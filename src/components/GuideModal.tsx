import React, { useState } from 'react';
import { BookOpen, Download, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { downloadGuidePdf } from '../utils/guidePdf';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadStatus(null);
    try {
      await downloadGuidePdf();
      setDownloadStatus({ type: 'success', text: 'PDF téléchargé avec succès !' });
      setTimeout(() => setDownloadStatus(null), 4000);
    } catch (err: any) {
      setDownloadStatus({
        type: 'error',
        text: err?.message || 'Erreur lors du téléchargement du PDF.',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-gradient-to-r from-[#1B4F72] to-[#21618C] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-300 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold leading-tight">
                Guide d&apos;Utilisation Officiel — Couvoir SAMCHE
              </h2>
              <p className="text-[11px] text-sky-100 hidden sm:block">
                Manuel illustré (Rôles, Calendrier &amp; Planification, Cycle OAC, Validation, Livraisons, Ventes, Factures, Dépenses, Caisse &amp; Rentabilité)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloading ? 'Téléchargement...' : 'Télécharger le PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Fermer"
              aria-label="Fermer le guide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status feedback */}
        {downloadStatus && (
          <div
            className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b ${
              downloadStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {downloadStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{downloadStatus.text}</span>
          </div>
        )}

        {/* In-app HTML guide viewer (100% reliable across Edge, Chrome, mobile & iframes) */}
        <div className="flex-1 bg-slate-100 overflow-hidden">
          <iframe
            src="/api/guide-html"
            title="Guide d'utilisation Couvoir SAMCHE"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
};
