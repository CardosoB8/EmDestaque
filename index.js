// api/index.js
const serverless = require('serverless-http');
const express    = require('express');
const fileUpload = require('express-fileupload');
const axios      = require('axios');
const FormData   = require('form-data');
const cors       = require('cors');
const fs         = require('fs');
const path       = require('path');

const app = express();
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'K85155303888957';

// 1. Middlewares
app.use(cors());
app.use(express.json());

const tmpDir = path.join('/tmp', 'uploads');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: tmpDir
}));

// 2. Rotas de API
app.post('/api/ocr', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const tempPath = req.files.file.tempFilePath;
    if (!fs.existsSync(tempPath)) {
      return res.status(400).json({ error: 'Arquivo temporário não encontrado' });
    }

    const form = new FormData();
    form.append('apikey', OCR_SPACE_API_KEY);
    form.append('language', 'por');
    form.append('file', fs.createReadStream(tempPath));

    const ocrRes = await axios.post(
      'https://api.ocr.space/parse/image',
      form,
      { headers: form.getHeaders(), timeout: 60000 }
    );
    const body = ocrRes.data;

    if (body.IsErroredOnProcessing) {
      const msg = Array.isArray(body.ErrorMessage)
                  ? body.ErrorMessage.join('; ')
                  : body.ErrorMessage;
      fs.unlink(tempPath, () => {});
      return res.status(500).json({ error: msg });
    }

    const text = body.ParsedResults.map(r => r.ParsedText).join('\n');
    fs.unlink(tempPath, () => {});
    return res.status(200).json({ text });

  } catch (err) {
    console.error('[OCR.space ERROR]', err);
    if (req.files && req.files.file && req.files.file.tempFilePath) {
      fs.unlink(req.files.file.tempFilePath, () => {});
    }
    return res.status(500).json({
      error: 'Falha no OCR externo',
      details: err.message
    });
  }
});

app.post('/api/validate', (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto inválido para validação' });
    }

    const original = text;
    const cleaned = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const today = new Date();
    const dia = today.getDate();
    const mes = today.getMonth() + 1;
    const ano = today.getFullYear();
    const dateRegex = new RegExp(`\\b0?${dia}\\s*\\/\\s*0?${mes}\\s*\\/\\s*${ano}\\b`);

    const hasRegistado = cleaned.includes('registado');
    const hasDate     = dateRegex.test(cleaned);
    const hasObrigado = /\bobrigado\b/.test(cleaned);

    const approved = (hasRegistado && hasDate) || hasObrigado;

    if (approved) {
      return res.status(200).json({
        approved: true,
        message: 'Seu acesso: Nome: GoodBot Senha: 654321',
        guideLink: 'https://www.mediafire.com/file/c5xy3yuthu9oil1/SEO_HACKER_AVIATOR_1.0.apk/file'
      });
    } else {
      return res.status(401).json({
        approved: false,
        errors: [
          'Erro na validação. Verifique:',
          '1. Se criou a conta pelo link fornecido',
          '2. Tente criar de novo',
          '3. Crie nova conta'
        ],
        debug: { original, cleaned }
      });
    }

  } catch (err) {
    console.error('[VALIDATE ERROR]', err);
    return res.status(500).json({
      error: 'Erro interno na validação',
      details: err.message
    });
  }
});

// 3. Servir estáticos de public/
app.use(express.static(path.join(__dirname, '../public')));

// 4. Rota dinâmica para páginas sem .html
app.get('/:page', (req, res) => {
  const page = req.params.page;
  if (page.includes('..')) {
    return res.status(400).send('Bad Request');
  }
  const filePath = path.join(__dirname, '../public', `${page}.html`);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  } else {
    return res.status(404).send('Página não encontrada');
  }
});

// 5. Fallback 404
app.use((req, res) => {
  res.status(404).send('404 — Nada correspondido');
});

// 6. Exporta o handler em vez de app.listen
module.exports = serverless(app);