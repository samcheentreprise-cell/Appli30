import React, { useState, useMemo } from 'react';
import { OAC } from '../types';

interface CalendrierModuleProps {
  oacList: OAC[];
  onNavigate?: (tab: any) => void;
  onClose?: () => void;
}

export const CalendrierModule: React.FC<CalendrierModuleProps> = ({
  oacList,
  onNavigate,
  onClose,
}) => {
  const [filter, setFilter] = useState<'tous' | 'Incubation' | 'Miré' | 'En éclosion' | 'Éclos'>('tous');
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to parse French date DD/MM/YYYY into Date
  const parseFrDate = (str: string | undefined): Date | null => {
    if (!str) return null;
    const clean = str.trim();
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (!isNaN(d.getTime())) return d;
      }
    }
    if (clean.includes('-')) {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const formatFrDate = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  // Compute calculated dates and operational indicators for each lot
  const enrichedLots = useMemo(() => {
    return oacList.map((lot) => {
      // Eclosion Date
      const dEclo = parseFrDate(lot.eclosion);

      // Incubation / Reception Date (lot.date or dEclo - 21 days)
      let dIncub = parseFrDate(lot.date);
      if (!dIncub && dEclo) {
        dIncub = new Date(dEclo);
        dIncub.setDate(dIncub.getDate() - 21);
      }

      // Mirage Date (dIncub + 18 days or dEclo - 3 days)
      let dMirage: Date | null = null;
      if (dIncub) {
        dMirage = new Date(dIncub);
        dMirage.setDate(dMirage.getDate() + 18);
      } else if (dEclo) {
        dMirage = new Date(dEclo);
        dMirage.setDate(dMirage.getDate() - 3);
      }

      // Jours d'incubation écoulés (0 to 21)
      let joursElapsed = 0;
      let joursRestants = 21;
      if (dIncub) {
        const diffMs = today.getTime() - dIncub.getTime();
        joursElapsed = Math.min(21, Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24))));
        joursRestants = Math.max(0, 21 - joursElapsed);
      }

      // Days until Mirage
      let joursAvantMirage: number | null = null;
      if (dMirage) {
        const diffMirage = Math.ceil((dMirage.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        joursAvantMirage = diffMirage;
      }

      // Days until Eclosion
      let joursAvantEclosion: number | null = null;
      if (dEclo) {
        const diffEclo = Math.ceil((dEclo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        joursAvantEclosion = diffEclo;
      }

      // ══════════════════════════════════════════════════════════════════════════
      // Operational Status : Incubation | Miré | En éclosion | Éclos
      // Règle formelle : Éclos si et seulement si les données de l'éclosion sont enregistrées
      // ══════════════════════════════════════════════════════════════════════════
      const hasDonneesEclosion = Boolean(
        (lot.commerciaux !== undefined && lot.commerciaux !== null && Number(lot.commerciaux) > 0) ||
        (lot.nes !== undefined && lot.nes !== null && Number(lot.nes) > 0) ||
        (lot.pourVente !== undefined && lot.pourVente !== null && Number(lot.pourVente) > 0) ||
        (lot.complet === true && (lot.commerciaux != null || lot.nes != null))
      );

      const hasDonneesMirage = Boolean(
        (lot.clairs !== undefined && lot.clairs !== null) ||
        (lot.fertiles !== undefined && lot.fertiles !== null)
      );

      let statut: 'Incubation' | 'Miré' | 'En éclosion' | 'Éclos' = 'Incubation';
      let statutBadge = 'bg-sky-100 text-sky-800 border-sky-300 font-extrabold';
      let isAlerteMirage = false;
      let isAlerteEclosion = false;

      if (hasDonneesEclosion) {
        // 1. ÉCLOS (si les données de l'éclosion sont enregistrées)
        statut = 'Éclos';
        statutBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold';
      } else if (joursElapsed >= 21 || (joursAvantEclosion !== null && joursAvantEclosion <= 0)) {
        // 2. EN ÉCLOSION (échéance d'éclosion atteinte mais résultats non encore enregistrés)
        statut = 'En éclosion';
        statutBadge = 'bg-purple-100 text-purple-900 border-purple-300 font-extrabold animate-pulse';
        isAlerteEclosion = true;
      } else if (hasDonneesMirage || (joursElapsed >= 18 && joursElapsed < 21) || (joursAvantMirage !== null && joursAvantMirage <= 0)) {
        // 3. MIRÉ (mirage réalisé ou échéance J18 atteinte)
        statut = 'Miré';
        statutBadge = 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold';
        isAlerteMirage = true;
      } else {
        // 4. INCUBATION (J0 à J17)
        statut = 'Incubation';
        statutBadge = 'bg-sky-100 text-sky-800 border-sky-300 font-extrabold';
        if (joursAvantMirage === 1 || joursAvantMirage === 0) {
          isAlerteMirage = true;
        }
      }

      const dateIncubStr = dIncub ? formatFrDate(dIncub) : lot.date || '--';
      const dateMirageStr = dMirage ? formatFrDate(dMirage) : '--';
      const dateEcloStr = dEclo ? formatFrDate(dEclo) : lot.eclosion || '--';

      const poussinsAttendus = lot.attendus || (lot.fertiles ? Math.round(lot.fertiles * 0.8) : Math.round(lot.recus * 0.75));

      return {
        ...lot,
        dateIncubStr,
        dateMirageStr,
        dateEcloStr,
        joursElapsed,
        joursRestants,
        joursAvantMirage,
        joursAvantEclosion,
        statut,
        statutBadge,
        isAlerteMirage,
        isAlerteEclosion,
        poussinsAttendus,
        hasDonneesEclosion,
        hasDonneesMirage,
      };
    });
  }, [oacList, today]);

  // KPIs
  const kpis = useMemo(() => {
    const actifs = enrichedLots.filter((l) => l.statut !== 'Éclos');
    const totalOeufs = actifs.reduce((acc, l) => acc + (l.recus || l.cartons * 360), 0);
    const totalAttendus = actifs.reduce((acc, l) => acc + l.poussinsAttendus, 0);

    const nbIncubation = enrichedLots.filter((l) => l.statut === 'Incubation').length;
    const nbMire = enrichedLots.filter((l) => l.statut === 'Miré').length;
    const nbEnEclosion = enrichedLots.filter((l) => l.statut === 'En éclosion').length;
    const nbEclos = enrichedLots.filter((l) => l.statut === 'Éclos').length;

    // Find next mirage
    const nextMirages = actifs
      .filter((l) => l.joursAvantMirage !== null && l.joursAvantMirage >= 0 && l.statut === 'Incubation')
      .sort((a, b) => (a.joursAvantMirage ?? 999) - (b.joursAvantMirage ?? 999));
    const prochainMirage = nextMirages[0]
      ? `${nextMirages[0].dateMirageStr} (${nextMirages[0].id})`
      : '--';

    // Find next hatch
    const nextHatches = actifs
      .filter((l) => l.joursAvantEclosion !== null && l.joursAvantEclosion >= 0 && l.statut !== 'Éclos')
      .sort((a, b) => (a.joursAvantEclosion ?? 999) - (b.joursAvantEclosion ?? 999));
    const prochaineEclosion = nextHatches[0]
      ? `${nextHatches[0].dateEcloStr} (${nextHatches[0].id})`
      : '--';

    return {
      lotsActifs: actifs.length,
      totalOeufs,
      totalAttendus,
      prochainMirage,
      prochaineEclosion,
      nbIncubation,
      nbMire,
      nbEnEclosion,
      nbEclos,
    };
  }, [enrichedLots]);

  // Filtered list
  const filteredLots = useMemo(() => {
    return enrichedLots.filter((lot) => {
      // Tab filter
      if (filter !== 'tous' && lot.statut !== filter) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          lot.id.toLowerCase().includes(q) ||
          lot.fournisseur.toLowerCase().includes(q) ||
          lot.race.toLowerCase().includes(q) ||
          lot.type.toLowerCase().includes(q) ||
          lot.dateEcloStr.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [enrichedLots, filter, searchTerm]);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6 animate-fade-in font-['Inter',sans-serif]">
      {/* ══════════════════════════════════════════════════════════════════════════
          TOP HEADER
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center text-2xl shadow-md">
            📅
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
              Calendrier Opérationnel des Échéances
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Suivi chronologique des lots OAC : Mirage (J+18) & Éclosion (J+21) avec alertes actives.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('oac')}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <span>🥚 Gérer les lots OAC</span>
              <span>❯</span>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition"
            >
              ✕ Fermer
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          KPI STATS SUMMARY CARDS
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Lots actifs */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/60 border border-blue-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700 text-xs font-bold uppercase tracking-wider">
            <span>Lots Actifs</span>
            <span className="text-base">🐣</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-900 mt-2">
            {kpis.lotsActifs}
          </div>
          <div className="text-[11px] text-blue-600/80 font-medium mt-0.5">en incubateur</div>
        </div>

        {/* Card 2: Total Œufs */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-700 text-xs font-bold uppercase tracking-wider">
            <span>Œufs Incubés</span>
            <span className="text-base">🥚</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-900 mt-2">
            {kpis.totalOeufs.toLocaleString('fr-FR')}
          </div>
          <div className="text-[11px] text-indigo-600/80 font-medium mt-0.5">capacité occupée</div>
        </div>

        {/* Card 3: Poussins attendus */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <span>Poussins Prévus</span>
            <span className="text-base">🐥</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-2">
            {kpis.totalAttendus.toLocaleString('fr-FR')}
          </div>
          <div className="text-[11px] text-emerald-600/80 font-medium mt-0.5">estimés fertiles</div>
        </div>

        {/* Card 4: Prochain Mirage */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold uppercase tracking-wider">
            <span>Prochain Mirage</span>
            <span className="text-base">🔦</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-900 mt-2 truncate">
            {kpis.prochainMirage}
          </div>
          <div className="text-[11px] text-amber-600/80 font-medium mt-0.5">échéance J+18</div>
        </div>

        {/* Card 5: Prochaine Éclosion */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100/60 border border-purple-200/80 rounded-2xl p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-purple-700 text-xs font-bold uppercase tracking-wider">
            <span>Prochaine Éclosion</span>
            <span className="text-base">🎂</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-purple-900 mt-2 truncate">
            {kpis.prochaineEclosion}
          </div>
          <div className="text-[11px] text-purple-600/80 font-medium mt-0.5">échéance J+21</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          FILTER TABS & SEARCH
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilter('tous')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filter === 'tous'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tous ({enrichedLots.length})
          </button>
          <button
            onClick={() => setFilter('Incubation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              filter === 'Incubation'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Incubation</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-sky-100 text-sky-800 rounded-full font-extrabold">{kpis.nbIncubation}</span>
          </button>
          <button
            onClick={() => setFilter('Miré')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              filter === 'Miré'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Miré</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full font-extrabold">{kpis.nbMire}</span>
          </button>
          <button
            onClick={() => setFilter('En éclosion')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              filter === 'En éclosion'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>En éclosion</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded-full font-extrabold">{kpis.nbEnEclosion}</span>
          </button>
          <button
            onClick={() => setFilter('Éclos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              filter === 'Éclos'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Éclos</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-extrabold">{kpis.nbEclos}</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
            🔍
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par ID, race, date..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-700 font-medium"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          TABLE DES ÉCHÉANCES
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 uppercase font-black text-[11px] text-slate-500 tracking-wider">
            <tr>
              <th className="px-4 py-3.5">LOT ID</th>
              <th className="px-4 py-3.5">FOURNISSEUR & RACE</th>
              <th className="px-4 py-3.5">CARTONS / ŒUFS</th>
              <th className="px-4 py-3.5">INCUBATION (J0)</th>
              <th className="px-4 py-3.5">MIRAGE J+18</th>
              <th className="px-4 py-3.5">ÉCLOSION J+21</th>
              <th className="px-4 py-3.5">POUSSINS PRÉVUS</th>
              <th className="px-4 py-3.5">STATUT & CYCLE</th>
              <th className="px-4 py-3.5 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredLots.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-400 font-medium">
                  <div className="text-3xl mb-2">🥚</div>
                  Aucun lot correspondant aux critères sélectionnés.
                </td>
              </tr>
            ) : (
              filteredLots.map((lot) => {
                const progressPct = Math.min(100, Math.round((lot.joursElapsed / 21) * 100));

                return (
                  <tr
                    key={lot.id}
                    className="hover:bg-amber-50/40 transition duration-150 group"
                  >
                    {/* LOT ID */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-extrabold text-slate-900 group-hover:text-amber-800 transition">
                        {lot.id}
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">
                        {lot.type}
                      </div>
                    </td>

                    {/* FOURNISSEUR & RACE */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-800">{lot.fournisseur || 'Couvoir'}</div>
                      <div className="text-[11px] text-slate-500">{lot.race || 'Souche standard'}</div>
                    </td>

                    {/* CARTONS / ŒUFS */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-extrabold text-slate-800 tabular-nums">
                        {lot.cartons} carton{lot.cartons > 1 ? 's' : ''}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {(lot.recus || lot.cartons * 360).toLocaleString('fr-FR')} œufs
                      </div>
                    </td>

                    {/* DATE INCUBATION (J0) */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-800 tabular-nums">
                        {lot.dateIncubStr}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">Mise en boîte</div>
                    </td>

                    {/* MIRAGE J+18 */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 tabular-nums">
                        <span>{lot.dateMirageStr}</span>
                        {lot.isAlerteMirage && (
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-black border border-amber-300">
                            ⚠️ J-{lot.joursAvantMirage}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {lot.clairs !== null ? `Clairs: ${lot.clairs}` : 'À réaliser'}
                      </div>
                    </td>

                    {/* ÉCLOSION J+21 */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-extrabold text-emerald-800 tabular-nums">
                        <span>{lot.dateEcloStr}</span>
                        {lot.isAlerteEclosion && (
                          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-black border border-emerald-300">
                            🎂 J-0 !
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {lot.joursRestants > 0 ? `Dans ${lot.joursRestants} j` : 'Atteint'}
                      </div>
                    </td>

                    {/* POUSSINS ATTENDUS */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-black text-slate-800 text-sm tabular-nums">
                        {lot.poussinsAttendus.toLocaleString('fr-FR')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {lot.commerciaux !== null ? `Nés: ${lot.commerciaux}` : 'Prévision'}
                      </div>
                    </td>

                    {/* STATUT & CYCLE PROGRESS */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-black border ${lot.statutBadge}`}
                      >
                        {lot.statut}
                      </span>
                      <div className="text-[10px] text-slate-500 font-medium mt-1">
                        {lot.statut === 'Éclos'
                          ? `✓ Données enregistrées (${(lot.commerciaux ?? lot.nes)?.toLocaleString('fr-FR')} poussins)`
                          : lot.statut === 'En éclosion'
                          ? '⏳ Terme J+21 atteint (attente saisie)'
                          : lot.statut === 'Miré'
                          ? (lot.clairs !== null && lot.clairs !== undefined ? `Mirage validé (${lot.clairs} clairs)` : `J${lot.joursElapsed}/21 • En transfert`)
                          : `J${lot.joursElapsed}/21 • En cours`}
                      </div>
                      <div className="w-28 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            lot.statut === 'Éclos'
                              ? 'bg-emerald-500'
                              : lot.statut === 'En éclosion'
                              ? 'bg-purple-600 animate-pulse'
                              : lot.statut === 'Miré'
                              ? 'bg-amber-500'
                              : 'bg-sky-500'
                          }`}
                          style={{
                            width: lot.statut === 'Éclos' || lot.statut === 'En éclosion' ? '100%' : `${progressWidth(progressPct)}%`,
                          }}
                        />
                      </div>
                    </td>

                    {/* ACTION */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {onNavigate ? (
                        <button
                          onClick={() => onNavigate('oac')}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg text-xs font-bold transition shadow-2xs"
                        >
                          Gérer lot ❯
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold">Actif</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          FOOTER INFORMATIF DU COUVOIR
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">💡</span>
          <span>
            <strong>Rappel technique :</strong> Le mirage s'effectue systématiquement à <strong>J+18</strong> pour retirer les œufs clairs et transférer les fertiles vers les paniers d'éclosion. L'éclosion démarre à <strong>J+21</strong>.
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <span>Aujourd'hui :</span>
          <strong className="text-slate-800">{formatFrDate(today)}</strong>
        </div>
      </div>
    </div>
  );
};

function progressWidth(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}
