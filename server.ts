import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import {
  autoRestoreBuiltInWhatsApp,
  getBuiltInWhatsAppStatus,
  sendBuiltInWhatsAppMessage,
  startBuiltInWhatsApp,
  stopBuiltInWhatsApp,
} from './server/whatsappGateway.ts';

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

app.use(express.json({ limit: '15mb' }));

// Configuration Google Apps Script
const SHEET_URL = process.env.VITE_GSHEET_WEBAPP_URL
  || 'https://script.google.com/macros/s/AKfycbyLDQt8owxZawRMcjppqQ70_9vHg-70Ei-CVSO2K--x_2bmiIY_GX2LhHcc2ADE07YB/exec';
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

    // ✅ Détecter si c'est un upload de justificatif (gros payload base64)
    const payloadSize = JSON.stringify({ data: data || {} }).length;
    const isJustifUpload = action.endsWith('.joindreJustificatif');
    const timeout = isJustifUpload ? 120000 : 60000; // 2 min pour justificatifs, 1 min sinon

    console.log(`[GAS POST] action=${action} payload=${(payloadSize / 1024).toFixed(1)}Ko timeout=${timeout / 1000}s`);

    const bodyStr = JSON.stringify({ data: data || {} });
    const response = await axios.post(url, bodyStr, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      maxRedirects: 5,
      timeout: timeout,
      maxContentLength: Infinity,    // réponse de n'importe quelle taille
      maxBodyLength: Infinity,       // body de requête de n'importe quelle taille
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('[GAS PROXY POST ERROR]', {
      action,
      status: error?.response?.status,
      message: error?.message,
      code: error?.code,
      gasResponse: typeof error?.response?.data === 'string'
        ? error.response.data.slice(0, 500)
        : JSON.stringify(error?.response?.data || {}).slice(0, 500),
    });
    // Transmettre le message d'erreur GAS au frontend de façon exploitable
    const errMsg = error?.response?.data
      ? (typeof error.response.data === 'string'
          ? error.response.data.slice(0, 300)
          : (error.response.data.message || error.response.data.error || JSON.stringify(error.response.data).slice(0, 300)))
      : error?.message || 'Erreur proxy GAS (POST)';
    res.status(502).json({
      success: false,
      message: errMsg,
      error: errMsg,
      code: error?.code || 'PROXY_ERROR',
    });
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
    : 'ckamisso@gmail.com,keitasamba@yahoo.fr';

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
// Passerelle WhatsApp automatique (envoi en lot côté serveur)
// ============================================================
function detectWhatsAppProvider(): {
  configured: boolean;
  provider: 'webhook' | 'ultramsg' | 'greenapi' | 'cloud' | 'builtin';
} {
  if (process.env.WHATSAPP_WEBHOOK_URL) {
    return { configured: true, provider: 'webhook' };
  }
  if (process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN) {
    return { configured: true, provider: 'ultramsg' };
  }
  if (process.env.GREENAPI_ID_INSTANCE && process.env.GREENAPI_API_TOKEN) {
    return { configured: true, provider: 'greenapi' };
  }
  if (process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { configured: true, provider: 'cloud' };
  }
  // Option gratuite intégrée par défaut (WhatsApp Web Appareils connectés)
  return { configured: true, provider: 'builtin' };
}

app.get('/api/whatsapp/status', (_req, res) => {
  const ext = detectWhatsAppProvider();
  const builtin = getBuiltInWhatsAppStatus();
  const isConnected =
    ext.provider !== 'builtin' ? true : builtin.status === 'connected';
  res.json({
    configured: true,
    provider: ext.provider,
    connected: isConnected,
    builtin,
  });
});

app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const { pairingPhone, forceFresh } = req.body || {};
    const builtin = await startBuiltInWhatsApp({
      pairingPhone: typeof pairingPhone === 'string' ? pairingPhone : undefined,
      forceFresh: Boolean(forceFresh),
    });
    res.json({
      success: true,
      connected: builtin.status === 'connected',
      builtin,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'Erreur connexion WhatsApp',
    });
  }
});

app.post('/api/whatsapp/disconnect', async (_req, res) => {
  try {
    const builtin = await stopBuiltInWhatsApp(true);
    res.json({ success: true, connected: false, builtin });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'Erreur déconnexion WhatsApp',
    });
  }
});

app.post('/api/whatsapp/send-batch', async (req, res) => {
  const { recipients, defaultMessage } = req.body || {};
  const status = detectWhatsAppProvider();

  if (status.provider === 'builtin') {
    const bStatus = getBuiltInWhatsAppStatus();
    if (bStatus.status !== 'connected') {
      return res.json({
        success: false,
        configured: true,
        connected: false,
        provider: 'builtin',
        message:
          'WhatsApp n’est pas encore connecté. Scannez le QR code (Appareils connectés) pour activer l’envoi automatique.',
        sentCount: 0,
        failedCount: 0,
        results: [],
      });
    }
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({
      success: false,
      configured: true,
      message: 'Aucun destinataire WhatsApp fourni.',
      results: [],
    });
  }

  const results: Array<{
    uid: string;
    phone: string;
    success: boolean;
    error?: string;
  }> = [];

  for (let i = 0; i < recipients.length; i++) {
    const rec = recipients[i] || {};
    const uid = String(rec.uid || '');
    const phone = String(rec.phone || '').replace(/\D/g, '');
    const name = String(rec.name || '');
    const text = String(rec.message || defaultMessage || '').trim();

    if (!phone || !text) {
      results.push({
        uid,
        phone,
        success: false,
        error: 'Numéro ou message manquant',
      });
      continue;
    }

    try {
      if (status.provider === 'builtin') {
        const sendRes = await sendBuiltInWhatsAppMessage(phone, text);
        results.push({
          uid,
          phone,
          success: sendRes.success,
          error: sendRes.error,
        });
      } else if (status.provider === 'webhook') {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (process.env.WHATSAPP_WEBHOOK_TOKEN) {
          headers.Authorization = `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}`;
        }
        await axios.post(
          process.env.WHATSAPP_WEBHOOK_URL as string,
          { phone, to: phone, name, text, message: text },
          { headers, timeout: 15000 }
        );
        results.push({ uid, phone, success: true });
      } else if (status.provider === 'ultramsg') {
        const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
        const token = process.env.ULTRAMSG_TOKEN;
        await axios.post(
          `https://api.ultramsg.com/${encodeURIComponent(String(instanceId))}/messages/chat`,
          { token, to: `+${phone}`, body: text },
          { timeout: 15000 }
        );
        results.push({ uid, phone, success: true });
      } else if (status.provider === 'greenapi') {
        const idInst = process.env.GREENAPI_ID_INSTANCE;
        const apiToken = process.env.GREENAPI_API_TOKEN;
        await axios.post(
          `https://api.green-api.com/waInstance${encodeURIComponent(String(idInst))}/sendMessage/${encodeURIComponent(String(apiToken))}`,
          { chatId: `${phone}@c.us`, message: text },
          { timeout: 15000 }
        );
        results.push({ uid, phone, success: true });
      } else if (status.provider === 'cloud') {
        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const cloudToken = process.env.WHATSAPP_CLOUD_TOKEN;
        await axios.post(
          `https://graph.facebook.com/v20.0/${encodeURIComponent(String(phoneId))}/messages`,
          {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: text },
          },
          {
            headers: {
              Authorization: `Bearer ${cloudToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        );
        results.push({ uid, phone, success: true });
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Erreur envoi WhatsApp';
      results.push({ uid, phone, success: false, error: String(errMsg) });
    }

    if (i < recipients.length - 1) {
      // Délai anti-blocage WhatsApp (1.2s en mode intégré, 150ms pour API cloud)
      const delayMs = status.provider === 'builtin' ? 1200 : 150;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const sentCount = results.filter((r) => r.success).length;
  const failedCount = results.length - sentCount;
  res.json({
    success: sentCount > 0,
    configured: true,
    connected: true,
    provider: status.provider,
    sentCount,
    failedCount,
    results,
  });
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
// Guide d'utilisation PDF — Route directe garantie (dev & prod)
// ============================================================
app.get(['/api/guide-pdf', '/Guide_Utilisation_Couvoir_SAMCHE.pdf'], (req, res) => {
  const candidates = [
    path.resolve(__dirname, 'docs', 'Guide_Utilisation_Couvoir_SAMCHE.pdf'),
    path.resolve(__dirname, 'public', 'Guide_Utilisation_Couvoir_SAMCHE.pdf'),
    path.resolve(__dirname, 'dist', 'Guide_Utilisation_Couvoir_SAMCHE.pdf'),
  ];
  const pdfPath = candidates.find((p) => fs.existsSync(p));
  if (!pdfPath) {
    return res.status(404).json({ success: false, error: 'Guide PDF introuvable sur le serveur.' });
  }
  const forceDownload = req.query.download === '1' || req.query.download === 'true';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `${forceDownload ? 'attachment' : 'inline'}; filename="Guide_Utilisation_Couvoir_SAMCHE.pdf"`
  );
  return res.sendFile(pdfPath);
});

app.get(['/api/guide-html', '/guide-samche.html'], (_req, res) => {
  const candidates = [
    path.resolve(__dirname, 'docs', 'guide-samche.html'),
    path.resolve(__dirname, 'public', 'guide-samche.html'),
    path.resolve(__dirname, 'dist', 'guide-samche.html'),
  ];
  const htmlPath = candidates.find((p) => fs.existsSync(p));
  if (!htmlPath) {
    return res.status(404).send('<h1>Guide HTML introuvable</h1>');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.sendFile(htmlPath);
});

// ============================================================
// ✅ Démarrage du serveur — SIMPLIFIÉ pour Cloud Run
// ============================================================
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(distPath);
  const isProd =
    hasDist &&
    (process.env.NODE_ENV === 'production' ||
      process.env.npm_lifecycle_event === 'start');

  if (isProd) {
    app.use(express.static(distPath));

    // ✅ Catch-all compatible Express 4 ET 5
    app.use((_req, res) => {
      const indexHtmlPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
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
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: { middlewareMode: true, host: '0.0.0.0', hmr: false },
        appType: 'spa',
      })
    );

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (e) {
        next(e);
      }
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        const indexPath = path.resolve(__dirname, 'index.html');
        const indexHtml = fs.readFileSync(indexPath, 'utf-8');
        const template = await vite.transformIndexHtml(req.originalUrl, indexHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        try {
          const vite = await vitePromise;
          vite.ssrFixStacktrace(e);
        } catch {
          // ignore
        }
        next(e);
      }
    });
  }

  // ✅ Démarrer le serveur IMMÉDIATEMENT sur 0.0.0.0:PORT
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
    console.log(`GAS URL: ${SHEET_URL}`);
    autoRestoreBuiltInWhatsApp();
  });

  // ✅ Daily backup at 18:00
  cron.schedule('0 18 * * *', async () => {
    console.log('[Cron] Daily backup triggered');
    try {
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