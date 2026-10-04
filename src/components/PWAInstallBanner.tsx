import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  if (isInstalled || !isVisible) {
    return null;
  }

  // Only show if it's installable (Android/Desktop) or iOS device
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <div className="bg-emerald-600 text-white p-4 shadow-lg flex items-center justify-between z-50">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-lg">
          <Download className="w-6 h-6" />
        </div>
        <div>
          <p className="font-bold text-sm">Installer l'application</p>
          <p className="text-xs text-emerald-100">Accédez rapidement à Couvoir SAMCHE.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={isIOS ? () => setShowIOSGuide(true) : install}
          className="bg-white text-emerald-700 font-bold py-2 px-4 rounded-lg text-xs"
        >
          Installer
        </button>
        <button onClick={() => setIsVisible(false)} className="text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl text-slate-900">
            <h3 className="text-lg font-semibold">Installer sur iPhone</h3>
            <p className="mt-2 text-sm text-slate-600">
              1. Tap le bouton <strong>Partager</strong> dans Safari.<br />
              2. Défilez et tap <strong>Sur l'écran d'accueil</strong>.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-800"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
