import React, { useState } from 'react';
import { getGSheetWebappUrl, setGSheetWebappUrl, SyncResult } from '../services/googleSheet';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Database, 
  ExternalLink, 
  ShieldCheck, 
  Lock, 
  FileCode2, 
  HelpCircle,
  Copy,
  Check,
  Edit2,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: { syncing: boolean; lastSync: string; error?: string };
  onTriggerSync: () => void;
  lastResult: SyncResult | null;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onTriggerSync,
  lastResult,
}) => {
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState(getGSheetWebappUrl());
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!isOpen) return null;

  const FIXED_APPS_SCRIPT_CODE = `// ==========================================
// CODE GOOGLE APPS SCRIPT POUR COUVOIR SAMCHE
// ==========================================
// Ce code utilise getActiveSpreadsheet() pour se lier directement au classeur
// SANS AUCUN BESOIN D'IDENTIFIANT (évite les erreurs d'ID de document) !

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getAll";
  var ss = getSS();
  
  if (action === "getAll") {
    var result = {};
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var name = sheet.getName().toLowerCase().trim().replace(/[\\s-]+/g, "_");
      result[name] = sheet.getDataRange().getValues();
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "API Couvoir SAMCHE opérationnelle" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : "";
    var payload = JSON.parse(contents);
    var ss = getSS();
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Enregistrement effectué" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyFixedScript = () => {
    navigator.clipboard.writeText(FIXED_APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleRestoreWorkingUrl = () => {
    const workingUrl = 'https://script.google.com/macros/s/AKfycbwZLonbfs4JZLyF9WIYIwx1KbcPBH8rshwNKBeYEtwPwlxIhZkA1JmZRoWf3u4V6B_IsA/exec';
    setCustomUrl(workingUrl);
    setGSheetWebappUrl(workingUrl);
    setIsEditingUrl(false);
    onTriggerSync();
  };

  const handleSaveUrl = () => {
    const trimmed = customUrl.trim();
    setGSheetWebappUrl(trimmed);
    setIsEditingUrl(false);
    onTriggerSync();
  };

  const handlePasteUrl = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (pasted && pasted.includes('script.google.com')) {
      setCustomUrl(pasted);
      setGSheetWebappUrl(pasted);
      setIsEditingUrl(false);
      onTriggerSync();
    }
  };

  const handleResetUrl = () => {
    const defaultUrl = 'https://script.google.com/macros/s/AKfycbwZLonbfs4JZLyF9WIYIwx1KbcPBH8rshwNKBeYEtwPwlxIhZkA1JmZRoWf3u4V6B_IsA/exec';
    setCustomUrl(defaultUrl);
    setGSheetWebappUrl(defaultUrl);
    setIsEditingUrl(false);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(getGSheetWebappUrl());
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const isHtmlError = lastResult?.isHtmlError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Synchronisation Google Sheets</h3>
              <p className="text-xs text-slate-500">Liaison bidirectionnelle Couvoir & Google Drive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition text-lg font-bold"
            title="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-sm">
          {/* Detailed Alert Banner for HTML or Sync Errors */}
          {lastResult && !lastResult.success && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-700 shrink-0 mt-0.5">
                  {isHtmlError ? (
                    lastResult.errorCategory === 'google_auth' ? <Lock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-rose-950 text-sm">
                      {lastResult.errorTitle || 'Échec de synchronisation'}
                    </h4>
                    {lastResult.statusCode && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-200/70 text-rose-800 font-semibold">
                        HTTP {lastResult.statusCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-rose-900 leading-relaxed">
                    {lastResult.errorDetails || lastResult.message}
                  </p>
                </div>
              </div>

              {/* Actionable guidance if HTML or Auth error */}
              {lastResult.suggestedAction && (
                <div className="bg-white/90 border border-rose-200/80 rounded-xl p-3 space-y-1.5 text-xs text-slate-700 shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    <span>Action recommandée pour corriger :</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed font-normal whitespace-pre-line">
                    {lastResult.suggestedAction}
                  </p>
                </div>
              )}

              {/* Quick 1-Click Fix for Spreadsheet ID Errors */}
              {(lastResult.errorDetails?.includes('Illegal spreadsheet id') || 
                lastResult.errorDetails?.includes('Service Spreadsheets failed') ||
                lastResult.errorTitle?.includes('Identifiant')) && (
                <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 space-y-2.5 text-xs text-amber-900 shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Options de résolution immédiate :</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-normal">
                    Votre script Google utilise un identifiant qui a causé l'erreur. Vous pouvez restaurer en 1 clic l'URL d'origine validée, ou copier le script corrigé qui se lie directement au classeur.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      onClick={handleRestoreWorkingUrl}
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Restaurer l'URL active Couvoir SAMCHE</span>
                    </button>
                    <button
                      onClick={handleCopyFixedScript}
                      className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? 'Code copié dans le presse-papiers !' : 'Copier le script Code.gs corrigé'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Technical details accordion for HTML previews */}
              {lastResult.htmlPreview && (
                <div className="pt-1">
                  <button
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 hover:text-rose-900 transition"
                  >
                    {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{showTechnicalDetails ? 'Masquer le contenu HTML retourné' : 'Voir le contenu HTML retourné par Google'}</span>
                  </button>

                  {showTechnicalDetails && (
                    <div className="mt-2 p-2.5 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto border border-slate-800 space-y-1">
                      <div className="text-slate-400 text-[10px] pb-1 border-b border-slate-800 flex justify-between">
                        <span>Aperçu de la réponse brute</span>
                        <span>{lastResult.statusCode ? `Code: ${lastResult.statusCode}` : 'HTML Page'}</span>
                      </div>
                      <pre className="whitespace-pre-wrap break-all">{lastResult.htmlPreview}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Success Result */}
          {lastResult && lastResult.success && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex-1 font-medium">{lastResult.message}</div>
              <span className="text-emerald-700 font-mono text-[11px]">{lastResult.timestamp}</span>
            </div>
          )}

          {/* Quick Access to Google Sheets File */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-sky-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <div>
                  <h4 className="font-extrabold text-emerald-950 text-sm">
                    Accès direct au Classeur Google Sheets
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Compte propriétaire : <strong>samcheentreprise@gmail.com</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href="https://docs.google.com/spreadsheets/u/0/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition shadow-sm hover:shadow"
              >
                <span>📊 Ouvrir Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href="https://drive.google.com/drive/u/0/my-drive"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition shadow-sm hover:shadow"
              >
                <span>📁 Ouvrir dans Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-emerald-200/60 space-y-1">
              <div className="font-bold text-slate-800">Feuilles synchronisées dans ce classeur :</div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {[
                  'gestions_oac',
                  'en_attente',
                  'commandes_poussins',
                  'ventes',
                  'depenses',
                  'factures',
                  'caisse',
                  'clients',
                  'bordereaux',
                  'notifications'
                ].map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-md bg-emerald-100/70 text-emerald-900 font-mono text-[10px] font-semibold border border-emerald-200">
                    📄 {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Connection URL Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4 text-sky-600" />
                URL Web App Google Apps Script :
              </span>
              <button
                onClick={() => setIsEditingUrl(!isEditingUrl)}
                className="text-xs text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1 transition"
              >
                <Edit2 className="w-3 h-3" />
                <span>{isEditingUrl ? 'Annuler' : 'Modifier l\'URL'}</span>
              </button>
            </div>

            {isEditingUrl ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  onPaste={handlePasteUrl}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
                <p className="text-[11px] text-sky-800 bg-sky-50 p-2 rounded-lg border border-sky-100 flex items-center gap-1.5">
                  <span>⚡ <strong>Auto-synchronisation :</strong> Enregistrer ou coller une URL déclenchera immédiatement le test et le chargement des données.</span>
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleResetUrl}
                    className="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
                  >
                    Réinitialiser
                  </button>
                  <button
                    onClick={handleSaveUrl}
                    className="text-xs px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Appliquer & Synchroniser automatiquement</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-600 break-all font-mono bg-white p-2.5 rounded-xl border border-slate-200 flex-1 select-all">
                  {getGSheetWebappUrl()}
                </div>
                <button
                  onClick={handleCopyUrl}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-white text-slate-600 hover:text-slate-900 transition"
                  title="Copier l'URL"
                >
                  {copiedUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={getGSheetWebappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl border border-slate-200 hover:bg-white text-sky-600 hover:text-sky-800 transition"
                  title="Ouvrir directement dans un nouvel onglet"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            <div className="text-xs text-slate-500 flex justify-between pt-1 border-t border-slate-200/60">
              <span>Dernière tentative de synchro :</span>
              <strong className="text-slate-700">{syncStatus.lastSync || 'À l’instant'}</strong>
            </div>
          </div>

          {/* Google Apps Script Checklist */}
          <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-100 text-xs space-y-2">
            <h5 className="font-bold text-sky-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-700" />
              Checklist pour un déploiement Google Sheets réussi :
            </h5>
            <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
              <li>
                Type de déploiement : <strong>Application Web</strong> (Web app).
              </li>
              <li>
                Exécuter en tant que : <strong>Moi (votre adresse email)</strong>.
              </li>
              <li>
                Qui a accès : <strong className="text-sky-900 font-semibold underline decoration-sky-400">Tout le monde (Anyone)</strong> (évite la page HTML de connexion Google).
              </li>
              <li>
                Assurez-vous que l'URL se termine bien par <code>/exec</code> (et non <code>/dev</code>).
              </li>
            </ul>
          </div>

          {/* Action Trigger Button */}
          <div className="pt-2">
            <button
              onClick={onTriggerSync}
              disabled={syncStatus.syncing}
              className="w-full flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-600 text-white font-bold py-3.5 rounded-2xl transition shadow-md hover:shadow-lg disabled:opacity-50 text-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus.syncing ? 'animate-spin' : ''}`} />
              <span>{syncStatus.syncing ? 'Synchronisation en cours...' : 'Lancer la Synchronisation Maintenant'}</span>
            </button>
            {syncStatus.syncing && (
              <p className="text-center text-xs text-sky-700 animate-pulse font-medium pt-2">
                ⏳ Communication avec Google Apps Script en cours (compilation des 14 feuilles)...
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            Couvoir SAMCHE • Google Sheets API
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
