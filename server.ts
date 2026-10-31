import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'couvoirsamche@gmail.com',
    pass: process.env.EMAIL_PASS, // Needs to be set in environment
  },
});

const sendNotificationEmail = async (subject: string, text: string) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'couvoirsamche@gmail.com',
      to: 'couvoirsamche@gmail.com',
      subject,
      text,
    });
    console.log(`[Email] Notification sent: ${subject}`);
  } catch (error) {
    console.error('[Email] Error sending notification:', error);
  }
};

// ✅ Cloud Run : NE PAS utiliser process.exit sur les erreurs non critiques
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught Exception:', err);
  // Ne pas process.exit — laisser Cloud Run gérer
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection:', reason);
  // Ne pas process.exit — laisser Cloud Run gérer
});

const app = express();
const port = Number(process.env.PORT) || 3000;
console.log(`[startup] Server configured on port ${port}`);

app.use(express.json());

// Configuration Google Apps Script
const SHEET_URL = process.env.VITE_GSHEET_WEBAPP_URL
  || 'https://script.google.com/macros/s/AKfycbxhey_NEIaQt60HykMj1MSBtcZP5f-sXIBuBL0iEecZFn28dgct1ZLr4D1ejYv62319/exec';
const SHEET_TOKEN = process.env.VITE_GSHEET_API_TOKEN || 'samche_2023_1972KlaBgni2';

// ============================================================
// ✅ HEALTH CHECK — Cloud Run a besoin de ça pour détecter que le serveur est prêt
// ============================================================
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

app.get('/_health', (_req, res) => {
  res.status(200).send('ok');
});

// ============================================================
// Utilisateurs locaux (FALLBACK si GAS indisponible)
// ============================================================
interface User {
  username: string;
  password: string;
  role: 'admin' | 'utilisateur' | 'comptable';
}

const APP_USERS: User[] = [
  { username: 'Cheick', password: '1234', role: 'admin' },
  { username: 'Samba', password: '4321', role: 'admin' },
  { username: 'Amara', password: 'a1111', role: 'utilisateur' },
  { username: 'Ousmane', password: 'o8801', role: 'utilisateur' },
  { username: 'Djeneba', password: 'd3333', role: 'comptable' },
  { username: 'Alou', password: 'c0100', role: 'utilisateur' },
];

// Helper : appel GET à Google Apps Script
async function callGas(action: string, extraParams: Record<string, string> = {}) {
  const params = new URLSearchParams({ action, token: SHEET_TOKEN, ...extraParams });
  const url = `${SHEET_URL}?${params.toString()}`;
  const response = await axios.get(url, {
    maxRedirects: 5,
    timeout: 60000,
  });
  return response.data;
}

// ============================================================
// Route d'authentification (GAS d'abord + fallback local)
// ============================================================
app.post('/api/auth', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Nom d\'utilisateur et mot de passe requis',
    });
  }

  // ✅ Essayer GAS d'abord
  try {
    const params = new URLSearchParams({
      action: 'utilisateurs.authentifier',
      token: SHEET_TOKEN,
      username,
      password,
    });
    const gasResponse = await axios.get(`${SHEET_URL}?${params.toString()}`, {
      timeout: 10000,
      maxRedirects: 5,
    });

    if (gasResponse.data?.success) {
      const userData = gasResponse.data.data?.user || gasResponse.data.user || gasResponse.data.data;
      if (userData && userData.username) {
        return res.json({
          success: true,
          role: userData.role,
          username: userData.username,
        });
      }
    }
    console.warn('[Auth] GAS a répondu mais utilisateur non trouvé, fallback local');
  } catch (error: any) {
    console.warn('[Auth] GAS indisponible, fallback local:', error?.message);
  }

  // ✅ Fallback local
  const user = APP_USERS.find(u => u.username === username && u.password === password);
  if (user) {
    return res.json({
      success: true,
      role: user.role,
      username: user.username,
    });
  } else {
    return res.status(401).json({
      success: false,
      error: 'Utilisateur introuvable ou mot de passe incorrect',
    });
  }
});

// ============================================================
// Proxy GAS — GET (lecture)
// ============================================================
app.get('/api/gas', async (req, res) => {
  const action = req.query.action as string;

  if (!action) {
    return res.status(400).json({ error: 'Action manquante' });
  }

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

// ============================================================
// Proxy GAS — POST (écriture)
// ============================================================
app.post('/api/gas', async (req, res) => {
  const { action, data, _gas_url, _gas_token } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Action manquante dans le body' });
  try {
    const targetUrl = (typeof _gas_url === 'string' && _gas_url.trim()) ? _gas_url.trim() : SHEET_URL;
    const token     = (typeof _gas_token === 'string' && _gas_token.trim()) ? _gas_token.trim() : SHEET_TOKEN;
    const params = new URLSearchParams({ action, token });
    const url = `${targetUrl}?${params.toString()}`;
    const response = await axios.post(url, JSON.stringify({ data: data || {} }), {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      maxRedirects: 5,
      timeout: 30000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('[GAS PROXY POST ERROR]', error?.response?.status, error?.message);
    res.status(502).json({ success: false, error: error?.message || 'Erreur proxy GAS (POST)' });
  }
});

// ============================================================
// Notification route
// ============================================================
app.post('/api/send-email', async (req, res) => {
  const { subject, text, adminEmails } = req.body;
  if (!subject || !text) {
    return res.status(400).json({ success: false, error: 'Sujet et contenu requis' });
  }

  // Use provided admin emails or fallback
  const recipients = (adminEmails && Array.isArray(adminEmails) && adminEmails.length > 0)
    ? adminEmails.join(',')
    : 'couvoirsamche@gmail.com';

  console.log(`[Email] Sending notification to: ${recipients}, from: ${process.env.EMAIL_USER || 'couvoirsamche@gmail.com'}, subject: ${subject}`);
  console.log(`[Email] Content: ${text}`);

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'couvoirsamche@gmail.com',
      to: recipients,
      subject,
      text,
    });
    console.log(`[Email] Notification sent: ${subject}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Email] Error sending notification:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'envoi de l\'email' });
  }
});

// ============================================================
// Proxy générique vers Google Sheets
// ============================================================
app.all('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL cible manquante' });
  }

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

    const contentType = String(response.headers['content-type'] || 'application/json');
    res.setHeader('Content-Type', contentType);

    if (typeof response.data === 'string') {
      return res.status(response.status).send(response.data);
    }
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('PROXY ERREUR:', error?.message);
    if (error.response) {
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
        ? 'Délai d\'attente dépassé (65s).'
        : error?.message || 'Erreur inconnue',
    });
  }
});

// ============================================================
// ✅ Démarrage du serveur — SIMPLIFIÉ pour Cloud Run
// ============================================================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production'
    && fs.existsSync(path.resolve(__dirname, 'dist'));

  if (isProd) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));

    // ✅ Catch-all compatible Express 4 ET 5
    app.use((req, res) => {
      const indexHtmlPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        // ✅ Fallback si index.html n'existe pas — ne pas crasher
        res.status(200).send(`
          <!DOCTYPE html>
          <html><body>
          <h1>Server OK</h1>
          <p>Server is running but dist/index.html was not found.</p>
          </body></html>
        `);
      }
    });
    console.log('[startup] Running in production mode');
  } else {
    console.log('[startup] Running in development mode');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', hmr: false },
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

  // ✅ Démarrer le serveur IMMÉDIATEMENT
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
    console.log(`GAS URL: ${SHEET_URL}`);
  });

  // ✅ Daily backup at 18:00
  cron.schedule('0 18 * * *', async () => {
    console.log('[Cron] Daily backup triggered');
    try {
      // Trigger GAS backup action
      await callGas('backup.generer');
      await sendNotificationEmail('Sauvegarde quotidienne effectuée', 'La sauvegarde quotidienne a été effectuée avec succès.');
    } catch (error) {
      console.error('[Cron] Backup failed:', error);
      await sendNotificationEmail('Échec de la sauvegarde quotidienne', `La sauvegarde quotidienne a échoué : ${error}`);
    }
  });
}

startServer().catch(err => {
  console.error('[FATAL] Failed to start server:', err);
});