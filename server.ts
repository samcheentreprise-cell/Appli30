import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const app = express();
const port = Number(process.env.PORT) || 3000;
console.log(`[startup] Server configured on port ${port}`);

app.use(express.json());

// Configuration Google Apps Script
const SHEET_URL = process.env.VITE_GSHEET_WEBAPP_URL
  || 'https://script.google.com/macros/s/AKfycbzdSJH0MVF3KFaZnMy9zJstg3fLbcJQpeWSUs72w4EnVsLM_Z0HnEHRlMI_6Lbx6X4L/exec';
const SHEET_TOKEN = process.env.VITE_GSHEET_API_TOKEN || 'samche_2023_1972KlaBgni2';

// Helper : appel GET à Google Apps Script
async function callGas(action: string, extraParams: Record<string, string> = {}) {
  const params = new URLSearchParams({ action, token: SHEET_TOKEN, ...extraParams });
  const url = `${SHEET_URL}?${params.toString()}`;
  const response = await axios.get(url, {
    maxRedirects: 5,
    timeout: 15000,
  });
  return response.data;
}

// ============================================================
// Route d'authentification (mode permissif — à remplacer plus tard)
// ============================================================
app.post('/api/auth', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Nom d\'utilisateur et mot de passe requis',
    });
  }

  try {
    // Étape 1 : récupérer la liste des utilisateurs
    const params = new URLSearchParams({
      action: 'utilisateurs.lister',
      token: SHEET_TOKEN,
    });
    const url = `${SHEET_URL}?${params.toString()}`;
    const response = await axios.get(url, { maxRedirects: 5, timeout: 15000 });
    const result = response.data;

    const users = result?.data;
    if (!Array.isArray(users)) {
      throw new Error('Format invalide : pas de tableau "data"');
    }

    // Étape 2 : trouver l'utilisateur par username
    const user = users.find((u: any) => u.username === username);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur introuvable',
      });
    }

    // Étape 3 : mode permissif — accepter tout mot de passe non vide
    // ⚠️ TEMPORAIRE : à remplacer par utilisateurs.authentifier quand vous
    // aurez vérifié les vrais mots de passe dans la feuille Google Sheets
    return res.json({
      success: true,
      role: user.role,
      username: user.username,
      ligne: user.ligne,
    });
  } catch (error: any) {
    console.error('[AUTH ERROR]', error?.response?.status, error?.message);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification',
      details: error?.message,
    });
  }
});

// ============================================================
// Proxy GAS — GET uniquement (POST ne marche pas avec GAS)
// ============================================================
app.get('/api/gas', async (req, res) => {
  const action = req.query.action as string;

  if (!action) {
    return res.status(400).json({ error: 'Action manquante' });
  }

  // Transmettre tous les autres query params (username, password, etc.)
  const extraParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'action') continue;
    if (typeof value === 'string') {
      extraParams[key] = value;
    }
  }

  try {
    const data = await callGas(action, extraParams);
    res.json(data);
  } catch (error: any) {
    console.error('[GAS PROXY ERROR]', error?.response?.status, error?.message);
    res.status(502).json({
      success: false,
      error: error?.message || 'Erreur proxy GAS',
    });
  }
});

app.post('/api/gas', async (req, res) => {
  const { action, data } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: 'Action manquante dans le body' });
  }

  try {
    const params = new URLSearchParams({
      action,
      token: SHEET_TOKEN,
    });
    const url = `${SHEET_URL}?${params.toString()}`;

    // On utilise text/plain pour éviter le preflight côté serveur→GAS
    const response = await axios.post(
      url,
      JSON.stringify({ data: data || {} }),
      {
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        maxRedirects: 5,
        timeout: 30000,
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('[GAS PROXY POST ERROR]', error?.response?.status, error?.message);
    res.status(502).json({
      success: false,
      error: error?.message || 'Erreur proxy GAS (POST)',
    });
  }
});

// ============================================================
// Proxy générique vers Google Sheets
// ============================================================
app.all('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    console.error('PROXY ERREUR: URL manquante.');
    return res.status(400).json({ error: 'URL cible manquante' });
  }

  console.log(`[PROXY] ${req.method} vers : ${targetUrl}`);
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 65000,
      maxRedirects: 5,
    });
    console.log(`[PROXY] Succès ${req.method} pour ${targetUrl}`);

    const contentType = String(response.headers['content-type'] || 'application/json');
    res.setHeader('Content-Type', contentType);

    if (typeof response.data === 'string') {
      return res.status(response.status).send(response.data);
    }
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('PROXY ERREUR:', error?.message);
    if (error.response) {
      console.error('PROXY STATUS:', error.response.status);
      const ct = String(error.response.headers['content-type'] || 'text/html');
      res.setHeader('Content-Type', ct);
      if (typeof error.response.data === 'string') {
        return res.status(error.response.status).send(error.response.data);
      }
      return res.status(error.response.status).json(error.response.data);
    }
    const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '');
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout
        ? 'Délai d\'attente dépassé (65s) lors de la communication avec Google Apps Script.'
        : error?.message || 'Erreur inconnue',
    });
  }
});

// ============================================================
// Démarrage du serveur
// ============================================================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production'
    && fs.existsSync(path.resolve(__dirname, 'dist'));

  if (isProd) {
    const distPath = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(distPath)) {
      console.error('[FATAL] Production mode but dist/ directory not found at', distPath);
      process.exit(1);
    }
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('[startup] Running in production mode');
  } else {
    console.log('[startup] Running in development mode');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
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
    console.log(`GAS URL: ${SHEET_URL}`);
  });
}

startServer();