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
  // ✅ v1.3.2 : champs ajoutés pour le dashboard
  morts?: number;
  handicapes?: number;
  mortsHandicapes?: number;
  fertiles?: number;
  pourVente?: number;
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
  // ✅ v1.3.3 : Les props oacList/ventes/depenses ne sont PLUS utilisées.
  // Le Dashboard lit UNIQUEMENT les données du Google Sheet via GAS (dashboard.data).
  // On garde la signature pour la compatibilité avec App.tsx mais on ignore ces props.
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
      console.log('[Dashboard] Données chargées depuis GAS (sheet) :', result.data);
      console.log('[Dashboard] KPIs :', result.data.kpis);
      console.log('[Dashboard] Incubations (' + (result.data.incubations?.length || 0) + ') :', result.data.incubations);
      console.log('[Dashboard] Dernières éclosions (' + (result.data.hatchingChart?.length || 0) + ') :', result.data.hatchingChart);
    } else {
      console.warn('[Dashboard] GAS a échoué, on n\'utilise PLUS les données locales :', result);
      setError(result?.error || 'Impossible de charger les données depuis le Google Sheet.');
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
  //  KPIs — UNIQUEMENT depuis GAS (lecture directe du sheet). Plus de fallback local.
  // ══════════════════════════════════════════════════════════════════════════
  const kpiData = useMemo(() => {
    if (!dashData?.kpis) {
      return {
        nbLotsIncubation: 0,
        poussinsAttendus: 0,
        poussinsMois: null,
        ventesMois: 0,
        tauxEclosion: '--',
        depensesMois: 0,
      };
    }
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
  }, [dashData]);

  // ══════════════════════════════════════════════════════════════════════════
  //  LOTS EN COURS — UNIQUEMENT depuis GAS (lecture directe du sheet). Plus de fallback local.
  // ══════════════════════════════════════════════════════════════════════════
  const lotsEnCours = useMemo(() => {
    if (!dashData?.incubations || dashData.incubations.length === 0) {
      return [];
    }
    return dashData.incubations
      .filter((inc, index, self) => index === self.findIndex((i) => i.id === inc.id))
      .map((inc) => {
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
  }, [dashData]);

  // ══════════════════════════════════════════════════════════════════════════
  //  5 DERNIÈRES ÉCLOSIONS — UNIQUEMENT depuis GAS. Plus de fallback local.
  // ══════════════════════════════════════════════════════════════════════════
  const dernieresEclosions = useMemo(() => {
    if (!dashData?.hatchingChart || dashData.hatchingChart.length === 0) {
      return [];
    }
    return dashData.hatchingChart.map((h) => ({
      id: h.id,
      date: h.date,
      type: h.type,
      race: h.race,
      fournisseur: h.fournisseur,
      oeufs: h.oeufs,
      commerciaux: h.poussins,
      // ✅ v1.3.2 : utiliser les vraies valeurs venant du backend
      morts: h.morts ?? 0,
      handicapes: h.handicapes ?? 0,
      fertiles: h.fertiles ?? 0,
      pourVente: h.pourVente ?? h.poussins,
      taux: h.taux,
      eclosion: h.date,
    }));
  }, [dashData]);

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
          <div className="text-4xl mb-3">📡</div>
          <div className="text-sm font-bold text-white/90 mb-2">Données du Google Sheet indisponibles</div>
          <div className="text-xs text-white/50 mb-4 leading-relaxed">
            Le tableau de bord lit directement les données du Google Sheet via GAS.
            Impossible de charger les données pour le moment.
            <br />
            <span className="text-amber-400/80 mt-2 inline-block">
              Détail : {error}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={loadDashboard}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
            >
              🔄 Réessayer
            </button>
            <button
              onClick={() => onNavigate('oac')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition"
            >
              ← Retour OAC
            </button>
          </div>
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
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold text-white tracking-wide">{dateStr}</div>
            <div className="text-[11px] text-white/70 font-medium">{weekStr}</div>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            title="Recharger les données depuis le Google Sheet"
            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <span className={loading ? 'inline-block animate-spin' : ''}>{loading ? '⟳' : '🔄'}</span>
            <span className="hidden sm:inline">{loading ? 'Chargement...' : 'Actualiser'}</span>
          </button>
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
            {role !== 'comptable' && (
              <button type="button" onClick={() => onNavigate('oac')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
                <div className="w-9 h-9 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center text-lg flex-shrink-0">🥚</div>
                <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Gestion OAC</div><div className="text-[10px] text-[#64748B] mt-0.5">Commandes</div></div>
              </button>
            )}
            <button type="button" onClick={() => onNavigate('couts_rentabilite')} className="bg-[#252b3d] hover:bg-[#2d3552] border border-white/5 p-3 rounded-lg flex items-center gap-3 transition text-left hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#10b981]/20 flex items-center justify-center text-lg flex-shrink-0">📈</div>
              <div><div className="text-xs font-bold text-[#E2E8F0] leading-tight">Rentabilité</div><div className="text-[10px] text-[#64748B] mt-0.5">Coûts & Marges</div></div>
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
                    <td className="py-2 font-bold text-emerald-400">{lot.commerciaux || 0}</td>
                    <td className="py-2 text-rose-400">{lot.morts || 0}</td>
                    <td className="py-2 text-amber-400">{lot.handicapes || 0}</td>
                    <td className="py-2 font-bold text-sky-400">{lot.pourVente || 0}</td>
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