import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// Proxy API vers Google Sheets
app.all('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  
  if (!targetUrl) {
    console.error('PROXY ERREUR: URL manquante.');
    return res.status(400).json({ error: 'URL cible manquante' });
  }
  
  console.log(`PROXY [${req.method}]: Relais vers`, targetUrl);
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json' 
      },
      timeout: 65000,
      maxRedirects: 5 // Crucial: Google Apps Script Web Apps always redirect 302
    });

    const contentType = String(response.headers['content-type'] || 'application/json');
    res.setHeader('Content-Type', contentType);
    
    if (typeof response.data === 'string') {
      return res.status(response.status).send(response.data);
    }
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('PROXY ERREUR:', error.message);
    if (error.response) {
      console.error('PROXY STATUS:', error.response.status);
      const ct = String(error.response.headers['content-type'] || 'text/html');
      res.setHeader('Content-Type', ct);
      if (typeof error.response.data === 'string') {
        return res.status(error.response.status).send(error.response.data);
      }
      return res.status(error.response.status).json(error.response.data);
    }
    const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(error.message);
    return res.status(isTimeout ? 504 : 500).json({ 
      error: isTimeout 
        ? 'Délai d\'attente dépassé (65s) lors de la communication avec Google Apps Script.' 
        : error.message 
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'));

  if (isProd) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa'
    });
    
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let indexHtml = fs.readFileSync(indexPath, 'utf-8');
        const template = await vite.transformIndexHtml(req.originalUrl, indexHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });
}

startServer();
