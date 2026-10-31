import React, { useState, useMemo, useEffect } from 'react';
import { callApi } from '../services/googleSheet';
import { OAC, Depense, Vente } from '../types';
import { getStoredData, INITIAL_OAC, INITIAL_DEPENSES, INITIAL_VENTES } from '../data/initialData';
import { toCoutRentabiliteData } from '../lib/coutPoussin';
import { TableauCoutPoussin } from './TableauCoutPoussin';

// ============================================================
// ✅ v1.3.14 — MODULE COÛT & RENTABILITÉ
// ------------------------------------------------------------
// Calcule le coût par poussin et la rentabilité par lot éclos.
//
// STRATÉGIE (validée avec l'utilisateur) :
//   1. Lots inclus : UNIQUEMENT les lots avec statut="Eclo" (colonne Z)
//      → exclut les lots en incubation et les commandes non livrées
//   2. Dépenses directes OAC : achat œufs + transport + dédouanement
//      → affectées au lot via la colonne "ID Commande" (colonne H des dépenses)
//   3. Dépenses indirectes : toutes les autres dépenses du mois
//      → réparties au prorata du nombre de poussins éclos de chaque lot
//   4. Prix de vente : moyenne pondérée des ventes du mois
//   5. Période : mois calendaire en cours par défaut
// ============================================================

interface LotRentabilite {
  id: string;
  date: string;
  dateEclo: string;
  type: string;
  race: string;
  fournisseur: string;
  oeufsRecus: number;
  poussins: number;
  morts: number;
  handicapes: number;
  pourVente: number;
  tauxEclosion: number;
  coutDirect: number;
  coutIndirect: number;
  coutTotal: number;
  coutParPoussin: number;
  prixVente: number;
  valeurVente: number;
  margeBrute: number;
  margeNette: number;
  pctMarge: number;
}

interface ResumeMensuel {
  mois: number;
  annee: number;
  label: string;
  nbLots: number;
  poussins: number;
  couts: number;
  ventes: number;
  marge: number;
  rentabilitePct: number;
  coutMoyenParPoussin: number;
}

interface CoutRentabiliteData {
  success: boolean;
  periode: { mois: number; annee: number };
  kpis: {
    nbLotsEclos: number;
    totalPoussins: number;
    totalCoutsDirects: number;
    totalCoutsIndirects: number;
    totalCouts: number;
    coutMoyenParPoussin: number;
    prixVenteMoyen: number;
    totalVentes: number;
    totalMarge: number;
    margeMoyenneParLot: number;
    rentabilitePct: number;
  };
  lots: LotRentabilite[];
  resumeMensuel: ResumeMensuel[];
  debug?: string;
}

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

interface CoutRentabiliteModuleProps {
  onClose?: () => void;
  oacList?: OAC[];
  depenses?: Depense[];
  ventes?: Vente[];
}

function parseDateParts(dStr?: string | null): { day: number; month: number; year: number } | null {
  if (!dStr) return null;
  const s = String(dStr).trim();
  const fr = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (fr) {
    return { day: parseInt(fr[1], 10), month: parseInt(fr[2], 10) - 1, year: parseInt(fr[3], 10) };
  }
  const iso = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (iso) {
    return { day: parseInt(iso[3], 10), month: parseInt(iso[2], 10) - 1, year: parseInt(iso[1], 10) };
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return { day: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
  }
  return null;
}

export function computeCoutRentabilite(
  oacList: OAC[],
  depenses: Depense[],
  ventes: Vente[],
  targetMois: number,
  targetAnnee: number
): CoutRentabiliteData {
  const calcForMonth = (m: number, y: number) => {
    // 1. Lots éclos du mois
    const lotsDuMois = oacList.filter((lot) => {
      const st = String(lot.statut || '').trim().toLowerCase();
      const isEclos = st === 'eclo' || st === 'éclos' || st === 'eclos' || lot.complet === true || (Number(lot.commerciaux) > 0);
      if (!isEclos) return false;

      const dateParts = parseDateParts(lot.eclosion || (lot as any).dateEclosion);
      if (!dateParts) return false;
      return dateParts.month === m && dateParts.year === y;
    });

    // 2. Dépenses directes par lot
    const lotMap = new Map<string, number>();
    const directDepenseKeys = new Set<string>();

    depenses.forEach((dep, idx) => {
      const cmdId = String(dep.idCommande || '').trim().toUpperCase();
      const lib = String(dep.libelle || '').trim().toUpperCase();
      const montant = Number(dep.montant) || 0;

      for (const lot of lotsDuMois) {
        const lotIdUpper = String(lot.id).trim().toUpperCase();
        if (cmdId === lotIdUpper || (cmdId && cmdId.includes(lotIdUpper)) || (lib && lib.includes(lotIdUpper))) {
          lotMap.set(lot.id, (lotMap.get(lot.id) || 0) + montant);
          directDepenseKeys.add(String(dep.id || dep.ligne || `${dep.date}_${dep.montant}_${idx}`));
          break;
        }
      }
    });

    // 3. Dépenses indirectes du mois
    let totalDepensesIndirectesMois = 0;
    depenses.forEach((dep, idx) => {
      const dParts = parseDateParts(dep.date);
      if (!dParts || dParts.month !== m || dParts.year !== y) return;
      const key = String(dep.id || dep.ligne || `${dep.date}_${dep.montant}_${idx}`);
      if (!directDepenseKeys.has(key) && !dep.idCommande) {
        totalDepensesIndirectesMois += Number(dep.montant) || 0;
      }
    });

    // 4. Poussins éclos au total dans le mois
    const totalPoussinsMois = lotsDuMois.reduce((acc, lot) => {
      const p = Number(lot.commerciaux) || Number(lot.nes) || Number(lot.pourVente) || 0;
      return acc + p;
    }, 0);

    // 5. Prix moyen de vente du mois
    let totalVentesMois = 0;
    let totalPoussinsVendusMois = 0;
    ventes.forEach((v) => {
      const vParts = parseDateParts(v.date);
      if (!vParts || vParts.month !== m || vParts.year !== y) return;
      const qte = Number(v.quantite) || 0;
      const mt = Number(v.montant) || (qte * (Number(v.prixUnitaire) || 0));
      totalVentesMois += mt;
      totalPoussinsVendusMois += qte;
    });

    const prixVenteMoyen = totalPoussinsVendusMois > 0
      ? Math.round(totalVentesMois / totalPoussinsVendusMois)
      : 600;

    // 6. Construire les données détaillées par lot
    const lots: LotRentabilite[] = lotsDuMois.map((lot) => {
      const poussins = Number(lot.commerciaux) || Number(lot.nes) || Number(lot.pourVente) || 0;
      const morts = Number(lot.morts) || 0;
      const handicapes = Number(lot.handicapes) || 0;
      const pourVente = Number(lot.pourVente) || Math.max(0, poussins - handicapes - morts);
      const oeufsRecus = Number(lot.recus) || ((Number(lot.cartons) || 0) * 360) || 0;
      const tauxEclosion = lot.tauxEclosion
        ? (lot.tauxEclosion > 1 ? lot.tauxEclosion : lot.tauxEclosion * 100)
        : (oeufsRecus > 0 ? (poussins / oeufsRecus) * 100 : 0);

      const coutDirect = lotMap.get(lot.id) || 0;
      const coutIndirect = totalPoussinsMois > 0
        ? Math.round(totalDepensesIndirectesMois * (poussins / totalPoussinsMois))
        : 0;
      const coutTotal = coutDirect + coutIndirect;
      const coutParPoussin = poussins > 0 ? Math.round(coutTotal / poussins) : 0;
      const prixVente = prixVenteMoyen;
      const valeurVente = Math.round(pourVente * prixVente);
      const margeBrute = valeurVente - coutDirect;
      const margeNette = valeurVente - coutTotal;
      const pctMarge = valeurVente > 0 ? Math.round((margeNette / valeurVente) * 1000) / 10 : 0;

      return {
        id: lot.id,
        date: lot.date || '',
        dateEclo: lot.eclosion || (lot as any).dateEclosion || '',
        type: lot.type || '',
        race: lot.race || '',
        fournisseur: lot.fournisseur || '',
        oeufsRecus,
        poussins,
        morts,
        handicapes,
        pourVente,
        tauxEclosion: Math.round(tauxEclosion * 10) / 10,
        coutDirect,
        coutIndirect,
        coutTotal,
        coutParPoussin,
        prixVente,
        valeurVente,
        margeBrute,
        margeNette,
        pctMarge,
      };
    });

    const totalCoutsDirects = lots.reduce((acc, l) => acc + l.coutDirect, 0);
    const totalCoutsIndirects = lots.reduce((acc, l) => acc + l.coutIndirect, 0);
    const totalCouts = totalCoutsDirects + totalCoutsIndirects;
    const totalPoussins = lots.reduce((acc, l) => acc + l.poussins, 0);
    const totalVentes = lots.reduce((acc, l) => acc + l.valeurVente, 0);
    const totalMarge = totalVentes - totalCouts;
    const coutMoyenParPoussin = totalPoussins > 0 ? Math.round(totalCouts / totalPoussins) : 0;
    const margeMoyenneParLot = lots.length > 0 ? Math.round(totalMarge / lots.length) : 0;
    const rentabilitePct = totalCouts > 0
      ? Math.round((totalMarge / totalCouts) * 1000) / 10
      : (totalVentes > 0 ? Math.round((totalMarge / totalVentes) * 1000) / 10 : 0);

    return {
      lots,
      kpis: {
        nbLotsEclos: lots.length,
        totalPoussins,
        totalCoutsDirects,
        totalCoutsIndirects,
        totalCouts,
        coutMoyenParPoussin,
        prixVenteMoyen,
        totalVentes,
        totalMarge,
        margeMoyenneParLot,
        rentabilitePct,
      },
    };
  };

  const currentMonthData = calcForMonth(targetMois, targetAnnee);

  // Resume Mensuel (6 derniers mois)
  const resumeMensuel: ResumeMensuel[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(targetAnnee, targetMois - i, 1));
    const m = d.getUTCMonth();
    const y = d.getUTCFullYear();
    const mData = calcForMonth(m, y);
    resumeMensuel.push({
      mois: m,
      annee: y,
      label: `${MOIS_LABELS[m].slice(0, 4)} ${y}`,
      nbLots: mData.kpis.nbLotsEclos,
      poussins: mData.kpis.totalPoussins,
      couts: mData.kpis.totalCouts,
      ventes: mData.kpis.totalVentes,
      marge: mData.kpis.totalMarge,
      rentabilitePct: mData.kpis.rentabilitePct,
      coutMoyenParPoussin: mData.kpis.coutMoyenParPoussin,
    });
  }

  return {
    success: true,
    periode: { mois: targetMois, annee: targetAnnee },
    kpis: currentMonthData.kpis,
    lots: currentMonthData.lots,
    resumeMensuel,
  };
}

export const CoutRentabiliteModule: React.FC<CoutRentabiliteModuleProps> = ({
  onClose,
  oacList: propOacList,
  depenses: propDepenses,
  ventes: propVentes,
}) => {
  const [data, setData] = useState<CoutRentabiliteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Par défaut : mois en cours
  const now = new Date();
  const [moisSelect, setMoisSelect] = useState<number>(now.getUTCMonth());
  const [anneeSelect, setAnneeSelect] = useState<number>(now.getUTCFullYear());
  // Inclure ou non l'amortissement des équipements dans le coût (désactivé par défaut)
  const [inclureAmort, setInclureAmort] = useState<boolean>(false);

  // Données locales ou transmises en props
  const currentOacList = useMemo(() => propOacList || getStoredData('oac', INITIAL_OAC), [propOacList]);
  const currentDepenses = useMemo(() => propDepenses || getStoredData('depenses', INITIAL_DEPENSES), [propDepenses]);
  const currentVentes = useMemo(() => propVentes || getStoredData('ventes', INITIAL_VENTES), [propVentes]);

  // v1.4.0 : calcul local unique (prix unitaire par poussin vendable, engagements, amortissement)
  const loadData = (mois: number, annee: number) => {
    setLoading(true);
    setError(null);
    try {
      const computed = toCoutRentabiliteData(currentOacList, currentDepenses, currentVentes, mois, annee, 60, inclureAmort);
      setData(computed as any);
    } catch (e: any) {
      setError(e?.message || 'Erreur de calcul');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData(moisSelect, anneeSelect);
  }, [moisSelect, anneeSelect, inclureAmort, currentOacList, currentDepenses, currentVentes]);

  // ─────────────────────────────────────────────────────────────
  // Helpers de formatage
  // ─────────────────────────────────────────────────────────────
  const fmtFCFA = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n as number)) return '--';
    return Number(n).toLocaleString('fr-FR') + ' FCFA';
  };

  const fmtN = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n as number)) return '--';
    return Number(n).toLocaleString('fr-FR');
  };

  const fmtPct = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n as number)) return '--';
    const signe = Number(n) >= 0 ? '+' : '';
    return signe + Number(n).toFixed(1) + '%';
  };

  // Années disponibles (3 dernières années)
  const anneesDispos = useMemo(() => {
    const currentYear = now.getUTCFullYear();
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
  }, []);

  // ─────────────────────────────────────────────────────────────
  // États
  // ─────────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="bg-[#0f172a] text-[#E2E8F0] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3"></div>
          <div className="text-sm text-white/60">Calcul du coût et de la rentabilité...</div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-[#0f172a] text-[#E2E8F0] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-sm font-bold text-white/90 mb-2">Données de coût indisponibles</div>
          <div className="text-xs text-white/50 mb-4">{error}</div>
          <button
            onClick={() => loadData(moisSelect, anneeSelect)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
          >
            🔄 Réessayer
          </button>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;
  const lots = data?.lots || [];
  const resume = data?.resumeMensuel || [];

  // ─────────────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#0f172a] text-[#E2E8F0] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 font-['Inter',sans-serif] space-y-4 animate-fade-in select-none">
      {/* TOP HEADER avec sélecteur de période */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#1e40af] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-md p-1.5 flex-shrink-0">
            <span className="text-2xl">💰</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-tight">
              Coûts & Rentabilité
            </h1>
            <p className="text-xs text-white/70 font-medium">
              Analyse du coût par poussin et de la marge par lot éclos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Sélecteur Mois */}
          <select
            value={moisSelect}
            onChange={(e) => setMoisSelect(parseInt(e.target.value))}
            className="bg-white/10 border border-white/20 text-white px-3 py-2 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            {MOIS_LABELS.map((label, idx) => (
              <option key={idx} value={idx} className="bg-slate-800">
                {label}
              </option>
            ))}
          </select>
          {/* Option amortissement */}
          <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none px-2">
            <input
              type="checkbox"
              checked={inclureAmort}
              onChange={(e) => setInclureAmort(e.target.checked)}
              className="w-4 h-4 accent-sky-400"
            />
            Inclure amortissement équipements
          </label>
          {/* Sélecteur Année */}
          <select
            value={anneeSelect}
            onChange={(e) => setAnneeSelect(parseInt(e.target.value))}
            className="bg-white/10 border border-white/20 text-white px-3 py-2 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            {anneesDispos.map((a) => (
              <option key={a} value={a} className="bg-slate-800">
                {a}
              </option>
            ))}
          </select>
          {/* Bouton Actualiser */}
          <button
            onClick={() => loadData(moisSelect, anneeSelect)}
            disabled={loading}
            title="Recharger les données"
            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <span className={loading ? 'inline-block animate-spin' : ''}>{loading ? '⟳' : '🔄'}</span>
            <span className="hidden sm:inline">{loading ? 'Calcul...' : 'Actualiser'}</span>
          </button>
          {/* Bouton Quitter */}
          {onClose && (
            <button
              onClick={onClose}
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>✕</span>
              <span className="hidden sm:inline">Quitter</span>
            </button>
          )}
        </div>
      </div>

      {/* AIDE : méthodologie */}
      <div className="bg-[#1a1f36] rounded-xl p-3 sm:p-4 border border-blue-500/20 flex items-start gap-3">
        <span className="text-lg flex-shrink-0">💡</span>
        <div className="text-[11px] text-[#94A3B8] leading-relaxed">
          <strong className="text-blue-300">Méthodologie :</strong>{' '}
          Seuls les lots avec statut <strong className="text-emerald-400">"Eclo"</strong> sont inclus.
          Les dépenses directes OAC (achat œufs, transport, dédouanement) sont affectées au lot via l'ID Commande.
          Les dépenses indirectes (salaires, électricité, loyer, etc.) sont réparties au prorata du nombre de poussins éclos.
          Le prix de vente utilisé est la <strong className="text-amber-300">moyenne pondérée des ventes du mois</strong>.
        </div>
      </div>

      {/* KPIs PRINCIPAUX (4 cartes) */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Coût moyen par poussin */}
          <div className="bg-gradient-to-br from-[#1e40af] to-[#2563eb] rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">COÛT / POUSSIN</div>
            <div className="text-xl sm:text-2xl font-extrabold text-white leading-tight tabular-nums">
              {fmtFCFA(kpis.coutMoyenParPoussin)}
            </div>
            <div className="text-[10px] text-white/70 mt-1 font-medium">
              {fmtN(kpis.totalPoussins)} poussins éclos
            </div>
          </div>

          {/* Prix de vente moyen */}
          <div className="bg-gradient-to-br from-[#15803d] to-[#16a34a] rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="text-2xl mb-1">🪙</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">PRIX VENTE MOYEN</div>
            <div className="text-xl sm:text-2xl font-extrabold text-white leading-tight tabular-nums">
              {fmtFCFA(kpis.prixVenteMoyen)}
            </div>
            <div className="text-[10px] text-white/70 mt-1 font-medium">
              par poussin vendu
            </div>
          </div>

          {/* Marge nette totale */}
          <div className={`bg-gradient-to-br ${kpis.totalMarge >= 0 ? 'from-[#15803d] to-[#16a34a]' : 'from-[#991b1b] to-[#dc2626]'} rounded-xl p-4 shadow-lg relative overflow-hidden`}>
            <div className="text-2xl mb-1">{kpis.totalMarge >= 0 ? '📈' : '📉'}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">MARGE NETTE</div>
            <div className="text-xl sm:text-2xl font-extrabold text-white leading-tight tabular-nums">
              {fmtFCFA(kpis.totalMarge)}
            </div>
            <div className="text-[10px] text-white/70 mt-1 font-medium">
              {kpis.nbLotsEclos} lot(s) éclos
            </div>
          </div>

          {/* Rentabilité % */}
          <div className={`bg-gradient-to-br ${kpis.rentabilitePct >= 0 ? 'from-[#6d28d9] to-[#7c3aed]' : 'from-[#92400e] to-[#b45309]'} rounded-xl p-4 shadow-lg relative overflow-hidden`}>
            <div className="text-2xl mb-1">🎯</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">RENTABILITÉ</div>
            <div className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
              {fmtPct(kpis.rentabilitePct)}
            </div>
            <div className="text-[10px] text-white/70 mt-1 font-medium">
              marge / coûts
            </div>
          </div>
        </div>
      )}

      {/* TABLEAU COÛT DU POUSSIN (sans amortissement) */}
      <div className="mb-4">
        <TableauCoutPoussin lots={lots} fmtN={fmtN} fmtFCFA={fmtFCFA} />
      </div>

      {/* TABLEAU DES LOTS ÉCLOS */}
      <div className="bg-[#1a1f36] rounded-xl p-4 sm:p-5 shadow-lg border border-white/5">
        <div className="flex items-center gap-2 pb-3 border-b border-white/5">
          <div className="w-[3px] h-[18px] bg-[#a855f7] rounded" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">
            Lots éclos — {MOIS_LABELS[moisSelect]} {anneeSelect}
          </h2>
        </div>

        {lots.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3 opacity-50">🐔</div>
            <div className="text-sm text-[#64748B] font-medium mb-1">Aucun lot éclos ce mois</div>
            <div className="text-xs text-[#475569]">
              Les lots en incubation ne sont pas inclus dans le calcul.
              Sélectionnez un autre mois ou attendez que des lots soient marqués "Eclo".
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs text-[#E2E8F0]">
              <thead className="text-[10px] text-[#94A3B8] uppercase">
                <tr>
                  <th className="pb-2 pr-3 whitespace-nowrap">Lot ID</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Date Éclo.</th>
                  <th className="pb-2 pr-3 text-right whitespace-nowrap">Œufs reçus</th>
                  <th className="pb-2 pr-3 text-right whitespace-nowrap">Poussins</th>
                  <th className="pb-2 pr-3 text-right whitespace-nowrap">Coût direct</th>
                  <th className="pb-2 pr-3 text-right whitespace-nowrap">Quote-part</th>
                  <th className="pb-2 pr-3 text-right whitespace-nowrap">Coût total</th>
                  <th className="pb-2 pr-3 text-right whitespace-nowrap">Coût/poussin</th>
                  <th className="pb-2 pr-3 text-right whitespace-nowrap">Prix vente</th>
                  <th className="pb-2 pr-3 text-right whitespace-nowrap">Marge nette</th>
                  <th className="pb-2 text-right whitespace-nowrap">% Marge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lots.map((lot, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    <td className="py-2 pr-3 font-bold text-blue-300 whitespace-nowrap">{lot.id}</td>
                    <td className="py-2 pr-3 text-[#94A3B8] whitespace-nowrap tabular-nums">{lot.dateEclo}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtN(lot.oeufsRecus)}</td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums text-emerald-300">{fmtN(lot.poussins)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#94A3B8]">{fmtFCFA(lot.coutDirect)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#94A3B8]">{fmtFCFA(lot.coutIndirect)}</td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums">{fmtFCFA(lot.coutTotal)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-bold text-amber-300">{fmtFCFA(lot.coutParPoussin)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-300">{fmtFCFA(lot.prixVente)}</td>
                    <td className={`py-2 pr-3 text-right font-bold tabular-nums ${lot.margeNette >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {fmtFCFA(lot.margeNette)}
                    </td>
                    <td className={`py-2 text-right font-bold tabular-nums ${lot.pctMarge >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {fmtPct(lot.pctMarge)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totaux */}
              <tfoot>
                <tr className="border-t-2 border-white/10 bg-white/5">
                  <td className="py-3 pr-3 font-extrabold uppercase text-[10px]" colSpan={2}>TOTAUX</td>
                  <td className="py-3 pr-3 text-right tabular-nums font-bold">
                    {fmtN(lots.reduce((s, l) => s + l.oeufsRecus, 0))}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-bold text-emerald-300">
                    {fmtN(kpis?.totalPoussins)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-bold text-[#94A3B8]">
                    {fmtFCFA(kpis?.totalCoutsDirects)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-bold text-[#94A3B8]">
                    {fmtFCFA(kpis?.totalCoutsIndirects)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-extrabold">
                    {fmtFCFA(kpis?.totalCouts)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-extrabold text-amber-300">
                    {fmtFCFA(kpis?.coutMoyenParPoussin)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-bold text-emerald-300">
                    {fmtFCFA(kpis?.prixVenteMoyen)}
                  </td>
                  <td className={`py-3 pr-3 text-right tabular-nums font-extrabold ${(kpis?.totalMarge || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtFCFA(kpis?.totalMarge)}
                  </td>
                  <td className={`py-3 text-right tabular-nums font-extrabold ${(kpis?.rentabilitePct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtPct(kpis?.rentabilitePct)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* RÉSUMÉ MENSUEL — 6 derniers mois (graphique en barres simple) */}
      {resume.length > 0 && (
        <div className="bg-[#1a1f36] rounded-xl p-4 sm:p-5 shadow-lg border border-white/5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <div className="w-[3px] h-[18px] bg-[#22c55e] rounded" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">
              Évolution sur 6 mois
            </h2>
          </div>

          {/* Graphique simple en barres (HTML/CSS) */}
          <div className="mt-4 grid grid-cols-6 gap-2 h-48 items-end">
            {resume.map((r, idx) => {
              const maxMarge = Math.max(...resume.map(x => Math.abs(x.marge)), 1);
              const hauteurPct = (Math.abs(r.marge) / maxMarge) * 100;
              const isPositif = r.marge >= 0;
              return (
                <div key={idx} className="flex flex-col items-center gap-1">
                  {/* Barre */}
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t transition-all hover:opacity-80 ${
                        isPositif ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-rose-600 to-rose-400'
                      }`}
                      style={{ height: `${hauteurPct}%`, minHeight: '4px' }}
                      title={`Marge : ${fmtFCFA(r.marge)}`}
                    />
                  </div>
                  {/* Label mois */}
                  <div className="text-[9px] text-[#94A3B8] font-bold uppercase text-center">{r.label}</div>
                  {/* Marge */}
                  <div className={`text-[9px] font-bold text-center ${isPositif ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {r.marge >= 1000 ? `${(r.marge / 1000).toFixed(0)}k` : r.marge <= -1000 ? `${(r.marge / 1000).toFixed(0)}k` : fmtN(r.marge)}
                  </div>
                  {/* Nb lots */}
                  <div className="text-[8px] text-[#64748B] text-center">{r.nbLots} lot(s)</div>
                </div>
              );
            })}
          </div>

          {/* Tableau détaillé du résumé */}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs text-[#E2E8F0]">
              <thead className="text-[10px] text-[#94A3B8] uppercase">
                <tr>
                  <th className="pb-2 pr-3">Mois</th>
                  <th className="pb-2 pr-3 text-right">Lots</th>
                  <th className="pb-2 pr-3 text-right">Poussins</th>
                  <th className="pb-2 pr-3 text-right">Coûts</th>
                  <th className="pb-2 pr-3 text-right">Ventes</th>
                  <th className="pb-2 pr-3 text-right">Marge</th>
                  <th className="pb-2 pr-3 text-right">Coût/poussin</th>
                  <th className="pb-2 text-right">Rentabilité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resume.map((r, idx) => (
                  <tr key={idx} className={r.mois === moisSelect && r.annee === anneeSelect ? 'bg-blue-500/10' : 'hover:bg-white/5'}>
                    <td className="py-2 pr-3 font-bold whitespace-nowrap">{r.label}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.nbLots}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtN(r.poussins)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtFCFA(r.couts)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-300">{fmtFCFA(r.ventes)}</td>
                    <td className={`py-2 pr-3 text-right font-bold tabular-nums ${r.marge >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtFCFA(r.marge)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-amber-300">{fmtFCFA(r.coutMoyenParPoussin)}</td>
                    <td className={`py-2 text-right font-bold tabular-nums ${r.rentabilitePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtPct(r.rentabilitePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DÉTAIL DES COÛTS (résumé vertical) */}
      {kpis && (
        <div className="bg-[#1a1f36] rounded-xl p-4 sm:p-5 shadow-lg border border-white/5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <div className="w-[3px] h-[18px] bg-[#f59e0b] rounded" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">
              Synthèse financière — {MOIS_LABELS[moisSelect]} {anneeSelect}
            </h2>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Coûts directs */}
            <div className="bg-[#252b3d] rounded-lg p-3 border-l-2 border-blue-500">
              <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-1">Dépenses directes OAC</div>
              <div className="text-base font-extrabold text-blue-300 tabular-nums">{fmtFCFA(kpis.totalCoutsDirects)}</div>
              <div className="text-[10px] text-[#64748B] mt-1">Achat œufs + transport + dédouanement (affectés aux lots via ID Commande)</div>
            </div>
            {/* Coûts indirects */}
            <div className="bg-[#252b3d] rounded-lg p-3 border-l-2 border-amber-500">
              <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-1">Dépenses indirectes (quote-part)</div>
              <div className="text-base font-extrabold text-amber-300 tabular-nums">{fmtFCFA(kpis.totalCoutsIndirects)}</div>
              <div className="text-[10px] text-[#64748B] mt-1">Salaires, électricité, loyer, etc. — réparties au prorata des poussins</div>
            </div>
            {/* Total coûts */}
            <div className="bg-[#252b3d] rounded-lg p-3 border-l-2 border-rose-500">
              <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-1">Total des coûts</div>
              <div className="text-base font-extrabold text-rose-300 tabular-nums">{fmtFCFA(kpis.totalCouts)}</div>
              <div className="text-[10px] text-[#64748B] mt-1">Directes + indirectes</div>
            </div>
            {/* Total ventes */}
            <div className="bg-[#252b3d] rounded-lg p-3 border-l-2 border-emerald-500">
              <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-1">Valeur totale des ventes</div>
              <div className="text-base font-extrabold text-emerald-300 tabular-nums">{fmtFCFA(kpis.totalVentes)}</div>
              <div className="text-[10px] text-[#64748B] mt-1">Prix moyen × nb poussins éclos</div>
            </div>
          </div>

          {/* Ligne de marge finale */}
          <div className={`mt-3 rounded-lg p-3 flex items-center justify-between ${kpis.totalMarge >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
            <div>
              <div className="text-[10px] font-bold uppercase text-[#94A3B8]">Marge nette totale</div>
              <div className="text-[10px] text-[#64748B]">Ventes - Total coûts</div>
            </div>
            <div className={`text-xl font-extrabold tabular-nums ${kpis.totalMarge >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtFCFA(kpis.totalMarge)}
            </div>
          </div>
        </div>
      )}

      {/* Debug (visible seulement si erreur) */}
      {data?.debug && data.debug.includes('ERR') && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-[10px] text-rose-300 font-mono">
          Debug : {data.debug}
        </div>
      )}
    </div>
  );
};
