import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Depense, Facture } from '../types';
import { callApi } from '../services/googleSheet';

// ============================================================
// JustificatifsDepense.tsx — v3.0 (générique : dépenses ET factures)
// ------------------------------------------------------------
// Galerie façon Expensify / SAP Concur / app bancaire :
//   - Drop-zone (glisser-déposer) + bouton "Ajouter"
//   - Vignettes (thumbnails) pour les images, icône PDF sinon
//   - Compteur + barre d'occupation
//   - Preview plein écran (modal) avec navigation ← / →
//   - Suppression individuelle (avec confirmation)
//   - Téléchargement direct
//   - États de chargement, erreurs, et badge "X en cours d'envoi"
//
// Supporte DEUX types de justificatifs via la prop `actionPrefix` :
//   - 'depenses' (défaut) : actions depenses.joindreJustificatif, etc.
//   - 'factures'          : actions factures.joindreJustificatif, etc.
//
// La clé de liaison est calculée automatiquement à partir de `depense` ou
// `facture`, ou fournie explicitement via `cle`.
//
// ⚠️ PREREQUIS BACKEND (fichier Justificatifs.gs) :
//   - {prefix}.justificatifs          : GET  → { success, fichiers: [{nom, type, url, auteur?, dateAjout?}] }
//   - {prefix}.joindreJustificatif    : POST → { success, message? }
//   - {prefix}.supprimerJustificatif  : POST → { success, message? }
//   - {prefix}.justificatifsCles      : GET  → { success, counts: { cle: n } }
// ============================================================

interface Fichier {
  nom: string;
  type: string;
  url: string;
  idDrive?: string;
  auteur?: string;
  dateAjout?: string;
}

export type JustifPrefix = 'depenses' | 'factures';

// ─── Clés de liaison (ne dépendent pas du numéro de ligne) ─────────────────

// Clé pour une DÉPENSE : date | montant | sousCategorie | libelle
export const cleJustificatif = (d: Depense): string =>
  [d.date, Number(d.montant || 0).toFixed(2), d.sousCategorie, d.libelle]
    .map((s) => String(s ?? '').trim().toLowerCase())
    .join('|');

// Clé pour une FACTURE : FAC:numero | date | total | client
export const cleJustificatifFacture = (f: Facture): string =>
  [`FAC:${f.numero || ''}`, f.date || '', Number(f.total || 0).toFixed(2), f.client || '']
    .map((s) => String(s ?? '').trim().toLowerCase())
    .join('|');

// ─── Constantes ────────────────────────────────────────────────────────────

const MAX_IMAGE_DIM = 1600;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 Mo après compression
const ACCEPTED = 'image/*,application/pdf';

// ─── Helpers ───────────────────────────────────────────────────────────────

const compresserImage = (file: File): Promise<{ base64: string; type: string }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Traitement d'image indisponible"));
        return;
      }
      // Fond blanc pour les PNG transparents (reçus en JPEG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      URL.revokeObjectURL(url);
      resolve({ base64: dataUrl.split(',')[1] || '', type: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };
    img.src = url;
  });

const lireBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });

const getUsername = (): string => {
  try {
    const stored = JSON.parse(localStorage.getItem('samche_user') || 'null');
    return stored?.username || '';
  } catch {
    return '';
  }
};

const estImage = (type: string, nom: string): boolean => {
  if (typeof type === 'string' && type.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(nom);
};

const estPdf = (type: string, nom: string): boolean => {
  if (type === 'application/pdf') return true;
  return /\.pdf$/i.test(nom);
};

const iconeExtension = (nom: string): string => {
  const m = /\.([a-z0-9]+)$/i.exec(nom || '');
  return m ? m[1].toUpperCase().slice(0, 4) : 'FICH';
};

// ─── Composant principal ───────────────────────────────────────────────────

interface JustificatifsDepenseProps {
  /** Dépense (mode dépenses — calcul la clé automatiquement) */
  depense?: Depense;
  /** Facture (mode factures — calcul la clé automatiquement) */
  facture?: Facture;
  /** Clé explicite (alternative à depense/facture) */
  cle?: string;
  /** Préfixe d'actions API : 'depenses' ou 'factures' (défaut: 'depenses') */
  actionPrefix?: JustifPrefix;
  /** Titre affiché dans l'en-tête (défaut: 'Justificatifs') */
  titre?: string;
  /** Couleur de l'en-tête (défaut: dégradé bleu SAMCHE) */
  couleur?: 'bleu' | 'or';
  /** Callback appelé après ajout/suppression (pour rafraîchir les badges) */
  onChange?: () => void;
  /** Variante compacte (sans drop-zone, juste bouton + galerie) */
  compact?: boolean;
}

export const JustificatifsDepense: React.FC<JustificatifsDepenseProps> = ({
  depense,
  facture,
  cle: cleExplicit,
  actionPrefix = 'depenses',
  titre = 'Justificatifs',
  couleur = 'bleu',
  onChange,
  compact = false,
}) => {
  // Calcul de la clé de liaison
  const cle = cleExplicit
    || (depense ? cleJustificatif(depense) : '')
    || (facture ? cleJustificatifFacture(facture) : '');

  const prefix = actionPrefix;
  const actions = {
    lister: `${prefix}.justificatifs`,
    joindre: `${prefix}.joindreJustificatif`,
    supprimer: `${prefix}.supprimerJustificatif`,
  };

  const [fichiers, setFichiers] = useState<Fichier[]>([]);
  const [chargement, setChargement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [fileEnCours, setFileEnCours] = useState<string>('');
  const [progression, setProgression] = useState<{ fait: number; total: number }>({ fait: 0, total: 0 });
  const [message, setMessage] = useState<{ text: string; ok: boolean; details?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [confirmSuppr, setConfirmSuppr] = useState<number | null>(null);
  const [supprEnCours, setSupprEnCours] = useState(false);
  const [supprDisponible, setSupprDisponible] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charger = useCallback(async () => {
    if (!cle) {
      setFichiers([]);
      return;
    }
    setChargement(true);
    try {
      const res = await callApi(actions.lister, { cle }, 'GET');
      // ✅ CORRECTION : la réponse GAS est enveloppée dans { success, action, data: {...} }
      // Les fichiers sont dans res.data.fichiers (pas res.fichiers directement)
      const inner = res?.data || res; // fallback au cas où la réponse n'est pas enveloppée
      const fichiers = inner?.fichiers || [];
      const isOk = res?.success || inner?.success;
      if (isOk) {
        setFichiers(fichiers);
        // Ne pas écraser un message d'erreur d'upload récent
        if (!message || message.ok) setMessage(null);
      } else {
        setFichiers([]);
        setMessage({
          text: inner?.message || res?.message || 'Impossible de charger les justificatifs.',
          ok: false,
        });
      }
    } catch (err: any) {
      setMessage({
        text: 'Impossible de charger les justificatifs (erreur réseau).',
        ok: false,
        details: err?.message || String(err),
      });
    } finally {
      setChargement(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, prefix]);

  useEffect(() => {
    charger();
  }, [charger]);

  // ─── Téléversement ───────────────────────────────────────────────────────

  const envoyerFichiers = async (liste: File[]) => {
    if (liste.length === 0) return;
    if (!cle) {
      setMessage({
        text: prefix === 'factures'
          ? 'Enregistrez d\'abord la facture avant d\'ajouter un justificatif.'
          : 'Enregistrez d\'abord la dépense avant d\'ajouter un justificatif.',
        ok: false,
      });
      return;
    }

    const username = getUsername();
    if (!username) {
      setMessage({
        text: 'Utilisateur non identifié. Reconnectez-vous puis réessayez.',
        ok: false,
        details: 'Aucun username trouvé dans localStorage["samche_user"]. Le justificatif ne peut pas être téléversé sans identification.',
      });
      return;
    }

    // Validation préalable
    const refuses: string[] = [];
    const acceptes: File[] = [];
    for (const f of liste) {
      const ok = estImage(f.type, f.name) || estPdf(f.type, f.name);
      if (!ok) refuses.push(`${f.name} (type non supporté)`);
      else if (f.size > 25 * 1024 * 1024) refuses.push(`${f.name} (> 25 Mo)`);
      else acceptes.push(f);
    }

    setEnvoi(true);
    setProgression({ fait: 0, total: acceptes.length });
    let ok = 0;
    let ko = 0;
    let premierMotif = '';

    for (const f of acceptes) {
      setFileEnCours(f.name);
      try {
        const estImg = f.type.startsWith('image/');
        const contenu = estImg
          ? await compresserImage(f)
          : { base64: await lireBase64(f), type: f.type };

        // Garde-fou taille après compression
        if (contenu.base64.length > MAX_FILE_BYTES * 1.4) {
          ko++;
          if (!premierMotif) premierMotif = `${f.name} : fichier trop volumineux même compressé`;
          continue;
        }

        const res = await callApi(
          actions.joindre,
          {
            cle,
            nomFichier: f.name,
            typeMime: contenu.type,
            contenuBase64: contenu.base64,
            username,
          },
          'POST'
        );
        // ✅ CORRECTION : la réponse est enveloppée dans { success, data: {...} }
        const innerUp = res?.data || res;
        const isOkUp = res?.success || innerUp?.success;
        if (isOkUp) {
          ok++;
        } else {
          ko++;
          const motif = innerUp?.message || res?.message || res?.error || `Erreur inconnue (success=${res?.success})`;
          if (!premierMotif) premierMotif = motif;
          if (res?.code === 'ACTION_INCONNUE' || innerUp?.code === 'ACTION_INCONNUE' || /action inconnue/i.test(String(motif))) {
            setSupprDisponible(false);
          }
        }
      } catch (err: any) {
        ko++;
        const motif = err?.message || String(err) || 'Erreur réseau';
        if (!premierMotif) premierMotif = motif;
      }
      setProgression((p) => ({ fait: p.fait + 1, total: p.total }));
    }

    setFileEnCours('');
    setEnvoi(false);
    const texteMessage =
      (ok > 0 ? `${ok} ajouté(s)` : '') +
      (ok > 0 && ko > 0 ? ' • ' : '') +
      (ko > 0 ? `${ko} échec(s)${premierMotif ? ` — ${premierMotif}` : ''}` : '') +
      (refuses.length > 0 ? ` • ${refuses.length} refusé(s)` : '');
    setMessage({
      text: texteMessage || 'Aucun fichier traité.',
      ok: ko === 0 && refuses.length === 0,
    });
    await charger();
    if (onChange) onChange();
  };

  const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const liste: File[] = Array.from(e.target.files || []);
    e.target.value = '';
    await envoyerFichiers(liste);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const liste: File[] = Array.from(e.dataTransfer.files || []);
    await envoyerFichiers(liste);
  };

  // ─── Suppression ─────────────────────────────────────────────────────────

  const supprimerFichier = async (index: number) => {
    if (index < 0 || index >= fichiers.length) return;
    const f = fichiers[index];

    // ✅ CORRECTION : le backend _checkRole exige username pour les actions d'écriture
    // (catégorie 'ecriture' → admin + comptable). Sans username, rejet 401.
    const username = getUsername();
    if (!username) {
      setMessage({
        text: 'Utilisateur non identifié. Reconnectez-vous pour supprimer.',
        ok: false,
        details: 'La suppression est une action d\'écriture qui nécessite une identification.',
      });
      setConfirmSuppr(null);
      return;
    }

    setSupprEnCours(true);
    try {
      const res = await callApi(
        actions.supprimer,
        {
          cle,
          nomFichier: f.nom,
          url: f.url,
          idDrive: f.idDrive,
          username,  // ✅ AJOUT CRITIQUE : sans ça, _checkRole rejette avec 401
        },
        'POST'
      );
      // ✅ CORRECTION : gérer la réponse enveloppée { success, data: {...} }
      const innerDel = res?.data || res;
      const isOkDel = res?.success || innerDel?.success;
      const motifDel = innerDel?.message || res?.message || '';
      if (isOkDel) {
        setMessage({ text: `« ${f.nom} » supprimé.`, ok: true });
        await charger();
        if (onChange) onChange();
      } else if (res?.code === 'ACTION_INCONNUE' || innerDel?.code === 'ACTION_INCONNUE' || /action inconnue|404/i.test(String(motifDel))) {
        setSupprDisponible(false);
        setMessage({
          text: `La suppression n'est pas encore activée côté serveur (action « ${actions.supprimer} » manquante).`,
          ok: false,
        });
      } else if (res?.code === 401 || /identifiant utilisateur requis|username/i.test(String(motifDel))) {
        setMessage({
          text: 'Suppression refusée : identification requise. Reconnectez-vous.',
          ok: false,
          details: motifDel,
        });
      } else if (res?.code === 403 || /accès refusé|réservé/i.test(String(motifDel))) {
        setMessage({
          text: 'Suppression refusée : votre rôle ne permet pas cette action.',
          ok: false,
          details: motifDel + '\n\nLa suppression nécessite le rôle "admin" ou "comptable".',
        });
      } else {
        setMessage({ text: motifDel || 'Suppression impossible.', ok: false, details: `Action: ${actions.supprimer}\nRéponse: ${JSON.stringify(res).slice(0, 300)}` });
      }
    } catch (err: any) {
      setMessage({ text: err?.message || 'Suppression impossible.', ok: false });
    } finally {
      setSupprEnCours(false);
      setConfirmSuppr(null);
    }
  };

  // ─── Preview ─────────────────────────────────────────────────────────────

  const ouvrirPreview = (i: number) => setPreviewIndex(i);
  const fermerPreview = () => setPreviewIndex(null);
  const previewSuivant = () =>
    setPreviewIndex((i) => (i === null ? null : (i + 1) % fichiers.length));
  const previewPrecedent = () =>
    setPreviewIndex((i) => (i === null ? null : (i - 1 + fichiers.length) % fichiers.length));

  // Navigation clavier dans la preview
  useEffect(() => {
    if (previewIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermerPreview();
      else if (e.key === 'ArrowRight') previewSuivant();
      else if (e.key === 'ArrowLeft') previewPrecedent();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewIndex, fichiers.length]);

  // ─── Rendu ───────────────────────────────────────────────────────────────

  const count = fichiers.length;
  const headerBg =
    couleur === 'or'
      ? 'bg-gradient-to-r from-[#1a3050] to-[#c8a850]'
      : 'bg-gradient-to-r from-[#1B4F72] to-[#2E86C1]';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${headerBg}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">📎</span>
          <span className="text-sm font-bold text-white tracking-wide">
            {titre}
            {count > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold">
                {count}
              </span>
            )}
          </span>
        </div>
        <label
          className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase cursor-pointer transition shadow-sm ${
              envoi
                ? 'bg-slate-300 text-slate-500 cursor-wait'
                : 'bg-white text-[#1B4F72] hover:bg-slate-50 active:scale-95'
            }`}
        >
            {envoi ? '⏳ Envoi…' : '+ Ajouter'}
            <input
              ref={fileInputRef}
              type="file"
              multiple
            accept={ACCEPTED}
            className="hidden"
            disabled={envoi}
            onChange={handleInput}
          />
        </label>
      </div>

      {/* Drop-zone (masquée en mode compact) */}
      {!compact && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!envoi) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mx-3 mt-3 mb-2 rounded-lg border-2 border-dashed p-4 text-center transition ${
            dragOver
              ? 'border-[#2E86C1] bg-[#eaf2f8] scale-[1.01]'
              : 'border-slate-200 bg-slate-50/50'
          }`}
        >
          <div className="text-[11px] text-slate-500">
            {dragOver ? (
              <span className="font-bold text-[#2E86C1]">⬇ Déposer les fichiers ici</span>
            ) : (
              <>
                <span className="font-semibold text-slate-700">Glisser-déposer</span> ou cliquer{' '}
                <span className="font-semibold text-slate-700">« Ajouter »</span>
                <br />
                <span className="text-slate-400">Images (JPG, PNG…) ou PDF • max 25 Mo / fichier</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Barre de progression d'envoi */}
      {envoi && progression.total > 0 && (
        <div className="mx-3 mb-2">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>
              Téléversement {progression.fait}/{progression.total}
              {fileEnCours ? ` — ${fileEnCours.length > 32 ? fileEnCours.slice(0, 30) + '…' : fileEnCours}` : ''}
            </span>
            <span>{Math.round((progression.fait / progression.total) * 100)} %</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] transition-all duration-300"
              style={{ width: `${(progression.fait / progression.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Liste / Galerie */}
      <div className="px-3 pb-3">
        {chargement && (
          <div className="flex items-center justify-center py-6 text-[11px] text-slate-400">
            <svg className="animate-spin h-4 w-4 mr-2 text-[#2E86C1]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Chargement…
          </div>
        )}

        {!chargement && count === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="text-3xl opacity-30 mb-1">🗂️</div>
            <p className="text-[11px] text-slate-500">Aucun justificatif pour cette entrée.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Ajoutez une photo du reçu ou un PDF.
            </p>
          </div>
        )}

        {!chargement && count > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {fichiers.map((f, i) => {
              const isImg = estImage(f.type, f.nom);
              const isPdf = !isImg && estPdf(f.type, f.nom);
              return (
                <div
                  key={`${f.url}-${i}`}
                  className="group relative rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition"
                >
                  {/* Vignette */}
                  <button
                    type="button"
                    onClick={() => ouvrirPreview(i)}
                    className="block w-full aspect-[4/3] bg-slate-50 overflow-hidden relative focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    title="Aperçu"
                  >
                    {isImg ? (
                      <img
                        src={f.url}
                        alt={f.nom}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) parent.classList.add('flex', 'items-center', 'justify-center');
                          const span = document.createElement('span');
                          span.textContent = '🖼️';
                          span.className = 'text-3xl opacity-40';
                          parent?.appendChild(span);
                        }}
                      />
                    ) : isPdf ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#c0392b]/10 to-[#e74c3c]/10">
                        <div className="text-3xl mb-1">📕</div>
                        <div className="px-1 py-0.5 rounded bg-[#c0392b] text-white text-[9px] font-black">
                          PDF
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100">
                        <div className="text-3xl mb-1">📄</div>
                        <div className="px-1 py-0.5 rounded bg-slate-500 text-white text-[9px] font-black">
                          {iconeExtension(f.nom)}
                        </div>
                      </div>
                    )}
                    {/* Overlay hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-white text-[10px] font-bold px-2 py-1 rounded bg-white/20 backdrop-blur-sm">
                        🔍 Aperçu
                      </span>
                    </div>
                  </button>

                  {/* Métadonnées */}
                  <div className="px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-slate-700 truncate" title={f.nom}>
                      {f.nom}
                    </p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-slate-400">
                        {f.auteur ? `par ${f.auteur.slice(0, 10)}` : ''}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {/* Télécharger */}
                        <a
                          href={f.url}
                          download={f.nom}
                          title="Télécharger"
                          className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-[#1B4F72] transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                          </svg>
                        </a>
                        {/* Ouvrir dans onglet */}
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ouvrir"
                          className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-[#1B4F72] transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </a>
                        {/* Supprimer */}
                        {supprDisponible && (
                          <button
                            type="button"
                            title="Supprimer"
                            disabled={supprEnCours}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmSuppr(i);
                            }}
                            className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bandeau type en haut à gauche */}
                  <div className="absolute top-1 left-1">
                    {isImg ? (
                      <span className="px-1.5 py-0.5 rounded bg-black/60 text-white text-[8px] font-bold uppercase">
                        IMG
                      </span>
                    ) : isPdf ? (
                      <span className="px-1.5 py-0.5 rounded bg-[#c0392b] text-white text-[8px] font-bold uppercase">
                        PDF
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Message d'état */}
        {message && (
          <div
            className={`mt-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold flex items-start gap-2 ${
              message.ok
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            <span className="text-sm leading-none mt-0.5 shrink-0">{message.ok ? '✓' : '⚠'}</span>
            <div className="flex-1 min-w-0">
              <div>{message.text}</div>
              {message.details && (
                <details className="mt-1.5">
                  <summary className="text-[10px] text-red-600 cursor-pointer hover:underline font-bold">
                    🔍 Voir les détails techniques
                  </summary>
                  <pre className="mt-1 px-2 py-1.5 rounded bg-white/70 text-[9px] text-red-800 whitespace-pre-wrap break-all max-h-32 overflow-y-auto border border-red-200">
                    {message.details}
                  </pre>
                </details>
              )}
              {!message.ok && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 rounded text-[9px] font-bold bg-white text-red-600 border border-red-300 hover:bg-red-50"
                  >
                    ↻ Réessayer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Preview plein écran ---------- */}
      {previewIndex !== null && fichiers[previewIndex] && (
        <PreviewModal
          fichier={fichiers[previewIndex]}
          index={previewIndex}
          total={fichiers.length}
          onFermer={fermerPreview}
          onSuivant={previewSuivant}
          onPrecedent={previewPrecedent}
        />
      )}

      {/* ---------- Confirmation suppression ---------- */}
      {confirmSuppr !== null && fichiers[confirmSuppr] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !supprEnCours && setConfirmSuppr(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-red-600 text-xl">🗑</span>
                <h3 className="text-sm font-bold text-slate-800">Supprimer ce justificatif ?</h3>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-slate-600">
                Vous allez supprimer{' '}
                <span className="font-bold text-slate-800">« {fichiers[confirmSuppr].nom} »</span>.
                <br />
                Cette action est irréversible.
              </p>
            </div>
            <div className="flex gap-2 px-5 py-3 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                disabled={supprEnCours}
                onClick={() => setConfirmSuppr(null)}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={supprEnCours}
                onClick={() => supprimerFichier(confirmSuppr)}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#c0392b] to-[#e74c3c] hover:from-[#a93226] hover:to-[#c0392b] disabled:opacity-50"
              >
                {supprEnCours ? '⏳ Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Modal de prévisualisation plein écran
// ============================================================

interface PreviewModalProps {
  fichier: Fichier;
  index: number;
  total: number;
  onFermer: () => void;
  onSuivant: () => void;
  onPrecedent: () => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({
  fichier,
  index,
  total,
  onFermer,
  onSuivant,
  onPrecedent,
}) => {
  const isImg = estImage(fichier.type, fichier.nom);
  const isPdf = !isImg && estPdf(fichier.type, fichier.nom);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onFermer}
    >
      {/* Barre du haut */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{isPdf ? '📕' : isImg ? '🖼️' : '📄'}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate max-w-[60vw] sm:max-w-md" title={fichier.nom}>
              {fichier.nom}
            </p>
            <p className="text-[10px] text-white/60">
              {index + 1} / {total}
              {fichier.auteur ? ` • par ${fichier.auteur}` : ''}
              {fichier.dateAjout ? ` • ${fichier.dateAjout}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={fichier.url}
            download={fichier.nom}
            title="Télécharger"
            className="p-2 rounded-lg hover:bg-white/10 transition"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </a>
          <a
            href={fichier.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Ouvrir dans un onglet"
            className="p-2 rounded-lg hover:bg-white/10 transition"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
          <button
            type="button"
            onClick={onFermer}
            title="Fermer (Échap)"
            className="p-2 rounded-lg hover:bg-white/10 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Zone principale */}
      <div
        className="flex-1 flex items-center justify-center relative px-4 pb-4 min-h-0"
        onClick={onFermer}
      >
        {/* Bouton précédent */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrecedent();
            }}
            title="Précédent (←)"
            className="absolute left-2 sm:left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {/* Contenu preview */}
        <div
          className="max-w-full max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {isImg ? (
            <img
              src={fichier.url}
              alt={fichier.nom}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
          ) : isPdf ? (
            <iframe
              src={fichier.url}
              title={fichier.nom}
              className="w-[90vw] h-[80vh] sm:w-[800px] bg-white rounded-lg shadow-2xl"
            />
          ) : (
            <div className="bg-white rounded-xl p-8 text-center max-w-md">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-sm font-semibold text-slate-800 mb-1">{fichier.nom}</p>
              <p className="text-xs text-slate-500 mb-4">Aperçu non disponible pour ce type de fichier.</p>
              <a
                href={fichier.url}
                download={fichier.nom}
                className="inline-block px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#1B4F72] hover:bg-[#154360]"
              >
                Télécharger
              </a>
            </div>
          )}
        </div>

        {/* Bouton suivant */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSuivant();
            }}
            title="Suivant (→)"
            className="absolute right-2 sm:right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* Indicateur de progression en bas */}
      {total > 1 && (
        <div className="flex justify-center gap-1 pb-3">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (i === index - 1 || (i === total - 1 && index === 0)) onPrecedent();
                else onSuivant();
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Aller à ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default JustificatifsDepense;
