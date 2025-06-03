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

// 1. Middlewares globais (sempre no início)
app.use(cors()); // Permite requisições de outras origens
app.use(express.json()); // Habilita o parsing de JSON no corpo das requisições

// Configuração para express-fileupload (para uploads de arquivos)
const tmpDir = path.join('/tmp', 'uploads'); // Diretório temporário gravável no Vercel
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  useTempFiles: true, // Usa arquivos temporários
  tempFileDir: tmpDir // Define o diretório temporário
}));

// --- 2. Rotas de API (as mais específicas, vêm antes dos estáticos) ---
// Rota para OCR
app.post('/api/ocr', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const tempPath = req.files.file.tempFilePath;
    
    if (!fs.existsSync(tempPath)) {
      return res.status(400).json({ error: 'Arquivo temporário não encontrado após upload.' });
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

// Rota para Validação
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
    const hasDate      = dateRegex.test(cleaned);
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
        debug: { original, cleaned, hasRegistado, hasDate, hasObrigado, dateRegex: dateRegex.source }
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

// --- 3. Servir arquivos estáticos (CSS, JS, imagens, HTML COM EXTENSÃO) ---
// Este middleware é responsável por servir TUDO da pasta 'public' que tenha um nome de arquivo explícito
// (incluindo extensões como .html, .css, .js, .png, .jpg, etc.).
// Ele deve vir DEPOIS das rotas de API, mas ANTES das rotas dinâmicas/catch-all para HTML sem extensão.
app.use(express.static(path.join(__dirname, '../public')));


// --- 4. Rota Específica para a Página Inicial (se /index.html existir e quiser servir como /) ---
// Esta rota é útil para garantir que 'public/index.html' seja servido quando a URL for apenas '/'
app.get('/', (req, res, next) => {
    const indexPath = path.join(__dirname, '../public', 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    next(); // Se não encontrar index.html, passa para o próximo middleware
});


// --- 5. Rota Dinâmica para Páginas HTML SEM .html (Ex: /sobre -> /public/sobre.html) ---
// Esta rota vem DEPOIS de `express.static` e da rota da página inicial,
// para não "engolir" os arquivos estáticos ou a rota da home.
app.get('/:page', (req, res, next) => {
  const page = req.params.page;

  // Segurança: Evitar "directory traversal" (acesso a arquivos fora do public)
  // E também evitar que essa rota genérica pegue URLs de API ou arquivos estáticos já tratados.
  if (page.includes('..') || page.includes('/') || page.startsWith('api') || page.includes('.')) { 
    return next(); // Se contiver barra, '..', começar com 'api' ou tiver uma extensão (.), passe para o próximo.
  }

  const filePath = path.join(__dirname, '../public', `${page}.html`);

  // Log para depuração (remova em produção)
  console.log(`[DEBUG - Server HTML] Tentando acessar: ${filePath}`);

  if (fs.existsSync(filePath)) {
    console.log(`[DEBUG - Server HTML] Arquivo encontrado: ${filePath}`);
    return res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`[ERROR - Server HTML] Erro ao enviar arquivo ${filePath}:`, err);
        if (!res.headersSent) {
          res.status(500).send('Erro interno do servidor ao servir página');
        }
      }
    });
  } else {
    // Se não encontrou o HTML, passe para o próximo middleware (o 404 handler)
    console.log(`[DEBUG - Server HTML] Arquivo NÃO encontrado para: /${page}.html`);
    next(); 
  }
});


// --- 6. Fallback para 404 ---
// Este middleware deve ser o ÚLTIMO na cadeia de rotas do Express.
app.use((req, res) => {
  if (res.headersSent) { // Previne erro se os headers já foram enviados por uma rota anterior
    return;
  }
  res.status(404).send('404 — Nada correspondido');
});

// 7. Exporta o handler para o Vercel
module.exports = serverless(app);