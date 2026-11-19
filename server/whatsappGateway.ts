import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '..', '.baileys_auth');

export type BaileysConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'qr_ready'
  | 'connected'
  | 'error';

export interface BuiltInWhatsAppStatus {
  status: BaileysConnectionState;
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastError: string | null;
}

const silentLogger: any = {
  level: 'silent',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => silentLogger,
};

let sock: WASocket | null = null;
let currentState: BaileysConnectionState = 'disconnected';
let qrDataUrl: string | null = null;
let pairingCode: string | null = null;
let connectedPhone: string | null = null;
let connectedName: string | null = null;
let lastError: string | null = null;
let manualDisconnect = false;
let isStarting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function clearAuthDir() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[WhatsApp] Impossible de nettoyer .baileys_auth:', err);
  }
}

export function getBuiltInWhatsAppStatus(): BuiltInWhatsAppStatus {
  return {
    status: currentState,
    qrDataUrl,
    pairingCode,
    connectedPhone,
    connectedName,
    lastError,
  };
}

export async function startBuiltInWhatsApp(options?: {
  pairingPhone?: string;
  forceFresh?: boolean;
}): Promise<BuiltInWhatsAppStatus> {
  if (currentState === 'connected' && sock && !options?.forceFresh) {
    return getBuiltInWhatsAppStatus();
  }
  if (isStarting && !options?.forceFresh) {
    return getBuiltInWhatsAppStatus();
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  isStarting = true;
  manualDisconnect = false;
  lastError = null;

  try {
    if (options?.forceFresh) {
      if (sock) {
        try {
          sock.end(undefined);
        } catch {
          // ignore
        }
        sock = null;
      }
      clearAuthDir();
      qrDataUrl = null;
      pairingCode = null;
      connectedPhone = null;
      connectedName = null;
    }

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    currentState = 'connecting';
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version: [number, number, number] = [2, 3000, 1027934701];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version) version = latest.version;
    } catch {
      // keep fallback version
    }

    const activeSock = makeWASocket({
      version,
      auth: state,
      logger: silentLogger,
      browser: Browsers.ubuntu('Couvoir SAMCHE'),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    sock = activeSock;

    activeSock.ev.on('creds.update', saveCreds);

    activeSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !options?.pairingPhone) {
        try {
          qrDataUrl = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 2,
            color: { dark: '#1a3050', light: '#ffffff' },
          });
          currentState = 'qr_ready';
          lastError = null;
        } catch (err: any) {
          lastError = err?.message || 'Erreur génération QR';
        }
      }

      if (connection === 'open') {
        currentState = 'connected';
        qrDataUrl = null;
        pairingCode = null;
        lastError = null;
        const rawId = activeSock.user?.id || '';
        connectedPhone = rawId.split(':')[0].split('@')[0] || null;
        connectedName = activeSock.user?.name || null;
        console.log(`[WhatsApp] ✅ Connecté (${connectedName || connectedPhone || 'OK'})`);
      } else if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errMessage =
          (lastDisconnect?.error as Error)?.message || 'Connexion fermée';

        if (sock === activeSock) {
          sock = null;
        }

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        if (manualDisconnect || isLoggedOut) {
          if (isLoggedOut) {
            clearAuthDir();
          }
          currentState = 'disconnected';
          qrDataUrl = null;
          pairingCode = null;
          connectedPhone = null;
          connectedName = null;
          lastError = isLoggedOut ? 'Session WhatsApp déconnectée.' : null;
        } else {
          currentState = 'connecting';
          lastError = errMessage;
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              if (!manualDisconnect) {
                startBuiltInWhatsApp().catch(() => {});
              }
            }, 3000);
          }
        }
      }
    });

    // Mode optionnel : code d'appairage à 8 chiffres au lieu du QR code
    const rawPairing = (options?.pairingPhone || '').replace(/\D/g, '');
    if (rawPairing && !state.creds.registered) {
      setTimeout(async () => {
        try {
          if (sock === activeSock && currentState !== 'connected') {
            const code = await activeSock.requestPairingCode(rawPairing);
            pairingCode = code
              ? code.replace(/(.{4})(?=.)/g, '$1-')
              : null;
            currentState = 'qr_ready';
          }
        } catch (err: any) {
          lastError = err?.message || "Impossible de générer le code d'appairage";
        }
      }, 1500);
    }

    return getBuiltInWhatsAppStatus();
  } catch (err: any) {
    currentState = 'error';
    lastError = err?.message || 'Erreur initialisation WhatsApp';
    return getBuiltInWhatsAppStatus();
  } finally {
    isStarting = false;
  }
}

export async function stopBuiltInWhatsApp(logout = true): Promise<BuiltInWhatsAppStatus> {
  manualDisconnect = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try {
      if (logout) {
        await sock.logout().catch(() => {});
      }
      sock.end(undefined);
    } catch {
      // ignore
    }
    sock = null;
  }
  if (logout) {
    clearAuthDir();
  }
  currentState = 'disconnected';
  qrDataUrl = null;
  pairingCode = null;
  connectedPhone = null;
  connectedName = null;
  lastError = null;
  return getBuiltInWhatsAppStatus();
}

export async function sendBuiltInWhatsAppMessage(
  rawPhone: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (currentState !== 'connected' || !sock) {
    return {
      success: false,
      error: 'WhatsApp non connecté. Scannez le QR code d’abord.',
    };
  }

  const digits = (rawPhone || '').replace(/\D/g, '');
  if (digits.length < 8) {
    return { success: false, error: 'Numéro de téléphone invalide' };
  }

  try {
    let targetJid = `${digits}@s.whatsapp.net`;
    try {
      const lookup = await sock.onWhatsApp(targetJid);
      if (Array.isArray(lookup) && lookup.length > 0) {
        if (!lookup[0].exists) {
          return {
            success: false,
            error: 'Numéro non inscrit sur WhatsApp',
          };
        }
        if (lookup[0].jid) {
          targetJid = lookup[0].jid;
        }
      }
    } catch {
      // Si onWhatsApp échoue ponctuellement, tenter quand même l'envoi direct
    }

    await sock.sendMessage(targetJid, { text });
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Erreur envoi message WhatsApp',
    };
  }
}

export function autoRestoreBuiltInWhatsApp(): void {
  try {
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    if (fs.existsSync(credsPath)) {
      console.log('[WhatsApp] Session existante détectée, reconnexion automatique...');
      startBuiltInWhatsApp().catch((err) => {
        console.warn('[WhatsApp] Échec reconnexion auto:', err?.message);
      });
    }
  } catch {
    // ignore
  }
}
