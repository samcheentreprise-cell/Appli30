import React, { useState, useEffect } from 'react';
interface SyncStatus {
  syncing: boolean;
  lastSync: string;
  error?: string;
}

interface ParametresModuleProps {
  syncStatus: SyncStatus;
  onTriggerSync: () => void;
  onClose?: () => void;
}

export const ParametresModule: React.FC<ParametresModuleProps> = ({
  syncStatus,
  onTriggerSync,
  onClose,
}) => {
  // Alert Emails State
  const [emailList, setEmailList] = useState<string[]>(() => {
    const stored = localStorage.getItem('alert_emails');
    return stored ? JSON.parse(stored) : ['admin@couvoirsamche.com'];
  });
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    localStorage.setItem('alert_emails', JSON.stringify(emailList));
  }, [emailList]);

  const addEmail = () => {
    if (newEmail && !emailList.includes(newEmail)) {
      setEmailList([...emailList, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmail = (email: string) => {
    setEmailList(emailList.filter((e) => e !== email));
  };

  const clearLocalStorage = () => {
    if (window.confirm('Voulez-vous vraiment réinitialiser toutes les données locales ?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="bg-[#eef2f7] min-h-[85vh] rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col font-sans animate-fade-in text-sm">
      <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center justify-between text-white flex-shrink-0 shadow-md">
        <h1 className="text-lg font-bold">⚙ Paramètres</h1>
        {onClose && <button onClick={onClose} className="text-white hover:text-slate-200">✕</button>}
      </div>

      <div className="p-6 space-y-8">
        {/* 1. Sync */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-base font-bold text-slate-800 mb-4">Synchronisation</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Dernière synchronisation : {syncStatus.lastSync}</p>
              {syncStatus.error && <p className="text-xs text-rose-500 mt-1">{syncStatus.error}</p>}
            </div>
            <button
              onClick={onTriggerSync}
              className="px-4 py-2 bg-[#27AE60] hover:bg-[#1E8449] text-white rounded-lg font-bold text-xs uppercase"
            >
              {syncStatus.syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
            </button>
          </div>
        </section>

        {/* 2. Emails */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-base font-bold text-slate-800 mb-4">Alertes Email</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nouvelle.alerte@couvoir.com"
              className="flex-1 px-3 py-2 border rounded-lg"
            />
            <button onClick={addEmail} className="px-4 py-2 bg-[#1B4F72] text-white rounded-lg font-bold text-xs">
              Ajouter
            </button>
          </div>
          <div className="space-y-2">
            {emailList.map((email) => (
              <div key={email} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border">
                <span className="text-sm text-slate-700">{email}</span>
                <button onClick={() => removeEmail(email)} className="text-rose-500 font-bold text-xs">Supprimer</button>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Maintenance */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-base font-bold text-slate-800 mb-4">Système</h2>
          <button onClick={clearLocalStorage} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold text-xs">
            Réinitialiser tout le cache local
          </button>
          <p className="text-xs text-slate-500 mt-3">Version actuelle : 1.0.48</p>
        </section>
      </div>
    </div>
  );
};
