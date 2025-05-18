const express = require('express');
const fileUpload = require('express-fileupload');
const { createWorker } = require('tesseract.js');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = 3000;

// Configuração aprimorada do fileUpload
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
  })
);

// Restante dos middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rotas dinâmicas para arquivos HTML
const htmlFiles = fs
  .readdirSync(__dirname + '/public')
  .filter((file) => file.endsWith('.html'))
  .map((file) => file.replace('.html', ''));

htmlFiles.forEach((route) => {
  // Foi necessário usar template literals com crases e construir a rota e o caminho corretamente.
  app.get(`/${route}`, (req, res) => {
    res.sendFile(`${__dirname}/public/${route}.html`);
  });
});

// OBSERVAÇÃO:
// O trecho abaixo com fetch não deve estar diretamente no código do servidor,
// pois trata-se de uma chamada que normalmente é feita do lado do cliente.
// await fetch('/api/ocr', {
//   method: 'POST',
//   body: formData
// });

// Rota OCR com tratamento de erro aprimorado
app.post('/api/ocr', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const worker = await createWorker({
      logger: (m) => console.log(m)
    });

    // Correção: carregar e inicializar o worker antes de processar a imagem
    await worker.load();
    await worker.loadLanguage('por');
    await worker.initialize('por');

    const {
      data: { text }
    } = await worker.recognize(req.files.file.tempFilePath);

    await worker.terminate();

    res.json({ text });
  } catch (error) {
    console.error('Erro no OCR:', error);
    res.status(500).json({ 
      error: 'Erro ao processar a imagem',
      details: error.message
    });
  }
});

// Rota de validação com melhor tratamento de data
// Rota de validação com fallback em "Obrigado"
app.post('/api/validate', (req, res) => {
  try {
    const { text } = req.body;
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(
      today.getMonth() + 1
    ).padStart(2, '0')}/${today.getFullYear()}`;

    // Lista de palavras a verificar obrigatoriamente
    const requiredWords = ['REGISTADO', formattedDate];

    // Primeiro, checa se todas as palavras obrigatórias estão presentes
    const hasAllRequired = requiredWords.every((w) => text.includes(w));

    // Se não tiver todas, verifica só "Obrigado"
    const isValid = hasAllRequired || text.includes('GANHE');

    // Monta a resposta
    if (isValid) {
      res.json({
        approved: true,
        guideLink:
          'https://www.mediafire.com/file/zvy5z1jdow995aj/10_Ferramentas_de_Apostas_online_para_iniciantes.pdf/file'
      });
    } else {
      res.json({
        approved: false,
        message:
          'Erro na validação. Verifique:\n' +
          '1. Se criou a conta pelo link fornecido\n' +
          '2. Tente criar de novo\n' +
          '3. Crie nova conta'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Erro na validação',
      details: error.message
    });
  }
});


app.listen(port, () => {
  // Correção: utilizar template literal para compor a mensagem com a variável port
  console.log(`Servidor rodando em http://localhost:${port}/index.html`);
});