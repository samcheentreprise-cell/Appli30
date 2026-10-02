import React from 'react';
import { UserRole } from '../types';
import { Egg, RefreshCw, Shield, User, CheckCircle2, AlertCircle, LogOut, ExternalLink } from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  syncStatus: { syncing: boolean; lastSync: string; error?: string };
  onTriggerSync: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingSoumissionsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  setCurrentRole,
  syncStatus,
  onTriggerSync,
  activeTab,
  setActiveTab,
  pendingSoumissionsCount = 0,
}) => {
  const roles: UserRole[] = ['admin', 'utilisateur', 'comptable'];

  // Navigation Items
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: '📊', roles: ['admin', 'comptable', 'utilisateur'] },
    { id: 'calendrier', label: 'Calendrier', icon: '📅', roles: ['utilisateur'] },
    { id: 'commandes_poussins', label: 'Cmd Poussins', icon: '🐣', roles: ['admin'] },
    { id: 'oac', label: 'Suivi des OAC', icon: '🥚', roles: ['admin', 'utilisateur'] },
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
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shadow-inner text-amber-400">
                <Egg className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                    COUVOIR <span className="text-amber-400">SAMCHE</span>
                  </h1>
                </div>
                <p className="text-xs text-sky-200/80 font-medium">Système de Gestion</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Sync Indicator - Visible for admin only */}
            {currentRole === 'admin' && (
              <div className="hidden sm:flex items-center gap-2 bg-sky-900/60 border border-sky-700/60 rounded-xl px-3 py-1.5 text-xs text-sky-200">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-200">Google Sheets:</span>
                  <span className="text-sky-300 text-[11px] truncate max-w-[130px]">
                    {syncStatus.lastSync ? `Synchro ${syncStatus.lastSync}` : 'Connecté'}
                  </span>
                </div>
                <button
                  onClick={onTriggerSync}
                  disabled={syncStatus.syncing}
                  className="p-1 hover:bg-sky-800 rounded-lg transition text-amber-400 cursor-pointer"
                  title="Synchroniser maintenant"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.syncing ? 'animate-spin' : ''}`} />
                </button>
                <a
                  href="https://docs.google.com/spreadsheets/u/0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-[11px] font-bold transition shadow-xs ml-1"
                  title="Ouvrir le classeur Google Sheets dans un nouvel onglet"
                >
                  <span>📊</span>
                  <span className="hidden md:inline">Ouvrir Sheet</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            )}

            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/70 rounded-xl px-2.5 py-1.5 text-xs">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={currentRole}
                onChange={(e) => {
                  setCurrentRole(e.target.value as UserRole);
                  setActiveTab('dashboard'); // Redirect to dashboard on role switch
                }}
                className="bg-transparent text-amber-200 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                {roles.map((r) => (
                  <option key={r} value={r} className="bg-slate-900 text-white">
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-sky-800/30 scrollbar-none text-sm">
          {navItems
            .filter((item) => item.roles.includes(currentRole))
            .map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : 'text-sky-100/90 hover:bg-sky-800/50 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.id === 'oac' && pendingSoumissionsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                      {pendingSoumissionsCount}
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
