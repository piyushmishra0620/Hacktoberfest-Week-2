require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { extractText } = require('./extract');
const { analyzeResume, checkOllama } = require('./ollama');
const { findJobs } = require('./jobs');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => res.json(await checkOllama()));

app.post('/api/analyze', upload.single('resume'), async (req, res, next) => {
  try {
    const role = (req.body.role || '').trim();
    if (!req.file) return res.status(400).json({ error: 'Please upload your resume.' });
    if (!role) return res.status(400).json({ error: 'Please enter the role you are applying for.' });

    const text = await extractText(req.file);
    const analysis = await analyzeResume(text, role);
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

app.post('/api/jobs', async (req, res, next) => {
  try {
    const { role, skills, keywords } = req.body;
    if (!role) return res.status(400).json({ error: 'Role is required.' });
    res.json(await findJobs({ role, skills: skills || [], keywords: keywords || [] }));
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is larger than 5 MB.' });
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`MatchForge API on http://localhost:${PORT}`));
