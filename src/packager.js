/**
 * packager.js
 * Two packaging modes:
 *   1. packageAsResources — clean ZIP: index.html + assets/ folder
 *   2. packageAsSCORM     — SCORM 1.2 compliant ZIP with imsmanifest.xml
 *                           and SCORM API wrapper for LMS integration
 */

const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helper: create a ZIP archive from files in outputDir
// ---------------------------------------------------------------------------
function createZip(zipPath, files) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);
    archive.pipe(output);

    for (const { diskPath, zipName } of files) {
      if (fs.existsSync(diskPath)) {
        archive.file(diskPath, { name: zipName });
      }
    }

    archive.finalize();
  });
}

// ---------------------------------------------------------------------------
// Mode 1: Resources package
//   ZIP layout:
//     index.html
//     assets/
//       image1.jpg
//       video1.mp4
//       ...
// ---------------------------------------------------------------------------
async function packageAsResources({ processedHtml, assets, title, outputDir, jobId, tempDir: providedTempDir }) {
  const tempDir = providedTempDir || path.join('temp', jobId);
  const htmlPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(htmlPath, processedHtml, 'utf-8');

  const files = [{ diskPath: htmlPath, zipName: 'index.html' }];

  for (const asset of assets) {
    const diskPath = path.join(tempDir, asset.localPath);
    files.push({ diskPath, zipName: asset.localPath });
  }

  const safeName = title.replace(/[^a-zA-Z0-9\u0590-\u05FF\s_-]/g, '').trim().replace(/\s+/g, '_');
  const zipPath = path.join(outputDir, `${safeName}_resources.zip`);
  await createZip(zipPath, files);
  return zipPath;
}

// ---------------------------------------------------------------------------
// Mode 2: SCORM 1.2 package
//   ZIP layout:
//     imsmanifest.xml
//     index.html          (original content wrapped with SCORM shim)
//     scorm_api.js        (lightweight SCORM 1.2 API shim)
//     assets/
//       ...
// ---------------------------------------------------------------------------

// SCORM 1.2 API shim injected into the content page
const SCORM_API_JS = `
// Launchpad SCORM 1.2 API Shim
// Communicates with the LMS via window.parent / window.top
(function () {
  'use strict';

  var _initialized = false;
  var _finished = false;
  var _data = {};

  function findAPI(win) {
    var attempts = 0;
    while (win.API == null && win.parent != null && win.parent != win) {
      attempts++;
      if (attempts > 7) return null;
      win = win.parent;
    }
    return win.API || null;
  }

  var API = findAPI(window);

  function lmsCall(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (API && typeof API[fn] === 'function') {
      return API[fn].apply(API, args);
    }
    return '';
  }

  window.SCORM = {
    initialize: function () {
      if (_initialized) return true;
      var result = lmsCall('LMSInitialize', '');
      _initialized = (result === 'true' || result === true);
      return _initialized;
    },

    setValue: function (element, value) {
      if (!_initialized) this.initialize();
      return lmsCall('LMSSetValue', element, value);
    },

    getValue: function (element) {
      if (!_initialized) this.initialize();
      return lmsCall('LMSGetValue', element);
    },

    commit: function () {
      return lmsCall('LMSCommit', '');
    },

    finish: function () {
      if (_finished) return true;
      this.setValue('cmi.core.lesson_status', 'completed');
      this.commit();
      _finished = true;
      return lmsCall('LMSFinish', '');
    },

    setScore: function (score, min, max) {
      min = min != null ? min : 0;
      max = max != null ? max : 100;
      this.setValue('cmi.core.score.raw', score);
      this.setValue('cmi.core.score.min', min);
      this.setValue('cmi.core.score.max', max);
    },

    setCompleted: function () {
      this.setValue('cmi.core.lesson_status', 'completed');
      this.commit();
    },

    setPassed: function (score) {
      if (score != null) this.setScore(score);
      this.setValue('cmi.core.lesson_status', 'passed');
      this.commit();
    }
  };

  // Auto-initialize on load and auto-finish on unload
  window.addEventListener('load', function () {
    window.SCORM.initialize();
  });

  window.addEventListener('beforeunload', function () {
    window.SCORM.finish();
  });

  // Expose simple helpers on window for content authors
  window.scormSetCompleted = function () { window.SCORM.setCompleted(); };
  window.scormSetPassed    = function (s) { window.SCORM.setPassed(s); };
  window.scormSetScore     = function (s, min, max) { window.SCORM.setScore(s, min, max); };
})();
`;

function buildImsManifest(title, jobId) {
  const identifier = `LAUNCHPAD_${jobId.replace(/-/g, '').substring(0, 16).toUpperCase()}`;
  const now = new Date().toISOString().split('T')[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2
    imscp_rootv1p1p2.xsd
    http://www.adlnet.org/xsd/adlcp_rootv1p2
    adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>

  <organizations default="ORG_${identifier}">
    <organization identifier="ORG_${identifier}">
      <title>${escapeXml(title)}</title>
      <item identifier="ITEM_${identifier}" identifierref="RES_${identifier}">
        <title>${escapeXml(title)}</title>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="RES_${identifier}" type="webcontent"
      adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="scorm_api.js"/>
    </resource>
  </resources>

</manifest>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Inject the SCORM API shim <script> tag into the <head> of the HTML.
 */
function injectScormScript(html) {
  const shim = '\n<script src="scorm_api.js"></script>\n';
  if (html.includes('</head>')) {
    return html.replace('</head>', `${shim}</head>`);
  }
  if (html.includes('<body')) {
    return html.replace(/<body(\s[^>]*)?>/, match => `${shim}${match}`);
  }
  return shim + html;
}

async function packageAsSCORM({ processedHtml, assets, title, outputDir, jobId, tempDir: providedTempDir }) {
  const tempDir = providedTempDir || path.join('temp', jobId);

  // Inject SCORM shim into HTML
  const scormHtml = injectScormScript(processedHtml);
  const htmlPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(htmlPath, scormHtml, 'utf-8');

  // Write SCORM API JS
  const apiPath = path.join(outputDir, 'scorm_api.js');
  fs.writeFileSync(apiPath, SCORM_API_JS, 'utf-8');

  // Write IMS manifest
  const manifestContent = buildImsManifest(title, jobId);
  const manifestPath = path.join(outputDir, 'imsmanifest.xml');
  fs.writeFileSync(manifestPath, manifestContent, 'utf-8');

  // Build file list for ZIP
  const files = [
    { diskPath: manifestPath, zipName: 'imsmanifest.xml' },
    { diskPath: htmlPath,     zipName: 'index.html' },
    { diskPath: apiPath,      zipName: 'scorm_api.js' },
  ];

  for (const asset of assets) {
    const diskPath = path.join(tempDir, asset.localPath);
    files.push({ diskPath, zipName: asset.localPath });
  }

  const safeName = title.replace(/[^a-zA-Z0-9\u0590-\u05FF\s_-]/g, '').trim().replace(/\s+/g, '_');
  const zipPath = path.join(outputDir, `${safeName}_scorm.zip`);
  await createZip(zipPath, files);
  return zipPath;
}

module.exports = { packageAsResources, packageAsSCORM };
