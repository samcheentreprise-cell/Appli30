import React from 'react';
import { GSHEET_WEBAPP_URL, SyncResult } from '../services/googleSheet';
import { RefreshCw, CheckCircle2, AlertCircle, Database, ExternalLink, ShieldCheck } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-700">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Synchronisation des Données</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-sm">
          {/* Status Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">État de connexion Google Sheets :</span>
              <span className="flex items-center gap-1.5 font-bold text-emerald-600 text-xs">
                <CheckCircle2 className="w-4 h-4" />
                Connecté (Web App)
              </span>
            </div>
            <div className="text-xs text-slate-500 break-all font-mono bg-white p-2 rounded-lg border border-slate-200">
              {GSHEET_WEBAPP_URL}
            </div>
            <div className="text-xs text-slate-500 flex justify-between pt-1">
              <span>Dernière synchro :</span>
              <strong className="text-slate-700">{syncStatus.lastSync || 'À l’instant'}</strong>
            </div>
          </div>

          {/* Firebase info */}
          <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Projet Firebase Initialisé</span>
            </div>
            <p className="text-xs text-slate-600">
              Projet ID : <strong className="font-mono text-slate-800">gen-lang-client-0822992934</strong>
            </p>
            <p className="text-xs text-slate-500">
              Authentification sécurisée et stockage offline actif.
            </p>
          </div>

          {/* Result message */}
          {lastResult && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                lastResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {lastResult.message} ({lastResult.timestamp})
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onTriggerSync}
              disabled={syncStatus.syncing}
              className="w-full flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-600 text-white font-bold py-3 rounded-xl transition shadow-md disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus.syncing ? 'animate-spin' : ''}`} />
              <span>{syncStatus.syncing ? 'Synchronisation en cours...' : 'Synchroniser Maintenant'}</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
