/* ============================================================
   Launchpad — Client-side app logic
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

  // ---- Process ----
  processBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const title = titleInput.value.trim() || currentFile.name.replace(/\.html?$/i, '');
    const mode  = document.querySelector('input[name=mode]:checked').value;

    // Switch to progress
    btnText.textContent = 'מעבד...';
    btnSpinner.classList.remove('hidden');
    processBtn.disabled = true;
    showCard(progressCard);
    setStep(1);
    progressMsg.textContent = 'מנתח את קובץ ה-HTML...';

    // Simulate step progression while uploading
    const stepTimer1 = setTimeout(() => {
      setStep(2);
      progressMsg.textContent = 'מוריד ושומר נכסי מדיה...';
    }, 1200);
    const stepTimer2 = setTimeout(() => {
      setStep(3);
      progressMsg.textContent = 'אורז את החבילה הסופית...';
    }, 3000);

    try {
      const formData = new FormData();
      formData.append('htmlFile', currentFile);
      formData.append('title', title);
      formData.append('mode', mode);

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'שגיאה לא ידועה');
      }

      // Build result details
      const modeLabel = mode === 'scorm' ? 'חבילת SCORM' : 'תיקיית משאבים';
      resultDetails.innerHTML = `
        <div><span>שם התוצר: </span><strong>${escapeHtml(data.title)}</strong></div>
        <div><span>מסלול עיבוד: </span><strong>${modeLabel}</strong></div>
        <div><span>נכסים שהורדו: </span><strong>${data.assetsCount}</strong></div>
        ${data.warnings && data.warnings.length
          ? `<div style="color:var(--accent)">⚠️ ${data.warnings.length} קישור/ים לא הצליחו להיות מורדים</div>`
          : ''}
      `;

      downloadBtn.href = data.downloadUrl;
      downloadBtn.setAttribute('download', '');
      showCard(resultCard);
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      showError(err.message || 'אירעה שגיאה בעיבוד הקובץ. נסה שוב.');
    } finally {
      btnText.textContent = 'שגר 🚀';
      btnSpinner.classList.add('hidden');
      processBtn.disabled = false;
    }
  });

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }
})();
