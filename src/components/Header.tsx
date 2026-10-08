import React from 'react';
import { UserRole } from '../types';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { SamcheLogo } from './SamcheLogo';
import { PWAInstallButton } from './PWAInstallButton';
// ... rest of imports

// ... HeaderProps interface (remove currentRole, setCurrentRole if not used)
interface HeaderProps {
  currentUser: {username: string, role: UserRole} | null;
  onLogout: () => void;
  currentRole: UserRole;
  syncStatus: { syncing: boolean; lastSync: string; error?: string };
  onTriggerSync: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingSoumissionsCount?: number;
  rejectedSoumissionsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  currentRole,
  syncStatus,
  onTriggerSync,
  activeTab,
  setActiveTab,
  pendingSoumissionsCount = 0,
  rejectedSoumissionsCount = 0,
}) => {
  // Navigation Items
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: '📊', roles: ['admin', 'comptable'] },
    { id: 'calendrier', label: 'Calendrier', icon: '📅', roles: ['utilisateur'] },
    { id: 'oac', label: 'Gestion des OAC', icon: '🥚', roles: ['admin', 'utilisateur'] },
    { id: 'commandes_poussins', label: 'Cmd Poussins', icon: '🐣', roles: ['admin'] },
    { id: 'livraisons', label: 'Livraisons', icon: '🚚', roles: ['admin', 'utilisateur'] },
    { id: 'ventes', label: 'Ventes', icon: '💰', roles: ['admin', 'comptable'] },
    { id: 'depenses', label: 'Dépenses', icon: '💸', roles: ['admin', 'comptable'] },
    { id: 'factures', label: 'Factures', icon: '📑', roles: ['admin', 'comptable'] },
    { id: 'caisse', label: 'Caisse', icon: '🏦', roles: ['admin', 'comptable'] },
    { id: 'clients', label: 'Clients', icon: '👥', roles: ['admin', 'comptable'] },
    { id: 'recherche', label: 'Recherche', icon: '🔍', roles: ['admin', 'comptable'] },
    { id: 'parametres', label: 'Paramètres', icon: '⚙️', roles: ['admin'] },
  ];

  return (
    <header className="bg-gradient-to-r from-sky-950 via-slate-900 to-sky-900 text-white shadow-lg sticky top-0 z-40 border-b border-sky-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-3 gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setActiveTab(currentRole === 'utilisateur' ? 'calendrier' : 'dashboard')}
            >
              <div className="w-11 h-11 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-md border border-white/20 transition-transform group-hover:scale-105 flex-shrink-0">
                <img
                  src="/logo-samche.png"
                  alt="Logo SamChe"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/logo-samche.svg';
                  }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5 font-serif">
                    COUVOIR <span className="text-amber-400 font-sans">SAMCHE</span>
                  </h1>
                </div>
                <p className="text-[11px] text-sky-200/80 font-medium">Système de Gestion Avicole</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* User Info & Logout */}
            <div className="flex items-center gap-3 bg-sky-900/50 px-3 py-1.5 rounded-xl border border-sky-800/50">
              <span className="text-xs font-bold text-amber-300">
                {currentUser?.username}
              </span>
              <button
                onClick={onLogout}
                className="text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded-lg transition"
              >
                Quitter
              </button>
            </div>

            {/* Sync Indicator - Visible for admin only */}
            <div className="flex items-center gap-2">
              {currentRole === 'admin' && (
                <button
                  onClick={onTriggerSync}
                  className="flex items-center gap-1.5 bg-sky-700/60 hover:bg-sky-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm"
                  title="Actualiser les données"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualiser
                </button>
              )}

              {currentRole === 'admin' && (
                <div className="hidden sm:flex items-center gap-2 bg-sky-900/60 border border-sky-700/60 rounded-xl px-3 py-1.5 text-xs text-sky-200">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-200">Sheets:</span>
                    <span className="text-sky-300 text-[11px] truncate max-w-[130px]">
                      {syncStatus.lastSync ? syncStatus.lastSync : 'Connecté'}
                    </span>
                  </div>
                  <a
                    href="https://docs.google.com/spreadsheets/u/0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-[11px] font-bold transition shadow-xs ml-1"
                    title="Ouvrir le classeur Google Sheets"
                  >
                    <span>📊</span>
                  </a>
                </div>
              )}
            </div>

            <PWAInstallButton />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 py-2 border-t border-sky-800/30 text-sm">
          {navItems
            .filter((item) => item.roles.includes(currentRole))
            .map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : 'text-sky-100/90 hover:bg-sky-800/50 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.id === 'oac' && currentRole === 'admin' && pendingSoumissionsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                      {pendingSoumissionsCount}
                    </span>
                  )}
                  {item.id === 'oac' && currentRole === 'utilisateur' && (rejectedSoumissionsCount || 0) > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse shadow-sm flex items-center gap-1">
                      <span>⚠️</span>
                      <span>{rejectedSoumissionsCount} à corriger</span>
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>
    </header>
  );
};
