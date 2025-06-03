// server.js
const express   = require('express');
const fileUpload = require('express-fileupload');
const axios     = require('axios');
const FormData  = require('form-data');
const cors      = require('cors');
const fs        = require('fs');
const path      = require('path');

const app = express();
const port = process.env.PORT || 3000;
const OCR_SPACE_API_KEY = 'K85155303888957';

// Garante que exista a pasta tmp/ para uploads
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

// Middlewares
app.use(cors());
app.use(express.json());

// Configura upload: limita 5MB e usa pasta tmp/ dentro do projeto
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: tmpDir
}));

// Serve todo conteúdo estático de public/ (HTML, CSS, JS, imagens...)
app.use(express.static(path.join(__dirname, 'public')));

// ===== ROTA 1: /api/ocr =====
app.post('/api/ocr', async (req, res) => {
  try {
    console.log('Iniciando OCR: req.files =', req.files);
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const tempPath = req.files.file.tempFilePath;
    console.log('Arquivo temporário enviado para OCR: ', tempPath);

    // Monta FormData para OCR.space
    const form = new FormData();
    form.append('apikey', OCR_SPACE_API_KEY);
    form.append('language', 'por');
    form.append('file', fs.createReadStream(tempPath));

    // Dispara requisição ao OCR.space
    const ocrRes = await axios.post('https://api.ocr.space/parse/image', form, {
      headers: form.getHeaders(),
      timeout: 60000
    });

    const body = ocrRes.data;
    console.log('Resposta OCR.space →', body);

    if (body.IsErroredOnProcessing) {
      // Se a API devolveu erro, mostre a mensagem dela
      const msg = Array.isArray(body.ErrorMessage)
                    ? body.ErrorMessage.join('; ')
                    : body.ErrorMessage;
      // Remove arquivo temporário antes de retornar
      fs.unlink(tempPath, () => {});
      return res.status(500).json({ error: msg });
    }

    // Concatena todo texto extraído
    const text = body.ParsedResults.map(r => r.ParsedText).join('\n');
    // Remove temporário
    fs.unlink(tempPath, () => {});
    return res.status(200).json({ text });
  } catch (err) {
    console.error('[OCR.space ERROR]', err);
    return res.status(500).json({
      error: 'Falha no OCR externo',
      details: err.message
    });
  }
});

// ===== ROTA 2: /api/validate =====
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

    console.log('Texto original:', original);
    console.log('Texto depois de limpar:', cleaned);

    const today = new Date();
    // Regex flexível para data (com ou sem zero à esquerda)
    const dia = today.getDate();
    const mes = today.getMonth() + 1;
    const ano = today.getFullYear();
    const dateRegex = new RegExp(`\\b0?${dia}\\s*\\/\\s*0?${mes}\\s*\\/\\s*${ano}\\b`);

    const hasRegistado = cleaned.includes('registado'); // verifique se a palavra está escrita exatamente assim
    const hasDate = dateRegex.test(cleaned);
    const hasObrigado = /\bobrigado\b/.test(cleaned);

    console.log('hasRegistado?', hasRegistado, '| hasDate?', hasDate, '| hasObrigado?', hasObrigado);

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

// ===== ROTAS DINÂMICAS para páginas sem .html =====
// Obs: agora, como app.use(express.static('public')) já serve index.html em ‘/’,
// este bloco normalmente só pega /outrapagina e serve outroHtml.
app.get('/:page', (req, res) => {
  const page = req.params.page;

  // Previne caminhos inválidos
  if (page.includes('..')) {
    return res.status(400).send('Bad Request');
  }

  const filePath = path.join(__dirname, 'public', `${page}.html`);
  console.log('Tentando servir arquivo:', filePath);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  return res.status(404).send('Página não encontrada');
});

// ===== INICIA SERVIDOR =====
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}/`);
});