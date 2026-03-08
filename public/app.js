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

  const wfStep1  = document.getElementById('wfStep1');
  const wfStep2  = document.getElementById('wfStep2');
  const wfStep3  = document.getElementById('wfStep3');
  const wfLine1  = document.getElementById('wfLine1');
  const wfLine2  = document.getElementById('wfLine2');

  const ghDeploySection = document.getElementById('ghDeploySection');
  const ghToken         = document.getElementById('ghToken');
  const ghRepo          = document.getElementById('ghRepo');
  const deployBtn       = document.getElementById('deployBtn');
  const deployBtnText   = document.getElementById('deployBtnText');
  const deploySpinner   = document.getElementById('deploySpinner');
  const deployStatus    = document.getElementById('deployStatus');
  const deployResult    = document.getElementById('deployResult');
  const liveUrl         = document.getElementById('liveUrl');
  const copyUrl         = document.getElementById('copyUrl');

  let currentFile = null;
  let currentPageFiles = null; // flat files for GitHub Pages deployment

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
  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('label')) return; // label already opens dialog natively
    fileInput.click();
  });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    setFile(e.dataTransfer.files[0]);
  });

  // ---- State helpers ----
  function setWorkflowStep(n) {
    const steps = [wfStep1, wfStep2, wfStep3];
    const lines = [wfLine1, wfLine2];
    steps.forEach((s, i) => {
      s.classList.remove('wf-active', 'wf-done');
      if (i + 1 < n) s.classList.add('wf-done');
      if (i + 1 === n) s.classList.add('wf-active');
    });
    lines.forEach((l, i) => l.classList.toggle('wf-done', i + 1 < n));
  }

  function showCard(card) {
    [uploadCard, progressCard, resultCard, errorCard].forEach(c => c.classList.add('hidden'));
    card.classList.remove('hidden');
    if (card === uploadCard || card === errorCard) setWorkflowStep(1);
    else if (card === progressCard) setWorkflowStep(2);
    else if (card === resultCard) setWorkflowStep(3);
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

  // ---- GitHub Pages deploy button ----
  deployBtn.addEventListener('click', async () => {
    const token = ghToken.value.trim();
    const repoName = ghRepo.value.trim();

    if (!token) { deployStatus.textContent = 'נא להזין GitHub Token.'; deployStatus.classList.remove('hidden'); return; }
    if (!repoName) { deployStatus.textContent = 'נא להזין שם מאגר.'; deployStatus.classList.remove('hidden'); return; }
    if (!currentPageFiles) return;

    deployBtnText.textContent = 'מפרס...';
    deploySpinner.classList.remove('hidden');
    deployBtn.disabled = true;
    deployResult.classList.add('hidden');
    deployStatus.classList.remove('hidden');
    deployStatus.style.color = '';

    try {
      const url = await deployToGitHubPages(currentPageFiles, repoName, token, msg => {
        deployStatus.textContent = msg;
      });

      liveUrl.href = url;
      liveUrl.textContent = url;
      deployStatus.classList.add('hidden');
      deployResult.classList.remove('hidden');
    } catch (err) {
      deployStatus.textContent = '❌ ' + (err.message || 'שגיאה בפריסה');
      deployStatus.style.color = '#f97316';
    } finally {
      deployBtnText.textContent = 'שגר ל-GitHub Pages 🚀';
      deploySpinner.classList.add('hidden');
      deployBtn.disabled = false;
    }
  });

  // ---- Copy live URL ----
  copyUrl.addEventListener('click', () => {
    navigator.clipboard.writeText(liveUrl.href).then(() => {
      copyUrl.textContent = '✅';
      setTimeout(() => { copyUrl.textContent = '📋'; }, 1800);
    });
  });

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

  // ---- GitHub repo name sanitizer ----
  function githubRepoSlug(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100) || 'launchpad-content';
  }

  // ---- Base64 encoder for binary blobs (chunked to avoid stack overflow) ----
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  // ---- GitHub Pages deployment ----
  async function deployToGitHubPages(files, repoName, token, onProgress) {
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    // 1. Validate token & get username
    onProgress('מאמת חיבור ל-GitHub...');
    const userResp = await fetch('https://api.github.com/user', { headers });
    if (!userResp.ok) {
      throw new Error('טוקן GitHub לא תקין. בדוק שהטוקן נכון ושיש לו הרשאות public_repo.');
    }
    const user = await userResp.json();
    const owner = user.login;

    // 2. Create repository
    onProgress(`יוצר מאגר "${repoName}"...`);
    const createResp = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repoName,
        description: 'Deployed via Launchpad 🚀',
        private: false,
        auto_init: true,
      }),
    });
    if (!createResp.ok && createResp.status !== 422) {
      const errBody = await createResp.json().catch(() => ({}));
      throw new Error(`לא ניתן ליצור מאגר: ${errBody.message || createResp.status}`);
    }

    // Wait for GitHub to initialize the repo
    await new Promise(r => setTimeout(r, 1500));

    // 3. Upload files
    const fileEntries = Object.entries(files);
    for (let i = 0; i < fileEntries.length; i++) {
      const [path, content] = fileEntries[i];
      onProgress(`מעלה קבצים... ${i + 1}/${fileEntries.length}`);

      // Get SHA if file already exists (needed for update)
      let sha;
      const checkResp = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(path)}`,
        { headers }
      );
      if (checkResp.ok) {
        const existing = await checkResp.json();
        sha = existing.sha;
      }

      // Encode content as base64
      let base64;
      if (typeof content === 'string') {
        base64 = btoa(unescape(encodeURIComponent(content)));
      } else {
        const arr = content instanceof Blob ? await content.arrayBuffer() : content;
        base64 = arrayBufferToBase64(arr);
      }

      const uploadBody = { message: `Deploy ${path} via Launchpad`, content: base64 };
      if (sha) uploadBody.sha = sha;

      const uploadResp = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(path)}`,
        { method: 'PUT', headers, body: JSON.stringify(uploadBody) }
      );
      if (!uploadResp.ok) {
        const errBody = await uploadResp.json().catch(() => ({}));
        throw new Error(`שגיאה בהעלאת ${path}: ${errBody.message || uploadResp.status}`);
      }
    }

    // 4. Enable GitHub Pages
    onProgress('מפעיל GitHub Pages...');
    const pagesResp = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/pages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
      }
    );
    if (!pagesResp.ok && pagesResp.status !== 409 && pagesResp.status !== 422) {
      const getPagesResp = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/pages`,
        { headers }
      );
      if (!getPagesResp.ok) {
        throw new Error('לא ניתן להפעיל GitHub Pages. ודא שלטוקן יש הרשאת public_repo.');
      }
    }

    return `https://${owner}.github.io/${repoName}/`;
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
      <file href="scorm_api.js"/>
    </resource>
  </resources>
</manifest>`;
  }

  // ---- SCORM 1.2 shim with quiz scoring ----
  const SCORM_SHIM = `/* Launchpad SCORM 1.2 Scoring Shim */
(function(){
  'use strict';

  // 1. Find real LMS API (walk up parent frames), fallback to local stub
  function findApi() {
    var win = window, attempts = 0;
    while (win.parent && win.parent !== win && attempts++ < 7) {
      win = win.parent;
      if (win.API) return win.API;
    }
    var d = {};
    return {
      LMSInitialize:    function(){ return 'true'; },
      LMSFinish:        function(){ return 'true'; },
      LMSGetValue:      function(e){ return d[e] || ''; },
      LMSSetValue:      function(e,v){ d[e]=v; return 'true'; },
      LMSCommit:        function(){ return 'true'; },
      LMSGetLastError:  function(){ return '0'; },
      LMSGetErrorString:function(){ return ''; },
      LMSGetDiagnostic: function(){ return ''; }
    };
  }

  var api = findApi();
  var initialized = false;
  var reported    = false;

  function init() {
    if (initialized) return;
    api.LMSInitialize('');
    initialized = true;
  }

  // 2. Report score to LMS + show banner
  function reportScore(raw, correct, total) {
    if (reported) return;
    reported = true;
    init();
    api.LMSSetValue('cmi.core.score.raw',  String(raw));
    api.LMSSetValue('cmi.core.score.min',  '0');
    api.LMSSetValue('cmi.core.score.max',  '100');
    api.LMSSetValue('cmi.core.lesson_status', raw >= 60 ? 'passed' : 'failed');
    api.LMSCommit('');
    showBanner(raw, correct, total);
  }

  function reportComplete() {
    if (reported) return;
    reported = true;
    init();
    api.LMSSetValue('cmi.core.score.raw',  '100');
    api.LMSSetValue('cmi.core.score.min',  '0');
    api.LMSSetValue('cmi.core.score.max',  '100');
    api.LMSSetValue('cmi.core.lesson_status', 'passed');
    api.LMSCommit('');
  }

  // 3. Score banner
  function showBanner(score, correct, total) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;' +
      'background:#1e293b;color:#fff;padding:14px 26px;border-radius:14px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,.35);font-family:Arial,sans-serif;font-size:15px;' +
      'text-align:center;direction:rtl;min-width:260px;transition:opacity 1s;';
    var pass = score >= 60;
    el.innerHTML = (pass ? '🎉 <strong>עברת!</strong>' : '💪 <strong>כמעט...</strong>') +
      ' &nbsp;|&nbsp; ' + correct + '/' + total + ' נכונות' +
      ' &nbsp;|&nbsp; ציון: <strong>' + score + '</strong>';
    document.body.appendChild(el);
    setTimeout(function(){ el.style.opacity = '0'; setTimeout(function(){ el.remove(); }, 1000); }, 6000);
  }

  // 4. Quiz detection: radio inputs with value="correct" / value="wrong"
  window.addEventListener('load', function() {
    init();

    // Group radios by name attribute
    var groups = {};
    document.querySelectorAll('input[type="radio"]').forEach(function(r) {
      if (!groups[r.name]) groups[r.name] = { answered: false, correct: false };
      r.addEventListener('change', function() {
        groups[this.name].answered = true;
        groups[this.name].correct  = (this.value === 'correct');
        tryScore(groups);
      });
    });

    var hasQuiz = Object.keys(groups).length > 0;
    if (!hasQuiz) setupScrollFallback();
  });

  function tryScore(groups) {
    var names    = Object.keys(groups);
    var answered = names.filter(function(n){ return groups[n].answered; }).length;
    if (answered < names.length) return;          // not all answered yet
    var correct = names.filter(function(n){ return groups[n].correct; }).length;
    var score   = Math.round((correct / names.length) * 100);
    setTimeout(function(){ reportScore(score, correct, names.length); }, 400);
  }

  // 5. Fallback: scroll 90% = complete
  function setupScrollFallback() {
    var done = false;
    window.addEventListener('scroll', function() {
      if (done) return;
      var pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct >= 0.9) { done = true; reportComplete(); }
    });
  }

  window.addEventListener('beforeunload', function() {
    if (initialized) api.LMSFinish('');
  });
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
          const localPath = `asset_${counter}${ext}`;
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
      // Inject SCORM shim script tag into HTML
      let scormHtml = finalHtml;
      const shimTag = '\n<script src="scorm_api.js"><\/script>\n';
      if (scormHtml.includes('</head>')) {
        scormHtml = scormHtml.replace('</head>', shimTag + '</head>');
      } else if (scormHtml.includes('<body')) {
        scormHtml = scormHtml.replace(/<body(\s[^>]*)?>/, m => shimTag + m);
      } else {
        scormHtml = shimTag + scormHtml;
      }

      // SCORM: flat structure, manifest, shim
      zip.file('index.html',       scormHtml);
      zip.file('imsmanifest.xml',  buildManifest(slug, title));
      zip.file('scorm_api.js',     SCORM_SHIM);
      for (const [path, blob] of Object.entries(assets)) {
        zip.file(path, blob);
      }
    } else {
      // Resources: index.html + media files flat (no assets/ subfolder)
      const folder = zip.folder(slug);
      folder.file('index.html', finalHtml);
      for (const [filename, blob] of Object.entries(assets)) {
        folder.file(filename, blob);
      }
    }

    // Flat files for GitHub Pages deployment (resources mode)
    const pageFiles = { 'index.html': finalHtml };
    for (const [filename, blob] of Object.entries(assets)) {
      pageFiles[filename] = blob;
    }

    return {
      zip,
      pageFiles,
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
      const nextStep = mode === 'scorm'
        ? `<div class="next-step">📋 <strong>הצעד הבא:</strong> העלה את ה-ZIP למערכת ניהול הלמידה (קמפוס דיגיטלי)</div>`
        : `<div class="next-step">📋 <strong>הצעד הבא:</strong> הורד את ה-ZIP, או שגר ישירות ל-GitHub Pages באמצעות הכפתור למטה</div>`;
      resultDetails.innerHTML = `
        <div><span>שם התוצר: </span><strong>${escapeHtml(title)}</strong></div>
        <div><span>מסלול עיבוד: </span><strong>${modeLabel}</strong></div>
        <div><span>נכסים שנשמרו: </span><strong>${result.assetsCount}</strong></div>
        ${result.warnings.length
          ? `<div style="color:#f97316">⚠️ ${result.warnings.length} נכס/ים לא הורדו (CORS) — הקישורים נשמרו כמקוריים</div>`
          : ''}
        ${nextStep}
      `;

      downloadBtn.href = zipUrl;
      downloadBtn.setAttribute('download', `${result.slug}.zip`);

      // Show GitHub Pages option for resources mode only
      if (mode === 'resources') {
        currentPageFiles = result.pageFiles;
        ghRepo.value = githubRepoSlug(result.slug);
        deployResult.classList.add('hidden');
        deployStatus.classList.add('hidden');
        ghDeploySection.classList.remove('hidden');
      } else {
        currentPageFiles = null;
        ghDeploySection.classList.add('hidden');
      }

      showCard(resultCard);
    } catch (err) {
      showError(err.message || 'אירעה שגיאה בעיבוד הקובץ. נסה שוב.');
    } finally {
      btnText.textContent = 'עבד ⚙️';
      btnSpinner.classList.add('hidden');
      processBtn.disabled = false;
    }
  });
})();
