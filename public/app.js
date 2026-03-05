/* ============================================================
   Launchpad — Client-side only (no server required)
   Uses JSZip (loaded via CDN in index.html)
   ============================================================ */
(function () {
  'use strict';

  // Elements
  const dropZone      = document.getElementById('dropZone');
  const fileInput     = document.getElementById('fileInput');
  const selectedFile  = document.getElementById('selectedFile');
  const fileName      = document.getElementById('fileName');
  const clearFile     = document.getElementById('clearFile');
  const titleInput    = document.getElementById('titleInput');
  const processBtn    = document.getElementById('processBtn');
  const btnText       = document.getElementById('btnText');
  const btnSpinner    = document.getElementById('btnSpinner');

  const uploadCard    = document.getElementById('uploadCard');
  const progressCard  = document.getElementById('progressCard');
  const resultCard    = document.getElementById('resultCard');
  const errorCard     = document.getElementById('errorCard');

  const step1         = document.getElementById('step1');
  const step2         = document.getElementById('step2');
  const step3         = document.getElementById('step3');
  const progressMsg   = document.getElementById('progressMessage');

  const resultDetails = document.getElementById('resultDetails');
  const downloadBtn   = document.getElementById('downloadBtn');
  const resetBtn      = document.getElementById('resetBtn');
  const errorMessage  = document.getElementById('errorMessage');
  const errorResetBtn = document.getElementById('errorResetBtn');
  const modeCards     = document.querySelectorAll('.mode-card');

  let currentFile = null;

  // ---- Mode card selection ----
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input[type=radio]').checked = true;
    });
  });

  // ---- File handling ----
  function setFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.html') && file.type !== 'text/html') {
      showError('יש להעלות קובץ HTML בלבד.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('גודל הקובץ חורג מ-10 MB.');
      return;
    }
    currentFile = file;
    fileName.textContent = file.name;
    selectedFile.classList.remove('hidden');
    dropZone.classList.add('hidden');
    if (!titleInput.value) {
      titleInput.value = file.name.replace(/\.html?$/i, '');
    }
    processBtn.disabled = false;
  }

  function clearSelection() {
    currentFile = null;
    fileInput.value = '';
    selectedFile.classList.add('hidden');
    dropZone.classList.remove('hidden');
    processBtn.disabled = true;
  }

  fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
  clearFile.addEventListener('click', clearSelection);

  // Drop zone
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    setFile(e.dataTransfer.files[0]);
  });

  // ---- State helpers ----
  function showCard(card) {
    [uploadCard, progressCard, resultCard, errorCard].forEach(c => c.classList.add('hidden'));
    card.classList.remove('hidden');
  }

  function setStep(n) {
    const steps = [step1, step2, step3];
    steps.forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i + 1 < n) s.classList.add('done');
      if (i + 1 === n) s.classList.add('active');
    });
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    showCard(errorCard);
  }

  function reset() {
    clearSelection();
    titleInput.value = '';
    showCard(uploadCard);
  }

  resetBtn.addEventListener('click', reset);
  errorResetBtn.addEventListener('click', reset);

  // ---- Utilities ----
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
      reader.readAsText(file, 'utf-8');
    });
  }

  function extFromMime(mime) {
    const map = {
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
      'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif',
      'video/mp4': '.mp4', 'video/webm': '.webm',
      'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
      'application/javascript': '.js', 'text/css': '.css',
    };
    return map[mime.split(';')[0].trim()] || '';
  }

  function extFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      const m = pathname.match(/(\.[a-z0-9]{1,6})(\?|$)/i);
      return m ? m[1] : '';
    } catch { return ''; }
  }

  function slugify(str) {
    return str.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_').substring(0, 40) || 'launchpad_output';
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- SCORM 1.2 manifest ----
  function buildManifest(slug, title) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.launchpad.${slug}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org_${slug}">
    <organization identifier="org_${slug}">
      <title>${escapeXml(title)}</title>
      <item identifier="item_${slug}" identifierref="res_${slug}">
        <title>${escapeXml(title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res_${slug}" type="webcontent"
      adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;
  }

  // ---- Minimal SCORM 1.2 API shim ----
  const SCORM_SHIM = `/* Launchpad SCORM 1.2 API Shim */
(function(){
  var _data = {};
  window.API = {
    LMSInitialize:   function(){ return "true"; },
    LMSFinish:       function(){ return "true"; },
    LMSGetValue:     function(e){ return _data[e] || ""; },
    LMSSetValue:     function(e,v){ _data[e]=v; return "true"; },
    LMSCommit:       function(){ return "true"; },
    LMSGetLastError: function(){ return "0"; },
    LMSGetErrorString: function(){ return ""; },
    LMSGetDiagnostic:  function(){ return ""; }
  };
})();`;

  // ---- Asset downloader ----
  async function tryFetchAsset(url) {
    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) return null;
      return await resp.blob();
    } catch {
      return null;
    }
  }

  // ---- Main processing ----
  async function processHTML(htmlText, title, mode) {
    // Step 1 — parse
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Step 2 — collect & download external assets
    const SELECTORS = [
      ['img',    'src'],
      ['video',  'src'],
      ['audio',  'src'],
      ['source', 'src'],
      ['track',  'src'],
      ['script', 'src'],
      ['link',   'href'],
    ];

    const urlMap  = {}; // original url -> local path
    const assets  = {}; // local path -> Blob
    const warnings = [];
    let counter = 0;

    for (const [tag, attr] of SELECTORS) {
      const elements = doc.querySelectorAll(`${tag}[${attr}]`);
      for (const el of elements) {
        const url = el.getAttribute(attr);
        if (!url || !/^https?:\/\//i.test(url)) continue;

        if (urlMap[url]) {
          el.setAttribute(attr, urlMap[url]);
          continue;
        }

        progressMsg.textContent = `מוריד נכס ${++counter}…`;
        const blob = await tryFetchAsset(url);

        if (blob) {
          const ext = extFromMime(blob.type) || extFromUrl(url) || '';
          const localPath = `assets/asset_${counter}${ext}`;
          assets[localPath] = blob;
          urlMap[url] = localPath;
          el.setAttribute(attr, localPath);
        } else {
          warnings.push(url);
        }
      }
    }

    // Step 3 — package
    const slug    = slugify(title);
    const finalHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    const zip = new JSZip();

    if (mode === 'scorm') {
      // SCORM: flat structure, manifest, shim
      zip.file('index.html',       finalHtml);
      zip.file('imsmanifest.xml',  buildManifest(slug, title));
      zip.file('scorm_api.js',     SCORM_SHIM);
      for (const [path, blob] of Object.entries(assets)) {
        zip.file(path, blob);
      }
    } else {
      // Resources: folder with index.html + assets/
      const folder = zip.folder(slug);
      folder.file('index.html', finalHtml);
      for (const [path, blob] of Object.entries(assets)) {
        folder.file(path, blob);
      }
    }

    return {
      zip,
      slug,
      assetsCount: Object.keys(assets).length,
      warnings,
    };
  }

  // ---- Button handler ----
  processBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const title = titleInput.value.trim() || currentFile.name.replace(/\.html?$/i, '');
    const mode  = document.querySelector('input[name=mode]:checked').value;

    btnText.textContent = 'מעבד...';
    btnSpinner.classList.remove('hidden');
    processBtn.disabled = true;
    showCard(progressCard);
    setStep(1);
    progressMsg.textContent = 'קורא את קובץ ה-HTML…';

    try {
      const htmlText = await readFileAsText(currentFile);

      setStep(2);
      progressMsg.textContent = 'מוריד נכסי מדיה…';

      const result = await processHTML(htmlText, title, mode);

      setStep(3);
      progressMsg.textContent = 'אורז את החבילה…';

      const zipBlob = await result.zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const zipUrl  = URL.createObjectURL(zipBlob);

      const modeLabel = mode === 'scorm' ? 'חבילת SCORM' : 'תיקיית משאבים';
      resultDetails.innerHTML = `
        <div><span>שם התוצר: </span><strong>${escapeHtml(title)}</strong></div>
        <div><span>מסלול עיבוד: </span><strong>${modeLabel}</strong></div>
        <div><span>נכסים שנשמרו: </span><strong>${result.assetsCount}</strong></div>
        ${result.warnings.length
          ? `<div style="color:var(--accent)">⚠️ ${result.warnings.length} נכס/ים לא הורדו (CORS) — הקישורים נשמרו כמקוריים</div>`
          : ''}
      `;

      downloadBtn.href = zipUrl;
      downloadBtn.setAttribute('download', `${result.slug}.zip`);
      showCard(resultCard);
    } catch (err) {
      showError(err.message || 'אירעה שגיאה בעיבוד הקובץ. נסה שוב.');
    } finally {
      btnText.textContent = 'שגר 🚀';
      btnSpinner.classList.add('hidden');
      processBtn.disabled = false;
    }
  });
})();
