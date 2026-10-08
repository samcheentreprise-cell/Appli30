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
    { id: 'calendrier', label: 'Calendrier', icon: '📅', roles: ['utilisateur', 'admin'] },
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
    <header className="bg-sky-950 text-white shadow-lg sticky top-0 z-40 border-b border-sky-800">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <img src="/logo-samche.png" alt="Logo" className="w-8 h-8 object-contain" />
          <h1 className="text-sm font-black tracking-tight text-white font-serif">SAMCHE</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onTriggerSync} className="p-2 bg-sky-900 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={onLogout} className="text-[10px] font-bold bg-rose-600 px-2 py-1 rounded-lg">Quitter</button>
        </div>
      </div>
      <div className="flex overflow-x-auto gap-2 px-4 py-2 border-t border-sky-800 scrollbar-hide">
        {navItems
          .filter((item) => item.roles.includes(currentRole))
          .map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeTab === item.id ? 'bg-amber-500 text-slate-950' : 'text-sky-200'
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-[9px] uppercase tracking-wide">{item.label}</span>
            </button>
          ))}
      </div>
    </header>
  );
};
