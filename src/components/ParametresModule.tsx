import React, { useState, useEffect } from 'react';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  Database, 
  Trash2, 
  Mail, 
  Settings, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Check, 
  ShieldAlert,
  KeyRound,
  Activity,
  Smartphone
} from 'lucide-react';
import { 
  getGSheetWebappUrl, 
  setGSheetWebappUrl, 
  getGSheetApiToken, 
  setGSheetApiToken, 
  DEFAULT_API_URL, 
  DEFAULT_API_TOKEN,
  ping 
} from '../services/googleSheet';

interface SyncStatus {
  syncing: boolean;
  lastSync: string;
  error?: string;
}

interface ParametresModuleProps {
  syncStatus: SyncStatus;
  onTriggerSync: () => void;
  onResetAllData?: (keepGsheetUrl: boolean) => void;
  onClose?: () => void;
}

export const ParametresModule: React.FC<ParametresModuleProps> = ({
  syncStatus,
  onTriggerSync,
  onResetAllData,
  onClose,
}) => {
  // Alert Emails State
  const [emailList, setEmailList] = useState<string[]>(() => {
    const stored = localStorage.getItem('alert_emails');
    return stored ? JSON.parse(stored) : ['admin@couvoirsamche.com'];
  });
  const [newEmail, setNewEmail] = useState('');
  const [gsheetUrl, setGsheetUrl] = useState(() => getGSheetWebappUrl());
  const [apiToken, setApiToken] = useState(() => getGSheetApiToken());

  // In-app UI Feedback States
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [keepGsheetUrlOnReset, setKeepGsheetUrlOnReset] = useState(true);
  const [resetSuccessToast, setResetSuccessToast] = useState(false);
  const [pingStatus, setPingStatus] = useState<{ testing: boolean; message?: string; success?: boolean } | null>(null);

  useEffect(() => {
    localStorage.setItem('alert_emails', JSON.stringify(emailList));
  }, [emailList]);

  const saveGsheetUrl = () => {
    setGSheetWebappUrl(gsheetUrl);
    setGSheetApiToken(apiToken);
    onTriggerSync();
    setSaveSuccessMsg('Configuration API & Token enregistrée ! Synchronisation en cours...');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleTestPing = async () => {
    setPingStatus({ testing: true });
    try {
      const res = await ping();
      if (res?.success) {
        setPingStatus({
          testing: false,
          success: true,
          message: `Connexion API réussie (Version ${res.data?.version || '1.1.1'})`
        });
      } else {
        setPingStatus({
          testing: false,
          success: false,
          message: `Échec de connexion : ${res?.error || 'Erreur inconnue'}`
        });
      }
    } catch (e: any) {
      setPingStatus({
        testing: false,
        success: false,
        message: `Erreur réseau : ${e.message}`
      });
    }
    setTimeout(() => setPingStatus(null), 5000);
  };

  const handlePasteGsheetUrl = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (pasted && pasted.includes('script.google.com')) {
      setGsheetUrl(pasted);
      setGSheetWebappUrl(pasted);
      onTriggerSync();
      setSaveSuccessMsg('URL collée et synchronisation automatique déclenchée !');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    }
  };

  const addEmail = () => {
    if (newEmail && !emailList.includes(newEmail)) {
      setEmailList([...emailList, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmail = (email: string) => {
    setEmailList(emailList.filter((e) => e !== email));
  };

  const handleConfirmReset = () => {
    if (onResetAllData) {
      onResetAllData(keepGsheetUrlOnReset);
    }
    if (!keepGsheetUrlOnReset) {
      setGsheetUrl(DEFAULT_API_URL);
      setApiToken(DEFAULT_API_TOKEN);
    }
    setIsResetModalOpen(false);
    setResetSuccessToast(true);
    setTimeout(() => setResetSuccessToast(false), 4000);
  };

  return (
    <div className="bg-[#eef2f7] min-h-[85vh] rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col font-sans animate-fade-in text-sm relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center justify-between text-white flex-shrink-0 shadow-md">
        <div className="flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-sky-200" />
          <h1 className="text-lg font-bold">⚙ Paramètres du Système</h1>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition font-bold"
            title="Fermer"
          >
            ✕
          </button>
        )}
      </div>

      {/* In-app Toast for Reset Confirmation */}
      {resetSuccessToast && (
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-600 text-white flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm">
              Tout le cache et les données locales ont été réinitialisés avec succès !
            </span>
          </div>
          <button onClick={() => setResetSuccessToast(false)} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-6 space-y-6 flex-1">
        {/* 0. Identité de l'Entreprise & Logo Officiel */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="w-24 h-24 rounded-2xl bg-white p-2 border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
              <img
                src="/logo-samche.png"
                alt="Logo Officiel SamChe"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/logo-samche.svg';
                }}
              />
            </div>
            <div className="space-y-1.5 text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-black text-slate-900 font-serif">
                  COUVOIR SAMCHE
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Logo Officiel Actif
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-600">
                Production &amp; Vente de Poussins d'un jour au Mali • Bamako
              </p>
              <p className="text-[11px] text-slate-500">
                Tél : +223 66 56 50 55 / +223 66 71 97 17 • Email : couvoirsamche@gmail.com
              </p>
              <p className="text-[11px] text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100 inline-block font-medium">
                ✓ Ce logo officiel est automatiquement intégré sur vos factures, bordereaux de livraison et feuilles d'émargement envoyées aux clients.
              </p>
            </div>
          </div>
        </section>

        {/* 1. Synchronisation Google Sheets */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Smartphone className="w-4 h-4 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-800">Installation sur mobile</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pour une expérience optimale, installez l'application sur votre écran d'accueil.
          </p>
          <PWAInstallButton />
        </section>

        {/* 2. Synchronisation Google Sheets */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Database className="w-4 h-4 text-sky-700" />
            <h2 className="text-base font-bold text-slate-800">Synchronisation Google Sheets</h2>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Identifiant du Classeur (Spreadsheet ID)
            </label>
            <input
              type="text"
              placeholder="Ex: 1ABC1234567890abcdefghijklmnopqrstuvwxyz"
              className="w-full px-3.5 py-2.5 mb-4 border rounded-xl text-xs font-mono bg-slate-50 border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              onChange={(e) => {
                const id = e.target.value.trim();
                if (id) {
                  const newUrl = `https://script.google.com/macros/s/AKfycbwZLonbfs4JZLyF9WIYIwx1KbcPBH8rshwNKBeYEtwPwlxIhZkA1JmZRoWf3u4V6B_IsA/exec?id=${id}`;
                  setGsheetUrl(newUrl);
                }
              }}
            />
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              URL de la Web App Google Apps Script
            </label>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <input
                type="text"
                value={gsheetUrl}
                onChange={(e) => setGsheetUrl(e.target.value)}
                onPaste={handlePasteGsheetUrl}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2.5 border rounded-xl text-xs font-mono bg-slate-50 border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Clé d'authentification API (Token statique)
            </label>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="samche_..."
                  className="w-full pl-9 pr-3.5 py-2.5 border rounded-xl text-xs font-mono bg-slate-50 border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button 
                onClick={handleTestPing}
                disabled={pingStatus?.testing}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-slate-300"
              >
                <Activity className={`w-3.5 h-3.5 ${pingStatus?.testing ? 'animate-pulse text-sky-600' : 'text-slate-600'}`} />
                <span>{pingStatus?.testing ? 'Test...' : 'Tester (Ping)'}</span>
              </button>
              <button 
                onClick={saveGsheetUrl} 
                className="px-5 py-2.5 bg-[#1B4F72] hover:bg-[#153e5a] text-white rounded-xl font-bold text-xs transition cursor-pointer shrink-0 shadow-sm"
              >
                Enregistrer
              </button>
            </div>

            {pingStatus?.message && (
              <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 mt-2 font-medium ${
                pingStatus.success 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {pingStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{pingStatus.message}</span>
              </div>
            )}

            {saveSuccessMsg && (
              <p className="text-xs text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {saveSuccessMsg}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <span>Dernière synchronisation :</span>
                <span className="font-bold text-slate-800">{syncStatus.lastSync || 'Non effectuée'}</span>
              </p>
              {syncStatus.error && (
                <p className="text-xs text-rose-600 mt-1">{syncStatus.error}</p>
              )}
            </div>
            <button
              onClick={onTriggerSync}
              disabled={syncStatus.syncing}
              className="px-5 py-2.5 bg-[#27AE60] hover:bg-[#1E8449] disabled:opacity-50 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.syncing ? 'animate-spin' : ''}`} />
              <span>{syncStatus.syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}</span>
            </button>
          </div>
        </section>

        {/* 2. Alertes Email */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Mail className="w-4 h-4 text-amber-600" />
            <h2 className="text-base font-bold text-slate-800">Alertes Email & Notifications</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nouvelle.alerte@couvoir.com"
              className="flex-1 px-3.5 py-2 border rounded-xl text-xs bg-slate-50 border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button 
              onClick={addEmail} 
              className="px-4 py-2 bg-[#1B4F72] hover:bg-[#153e5a] text-white rounded-xl font-bold text-xs transition cursor-pointer"
            >
              Ajouter
            </button>
          </div>

          <div className="space-y-2">
            {emailList.map((email) => (
              <div key={email} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-xs font-medium text-slate-700">{email}</span>
                <button 
                  onClick={() => removeEmail(email)} 
                  className="text-rose-500 hover:text-rose-700 font-bold text-xs px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Maintenance & Nettoyage du Cache */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100 space-y-3">
          <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <h2 className="text-base font-bold text-slate-800">Maintenance & Données Locales</h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            La réinitialisation efface toutes les données en mémoire cache locale de l'appareil (commandes, factures, dépenses) et recharge les données d'origine sans affecter votre fichier Google Sheets.
          </p>

          <div className="pt-2">
            <button 
              onClick={() => setIsResetModalOpen(true)} 
              className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition shadow-sm hover:shadow flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Réinitialiser tout le cache local</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 pt-1">Couvoir SAMCHE • Version 1.0.49</p>
        </section>
      </div>

      {/* In-App Confirmation Modal (Replaces window.confirm) */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 text-rose-600 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Réinitialiser le cache local ?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cette action va réinitialiser les formulaires et les listes locales de l'application à leur état initial.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer font-medium select-none">
                <input
                  type="checkbox"
                  checked={keepGsheetUrlOnReset}
                  onChange={(e) => setKeepGsheetUrlOnReset(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <span>Conserver l'URL de connexion Google Sheets actuelle</span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la réinitialisation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
