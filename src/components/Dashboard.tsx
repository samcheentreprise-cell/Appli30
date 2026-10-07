import React, { useState, useMemo, useEffect } from 'react';
import { OAC, Depense, Client, Facture, Vente, UserRole } from '../types';
import { callApi } from '../services/googleSheet';
import { HATCH_COLOR_PALETTES } from './CommandesPoussinsModule';

interface DashboardProps {
  oacList: OAC[];
  depenses: Depense[];
  clients: Client[];
  factures: Facture[];
  ventes?: Vente[];
  role: UserRole;
  onNavigate: (tab: string) => void;
  onOpenNewOAC?: () => void;
  onOpenNewVente?: () => void;
  onOpenNewFacture?: () => void;
  onOpenNewDepense?: () => void;
}

// ══════════════════════════════════════════════════════════════════════════
//  Types pour la réponse de dashboard.data
// ══════════════════════════════════════════════════════════════════════════
interface DashboardKpis {
  tauxEclosion: number;
  moyTauxAnnee: number;
  nbLotsIncubation: number;
  poussinsAttendus: number;
  incubationsEnCours: number;
  nbLotsActifs: number;
  caMois: number;
  depensesMois: number;
  poussinsMois: number;
  tauxPerte: number;
  prochaineEclosion: string;
}

interface DashboardIncubation {
  id: string;
  type: string;
  race: string;
  oac: number;
  joursElapsed: number;
  joursRestants: number;
  totalJours: number;
  progression: number;
  statusLabel: string;
  statusClass: string;
  dateCmd: string;
  dateEclo: string;
  dateEcloTs: number;
}

interface DashboardHatching {
  id: string;
  type: string;
  race: string;
  fournisseur: string;
  date: string;
  dateTs: number;
  oeufs: number;
  poussins: number;
  taux: number;
}

interface DashboardRevenue {
  labels: string[];
  recettes: number[];
  depenses: number[];
}

interface DashboardData {
  kpis: DashboardKpis;
  incubations: DashboardIncubation[];
  hatchingChart: DashboardHatching[];
  revenueChart: DashboardRevenue;
  debug?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  oacList,
  depenses,
  ventes = [],
  role,
  onNavigate,
}) => {
  // ══════════════════════════════════════════════════════════════════════════
  //  ÉTAT : données chargées depuis GAS
  // ══════════════════════════════════════════════════════════════════════════
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    const result = await callApi('dashboard.data');
    if (result?.success && result?.data) {
      setDashData(result.data);
      console.log('[Dashboard] loaded:', result.data);
    } else {
      console.warn('[Dashboard] Fallback to local data:', result);
      setDashData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
    const handler = () => loadDashboard();
    window.addEventListener('gsheet_url_changed', handler);
    window.addEventListener('dashboard:refresh', handler);
    return () => {
      window.removeEventListener('gsheet_url_changed', handler);
      window.removeEventListener('dashboard:refresh', handler);
    };
  }, []);

  // Current date & week computation
  const { dateStr, weekStr } = useMemo(() => {
    const now = new Date();
    const jj = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const annee = now.getFullYear();
    const dateFormatted = `${jj}/${mm}/${annee}`;

    const oneJan = new Date(annee, 0, 1);
    const dayDiff = Math.ceil(((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
    const weekFormatted = `Semaine ${dayDiff || 40}`;

    return { dateStr: dateFormatted, weekStr: weekFormatted };
  }, []);

  // Number formatter
  const fmtN = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n as number)) return '--';
    return Number(n).toLocaleString('fr-FR', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  KPIs depuis GAS (fallback sur calcul local si GAS échoue)
  // ══════════════════════════════════════════════════════════════════════════
  const kpiData = useMemo(() => {
    // Si GAS a renvoyé des KPIs, on les utilise directement
    if (dashData?.kpis) {
      const k = dashData.kpis;
      return {
        nbLotsIncubation: k.nbLotsIncubation || 0,
        poussinsAttendus: k.poussinsAttendus || 0,
        poussinsMois: k.poussinsMois > 0 ? k.poussinsMois : null,
        ventesMois: k.caMois || 0,
        tauxEclosion:
          k.moyTauxAnnee > 0
            ? `${Math.round(k.moyTauxAnnee)}%`
            : k.tauxEclosion > 0
            ? `${Math.round(k.tauxEclosion)}%`
            : '--',
        depensesMois: k.depensesMois || 0,
      };
    }

    // Fallback : calcul local (ancien comportement)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let nbLotsIncub = 0;
    let totalPoussinsAttendus = 0;
    let totalPoussinsMois = 0;
    let sumTauxAnnee = 0;
    let countTauxAnnee = 0;

    oacList.forEach((lot) => {
      if (!lot.date) return;
      const partsEclo = (lot.eclosion || '').split('/');
      let dEclo: Date | null = null;
      if (partsEclo.length === 3) {
        dEclo = new Date(parseInt(partsEclo[2]), parseInt(partsEclo[1]) - 1, parseInt(partsEclo[0]));
      }
      if (dEclo) {
        dEclo.setHours(0, 0, 0, 0);
        const isEclos = lot.complet || dEclo < now;
        if (isEclos) {
          if (dEclo.getFullYear() === currentYear) {
            const tx = lot.txEclosionOeufsAchetes || (lot.commerciaux && lot.recus ? lot.commerciaux / lot.recus : 0);
            if (tx > 0) {
              sumTauxAnnee += tx;
              countTauxAnnee++;
            }
          }
          if (dEclo.getMonth() === currentMonth && dEclo.getFullYear() === currentYear) {
            if (lot.commerciaux) totalPoussinsMois += lot.commerciaux;
          }
        } else {
          nbLotsIncub++;
          const attendus = lot.attendus || lot.fertiles || (lot.recus ? Math.round(lot.recus * 0.75) : 0);
          totalPoussinsAttendus += attendus;
        }
      } else if (!lot.complet) {
        nbLotsIncub++;
        totalPoussinsAttendus += lot.attendus || (lot.recus ? Math.round(lot.recus * 0.75) : 0);
      }
    });

    let totalVentesMois = 0;
    ventes.forEach((v) => {
      const parts = (v.date || '').split('/');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          const rowMt = v.montant > 0 ? v.montant : ((Number(v.quantite) || 0) * (Number(v.prixUnitaire) || 0));
          totalVentesMois += rowMt;
        }
      }
    });

    let totalDepensesMois = 0;
    depenses.forEach((d) => {
      const parts = (d.date || '').split('/');
      if (parts.length === 3) {
        const dt = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (dt.getMonth() === currentMonth && dt.getFullYear() === currentYear) {
          totalDepensesMois += d.montant || 0;
        }
      }
    });

    const moyTaux = countTauxAnnee > 0 ? Math.round((sumTauxAnnee / countTauxAnnee) * 100) : 0;
    return {
      nbLotsIncubation: nbLotsIncub,
      poussinsAttendus: totalPoussinsAttendus,
      poussinsMois: totalPoussinsMois > 0 ? totalPoussinsMois : null,
      ventesMois: totalVentesMois,
      tauxEclosion: moyTaux > 0 ? `${moyTaux}%` : (sumTauxAnnee > 0 ? `${Math.round(sumTauxAnnee * 100)}%` : '--'),
      depensesMois: totalDepensesMois,
    };
  }, [dashData, oacList, ventes, depenses]);

  // ══════════════════════════════════════════════════════════════════════════
  //  LOTS EN COURS (priorise GAS, fallback sur calcul local)
  // ══════════════════════════════════════════════════════════════════════════
  const lotsEnCours = useMemo(() => {
    // Si GAS a renvoyé des incubations, on les utilise
    if (dashData?.incubations && dashData.incubations.length > 0) {
      return dashData.incubations.map((inc) => {
        const dotColor = inc.joursRestants <= 3 ? 'bg-[#f59e0b]' : 'bg-[#22c55e]';
        const btnColor = inc.joursRestants <= 3 ? 'bg-[#d97706] hover:bg-[#b45309]' : 'bg-[#15803d] hover:bg-[#166534]';
        return {
          date: inc.dateCmd || '--',
          desc: `${inc.type || 'Chairs'} ${inc.race || ''} - ${inc.id} - ${inc.oac || 0} œufs`,
          detail: `Éclosion : ${inc.dateEclo || '--'} (J-${inc.joursRestants})`,
          btnText: `J${inc.joursElapsed}/21`,
          dotColor,
          btnColor,
        };
      });
    }

    // Fallback : calcul local depuis oacList
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const enIncubation = oacList.filter((lot) => {
      if (lot.complet) return false;
      if (!lot.eclosion) return true;
      const parts = lot.eclosion.split('/');
      if (parts.length === 3) {
        const dEclo = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        return dEclo >= now;
      }
      return true;
    });

    return enIncubation.map((lot) => {
      let joursRestants = 0;
      let joursElapsed = 0;
      if (lot.eclosion) {
        const parts = lot.eclosion.split('/');
        if (parts.length === 3) {
          const dEclo = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          const diffMs = dEclo.getTime() - now.getTime();
          joursRestants = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          joursElapsed = Math.min(21, Math.max(0, 21 - joursRestants));
        }
      }
      let displayDate = lot.date && lot.date !== '--' ? lot.date : '';
      if (!displayDate && lot.eclosion) {
        const parts = lot.eclosion.split('/');
        if (parts.length === 3) {
          const dt = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          if (!isNaN(dt.getTime())) {
            dt.setDate(dt.getDate() - 21);
            displayDate = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
          }
        }
      }
      const dotColor = joursRestants <= 3 ? 'bg-[#f59e0b]' : 'bg-[#22c55e]';
      const btnColor = joursRestants <= 3 ? 'bg-[#d97706] hover:bg-[#b45309]' : 'bg-[#15803d] hover:bg-[#166534]';
      return {
        date: displayDate || '--',
        desc: `${lot.type || 'Chairs'} ${lot.race || ''} - ${lot.id} - ${lot.cartons || 0} cartons (${lot.recus || 0} œufs)`,
        detail: `Éclosion : ${lot.eclosion || '--'} (J-${joursRestants})`,
        btnText: `J${joursElapsed}/21`,
        dotColor,
        btnColor,
      };
    });
  }, [dashData, oacList]);

  // ══════════════════════════════════════════════════════════════════════════
  //  5 DERNIÈRES ÉCLOSIONS (priorise GAS, fallback sur oacList locale)
  // ══════════════════════════════════════════════════════════════════════════
  const dernieresEclosions = useMemo(() => {
    // Si GAS a renvoyé hatchingChart, on l'utilise
    if (dashData?.hatchingChart && dashData.hatchingChart.length > 0) {
      return dashData.hatchingChart.map((h) => ({
        id: h.id,
        date: h.date,
        type: h.type,
        race: h.race,
        fournisseur: h.fournisseur,
        oeufs: h.oeufs,
        commerciaux: h.poussins,
        morts: 0,
        handicapes: 0,
        pourVente: h.poussins,
        taux: h.taux,
        eclosion: h.date,
      }));
    }

    // Fallback : depuis oacList locale (lots complet=true)
    return oacList
      .filter((lot) => lot.complet)
      .sort((a, b) => {
        const d1 = new Date((a.eclosion || '').split('/').reverse().join('-')).getTime();
        const d2 = new Date((b.eclosion || '').split('/').reverse().join('-')).getTime();
        return d2 - d1;
      })
      .slice(0, 5);
  }, [dashData, oacList]);

  // ══════════════════════════════════════════════════════════════════════════
  //  État de chargement
  // ══════════════════════════════════════════════════════════════════════════
  if (loading && !dashData) {
    return (
      <div className="bg-[#0f172a] text-[#E2E8F0] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3"></div>
          <div className="text-sm text-white/60">Chargement du tableau de bord...</div>
        </div>
      </div>
    );
  }

  if (error && !dashData) {
    return (
      <div className="bg-[#0f172a] text-[#E2E8F0] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="text-sm text-white/80 mb-2">Erreur de chargement</div>
          <div className="text-xs text-white/50 mb-4">{error}</div>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDU : tout votre JSX original est conservé à l'identique
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="bg-[#0f172a] text-[#E2E8F0] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 font-['Inter',sans-serif] space-y-4 animate-fade-in select-none">
      {/* TOP HEADER */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#1e40af] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-md p-1.5 flex-shrink-0 border border-white/20">
            <img
              src="/logo-samche.png"
              alt="Logo SamChe"
              className="w-full h-full object-contain"
              onError={(e) => { e.currentTarget.src = '/logo-samche.svg'; }}
            />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-tight flex items-center gap-1.5 font-serif">
              Couvoir <span className="text-amber-400 font-sans">SAMCHE</span>
            </h1>
            <p className="text-xs text-white/70 font-medium">Tableau de bord de gestion</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-bold text-white tracking-wide">{dateStr}</div>
            <div className="text-[11px] text-white/70 font-medium">{weekStr}</div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('oac')}
            className="bg-[#dc2626] hover:bg-[#b91c1c] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <span>✕</span><span>Quitter</span>
          </button>
        </div>
      </div>

      {/* TOP ROW: 5 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: INCUBATION */}
        <div className="bg-gradient-to-br from-[#1e40af] to-[#2563eb] rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden transition transform hover:-translate-y-1">
          <div className="text-2xl mb-1">🥚</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">INCUBATION</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            {kpiData.nbLotsIncubation} lots
          </div>
          <div className="text-[10px] text-white/80 mt-1 font-semibold">
            {fmtN(kpiData.poussinsAttendus)} poussins attendus
          </div>
        </div>

        {/* Card 2: POUSSINS DU MOIS */}
        <div className="bg-gradient-to-br from-[#15803d] to-[#16a34a] rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden transition transform hover:-translate-y-1">
          <div className="text-2xl mb-1">🐥</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">POUSSINS DU MOIS</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            {kpiData.poussinsMois ? fmtN(kpiData.poussinsMois) : '--'}
          </div>
          <div className="text-[10px] text-white/70 mt-1 font-medium">produits ce mois</div>
        </div>

        {/* Card 3: VENTES DU MOIS */}
        <div className="bg-gradient-to-br from-[#92400e] to-[#b45309] rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden transition transform hover:-translate-y-1">
          <div className="text-2xl mb-1">🪙</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">VENTES DU MOIS</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white leading-tight tabular-nums">
            {fmtN(kpiData.ventesMois)}
          </div>
          <div className="text-[10px] text-white/70 mt-1 font-medium">F CFA</div>
        </div>

        {/* Card 4: TAUX ECLOSION */}
        <div className="bg-gradient-to-br from-[#6d28d9] to-[#7c3aed] rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden transition transform hover:-translate-y-1">
          <div className="text-2xl mb-1">📊</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">TAUX ECLOSION</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            {kpiData.tauxEclosion || '--'}
          </div>
          <div className="text-[10px] text-white/70 mt-1 font-medium">moyenne annee en cours</div>
        </div>

        {/* Card 5: DEPENSES DU MOIS */}
        <div className="bg-gradient-to-br from-[#991b1b] to-[#dc2626] rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden transition transform hover:-translate-y-1">
          <div className="text-2xl mb-1">💸</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">DEPENSES DU MOIS</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white leading-tight tabular-nums">
            {fmtN(kpiData.depensesMois)}
          </div>
          <div className="text-[10px] text-white/70 mt-1 font-medium">F CFA</div>
        </div>
      </div>

      {/* MIDDLE ROW: 2 COLUMNS (Actions Rapides + Lots en Cours) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* -- LEFT: ACTIONS RAPIDES -- */}
        <div className="bg-[#1a1f36] rounded-xl p-4 sm:p-5 shadow-lg border border-white/5 space-y-3">
          <div className="flex items-center gap-2 pb-1">
            <div className="w-[3px] h-[18px] bg-[#3b82f6] rounded" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">ACTIONS RAPIDES</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button type="button" onClick={() => onNavigate('depenses')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center text-lg flex-shrink-0">📋</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Depense</div><div className="text-[10px] text-[#64748B] mt-0.5">Saisir</div></div>
            </button>
            <button type="button" onClick={() => onNavigate('ventes')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#22c55e]/20 flex items-center justify-center text-lg flex-shrink-0">🛒</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Vente</div><div className="text-[10px] text-[#64748B] mt-0.5">Enregistrer</div></div>
            </button>
            <button type="button" onClick={() => onNavigate('caisse')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#22c55e]/20 flex items-center justify-center text-lg flex-shrink-0">💰</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Caisse</div><div className="text-[10px] text-[#64748B] mt-0.5">Mouvement</div></div>
            </button>
            <button type="button" onClick={() => onNavigate('oac')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center text-lg flex-shrink-0">🥚</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Gestion OAC</div><div className="text-[10px] text-[#64748B] mt-0.5">Commandes</div></div>
            </button>
            <button type="button" onClick={() => onNavigate('dashboard')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center text-lg flex-shrink-0">📊</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Tableau de bord</div><div className="text-[10px] text-[#64748B] mt-0.5">Statistiques</div></div>
            </button>
            <button type="button" onClick={() => onNavigate('recherche')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center text-lg flex-shrink-0">🔍</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Recherche</div><div className="text-[10px] text-[#64748B] mt-0.5">Depenses et Ventes</div></div>
            </button>
            <button type="button" onClick={() => onNavigate('factures')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#7c3aed]/20 flex items-center justify-center text-lg flex-shrink-0">📄</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Factures</div><div className="text-[10px] text-[#64748B] mt-0.5">et BL</div></div>
            </button>
            <button type="button" onClick={() => onNavigate('commandes_poussins')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#eab308]/20 flex items-center justify-center text-lg flex-shrink-0">🐥</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Commandes Poussins</div><div className="text-[10px] text-[#64748B] mt-0.5">Gestion</div></div>
            </button>
            <button type="button" onClick={() => onNavigate('factures')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5 sm:col-span-2">
              <div className="w-9 h-9 rounded-lg bg-[#ef4444]/20 flex items-center justify-center text-lg flex-shrink-0">📓</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Cahier de bord</div><div className="text-[10px] text-[#64748B] mt-0.5">Journal des actions</div></div>
            </button>
          </div>
        </div>

        {/* -- RIGHT: LOTS EN COURS -- */}
        <div className="bg-[#1a1f36] rounded-xl p-4 sm:p-5 shadow-lg border border-white/5 space-y-3">
          <div className="flex items-center gap-2 pb-1">
            <div className="w-[3px] h-[18px] bg-[#22c55e] rounded" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">LOTS EN COURS</h2>
          </div>
          <div className="divide-y divide-white/5 space-y-2">
            {lotsEnCours.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#64748B] font-medium">Aucun lot en cours</div>
            ) : (
              lotsEnCours.map((lot, idx) => (
                <div key={idx} className="pt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${lot.dotColor} flex-shrink-0`} />
                    <div className="text-xs font-medium text-[#94A3B8] tabular-nums whitespace-nowrap min-w-[75px]">{lot.date}</div>
                    <div>
                      <div className="text-xs font-semibold text-[#E2E8F0] leading-snug">{lot.desc}</div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">{lot.detail}</div>
                    </div>
                  </div>
                  <button type="button" className={`${lot.btnColor} text-white px-3 py-1 rounded-md text-xs font-bold transition flex-shrink-0`}>
                    {lot.btnText}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: 5 DERNIERES ECLOSIONS */}
      <div className="bg-[#1a1f36] rounded-xl p-4 sm:p-5 shadow-lg border border-white/5 space-y-3">
        <div className="flex items-center gap-2 pb-1">
          <div className="w-[3px] h-[18px] bg-[#a855f7] rounded" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">5 DERNIERES ECLOSIONS</h2>
        </div>
        {dernieresEclosions.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#64748B] font-medium">Aucune eclosion enregistree</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#E2E8F0]">
              <thead className="text-[10px] text-[#94A3B8] uppercase">
                <tr>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Lot</th>
                  <th className="pb-2">Commerciaux</th>
                  <th className="pb-2">Morts</th>
                  <th className="pb-2">Hand.</th>
                  <th className="pb-2">Vente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dernieresEclosions.map((lot: any) => (
                  <tr key={lot.id}>
                    <td className="py-2">{lot.eclosion || lot.date}</td>
                    <td className="py-2">{lot.id}</td>
                    <td className="py-2 font-bold text-emerald-400">{lot.commerciaux}</td>
                    <td className="py-2 text-rose-400">{lot.morts}</td>
                    <td className="py-2 text-amber-400">{lot.handicapes}</td>
                    <td className="py-2 font-bold text-sky-400">{lot.pourVente}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};