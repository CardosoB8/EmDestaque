// server.js
// Servidor Express completo com OCR.space e rotas dinâmicas sem extensão .html

const express = require('express');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Sua chave do OCR.space
const OCR_SPACE_API_KEY = 'K85155303888957';

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// --- OCR via OCR.space API ---
app.post('/api/ocr', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const form = new FormData();
    form.append('apikey', OCR_SPACE_API_KEY);
    form.append('language', 'por');
    form.append('file', fs.createReadStream(req.files.file.tempFilePath));

    const ocrRes = await axios.post('https://api.ocr.space/parse/image', form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });

    const body = ocrRes.data;
    if (body.IsErroredOnProcessing) {
      return res.status(500).json({ error: body.ErrorMessage.join('; ') });
    }

    const text = body.ParsedResults.map(r => r.ParsedText).join('\n');
    // opcional: limpar temp file
    fs.unlink(req.files.file.tempFilePath, () => {});

    return res.json({ text });
  } catch (err) {
    console.error('[OCR.space ERROR]', err);
    return res.status(500).json({ error: 'Falha no OCR externo', details: err.message });
  }
});

// --- Rota de validação (normalize, fallback Obrigado, debug) ---
app.post('/api/validate', (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto inválido para validação' });
    }

    const original = text;
    const cleaned = text
      .normalize('NFD')
      .replace(/[̀-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2,'0')}/` +
                          `${String(today.getMonth()+1).padStart(2,'0')}/` +
                          `${today.getFullYear()}`;

    const required = ['registado', formattedDate.toLowerCase()];
    const hasAllRequired = required.every(w => cleaned.includes(w));
    const hasObrigado = /\bobrigado\b/.test(cleaned);
    const approved = hasAllRequired || hasObrigado;

    if (approved) {
      return res.json({
        approved: true,
        guideLink: 'https://www.mediafire.com/file/zvy5z1jdow995aj/10_Ferramentas_de_Apostas_online_para_iniciantes.pdf/file'
      });
    } else {
      return res.json({
        approved: false,
        message: 'Erro na validação. Verifique:\n1. Se criou a conta pelo link fornecido\n2. Tente criar de novo\n3. Crie nova conta',
        debug: { original, cleaned }
      });
    }
  } catch (err) {
    console.error('[VALIDATE ERROR]', err);
    return res.status(500).json({ error: 'Erro interno na validação', details: err.message });
  }
});

// --- Rotas dinâmicas para servir páginas sem .html ---
app.get(['/', '/:page'], (req, res) => {
  let page = req.params.page || 'index';
  // prevenir acesso a caminhos fora de public
  if (page.includes('..')) return res.status(400).send('Bad Request');

  const filePath = path.join(__dirname, 'public', `${page}.html`);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  // se não existir, 404
  res.status(404).send('Página não encontrada');
});

// --- Iniciar servidor ---
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}/`);
});
