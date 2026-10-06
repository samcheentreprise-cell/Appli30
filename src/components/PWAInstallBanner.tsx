import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X, Smartphone } from 'lucide-react';

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
    <div className="bg-gradient-to-r from-[#b45309] to-[#78350f] text-white p-3 shadow-lg flex items-center justify-between z-[9999] w-full">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-lg">
          <Smartphone className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm">Installer sur votre téléphone</p>
            <span className="bg-amber-400 text-amber-950 text-[10px] font-black px-1.5 py-0.5 rounded">PWA MOBILE</span>
          </div>
          <p className="text-[11px] text-amber-100">Accédez au Couvoir SAMCHE en un clic depuis votre écran d'accueil, avec alertes sonores et fluidité native.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={isIOS ? () => setShowIOSGuide(true) : install}
          className="bg-white text-amber-900 font-black py-2 px-4 rounded-full text-xs shadow-md hover:bg-amber-50 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Installer
        </button>
        <button onClick={() => setIsVisible(false)} className="text-white/80 hover:text-white p-1 rounded cursor-pointer">
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
