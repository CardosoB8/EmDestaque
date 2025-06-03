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
// Lembre-se: em produção, configure OCR_SPACE_API_KEY como uma variável de ambiente no Vercel.
// Remova a chave padrão 'K85155303888957' antes do deploy para produção.
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'K85155303888957'; 

// 1. Middlewares
app.use(cors());
app.use(express.json());

// Configuração para express-fileupload
// O diretório /tmp é o único gravável em ambientes serverless como Vercel
const tmpDir = path.join('/tmp', 'uploads');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB para o arquivo
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
    
    // Verificação adicional para garantir que o arquivo temporário existe
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
      { headers: form.getHeaders(), timeout: 60000 } // Timeout de 60 segundos
    );
    const body = ocrRes.data;

    if (body.IsErroredOnProcessing) {
      const msg = Array.isArray(body.ErrorMessage)
                  ? body.ErrorMessage.join('; ')
                  : body.ErrorMessage;
      fs.unlink(tempPath, () => {}); // Tenta limpar o arquivo temporário mesmo em caso de erro
      return res.status(500).json({ error: msg });
    }

    const text = body.ParsedResults.map(r => r.ParsedText).join('\n');
    fs.unlink(tempPath, () => {}); // Limpa o arquivo temporário após o sucesso
    return res.status(200).json({ text });

  } catch (err) {
    console.error('[OCR.space ERROR]', err);
    // Tenta limpar o arquivo temporário se um erro ocorrer durante o processo
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
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+/g, ' ') // Substitui múltiplos espaços por um único
      .trim()
      .toLowerCase();

    const today = new Date();
    const dia = today.getDate();
    const mes = today.getMonth() + 1; // getMonth() retorna 0-11
    const ano = today.getFullYear();
    // Regex para a data de hoje, com ou sem zero à esquerda
    const dateRegex = new RegExp(`\\b0?${dia}\\s*\\/\\s*0?${mes}\\s*\\/\\s*${ano}\\b`);

    const hasRegistado = cleaned.includes('registado');
    const hasDate      = dateRegex.test(cleaned);
    const hasObrigado = /\bobrigado\b/.test(cleaned);

    // Lógica de validação: 'registado' E (data de hoje OU 'obrigado')
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
        debug: { original, cleaned, hasRegistado, hasDate, hasObrigado, dateRegex: dateRegex.source } // Adicionado debug para ajudar a entender a validação
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

// 3. Servir estáticos de public/ (para CSS, JS, imagens, etc. que têm extensão)
// As páginas HTML sem extensão serão tratadas pelo vercel.json
app.use(express.static(path.join(__dirname, '../public')));

// 4. Fallback 404
// Este middleware deve ser o ÚLTIMO, para capturar qualquer requisição não tratada
app.use((req, res) => {
  // Se a requisição já foi tratada e os headers enviados, não faça nada
  if (res.headersSent) {
    return;
  }
  res.status(404).send('404 — Nada correspondido');
});

// 5. Exporta o handler para o Vercel
module.exports = serverless(app);