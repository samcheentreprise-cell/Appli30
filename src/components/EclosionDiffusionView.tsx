import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client } from '../types';
import {
  getGrandsClients,
  RawGrandsClientItem,
  sendGroupClientDiffusionEmail,
  getWhatsAppGatewayStatus,
  connectBuiltInWhatsApp,
  disconnectBuiltInWhatsApp,
  sendWhatsAppBatch,
  WhatsAppGatewayStatus,
} from '../services/googleSheet';

export interface HatchDateBroadcastItem {
  id: string;
  date: string;
  dateFormatee: string;
  dateObj: Date | null;
  type: string;
  race: string;
  lotId?: string;
  fournisseur?: string;
  prix: number;
  prevision: number;
  commande: number;
  isPast: boolean;
}

export interface AnnouncedHatchRecord {
  key: string;
  announcedAt: string;
  mode: 'diffusion' | 'auto_email' | 'dismissed';
  emailCount?: number;
  waCount?: number;
}

export interface UnifiedRecipient {
  uid: string;
  stableKey: string;
  displayName: string;
  ville: string;
  rawPhone: string;
  waPhone: string;
  email: string;
  source: 'Grands_Clients' | 'Clients';
}

export interface ExcludedDuplicate {
  displayName: string;
  rawPhone: string;
  email: string;
  reason: string;
}

interface ClientSendRecord {
  emailAt?: string;
  waAt?: string;
}

interface EclosionDiffusionViewProps {
  activeHatchDates: HatchDateBroadcastItem[];
  initialHatchId?: string;
  clients: Client[];
  announcedMap: Record<string, AnnouncedHatchRecord>;
  autoEmailEnabled: boolean;
  onToggleAutoEmail: (enabled: boolean) => void;
  onMarkAnnounced: (
    hatchKey: string,
    mode?: 'diffusion' | 'auto_email' | 'dismissed',
    counts?: { emailCount?: number; waCount?: number }
  ) => void;
  showNotif: (text: string, ok: boolean) => void;
  onBack: () => void;
}

const STRICT_EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function normalizeText(str: string | undefined): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEmail(str: string | undefined): string {
  const clean = (str || '').trim().toLowerCase();
  return STRICT_EMAIL_RE.test(clean) ? clean : '';
}

export function formatWaPhone(raw: string | undefined): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const hasPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  if (digits.length < 8) return '';
  if (hasPlus) return digits;
  if (s.startsWith('00') && digits.length >= 10) return digits.slice(2);
  if (digits.length === 8) return `223${digits}`;
  if (digits.length === 11 && digits.startsWith('223')) return digits;
  return digits;
}

function phoneLast8(raw: string | undefined): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : '';
}

function formatNumberSpaces(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function capitalizeFirst(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatShortTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Règle métier stricte :
 * Uniquement les dates d'éclosion qui ne sont PAS encore arrivées (> aujourd'hui 00:00)
 * ET dont le nombre de poussins disponibles est strictement supérieur à 1000.
 */
export function isHatchEligibleForDiffusion(d: HatchDateBroadcastItem): boolean {
  if (!d || !d.dateObj || isNaN(d.dateObj.getTime())) return false;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const hatchMidnight = new Date(
    d.dateObj.getFullYear(),
    d.dateObj.getMonth(),
    d.dateObj.getDate()
  );
  const dispo = Math.max(0, d.prevision - d.commande);
  return hatchMidnight.getTime() > todayMidnight.getTime() && dispo > 1000;
}

export function formatEclosionLongDate(dateObj: Date | null, fallback: string): string {
  if (!dateObj || isNaN(dateObj.getTime())) return fallback;
  const day = dateObj.getDate();
  const month = capitalizeFirst(
    dateObj.toLocaleDateString('fr-FR', { month: 'long' })
  );
  const year = dateObj.getFullYear();
  const weekday = capitalizeFirst(
    dateObj.toLocaleDateString('fr-FR', { weekday: 'long' })
  );
  return `${day} ${month} ${year} (${weekday})`;
}

export function formatLivraisonNextDay(dateObj: Date | null): string {
  if (!dateObj || isNaN(dateObj.getTime())) return 'Le lendemain';
  const next = new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate() + 1
  );
  const dd = String(next.getDate()).padStart(2, '0');
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const yyyy = next.getFullYear();
  return `${dd}/${mm}/${yyyy} (le lendemain)`;
}

export function buildEclosionMessage(hatch: HatchDateBroadcastItem): string {
  const dispo = Math.max(0, hatch.prevision - hatch.commande);
  const eclosionText = formatEclosionLongDate(hatch.dateObj, hatch.date);
  const livraisonText = formatLivraisonNextDay(hatch.dateObj);
  const typeText = hatch.type || 'Chairs';
  const qteText = `${formatNumberSpaces(dispo)} poussins`;
  const tarifText =
    hatch.prix > 0
      ? `${formatNumberSpaces(hatch.prix)} FCFA / poussin`
      : 'À confirmer';

  return [
    'Bonjour,',
    '',
    "Une nouvelle date d'éclosion est ouverte aux réservations au Couvoir SAMCHE :",
    `• Éclosion : ${eclosionText}`,
    `• Livraison prévue : ${livraisonText}`,
    `• Type : ${typeText}`,
    `• Quantité disponible : ${qteText}`,
    `• Tarif : ${tarifText}`,
  ].join('\n');
}

export function buildEclosionSubject(hatch: HatchDateBroadcastItem): string {
  const longDate = formatEclosionLongDate(hatch.dateObj, hatch.date).replace(
    /\s*\([^)]+\)$/,
    ''
  );
  return `Couvoir SAMCHE — Nouvelle éclosion le ${longDate} (${hatch.type || 'Poussins'})`;
}

export function mergeClientsWithoutDuplicates(
  grandsClients: RawGrandsClientItem[],
  clients: Client[]
): {
  recipients: UnifiedRecipient[];
  excludedDuplicates: ExcludedDuplicate[];
  emailList: string[];
  waPhones: string[];
} {
  const gcNames = new Set<string>();
  const gcPhones8 = new Set<string>();
  const gcEmails = new Set<string>();

  const seenNames = new Set<string>();
  const seenPhones8 = new Set<string>();
  const seenEmails = new Set<string>();

  const list: UnifiedRecipient[] = [];
  const excluded: ExcludedDuplicate[] = [];

  const clientsByName = new Map<string, Client>();
  const clientsByPhone8 = new Map<string, Client>();
  for (const cl of clients) {
    const n = normalizeText(cl.label || `${cl.prenom || ''} ${cl.nom || ''}`);
    if (n && !clientsByName.has(n)) clientsByName.set(n, cl);
    const p8 = phoneLast8(cl.telephone);
    if (p8 && !clientsByPhone8.has(p8)) clientsByPhone8.set(p8, cl);
  }

  // 1. Grands_Clients en priorité
  grandsClients.forEach((gc, idx) => {
    const displayName =
      (gc.label || `${gc.prenom || ''} ${gc.nom || ''}`).trim() ||
      `Client #${idx + 1}`;
    const normN = normalizeText(displayName);
    const rawPhone = (gc.tel || gc.telephone || '').trim();
    const p8 = phoneLast8(rawPhone);
    let email = normalizeEmail(gc.email);

    if (!email) {
      const matchedCl =
        (normN ? clientsByName.get(normN) : undefined) ||
        (p8 ? clientsByPhone8.get(p8) : undefined);
      const clEmail = normalizeEmail(matchedCl?.email);
      if (clEmail) email = clEmail;
    }

    const waPhone = formatWaPhone(rawPhone);

    if (normN) {
      gcNames.add(normN);
      seenNames.add(normN);
    }
    if (p8) {
      gcPhones8.add(p8);
      seenPhones8.add(p8);
    }
    if (email) {
      gcEmails.add(email);
      seenEmails.add(email);
    }

    const stableKey = p8 ? `p_${p8}` : email ? `e_${email}` : `n_${normN || idx}`;

    list.push({
      uid: `gc_${idx}_${stableKey}`,
      stableKey,
      displayName,
      ville: (gc.ville || '').trim(),
      rawPhone,
      waPhone,
      email,
      source: 'Grands_Clients',
    });
  });

  // 2. Clients sans les doublons présents dans Grands_Clients
  clients.forEach((cl, idx) => {
    const displayName =
      (cl.label || `${cl.prenom || ''} ${cl.nom || ''}`).trim() ||
      `Client #${idx + 1}`;
    const normN = normalizeText(displayName);
    const rawPhone = (cl.telephone || '').trim();
    const p8 = phoneLast8(rawPhone);
    const email = normalizeEmail(cl.email);
    const waPhone = formatWaPhone(rawPhone);

    let dupReason = '';
    if (normN && gcNames.has(normN)) dupReason = 'Présent dans Grands_Clients (Nom)';
    else if (p8 && gcPhones8.has(p8)) dupReason = 'Présent dans Grands_Clients (Tél)';
    else if (email && gcEmails.has(email)) dupReason = 'Présent dans Grands_Clients (Email)';
    else if (
      (normN && seenNames.has(normN)) ||
      (p8 && seenPhones8.has(p8)) ||
      (email && seenEmails.has(email))
    ) {
      dupReason = 'Doublon interne';
    }

    if (dupReason) {
      excluded.push({ displayName, rawPhone, email, reason: dupReason });
      return;
    }

    if (normN) seenNames.add(normN);
    if (p8) seenPhones8.add(p8);
    if (email) seenEmails.add(email);

    const stableKey = p8 ? `p_${p8}` : email ? `e_${email}` : `n_${normN || idx}`;

    list.push({
      uid: `cl_${cl.index ?? idx}_${stableKey}`,
      stableKey,
      displayName,
      ville: (cl.ville || '').trim(),
      rawPhone,
      waPhone,
      email,
      source: 'Clients',
    });
  });

  const emailList = Array.from(new Set(list.map((r) => r.email).filter(Boolean)));
  const waPhones = Array.from(new Set(list.map((r) => r.waPhone).filter(Boolean)));

  return { recipients: list, excludedDuplicates: excluded, emailList, waPhones };
}

export function loadHatchSendLog(hatchKey: string): Record<string, ClientSendRecord> {
  try {
    if (typeof localStorage === 'undefined' || !hatchKey) return {};
    const raw = localStorage.getItem(`samche_diffusion_clients_${hatchKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveHatchSendLog(
  hatchKey: string,
  log: Record<string, ClientSendRecord>
): void {
  try {
    if (typeof localStorage === 'undefined' || !hatchKey) return;
    localStorage.setItem(
      `samche_diffusion_clients_${hatchKey}`,
      JSON.stringify(log)
    );
  } catch {
    // ignore storage quota errors
  }
}

export const EclosionDiffusionView: React.FC<EclosionDiffusionViewProps> = ({
  activeHatchDates,
  initialHatchId,
  clients,
  announcedMap,
  autoEmailEnabled,
  onToggleAutoEmail,
  onMarkAnnounced,
  showNotif,
  onBack,
}) => {
  // Filtrage strict : uniquement les dates non encore arrivées (> aujourd'hui) et > 1000 poussins
  const eligibleDates = useMemo(() => {
    return activeHatchDates
      .filter(isHatchEligibleForDiffusion)
      .sort((a, b) => {
        const ta = a.dateObj ? a.dateObj.getTime() : 0;
        const tb = b.dateObj ? b.dateObj.getTime() : 0;
        return ta - tb;
      });
  }, [activeHatchDates]);

  const [selectedHatchId, setSelectedHatchId] = useState<string>(() => {
    if (initialHatchId && eligibleDates.some((d) => d.id === initialHatchId)) {
      return initialHatchId;
    }
    return eligibleDates[0]?.id || '';
  });

  useEffect(() => {
    if (initialHatchId && eligibleDates.some((d) => d.id === initialHatchId)) {
      setSelectedHatchId(initialHatchId);
    }
  }, [initialHatchId, eligibleDates]);

  useEffect(() => {
    if (
      eligibleDates.length > 0 &&
      !eligibleDates.some((d) => d.id === selectedHatchId)
    ) {
      setSelectedHatchId(eligibleDates[0].id);
    }
  }, [eligibleDates, selectedHatchId]);

  const selectedHatch = useMemo(
    () => eligibleDates.find((d) => d.id === selectedHatchId) || eligibleDates[0] || null,
    [eligibleDates, selectedHatchId]
  );

  // Grands Clients + WhatsApp Gateway status
  const [grandsClients, setGrandsClients] = useState<RawGrandsClientItem[]>([]);
  const [loadingGc, setLoadingGc] = useState<boolean>(true);
  const [gcError, setGcError] = useState<string | null>(null);
  const [waGateway, setWaGateway] = useState<
    WhatsAppGatewayStatus & { checked: boolean }
  >({
    configured: true,
    connected: false,
    provider: 'builtin',
    checked: false,
  });
  const [showWaConnectPanel, setShowWaConnectPanel] = useState<boolean>(false);
  const [pairingPhoneInput, setPairingPhoneInput] = useState<string>('22366565055');
  const [isConnectingWa, setIsConnectingWa] = useState<boolean>(false);

  const fetchGrandsClients = useCallback(async () => {
    setLoadingGc(true);
    setGcError(null);
    const [res, waStatus] = await Promise.all([
      getGrandsClients(),
      getWhatsAppGatewayStatus(),
    ]);
    if (res.success) {
      setGrandsClients(res.clients);
    } else {
      setGcError(res.message || 'Impossible de charger la feuille Grands_Clients');
    }
    setWaGateway({ ...waStatus, checked: true });
    setLoadingGc(false);
  }, []);

  useEffect(() => {
    fetchGrandsClients();
  }, [fetchGrandsClients]);

  // Rafraîchir le statut QR Code / connexion WhatsApp automatiquement pendant l'appairage
  useEffect(() => {
    if (!showWaConnectPanel || waGateway.connected) return;
    const timer = setInterval(async () => {
      const status = await getWhatsAppGatewayStatus();
      setWaGateway({ ...status, checked: true });
      if (status.connected) {
        setShowWaConnectPanel(false);
        showNotif('WhatsApp connecté avec succès !', true);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [showWaConnectPanel, waGateway.connected, showNotif]);

  const handleStartWaQr = async (usePairing = false, overridePhone?: string) => {
    setIsConnectingWa(true);
    setShowWaConnectPanel(true);
    const cleanPhone = (overridePhone ?? pairingPhoneInput).replace(/\D/g, '');
    const res = await connectBuiltInWhatsApp({
      pairingPhone: usePairing && cleanPhone.length >= 8 ? cleanPhone : undefined,
      forceFresh: true,
    });
    const status = await getWhatsAppGatewayStatus();
    setWaGateway({ ...status, checked: true });
    setIsConnectingWa(false);
    if (res.connected) {
      setShowWaConnectPanel(false);
      showNotif('WhatsApp connecté avec succès !', true);
    }
  };

  const handleDisconnectWa = async () => {
    await disconnectBuiltInWhatsApp();
    const status = await getWhatsAppGatewayStatus();
    setWaGateway({ ...status, checked: true });
    showNotif('Session WhatsApp déconnectée.', true);
  };

  // Message state
  const [messageText, setMessageText] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [isEditingMessage, setIsEditingMessage] = useState<boolean>(false);
  const [copiedMsg, setCopiedMsg] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Channel toggles
  const [sendByEmail, setSendByEmail] = useState<boolean>(true);
  const [sendByWa, setSendByWa] = useState<boolean>(true);

  // Recipients deduplicated
  const { recipients, excludedDuplicates } = useMemo(
    () => mergeClientsWithoutDuplicates(grandsClients, clients),
    [grandsClients, clients]
  );

  // Historique d'envoi par date d'éclosion (évite les envois en double)
  const [sendLog, setSendLog] = useState<Record<string, ClientSendRecord>>({});
  useEffect(() => {
    if (!selectedHatch) {
      setSendLog({});
      return;
    }
    setSendLog(loadHatchSendLog(selectedHatch.id));
  }, [selectedHatch?.id]);

  // Cases à cocher par client (décochées automatiquement si déjà envoyé pour cette date !)
  const [checkedKeys, setCheckedKeys] = useState<Record<string, boolean>>({});
  const [confirmResend, setConfirmResend] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedHatch) {
      setMessageText('');
      setEmailSubject('');
      return;
    }
    setMessageText(buildEclosionMessage(selectedHatch));
    setEmailSubject(buildEclosionSubject(selectedHatch));
    setConfirmResend(false);
    setSendResult(null);
  }, [selectedHatch]);

  // Initialiser les cases à cocher : cocher uniquement ceux qui n'ont PAS encore reçu le message
  useEffect(() => {
    const next: Record<string, boolean> = {};
    recipients.forEach((r) => {
      const rec = sendLog[r.stableKey];
      const alreadySent = Boolean(rec?.emailAt || rec?.waAt);
      const hasContact = Boolean(r.email || r.waPhone);
      next[r.stableKey] = hasContact && !alreadySent;
    });
    setCheckedKeys(next);
    setConfirmResend(false);
  }, [recipients, selectedHatch?.id]);

  // Filters
  const [filterMode, setFilterMode] = useState<
    'all' | 'pending' | 'sent' | 'grands' | 'clients'
  >('all');
  const [searchClient, setSearchClient] = useState<string>('');
  const [showDuplicatesModal, setShowDuplicatesModal] = useState<boolean>(false);

  // Sending status
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<{
    ok: boolean;
    text: string;
    detail?: string;
  } | null>(null);

  const isClientAlreadySent = useCallback(
    (r: UnifiedRecipient): boolean => {
      const rec = sendLog[r.stableKey];
      return Boolean(rec?.emailAt || rec?.waAt);
    },
    [sendLog]
  );

  const filteredRecipients = useMemo(() => {
    const q = normalizeText(searchClient);
    return recipients.filter((r) => {
      const already = isClientAlreadySent(r);
      if (filterMode === 'pending' && already) return false;
      if (filterMode === 'sent' && !already) return false;
      if (filterMode === 'grands' && r.source !== 'Grands_Clients') return false;
      if (filterMode === 'clients' && r.source !== 'Clients') return false;
      if (!q) return true;
      return (
        normalizeText(r.displayName).includes(q) ||
        normalizeText(r.ville).includes(q) ||
        r.rawPhone.includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    });
  }, [recipients, filterMode, searchClient, isClientAlreadySent]);

  const selectedRecipients = useMemo(
    () => recipients.filter((r) => Boolean(checkedKeys[r.stableKey])),
    [recipients, checkedKeys]
  );

  const selectedAlreadySent = useMemo(
    () => selectedRecipients.filter(isClientAlreadySent),
    [selectedRecipients, isClientAlreadySent]
  );

  const selectedWithEmail = useMemo(
    () => selectedRecipients.filter((r) => Boolean(r.email)),
    [selectedRecipients]
  );
  const selectedWithWa = useMemo(
    () => selectedRecipients.filter((r) => Boolean(r.waPhone)),
    [selectedRecipients]
  );

  const sentCountTotal = useMemo(
    () => recipients.filter(isClientAlreadySent).length,
    [recipients, isClientAlreadySent]
  );

  const selectAllPending = () => {
    const next: Record<string, boolean> = {};
    recipients.forEach((r) => {
      const hasContact = Boolean(r.email || r.waPhone);
      next[r.stableKey] = hasContact && !isClientAlreadySent(r);
    });
    setCheckedKeys(next);
    setConfirmResend(false);
  };

  const selectAllVisible = (checked: boolean) => {
    setCheckedKeys((prev) => {
      const next = { ...prev };
      filteredRecipients.forEach((r) => {
        if (r.email || r.waPhone || !checked) {
          next[r.stableKey] = checked;
        }
      });
      return next;
    });
    if (!checked) setConfirmResend(false);
  };

  const uncheckAlreadySent = () => {
    setCheckedKeys((prev) => {
      const next = { ...prev };
      recipients.forEach((r) => {
        if (isClientAlreadySent(r)) next[r.stableKey] = false;
      });
      return next;
    });
    setConfirmResend(false);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch {
      showNotif('Copie bloquée par le navigateur.', false);
    }
  };

  // Envoi automatique en lot aux clients cochés (sans envoi un à un)
  const handleBatchSend = async () => {
    if (!selectedHatch || isSending || selectedRecipients.length === 0) return;

    if (selectedAlreadySent.length > 0 && !confirmResend) {
      showNotif(
        `${selectedAlreadySent.length} client(s) coché(s) ont déjà reçu ce message. Décochez-les ou confirmez le renvoi.`,
        false
      );
      return;
    }

    const doEmail = sendByEmail && selectedWithEmail.length > 0;
    const doWa = sendByWa && waGateway.connected && selectedWithWa.length > 0;

    if (!doEmail && !doWa) {
      if (sendByWa && !waGateway.connected && selectedWithEmail.length === 0) {
        showNotif(
          'Connectez votre WhatsApp (QR Code gratuit) ou cochez des clients avec Email.',
          false
        );
      } else {
        showNotif(
          'Sélectionnez au moins un client avec Email (ou connectez WhatsApp).',
          false
        );
      }
      return;
    }

    setIsSending(true);
    setSendResult(null);

    const nowIso = new Date().toISOString();
    const updatedLog: Record<string, ClientSendRecord> = { ...sendLog };
    const summaryParts: string[] = [];
    let anySuccess = false;
    let emailSentCount = 0;
    let waSentCount = 0;

    // 1. Envoi groupé automatique des Emails
    if (doEmail) {
      const targetEmails = selectedWithEmail.map((r) => r.email);
      const emailRes = await sendGroupClientDiffusionEmail(
        emailSubject || buildEclosionSubject(selectedHatch),
        messageText,
        targetEmails
      );
      if (emailRes.success) {
        anySuccess = true;
        emailSentCount = selectedWithEmail.length;
        selectedWithEmail.forEach((r) => {
          updatedLog[r.stableKey] = {
            ...updatedLog[r.stableKey],
            emailAt: nowIso,
          };
        });
        summaryParts.push(`✅ ${emailSentCount} Email(s) envoyé(s) automatiquement`);
      } else {
        summaryParts.push(`❌ Échec Email : ${emailRes.message}`);
      }
    }

    // 2. Envoi automatique par WhatsApp en lot (via serveur /api/whatsapp/send-batch)
    if (doWa) {
      const waPayload = selectedWithWa.map((r) => ({
        uid: r.uid,
        name: r.displayName,
        phone: r.waPhone,
        message: messageText,
      }));
      const waRes = await sendWhatsAppBatch(waPayload, messageText);
      if (waRes.sentCount > 0) {
        anySuccess = true;
        waSentCount = waRes.sentCount;
        const okUids = new Set(
          waRes.results.filter((x) => x.success).map((x) => x.uid)
        );
        selectedWithWa.forEach((r) => {
          if (okUids.has(r.uid)) {
            updatedLog[r.stableKey] = {
              ...updatedLog[r.stableKey],
              waAt: nowIso,
            };
          }
        });
        summaryParts.push(
          `✅ ${waRes.sentCount} WhatsApp envoyé(s)${
            waRes.failedCount > 0 ? ` (${waRes.failedCount} échec)` : ''
          }`
        );
      } else {
        summaryParts.push(`❌ Échec WhatsApp : ${waRes.message || 'Erreur envoi'}`);
      }
    }

    if (anySuccess) {
      setSendLog(updatedLog);
      saveHatchSendLog(selectedHatch.id, updatedLog);
      // Décocher automatiquement les clients qui viennent d'être envoyés pour empêcher un double envoi !
      setCheckedKeys((prev) => {
        const next = { ...prev };
        selectedRecipients.forEach((r) => {
          if (updatedLog[r.stableKey]?.emailAt || updatedLog[r.stableKey]?.waAt) {
            next[r.stableKey] = false;
          }
        });
        return next;
      });
      setConfirmResend(false);
      onMarkAnnounced(selectedHatch.id, 'diffusion', {
        emailCount: emailSentCount,
        waCount: waSentCount,
      });
    }

    setIsSending(false);
    const finalText = summaryParts.join(' • ');
    setSendResult({
      ok: anySuccess,
      text: finalText || "Aucun message n'a pu être envoyé.",
      detail:
        sendByWa && !waGateway.connected && selectedWithWa.length > 0
          ? 'Note : WhatsApp n’était pas connecté — cliquez sur « Connecter WhatsApp (Gratuit) » ci-dessus pour l’activer en 10 secondes.'
          : undefined,
    });
    showNotif(
      anySuccess ? 'Envoi automatique terminé !' : 'Échec de l’envoi.',
      anySuccess
    );
  };

  if (eligibleDates.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center space-y-4 max-w-2xl mx-auto">
        <div className="text-5xl">📢</div>
        <h2 className="text-xl font-bold text-slate-800">
          Aucune date d'éclosion éligible à diffuser
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Seules les dates d'éclosion <strong>à venir</strong> (non encore arrivées) disposant de{' '}
          <strong>plus de 1 000 poussins disponibles</strong> peuvent être diffusées aux clients.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-[#1a3050] text-white rounded-xl text-xs font-bold hover:opacity-90"
        >
          ← Retour
        </button>
      </div>
    );
  }

  const selectedDispo = selectedHatch
    ? Math.max(0, selectedHatch.prevision - selectedHatch.commande)
    : 0;

  const canExecuteSend =
    !isSending &&
    selectedRecipients.length > 0 &&
    Boolean(messageText.trim()) &&
    (selectedAlreadySent.length === 0 || confirmResend) &&
    ((sendByEmail && selectedWithEmail.length > 0) ||
      (sendByWa && waGateway.connected && selectedWithWa.length > 0));

  return (
    <div className="bg-gradient-to-br from-[#f8f9fa] to-[#eef6fb] rounded-3xl p-4 sm:p-7 space-y-5 shadow-xl border border-sky-100 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a3050] via-[#2e5984] to-[#0f766e] text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center text-2xl shrink-0">
            📢
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
              Diffusion Clients — Dates &gt; 1 000 poussins
            </h1>
            <p className="text-xs text-sky-100/90 mt-0.5">
              Cochez vos clients et envoyez en 1 clic sans envoi un à un • Protection anti-doublon intégrée
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={fetchGrandsClients}
            disabled={loadingGc}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 border border-white/20 transition"
          >
            {loadingGc ? '⏳' : '🔄'} Actualiser
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-[#1a3050] hover:bg-sky-50 transition"
          >
            ← Retour
          </button>
        </div>
      </div>

      {/* 1. Sélection date d'éclosion éligible (> aujourd'hui & > 1000 poussins) */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-extrabold uppercase tracking-wider text-[#1a3050]">
            1. Date d'éclosion à diffuser (à venir &amp; &gt; 1 000 poussins)
          </span>
          {selectedHatch && !announcedMap[selectedHatch.id] && (
            <button
              type="button"
              onClick={() => {
                onMarkAnnounced(selectedHatch.id, 'dismissed');
                showNotif('Date marquée comme déjà annoncée.', true);
              }}
              className="text-slate-500 hover:text-slate-800 underline font-semibold"
            >
              Marquer comme déjà annoncée
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {eligibleDates.map((d) => {
            const dispo = Math.max(0, d.prevision - d.commande);
            const isSelected = selectedHatch?.id === d.id;
            const dateLog = loadHatchSendLog(d.id);
            const sentClientsCount = Object.keys(dateLog).length;

            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedHatchId(d.id)}
                className={`text-left p-3.5 rounded-xl border-2 transition ${
                  isSelected
                    ? 'border-[#0f766e] bg-emerald-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-sm text-slate-900">{d.date}</span>
                  {sentClientsCount > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Déjà envoyé ({sentClientsCount})
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      À diffuser
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-[#1a5276] uppercase mt-1">
                  {d.type}
                  {d.lotId ? (
                    <span className="text-[10px] text-slate-400 font-mono font-normal ml-1">
                      • {d.lotId}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs font-extrabold text-emerald-700 mt-1 tabular-nums">
                  {formatNumberSpaces(dispo)} poussins disponibles
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Aperçu Message + Paramètres d'envoi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Message preview */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#1a3050]">
                2. Aperçu du message
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingMessage((v) => !v)}
                  className="text-xs font-bold text-[#5b7c99] hover:underline"
                >
                  {isEditingMessage ? 'Aperçu' : '✏️ Modifier'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                    copiedMsg
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {copiedMsg ? '✓ Copié' : '📋 Copier'}
                </button>
              </div>
            </div>

            {isEditingMessage ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Objet de l'email"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                />
                <textarea
                  rows={8}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-800 leading-relaxed"
                />
                {selectedHatch && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessageText(buildEclosionMessage(selectedHatch));
                      setEmailSubject(buildEclosionSubject(selectedHatch));
                    }}
                    className="text-[11px] font-bold text-[#5b7c99] hover:underline"
                  >
                    ↺ Rétablir le modèle officiel
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-[#008f5a] text-white rounded-2xl rounded-tl-sm p-4 shadow-md text-[13px] leading-relaxed whitespace-pre-wrap font-normal">
                {messageText}
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
            <span>
              Stock : <strong>{formatNumberSpaces(selectedDispo)} poussins</strong>
            </span>
            <span>
              Tarif : <strong>{selectedHatch?.prix || 0} FCFA</strong>
            </span>
          </div>
        </div>

        {/* Panneau d'envoi groupé automatique (Email + WhatsApp API serveur) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#1a3050]">
                3. Canaux &amp; Envoi Automatique
              </span>
              <span className="text-xs font-bold text-slate-600">
                <strong className="text-[#1a3050]">{selectedRecipients.length}</strong> client(s)
                coché(s) • <strong className="text-emerald-700">{sentCountTotal}</strong> déjà
                envoyé(s)
              </span>
            </div>

            {/* Sélection des canaux */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition ${
                  sendByEmail
                    ? 'border-[#1a3050] bg-sky-50/70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendByEmail}
                  onChange={(e) => setSendByEmail(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-[#1a3050]"
                />
                <div className="text-xs">
                  <div className="font-extrabold text-slate-900">
                    📧 Email automatique ({selectedWithEmail.length})
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Part automatiquement vers les clients cochés ayant un email.
                  </div>
                </div>
              </label>

              <div
                className={`p-3 rounded-xl border-2 transition ${
                  waGateway.connected
                    ? sendByWa
                      ? 'border-[#25D366] bg-emerald-50/70'
                      : 'border-slate-200 bg-slate-50'
                    : 'border-amber-200 bg-amber-50/60'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={sendByWa && waGateway.connected}
                    disabled={!waGateway.connected}
                    onChange={(e) => setSendByWa(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#25D366]"
                  />
                  <div className="text-xs flex-1">
                    <div className="font-extrabold text-slate-900 flex flex-wrap items-center justify-between gap-1">
                      <span>💬 WhatsApp ({selectedWithWa.length})</span>
                      {waGateway.checked && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            waGateway.connected
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {waGateway.connected ? '✓ Connecté' : 'À connecter'}
                        </span>
                      )}
                    </div>

                    {waGateway.connected ? (
                      <div className="text-[11px] text-emerald-800 mt-0.5 flex items-center justify-between gap-2">
                        <span>
                          {waGateway.builtin?.connectedName ||
                            (waGateway.builtin?.connectedPhone
                              ? `+${waGateway.builtin.connectedPhone}`
                              : 'Passerelle active')}
                        </span>
                        {waGateway.provider === 'builtin' && (
                          <button
                            type="button"
                            onClick={handleDisconnectWa}
                            className="text-red-600 hover:underline font-bold"
                          >
                            Déconnecter
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartWaQr(true, pairingPhoneInput || '22366565055')}
                          className="px-2.5 py-1.5 bg-[#25D366] hover:bg-[#1fb858] text-white rounded-lg text-[11px] font-extrabold shadow-2xs transition cursor-pointer"
                        >
                          📱 Connecter ce téléphone (Sans QR)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartWaQr(false)}
                          className="px-2.5 py-1.5 bg-[#1a3050] hover:bg-[#274570] text-white rounded-lg text-[11px] font-bold shadow-2xs transition cursor-pointer"
                        >
                          📷 QR Code
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Panneau Connexion WhatsApp sans QR Code (même téléphone) ou par QR Code */}
            {showWaConnectPanel && !waGateway.connected && (
              <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold text-emerald-950 flex items-center gap-2">
                    <span>📱</span>
                    <span>Connecter votre WhatsApp sur ce téléphone (Sans QR Code • Gratuit)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWaConnectPanel(false)}
                    className="text-slate-500 hover:text-slate-800 font-bold"
                  >
                    ✕ Fermer
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  {/* Code à 8 chiffres ou QR Code */}
                  <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center space-y-3">
                    {waGateway.builtin?.pairingCode ? (
                      <div className="py-2 space-y-3">
                        <div className="text-[11px] text-slate-500 font-bold uppercase">
                          1. Copiez ce code ({pairingPhoneInput}) :
                        </div>
                        <div className="text-2xl font-black tracking-widest text-[#1a3050] font-mono bg-emerald-50 py-2.5 px-4 rounded-xl border border-emerald-200 inline-block">
                          {waGateway.builtin.pairingCode}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const rawCode = (waGateway.builtin?.pairingCode || '').replace(/-/g, '');
                                await navigator.clipboard.writeText(rawCode);
                                setCopiedCode(true);
                                setTimeout(() => setCopiedCode(false), 2500);
                              } catch {
                                showNotif('Copie bloquée par le navigateur.', false);
                              }
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                              copiedCode
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-[#1a3050] hover:bg-[#274570] text-white border-[#1a3050]'
                            }`}
                          >
                            {copiedCode ? '✓ Code copié !' : '📋 Copier le code'}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-700 leading-relaxed text-left bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <div><strong>2. Dans WhatsApp sur votre téléphone :</strong></div>
                          <div>• Appuyez sur la notification WhatsApp si elle s’affiche, <strong>OU</strong></div>
                          <div>• Ouvrez <strong>WhatsApp</strong> → <strong>⋮ / Réglages</strong> → <strong>Appareils connectés</strong> → <strong>Connecter un appareil</strong> → <strong>« Lier avec le numéro de téléphone »</strong> (en bas) et <strong>collez le code</strong>.</div>
                        </div>
                      </div>
                    ) : waGateway.builtin?.qrDataUrl ? (
                      <>
                        <img
                          src={waGateway.builtin.qrDataUrl}
                          alt="QR Code WhatsApp"
                          className="w-44 h-44 mx-auto rounded-lg"
                        />
                        <div className="text-[11px] text-slate-600 leading-snug">
                          Ouvrez WhatsApp → <strong>Appareils connectés</strong> →{' '}
                          <strong>Connecter un appareil</strong> et scannez ce code.
                        </div>
                      </>
                    ) : (
                      <div className="py-10 text-slate-500 space-y-2">
                        <div className="text-2xl">⏳</div>
                        <div>
                          {isConnectingWa
                            ? 'Génération du code en cours...'
                            : 'Connexion aux serveurs WhatsApp en cours...'}
                        </div>
                      </div>
                    )}
                    {waGateway.builtin?.lastError && (
                      <div className="text-[11px] text-red-600 font-semibold">
                        ⚠️ {waGateway.builtin.lastError}
                      </div>
                    )}
                  </div>

                  {/* Changer le numéro ou basculer en QR Code */}
                  <div className="space-y-2.5 text-[11px] text-slate-700">
                    <div className="font-extrabold text-slate-900 text-xs">
                      Numéro WhatsApp à connecter :
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Aucun scan nécessaire : WhatsApp vous envoie une notification directe sur ce numéro pour valider en 1 clic :
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pairingPhoneInput}
                        onChange={(e) => setPairingPhoneInput(e.target.value)}
                        placeholder="22366565055"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleStartWaQr(true)}
                        disabled={isConnectingWa}
                        className="px-3 py-2 bg-[#1a3050] hover:bg-[#274570] text-white rounded-xl font-bold shrink-0 cursor-pointer"
                      >
                        Nouveau code
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartWaQr(false)}
                      disabled={isConnectingWa}
                      className="text-[#0f766e] font-bold hover:underline cursor-pointer"
                    >
                      📷 Ou afficher un QR Code (si vous êtes sur un PC)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Alerte anti-doublon si des clients déjà envoyés sont cochés */}
            {selectedAlreadySent.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 text-xs text-amber-950 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-extrabold">
                    ⚠️ Attention : {selectedAlreadySent.length} client(s) coché(s) ont DÉJÀ reçu ce
                    message !
                  </div>
                  <button
                    type="button"
                    onClick={uncheckAlreadySent}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px]"
                  >
                    Décocher les déjà envoyés
                  </button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={confirmResend}
                    onChange={(e) => setConfirmResend(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-700"
                  />
                  <span>Confirmer le renvoi du même message à ces clients</span>
                </label>
              </div>
            )}

            {/* Bouton principal d'envoi automatique aux clients cochés */}
            <button
              type="button"
              onClick={handleBatchSend}
              disabled={!canExecuteSend}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-[#1a3050] to-[#0f766e] hover:opacity-95 disabled:opacity-45 text-white rounded-2xl font-extrabold text-sm shadow-md transition cursor-pointer disabled:cursor-not-allowed"
            >
              {isSending
                ? '⏳ Envoi automatique en cours...'
                : `🚀 Envoyer aux ${selectedRecipients.length} client(s) coché(s)`}
            </button>

            {sendResult && (
              <div
                className={`text-xs rounded-xl p-3 border space-y-1 ${
                  sendResult.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="font-bold">{sendResult.text}</div>
                {sendResult.detail && (
                  <div className="text-[11px] opacity-90">{sendResult.detail}</div>
                )}
              </div>
            )}
          </div>

          {/* Option envoi automatique dès nouvelle éclosion > 1000 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-extrabold text-slate-900">
                ⚡ Envoi Email automatique dès qu'une nouvelle date (&gt; 1 000) arrive
              </div>
              <div className="text-[11px] text-slate-500">
                Envoie une seule fois automatiquement par email et marque les clients comme envoyés.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoEmailEnabled}
                onChange={(e) => onToggleAutoEmail(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0f766e]" />
            </label>
          </div>
        </div>
      </div>

      {/* 4. Liste des clients à cocher (Grands_Clients + Clients sans doublons) */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1a3050]">
              4. Choisir les clients à contacter ({recipients.length} uniques •{' '}
              {excludedDuplicates.length} doublons retirés)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Les clients ayant déjà reçu le message pour le <strong>{selectedHatch?.date}</strong>{' '}
              sont signalés en vert et décochés automatiquement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={selectAllPending}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold"
            >
              ✓ Cocher non envoyés ({recipients.length - sentCountTotal})
            </button>
            <button
              type="button"
              onClick={() => selectAllVisible(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
            >
              Tout cocher
            </button>
            <button
              type="button"
              onClick={() => selectAllVisible(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
            >
              Tout décocher
            </button>
            <button
              type="button"
              onClick={() => setShowDuplicatesModal((v) => !v)}
              className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold"
            >
              Doublons retirés ({excludedDuplicates.length})
            </button>
          </div>
        </div>

        {gcError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-2.5">
            ⚠️ {gcError}
          </div>
        )}

        {showDuplicatesModal && excludedDuplicates.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1.5">
            <div className="font-bold text-amber-900">
              Clients retirés de « Clients » car déjà dans « Grands_Clients » :
            </div>
            <div className="flex flex-wrap gap-1.5">
              {excludedDuplicates.map((d, i) => (
                <span
                  key={`${d.displayName}_${i}`}
                  className="px-2 py-1 rounded-lg bg-white border border-amber-200 text-[11px] text-slate-700"
                >
                  <strong>{d.displayName}</strong> — {d.reason}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filter pills + search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'all', label: `Tous (${recipients.length})` },
              {
                id: 'pending',
                label: `À envoyer (${Math.max(0, recipients.length - sentCountTotal)})`,
              },
              { id: 'sent', label: `Déjà envoyés (${sentCountTotal})` },
              { id: 'grands', label: `Grands Clients (${grandsClients.length})` },
              {
                id: 'clients',
                label: `Clients (${Math.max(0, recipients.length - grandsClients.length)})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  filterMode === tab.id
                    ? 'bg-[#1a3050] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchClient}
            onChange={(e) => setSearchClient(e.target.value)}
            placeholder="Rechercher nom, ville, tél, email..."
            className="w-full sm:w-64 px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#1a3050]"
          />
        </div>

        {/* Table with checkboxes */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto max-h-[48vh]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">Choix</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Feuille</th>
                  <th className="py-3 px-3">WhatsApp</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Statut pour le {selectedHatch?.date}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loadingGc && recipients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      ⏳ Chargement des clients...
                    </td>
                  </tr>
                ) : filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Aucun client pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((r) => {
                    const rec = sendLog[r.stableKey];
                    const alreadySent = Boolean(rec?.emailAt || rec?.waAt);
                    const isChecked = Boolean(checkedKeys[r.stableKey]);
                    const hasContact = Boolean(r.email || r.waPhone);

                    return (
                      <tr
                        key={r.uid}
                        onClick={() => {
                          if (!hasContact) return;
                          setCheckedKeys((prev) => ({
                            ...prev,
                            [r.stableKey]: !prev[r.stableKey],
                          }));
                        }}
                        className={`transition ${
                          hasContact ? 'cursor-pointer' : 'opacity-55'
                        } ${
                          alreadySent
                            ? isChecked
                              ? 'bg-amber-50/70'
                              : 'bg-emerald-50/40'
                            : isChecked
                            ? 'bg-sky-50/50 hover:bg-sky-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td
                          className="py-2.5 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            disabled={!hasContact}
                            checked={isChecked}
                            onChange={(e) =>
                              setCheckedKeys((prev) => ({
                                ...prev,
                                [r.stableKey]: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded text-[#0f766e] border-slate-300 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{r.displayName}</div>
                          {r.ville && (
                            <div className="text-[11px] text-slate-500">{r.ville}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.source === 'Grands_Clients'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {r.source === 'Grands_Clients' ? 'Grands Clients' : 'Clients'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                          {r.waPhone ? `+${r.waPhone}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 break-all text-slate-700">
                          {r.email || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {alreadySent ? (
                            <div className="flex flex-wrap gap-1">
                              {rec?.emailAt && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ Déjà envoyé Email ({formatShortTimestamp(rec.emailAt)})
                                </span>
                              )}
                              {rec?.waAt && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ Déjà envoyé WA ({formatShortTimestamp(rec.waAt)})
                                </span>
                              )}
                            </div>
                          ) : !hasContact ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                              Coordonnées manquantes
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Pas encore envoyé
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
