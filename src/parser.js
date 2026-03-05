/**
 * parser.js
 * Scans HTML for external media (img, video, audio, source, link),
 * downloads them to a local assets folder, and rewrites the HTML
 * with stable local paths.
 */

const cheerio = require('cheerio');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Maximum download size per asset: 50 MB
const MAX_ASSET_SIZE = 50 * 1024 * 1024;

// Attributes that may contain media URLs
const MEDIA_ATTRS = [
  { tag: 'img',    attr: 'src' },
  { tag: 'img',    attr: 'data-src' },
  { tag: 'video',  attr: 'src' },
  { tag: 'audio',  attr: 'src' },
  { tag: 'source', attr: 'src' },
  { tag: 'source', attr: 'srcset' },
  { tag: 'track',  attr: 'src' },
  { tag: 'link',   attr: 'href' },   // CSS stylesheets
  { tag: 'script', attr: 'src' },    // External scripts
];

// Mime-type → extension fallback map
const MIME_EXT = {
  'image/jpeg':      '.jpg',
  'image/png':       '.png',
  'image/gif':       '.gif',
  'image/webp':      '.webp',
  'image/svg+xml':   '.svg',
  'video/mp4':       '.mp4',
  'video/webm':      '.webm',
  'audio/mpeg':      '.mp3',
  'audio/ogg':       '.ogg',
  'audio/wav':       '.wav',
  'text/css':        '.css',
  'application/javascript': '.js',
  'text/javascript': '.js',
};

/**
 * Determines if a URL is external (should be downloaded).
 */
function isExternalUrl(url) {
  if (!url || typeof url !== 'string') return false;
  url = url.trim();
  if (url.startsWith('data:')) return false;          // inline data URI
  if (url.startsWith('blob:')) return false;           // blob URL
  if (url.startsWith('#'))     return false;           // anchor
  if (url.startsWith('javascript:')) return false;     // js pseudo-URL
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
}

/**
 * Returns the file extension to use for a downloaded asset.
 */
function resolveExtension(url, contentType) {
  // Try from Content-Type header
  if (contentType) {
    const mime = contentType.split(';')[0].trim().toLowerCase();
    if (MIME_EXT[mime]) return MIME_EXT[mime];
  }
  // Try from URL path
  try {
    const parsed = new URL(url.startsWith('//') ? 'https:' + url : url);
    const ext = path.extname(parsed.pathname);
    if (ext && ext.length <= 5) return ext;
  } catch {}
  return '';
}

/**
 * Downloads a single URL to the assets directory.
 * Returns the local relative path (e.g. "assets/abc123.jpg").
 */
async function downloadAsset(url, assetsDir, warnings) {
  const absoluteUrl = url.startsWith('//') ? 'https:' + url : url;

  try {
    const response = await axios.get(absoluteUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: MAX_ASSET_SIZE,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Launchpad/1.0)',
      },
    });

    const contentType = response.headers['content-type'] || '';
    const ext = resolveExtension(absoluteUrl, contentType);
    const filename = uuidv4() + ext;
    const localPath = path.join(assetsDir, filename);

    fs.writeFileSync(localPath, Buffer.from(response.data));
    return { filename, relativePath: `assets/${filename}`, contentType };
  } catch (err) {
    const msg = `Failed to download ${absoluteUrl}: ${err.message}`;
    warnings.push(msg);
    console.warn(msg);
    return null;
  }
}

/**
 * Handles srcset attribute (comma-separated list of "url [descriptor]").
 */
async function processSrcset(srcset, assetsDir, urlMap, warnings) {
  const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
  const newParts = [];

  for (const part of parts) {
    const [url, descriptor] = part.split(/\s+/);
    if (isExternalUrl(url)) {
      if (!urlMap.has(url)) {
        const result = await downloadAsset(url, assetsDir, warnings);
        urlMap.set(url, result ? result.relativePath : url);
      }
      const localPath = urlMap.get(url);
      newParts.push(descriptor ? `${localPath} ${descriptor}` : localPath);
    } else {
      newParts.push(part);
    }
  }

  return newParts.join(', ');
}

/**
 * Main export: parse HTML, download all external media, rewrite links.
 *
 * @param {string} htmlContent   Raw HTML string
 * @param {string} tempDir       Writable temp directory for this job
 * @returns {{ processedHtml: string, assets: Array, warnings: Array }}
 */
async function parseAndExtractMedia(htmlContent, tempDir) {
  const assetsDir = path.join(tempDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const $ = cheerio.load(htmlContent, { decodeEntities: false });
  const urlMap = new Map();   // original URL → local relative path
  const warnings = [];

  // --- Process standard media attributes ---
  for (const { tag, attr } of MEDIA_ATTRS) {
    const elements = $(tag).toArray();
    for (const el of elements) {
      const val = $(el).attr(attr);
      if (!val) continue;

      if (attr === 'srcset') {
        const newSrcset = await processSrcset(val, assetsDir, urlMap, warnings);
        $(el).attr(attr, newSrcset);
      } else if (isExternalUrl(val)) {
        if (!urlMap.has(val)) {
          const result = await downloadAsset(val, assetsDir, warnings);
          urlMap.set(val, result ? result.relativePath : val);
        }
        $(el).attr(attr, urlMap.get(val));
      }
    }
  }

  // --- Process inline CSS: url("...") and url('...') ---
  $('[style]').each((_, el) => {
    const style = $(el).attr('style');
    if (style) {
      $(el).attr('style', style); // will be rewritten below after download
    }
  });

  // --- Process <style> blocks for url() references ---
  // (synchronous regex pass after async downloads above)
  const cssUrlPattern = /url\(\s*['"]?(https?:\/\/[^'"\)]+)['"]?\s*\)/g;

  // Collect all CSS urls first for downloading
  const allHtml = $.html();
  const cssUrls = new Set();
  let m;
  const re = new RegExp(cssUrlPattern.source, 'g');
  while ((m = re.exec(allHtml)) !== null) {
    if (isExternalUrl(m[1])) cssUrls.add(m[1]);
  }

  for (const cssUrl of cssUrls) {
    if (!urlMap.has(cssUrl)) {
      const result = await downloadAsset(cssUrl, assetsDir, warnings);
      urlMap.set(cssUrl, result ? result.relativePath : cssUrl);
    }
  }

  // Rewrite all CSS url() occurrences in the final HTML
  let finalHtml = $.html();
  for (const [original, local] of urlMap.entries()) {
    // Only rewrite if it appears in CSS url() context too
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    finalHtml = finalHtml.replace(
      new RegExp(`url\\(\\s*(['"]?)${escaped}\\1\\s*\\)`, 'g'),
      `url('${local}')`
    );
  }

  // Build asset manifest
  const assets = [];
  for (const [original, localPath] of urlMap.entries()) {
    if (localPath !== original) {
      const fullPath = path.join(tempDir, localPath);
      const size = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
      assets.push({ original, localPath, size });
    }
  }

  return { processedHtml: finalHtml, assets, warnings };
}

module.exports = { parseAndExtractMedia };
