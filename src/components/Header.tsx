import React from 'react';
import { UserRole } from '../types';
import { Egg, RefreshCw, Shield, User, CheckCircle2, AlertCircle } from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  syncStatus: { syncing: boolean; lastSync: string; error?: string };
  onTriggerSync: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  setCurrentRole,
  syncStatus,
  onTriggerSync,
  activeTab,
  setActiveTab,
}) => {
  const roles: UserRole[] = [
    'Administrateur',
    'Directeur',
    'Responsable Commercial',
    'Opérateur Couvoir',
  ];

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: '📊' },
    { id: 'commandes_poussins', label: 'Cmd Poussins', icon: '🐣' },
    { id: 'oac', label: 'Suivi des OAC', icon: '🥚' },
    { id: 'ventes', label: 'Ventes', icon: '💰' },
    { id: 'depenses', label: 'Dépenses', icon: '💸' },
    { id: 'factures', label: 'Factures', icon: '📑' },
    { id: 'caisse', label: 'Caisse', icon: '🏦' },
    { id: 'clients', label: 'Clients', icon: '👥' },
  ];

  return (
    <header className="bg-gradient-to-r from-sky-950 via-slate-900 to-sky-900 text-white shadow-lg sticky top-0 z-40 border-b border-sky-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar with Branding, Sync & Role */}
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    BAMAKO
                  </span>
                </div>
                <p className="text-xs text-sky-200/80 font-medium">Système de Gestion d'Écloserie & Ventes</p>
              </div>
            </div>

            {/* Mobile quick sync button */}
            <div className="sm:hidden flex items-center gap-1">
              <button
                onClick={onTriggerSync}
                disabled={syncStatus.syncing}
                className="p-2 rounded-xl bg-sky-800/60 hover:bg-sky-700/80 text-sky-200 border border-sky-700/50"
                title="Synchroniser"
              >
                <RefreshCw className={`w-4 h-4 ${syncStatus.syncing ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Google Sheets Sync Indicator */}
            <div className="hidden sm:flex items-center gap-2 bg-sky-900/60 border border-sky-700/60 rounded-xl px-3 py-1.5 text-xs text-sky-200">
              <div className="flex items-center gap-1.5">
                {syncStatus.error ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="font-semibold text-slate-200">Google Sheets:</span>
                <span className="text-sky-300 text-[11px] truncate max-w-[130px]">
                  {syncStatus.lastSync ? `Synchro ${syncStatus.lastSync}` : 'Connecté'}
                </span>
              </div>
              <button
                onClick={onTriggerSync}
                disabled={syncStatus.syncing}
                className="ml-1 p-1 hover:bg-sky-800 rounded-lg transition text-amber-400 hover:text-amber-300 disabled:opacity-50"
                title="Synchroniser maintenant"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.syncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Role Switcher */}
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/70 rounded-xl px-2.5 py-1.5 text-xs">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400 hidden md:inline">Rôle:</span>
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as UserRole)}
                className="bg-transparent text-amber-200 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                {roles.map((r) => (
                  <option key={r} value={r} className="bg-slate-900 text-white">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* User tag */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-sky-200/90 bg-sky-950/60 border border-sky-800/40 px-2.5 py-1.5 rounded-xl">
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-300 font-medium">couvoirsamche@gmail.com</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-sky-800/30 scrollbar-none text-sm">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-sky-100/90 hover:bg-sky-800/50 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
