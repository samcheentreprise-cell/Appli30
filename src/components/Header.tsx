import React, { useState, useEffect, useRef } from 'react';
import { UserRole, AdminNotification } from '../types';
import { RefreshCw, Bell, BellRing, CheckCheck, Trash2 } from 'lucide-react';

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
  adminNotifications?: AdminNotification[];
  unreadNotificationsCount?: number;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onDeleteNotification?: (id: string) => void;
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
  adminNotifications = [],
  unreadNotificationsCount = 0,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: '📊', roles: ['admin', 'comptable'] },
    { id: 'calendrier', label: 'Calendrier', icon: '📅', roles: ['utilisateur', 'admin'] },
    { id: 'oac', label: 'Gestion des OAC', icon: '🥚', roles: ['admin', 'utilisateur'] },
    { id: 'commandes_poussins', label: 'Cmd Poussins', icon: '🐣', roles: ['admin'] },
    { id: 'livraisons', label: 'Livraisons', icon: '🚚', roles: ['admin', 'utilisateur'] },
    { id: 'ventes', label: 'Ventes', icon: '💰', roles: ['admin', 'comptable'] },
    { id: 'couts_rentabilite', label: 'Rentabilité', icon: '📈', roles: ['admin', 'comptable'] },
    { id: 'depenses', label: 'Dépenses', icon: '💸', roles: ['admin', 'comptable'] },
    { id: 'factures', label: 'Factures', icon: '📑', roles: ['admin', 'comptable'] },
    { id: 'caisse', label: 'Caisse', icon: '🏦', roles: ['admin', 'comptable'] },
    { id: 'clients', label: 'Clients', icon: '👥', roles: ['admin', 'comptable'] },
    { id: 'recherche', label: 'Recherche', icon: '🔍', roles: ['admin', 'comptable'] },
    { id: 'parametres', label: 'Paramètres', icon: '⚙️', roles: ['admin'] },
  ];

  const notifIcon = (type: AdminNotification['type']): { emoji: string; bg: string; text: string } => {
    switch (type) {
      case 'Commande': return { emoji: '🥚', bg: 'bg-amber-100', text: 'text-amber-700' };
      case 'Mirage':   return { emoji: '⚪', bg: 'bg-sky-100',   text: 'text-sky-700' };
      case 'Éclosion': return { emoji: '🐣', bg: 'bg-emerald-100', text: 'text-emerald-700' };
      case 'Correction': return { emoji: '✏️', bg: 'bg-rose-100', text: 'text-rose-700' };
      default: return { emoji: 'ℹ️', bg: 'bg-slate-100', text: 'text-slate-700' };
    }
  };

  return (
    <header className="bg-sky-950 text-white shadow-lg sticky top-0 z-40 border-b border-sky-800">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <img src="/logo-samche.png" alt="Logo" className="w-8 h-8 object-contain" />
          <h1 className="text-sm font-black tracking-tight text-white font-serif">SAMCHE</h1>
        </div>
        <div className="flex items-center gap-2">
          {currentUser && <span className="text-[10px] font-bold text-sky-200">Connecté: {currentUser.username}</span>}
          {currentRole === 'admin' && (
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen((v) => !v)} className="relative p-2 bg-sky-900 rounded-lg cursor-pointer">
                {unreadNotificationsCount > 0 ? <BellRing className="w-4 h-4 text-amber-300 animate-pulse" /> : <Bell className="w-4 h-4 text-sky-200" />}
                {unreadNotificationsCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">{unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}</span>}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-[min(360px,90vw)] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-extrabold text-sky-900">Notifications</h3>
                    {unreadNotificationsCount > 0 && <button onClick={() => onMarkAllNotificationsRead?.()} className="text-[10px] font-bold text-sky-700 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> Tout lire</button>}
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                    {adminNotifications.length === 0 ? <div className="p-4 text-center text-xs text-slate-500">Aucune notification.</div> : adminNotifications.map((n) => {
                      const ic = notifIcon(n.type);
                      return (
                        <div key={n.id} className={`px-4 py-3 flex gap-2.5 ${!n.lue ? 'bg-amber-50' : ''}`}>
                          <span className={`shrink-0 w-8 h-8 rounded-lg ${ic.bg} ${ic.text} flex items-center justify-center font-bold`}>{ic.emoji}</span>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-900">{n.titre}</p>
                            <p className="text-[10px] text-slate-600 line-clamp-2">{n.message}</p>
                            <div className="flex justify-between mt-1">
                              <p className="text-[9px] text-slate-400">{n.date} {n.heure}</p>
                              <div className="flex gap-1">
                                {!n.lue && <button onClick={() => onMarkNotificationRead?.(n.id)} className="text-[9px] font-bold text-sky-700">✓</button>}
                                <button onClick={() => onDeleteNotification?.(n.id)} className="text-[9px] font-bold text-rose-600"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {currentRole === 'admin' && <button onClick={onTriggerSync} className="p-2 bg-sky-900 rounded-lg cursor-pointer"><RefreshCw className={`w-4 h-4 ${syncStatus.syncing ? 'animate-spin' : ''}`} /></button>}
          <button onClick={onLogout} className="text-[10px] font-bold bg-rose-600 px-2 py-1 rounded-lg cursor-pointer">Quitter</button>
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
                activeTab === item.id ? 'bg-amber-500 text-slate-950' : 'text-sky-200 hover:bg-sky-900'
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-[9px] uppercase tracking-wide">{item.label}</span>
              {item.id === 'oac' && currentRole === 'admin' && pendingSoumissionsCount > 0 && <span className="absolute -mt-12 ml-7 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">{pendingSoumissionsCount > 9 ? '9+' : pendingSoumissionsCount}</span>}
            </button>
          ))}
      </div>
    </header>
  );
};
