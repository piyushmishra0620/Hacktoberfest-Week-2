const path = require('path');
const pdfParse = require('pdf-parse/lib/pdf-parse.js'); // direct path avoids pdf-parse's debug-mode bug
const mammoth = require('mammoth');

async function extractText(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  let text = '';

  if (ext === '.pdf' || file.mimetype === 'application/pdf') {
    text = (await pdfParse(file.buffer)).text;
  } else if (ext === '.docx') {
    text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
  } else if (ext === '.txt' || file.mimetype === 'text/plain') {
    text = file.buffer.toString('utf8');
  } else {
    const err = new Error('Unsupported file type. Upload a PDF, DOCX or TXT file.');
    err.status = 400;
    throw err;
  }

  text = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  if (text.length < 150) {
    const err = new Error(
      'Could not read enough text from this file. If it is a scanned PDF/image, export a text-based PDF instead.'
    );
    err.status = 422;
    throw err;
  }
  return text;
}

module.exports = { extractText };
