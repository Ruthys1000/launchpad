const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { parseAndExtractMedia } = require('./src/parser');
const { packageAsResources, packageAsSCORM } = require('./src/packager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure required directories exist
['uploads', 'output', 'temp'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer: accept only HTML files, max 10MB
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/html' || file.originalname.endsWith('.html')) {
      cb(null, true);
    } else {
      cb(new Error('Only HTML files are accepted'), false);
    }
  },
});

// POST /api/process — upload + process HTML
app.post('/api/process', upload.single('htmlFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No HTML file uploaded' });
  }

  const mode = req.body.mode || 'resources'; // 'resources' | 'scorm'
  const title = req.body.title || path.parse(req.file.originalname).name;
  const jobId = uuidv4();

  const uploadedPath = req.file.path;
  const htmlContent = fs.readFileSync(uploadedPath, 'utf-8');

  try {
    // Step 1: Parse HTML and download all media to temp directory
    const tempDir = path.join('temp', jobId);
    fs.mkdirSync(tempDir, { recursive: true });

    const { processedHtml, assets, warnings } = await parseAndExtractMedia(
      htmlContent,
      tempDir
    );

    // Step 2: Package according to requested mode
    const outputDir = path.join('output', jobId);
    fs.mkdirSync(outputDir, { recursive: true });

    let zipPath;
    if (mode === 'scorm') {
      zipPath = await packageAsSCORM({ processedHtml, assets, title, outputDir, jobId });
    } else {
      zipPath = await packageAsResources({ processedHtml, assets, title, outputDir, jobId });
    }

    // Cleanup uploaded file
    fs.unlinkSync(uploadedPath);

    const zipFilename = path.basename(zipPath);
    res.json({
      success: true,
      jobId,
      downloadUrl: `/api/download/${jobId}/${zipFilename}`,
      mode,
      title,
      assetsCount: assets.length,
      warnings,
    });
  } catch (err) {
    console.error('Processing error:', err);
    // Cleanup on failure
    try { fs.unlinkSync(uploadedPath); } catch {}
    res.status(500).json({ error: err.message || 'Processing failed' });
  }
});

// GET /api/download/:jobId/:filename
app.get('/api/download/:jobId/:filename', (req, res) => {
  const { jobId, filename } = req.params;
  // Sanitize to prevent path traversal
  const safeJobId = jobId.replace(/[^a-f0-9-]/gi, '');
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = path.join(__dirname, 'output', safeJobId, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, safeFilename, err => {
    if (err) console.error('Download error:', err);
  });
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`Launchpad server running on http://localhost:${PORT}`);
});
