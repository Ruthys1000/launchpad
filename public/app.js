/* ============================================================
   Launchpad — Client-side only (JSZip via CDN)
   ============================================================ */
(function () {
  'use strict';

  /* --- Elements --- */
  const dropZone      = document.getElementById('dropZone');
  const fileInput     = document.getElementById('fileInput');
  const fileBadge     = document.getElementById('fileBadge');
  const fileNameBadge = document.getElementById('fileNameBadge');
  const titleInput    = document.getElementById('titleInput');
  const processBtn    = document.getElementById('processBtn');
  const btnText       = document.getElementById('btnText');
  const btnSpinner    = document.getElementById('btnSpinner');
  const clearBtn      = document.getElementById('clearBtn');
  const modeResources = document.getElementById('modeResources');
  const modeScorm     = document.getElementById('modeScorm');

  const emptyState    = document.getElementById('emptyState');
  const progressBlock = document.getElementById('progressBlock');
  const resultBlock   = document.getElementById('resultBlock');
  const errorBlock    = document.getElementById('errorBlock');

  const step1         = document.getElementById('step1');
  const step2         = document.getElementById('step2');
  const step3         = document.getElementById('step3');
  const progressMsg   = document.getElementById('progressMessage');

  const resultDetails = document.getElementById('resultDetails');
  const downloadBtn   = document.getElementById('downloadBtn');
  const downloadBtn2  = document.getElementById('downloadBtn2');
  const resetBtn      = document.getElementById('resetBtn');
  const errorMsg      = document.getElementById('errorMessage');
  const errorResetBtn = document.getElementById('errorResetBtn');

  let currentFile = null;

  /* --- Mode selection --- */
  [modeResources, modeScorm].forEach(card => {
    card.addEventListener('click', () => {
      modeResources.classList.remove('selected');
      modeScorm.classList.remove('selected');
      card.classList.add('selected');
      card.querySelector('input[type=radio]').checked = true;
    });
  });

  /* --- File handling --- */
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
    fileNameBadge.textContent = file.name;
    fileBadge.classList.remove('hidden');
    if (!titleInput.value) titleInput.value = file.name.replace(/\.html?$/i, '');
    processBtn.disabled = false;
  }

  function clearAll() {
    currentFile = null;
    fileInput.value = '';
    titleInput.value = '';
    fileBadge.classList.add('hidden');
    processBtn.disabled = true;
    showState('empty');
  }

  fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
  clearBtn.addEventListener('click', clearAll);
  resetBtn.addEventListener('click', clearAll);
  errorResetBtn.addEventListener('click', clearAll);

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    setFile(e.dataTransfer.files[0]);
  });

  /* --- State management --- */
  function showState(state) {
    emptyState.classList.add('hidden');
    progressBlock.classList.add('hidden');
    resultBlock.classList.add('hidden');
    errorBlock.classList.add('hidden');
    if (state === 'empty')    emptyState.classList.remove('hidden');
    if (state === 'progress') progressBlock.classList.remove('hidden');
    if (state === 'result')   resultBlock.classList.remove('hidden');
    if (state === 'error')    errorBlock.classList.remove('hidden');
  }

  function setStep(n) {
    [step1, step2, step3].forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i + 1 < n)  s.classList.add('done');
      if (i + 1 === n) s.classList.add('active');
    });
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    showState('error');
  }

  /* --- Utilities --- */
  function readFileAsText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = e => res(e.target.result);
      r.onerror = () => rej(new Error('שגיאה בקריאת הקובץ'));
      r.readAsText(file, 'utf-8');
    });
  }

  function extFromMime(mime) {
    const m = { 'image/jpeg':'.jpg','image/png':'.png','image/gif':'.gif','image/webp':'.webp',
      'image/svg+xml':'.svg','video/mp4':'.mp4','video/webm':'.webm',
      'audio/mpeg':'.mp3','audio/ogg':'.ogg','audio/wav':'.wav',
      'text/css':'.css','application/javascript':'.js' };
    return m[mime.split(';')[0].trim()] || '';
  }

  function extFromUrl(url) {
    try { const m = new URL(url).pathname.match(/(\.[a-z0-9]{1,6})(\?|$)/i); return m ? m[1] : ''; }
    catch { return ''; }
  }

  function slugify(s) {
    return s.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g,'_').substring(0,40) || 'launchpad';
  }

  function escapeXml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s)));
    return d.innerHTML;
  }

  function buildManifest(slug, title) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.launchpad.${slug}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org_${slug}">
    <organization identifier="org_${slug}">
      <title>${escapeXml(title)}</title>
      <item identifier="item_${slug}" identifierref="res_${slug}">
        <title>${escapeXml(title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res_${slug}" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;
  }

  const SCORM_SHIM = `(function(){var d={};window.API={LMSInitialize:function(){return"true";},LMSFinish:function(){return"true";},LMSGetValue:function(k){return d[k]||"";},LMSSetValue:function(k,v){d[k]=v;return"true";},LMSCommit:function(){return"true";},LMSGetLastError:function(){return"0";},LMSGetErrorString:function(){return"";},LMSGetDiagnostic:function(){return"";}}})();`;

  async function tryFetch(url) {
    try {
      const r = await fetch(url, { mode: 'cors' });
      return r.ok ? await r.blob() : null;
    } catch { return null; }
  }

  /* --- Process --- */
  processBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const title = titleInput.value.trim() || currentFile.name.replace(/\.html?$/i, '');
    const mode  = document.querySelector('input[name=mode]:checked').value;

    btnText.textContent = 'מעבד...';
    btnSpinner.classList.remove('hidden');
    processBtn.disabled = true;
    showState('progress');
    setStep(1);
    progressMsg.textContent = 'קורא וניתוח HTML...';

    try {
      const htmlText = await readFileAsText(currentFile);
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');

      setStep(2);
      const ATTRS = [['img','src'],['video','src'],['audio','src'],['source','src'],
                     ['track','src'],['script','src'],['link','href']];
      const urlMap = {}, assets = {}, warnings = [];
      let cnt = 0;

      for (const [tag, attr] of ATTRS) {
        for (const el of doc.querySelectorAll(`${tag}[${attr}]`)) {
          const url = el.getAttribute(attr);
          if (!url || !/^https?:\/\//i.test(url)) continue;
          if (urlMap[url]) { el.setAttribute(attr, urlMap[url]); continue; }
          progressMsg.textContent = `מוריד נכס ${++cnt}…`;
          const blob = await tryFetch(url);
          if (blob) {
            const ext  = extFromMime(blob.type) || extFromUrl(url) || '';
            const path = `assets/asset_${cnt}${ext}`;
            assets[path] = blob;
            urlMap[url]  = path;
            el.setAttribute(attr, path);
          } else { warnings.push(url); }
        }
      }

      setStep(3);
      progressMsg.textContent = 'אורז חבילה...';

      const slug    = slugify(title);
      const final   = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      const zip     = new JSZip();

      if (mode === 'scorm') {
        zip.file('index.html',      final);
        zip.file('imsmanifest.xml', buildManifest(slug, title));
        zip.file('scorm_api.js',    SCORM_SHIM);
        for (const [p,b] of Object.entries(assets)) zip.file(p, b);
      } else {
        const f = zip.folder(slug);
        f.file('index.html', final);
        for (const [p,b] of Object.entries(assets)) f.file(p, b);
      }

      const zipBlob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' });
      const zipUrl  = URL.createObjectURL(zipBlob);
      const zipName = `${slug}.zip`;

      const modeLabel = mode === 'scorm' ? 'חבילת SCORM' : 'תיקיית משאבים';
      resultDetails.innerHTML =
        `<div><span>שם: </span><strong>${escapeHtml(title)}</strong></div>
         <div><span>מסלול: </span><strong>${modeLabel}</strong></div>
         <div><span>נכסים שנשמרו: </span><strong>${Object.keys(assets).length}</strong></div>
         ${warnings.length ? `<div style="color:var(--error)">⚠ ${warnings.length} נכס/ים לא הורדו (CORS)</div>` : ''}`;

      [downloadBtn, downloadBtn2].forEach(btn => {
        btn.href = zipUrl;
        btn.setAttribute('download', zipName);
        btn.style.display = '';
      });

      showState('result');
    } catch (err) {
      showError(err.message || 'אירעה שגיאה. נסה שוב.');
    } finally {
      btnText.textContent = 'פענח ▶';
      btnSpinner.classList.add('hidden');
      processBtn.disabled = false;
    }
  });

})();
