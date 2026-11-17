import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, Download, Printer, ArrowRight, RotateCcw, Layers, GitCommitHorizontal, Check } from 'lucide-react';
import { OAC } from '../types';

export interface ActiveLotAnchor {
  id: string;
  fournisseur: string;
  race: string;
  type: string;
  cartons: number;
  dateIncub: Date | null;
  dateMirage: Date | null;
  dateEclo: Date | null;
  statut: string;
}

interface IncubationPlannerProps {
  activeAnchors: ActiveLotAnchor[];
  allLots: OAC[];
  today: Date;
  onNavigate?: (tab: any) => void;
}

const MIN_CARTONS_LOT = 54;

interface PlannedOrderRow {
  rowKey: string;
  orderIndex: number;
  sourceLotId: string | null;
  sourceLotStatut?: string;
  sourceCartons?: number;
  rotationNum: number;
  origineLabel: string;
  dateCommande: Date;
  dateReception: Date;
  dateIncubation: Date;
  dateMirage: Date;
  dateEclosion: Date;
  joursAvantCommande: number;
  urgence: 'retard' | 'urgent' | 'proche' | 'planifie';
  cartons: number;
  oeufs: number;
  poussinsEstimes: number;
  fournisseur: string;
  race: string;
}

const addDays = (base: Date, days: number): Date => {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
};

const toIsoInput = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatFr = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatShortFr = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const diffDays = (target: Date, base: Date): number => {
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const b = new Date(base);
  b.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
};

export const IncubationPlanner: React.FC<IncubationPlannerProps> = ({
  activeAnchors,
  allLots,
  today,
  onNavigate,
}) => {
  // Lots actifs utilisables (avec date de mirage connue), triés chronologiquement par mirage
  const validAnchors = useMemo(() => {
    return [...activeAnchors]
      .filter((a) => a.dateMirage !== null)
      .sort((a, b) => a.dateMirage!.getTime() - b.dateMirage!.getTime());
  }, [activeAnchors]);

  // Lots actuellement en phase d'incubation (prioritaires pour la relève à venir)
  const incubatingAnchors = useMemo(
    () => validAnchors.filter((a) => a.statut === 'Incubation'),
    [validAnchors]
  );

  // Lots par défaut à sélectionner en vision globale : les lots en incubation (ou tous si aucun n'est strictement en incubation)
  const defaultGlobalLotIds = useMemo(() => {
    const base = incubatingAnchors.length > 0 ? incubatingAnchors : validAnchors;
    return base.map((a) => a.id);
  }, [incubatingAnchors, validAnchors]);

  // Meilleur lot de départ par défaut pour le mode "Point de départ Cycle 1"
  const defaultSingleAnchor = useMemo(() => {
    const minTime = addDays(today, -1).getTime();
    return validAnchors.find((a) => a.dateMirage!.getTime() >= minTime) || validAnchors[0] || null;
  }, [validAnchors, today]);

  // Taux d'éclosion historique moyen calculé depuis les lots éclos
  const historicalHatchRate = useMemo(() => {
    const hatched = allLots.filter((l) => {
      const rec = Number(l.recus) || Number(l.cartons) * 360;
      const com = Number(l.commerciaux) || Number(l.nes) || 0;
      return rec > 0 && com > 0;
    });
    if (hatched.length === 0) return 78;
    const sumEggs = hatched.reduce((s, l) => s + (Number(l.recus) || Number(l.cartons) * 360), 0);
    const sumChicks = hatched.reduce((s, l) => s + (Number(l.commerciaux) || Number(l.nes) || 0), 0);
    const pct = Math.round((sumChicks / sumEggs) * 100);
    return Math.min(95, Math.max(55, pct));
  }, [allLots]);

  // Mode principal : Vision globale (tous les lots en cours) vs Point de départ Cycle 1 (1 lot ou date)
  const [planningScope, setPlanningScope] = useState<'global' | 'single'>(
    validAnchors.length >= 2 ? 'global' : 'single'
  );
  const [hasUserChangedScope, setHasUserChangedScope] = useState(false);

  // État Vision globale
  const [selectedGlobalIds, setSelectedGlobalIds] = useState<string[]>(defaultGlobalLotIds);
  const [hasUserEditedGlobalSelection, setHasUserEditedGlobalSelection] = useState(false);
  const [rotationsParLot, setRotationsParLot] = useState<number>(1);
  const [globalVolumeMode, setGlobalVolumeMode] = useState<'lot' | 'uniform'>('lot');

  // État Point de départ Cycle 1 (mode ciblé)
  const [anchorMode, setAnchorMode] = useState<'lot' | 'custom'>(
    defaultSingleAnchor ? 'lot' : 'custom'
  );
  const [hasUserChangedSingleMode, setHasUserChangedSingleMode] = useState(false);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>(
    defaultSingleAnchor?.id || ''
  );
  const [customStartDate, setCustomStartDate] = useState<string>(() =>
    toIsoInput(defaultSingleAnchor?.dateMirage ? addDays(defaultSingleAnchor.dateMirage, 1) : addDays(today, 1))
  );
  const [nbCycles, setNbCycles] = useState<number>(4);

  // Paramètres opérationnels partagés
  const [delaiCommandeJours, setDelaiCommandeJours] = useState<number>(7);
  const [battementApresMirage, setBattementApresMirage] = useState<number>(1); // 1 = lendemain du mirage
  const [cartonsParLot, setCartonsParLot] = useState<number>(
    Math.max(MIN_CARTONS_LOT, defaultSingleAnchor?.cartons || MIN_CARTONS_LOT)
  );
  const [tauxEclosionPct, setTauxEclosionPct] = useState<number>(historicalHatchRate);
  const [fournisseurPrevu, setFournisseurPrevu] = useState<string>(
    defaultSingleAnchor?.fournisseur || 'Pak tavuk'
  );
  const [racePrevue, setRacePrevue] = useState<string>(
    defaultSingleAnchor?.race || 'Ross 308'
  );

  // Synchronisation lorsque oacList arrive après le premier rendu
  useEffect(() => {
    if (!hasUserChangedScope && validAnchors.length >= 2 && planningScope !== 'global') {
      setPlanningScope('global');
    }
    if (!hasUserEditedGlobalSelection && defaultGlobalLotIds.length > 0) {
      setSelectedGlobalIds(defaultGlobalLotIds);
    }
    if (validAnchors.length > 0 && !hasUserChangedSingleMode && anchorMode === 'custom' && defaultSingleAnchor) {
      setAnchorMode('lot');
      setSelectedAnchorId(defaultSingleAnchor.id);
      if (defaultSingleAnchor.cartons > 0) setCartonsParLot(Math.max(MIN_CARTONS_LOT, defaultSingleAnchor.cartons));
      if (defaultSingleAnchor.fournisseur) setFournisseurPrevu(defaultSingleAnchor.fournisseur);
      if (defaultSingleAnchor.race) setRacePrevue(defaultSingleAnchor.race);
      return;
    }
    if (anchorMode === 'lot' && validAnchors.length > 0 && !validAnchors.some((a) => a.id === selectedAnchorId) && defaultSingleAnchor) {
      setSelectedAnchorId(defaultSingleAnchor.id);
      if (defaultSingleAnchor.cartons > 0) setCartonsParLot(Math.max(MIN_CARTONS_LOT, defaultSingleAnchor.cartons));
      if (defaultSingleAnchor.fournisseur) setFournisseurPrevu(defaultSingleAnchor.fournisseur);
      if (defaultSingleAnchor.race) setRacePrevue(defaultSingleAnchor.race);
    }
  }, [
    validAnchors,
    defaultGlobalLotIds,
    defaultSingleAnchor,
    planningScope,
    hasUserChangedScope,
    hasUserEditedGlobalSelection,
    anchorMode,
    selectedAnchorId,
    hasUserChangedSingleMode,
  ]);

  const activeAnchorObj = useMemo(
    () => validAnchors.find((a) => a.id === selectedAnchorId) || defaultSingleAnchor || null,
    [validAnchors, selectedAnchorId, defaultSingleAnchor]
  );

  const selectedGlobalLots = useMemo(
    () => validAnchors.filter((a) => selectedGlobalIds.includes(a.id)),
    [validAnchors, selectedGlobalIds]
  );

  const handleSelectAnchorLot = (lotId: string) => {
    setHasUserChangedSingleMode(true);
    if (lotId === '__custom__') {
      setAnchorMode('custom');
      return;
    }
    setAnchorMode('lot');
    setSelectedAnchorId(lotId);
    const found = validAnchors.find((a) => a.id === lotId);
    if (found) {
      if (found.cartons > 0) setCartonsParLot(Math.max(MIN_CARTONS_LOT, found.cartons));
      if (found.fournisseur) setFournisseurPrevu(found.fournisseur);
      if (found.race) setRacePrevue(found.race);
    }
  };

  const toggleGlobalLot = (lotId: string) => {
    setHasUserEditedGlobalSelection(true);
    setSelectedGlobalIds((prev) =>
      prev.includes(lotId) ? prev.filter((id) => id !== lotId) : [...prev, lotId]
    );
  };

  const selectGlobalPreset = (preset: 'incubation' | 'all') => {
    setHasUserEditedGlobalSelection(true);
    if (preset === 'incubation') {
      setSelectedGlobalIds(incubatingAnchors.map((a) => a.id));
    } else {
      setSelectedGlobalIds(validAnchors.map((a) => a.id));
    }
  };

  const resetDefaults = () => {
    setDelaiCommandeJours(7);
    setBattementApresMirage(1);
    setNbCycles(4);
    setRotationsParLot(1);
    setGlobalVolumeMode('lot');
    setTauxEclosionPct(historicalHatchRate);
    setHasUserChangedScope(false);
    setHasUserEditedGlobalSelection(false);
    setHasUserChangedSingleMode(false);
    setPlanningScope(validAnchors.length >= 2 ? 'global' : 'single');
    setSelectedGlobalIds(defaultGlobalLotIds);

    if (defaultSingleAnchor) {
      setAnchorMode('lot');
      setSelectedAnchorId(defaultSingleAnchor.id);
      setCartonsParLot(Math.max(MIN_CARTONS_LOT, defaultSingleAnchor.cartons || MIN_CARTONS_LOT));
      setFournisseurPrevu(defaultSingleAnchor.fournisseur || 'Pak tavuk');
      setRacePrevue(defaultSingleAnchor.race || 'Ross 308');
    } else {
      setAnchorMode('custom');
      setCustomStartDate(toIsoInput(addDays(today, 1)));
      setCartonsParLot(MIN_CARTONS_LOT);
    }
  };

  // Listes uniques fournisseurs / races pour les suggestions
  const fournisseurOptions = useMemo(() => {
    const set = new Set<string>(['Pak tavuk', 'Garanti', 'Couvoir local']);
    allLots.forEach((l) => {
      if (l.fournisseur) set.add(l.fournisseur.trim());
    });
    return Array.from(set);
  }, [allLots]);

  const raceOptions = useMemo(() => {
    const set = new Set<string>(['Ross 308', 'Cobb 500', 'Pondeuse ISA Brown']);
    allLots.forEach((l) => {
      if (l.race) set.add(l.race.trim());
    });
    return Array.from(set);
  }, [allLots]);

  // ══════════════════════════════════════════════════════════════════════════════
  // MOTEUR DE CALCUL UNIFIÉ (Vision globale multi-lots OU Cycle 1 ciblé)
  // ══════════════════════════════════════════════════════════════════════════════
  const plannedRows = useMemo<PlannedOrderRow[]>(() => {
    const safeDelai = Math.max(1, Math.min(45, Number(delaiCommandeJours) || 7));
    const safeTaux = Math.min(98, Math.max(40, Number(tauxEclosionPct) || 78));
    const safeDefaultCartons = Math.max(MIN_CARTONS_LOT, Number(cartonsParLot) || MIN_CARTONS_LOT);

    const buildUrgence = (joursAvantCommande: number): PlannedOrderRow['urgence'] => {
      if (joursAvantCommande < 0) return 'retard';
      if (joursAvantCommande <= 3) return 'urgent';
      if (joursAvantCommande <= 10) return 'proche';
      return 'planifie';
    };

    if (planningScope === 'global') {
      const rows: PlannedOrderRow[] = [];

      selectedGlobalLots.forEach((lot) => {
        if (!lot.dateMirage) return;
        const lotCartons =
          globalVolumeMode === 'lot'
            ? Math.max(MIN_CARTONS_LOT, Number(lot.cartons) || safeDefaultCartons)
            : safeDefaultCartons;
        const lotFournisseur = globalVolumeMode === 'lot' ? (lot.fournisseur || fournisseurPrevu) : fournisseurPrevu;
        const lotRace = globalVolumeMode === 'lot' ? (lot.race || racePrevue) : racePrevue;

        let currentIncub = addDays(lot.dateMirage, battementApresMirage);
        let currentOrigin = `Mirage ${lot.id} (${formatFr(lot.dateMirage)})`;

        for (let r = 1; r <= rotationsParLot; r++) {
          const dateIncubation = currentIncub;
          const dateCommande = addDays(dateIncubation, -safeDelai);
          const dateReception = addDays(dateIncubation, -1);
          const dateMirage = addDays(dateIncubation, 18);
          const dateEclosion = addDays(dateIncubation, 21);
          const joursAvantCommande = diffDays(dateCommande, today);

          const oeufs = lotCartons * 360;
          const poussinsEstimes = Math.round((oeufs * safeTaux) / 100);

          rows.push({
            rowKey: `${lot.id}-rot-${r}`,
            orderIndex: 0,
            sourceLotId: lot.id,
            sourceLotStatut: lot.statut,
            sourceCartons: lot.cartons,
            rotationNum: r,
            origineLabel: currentOrigin,
            dateCommande,
            dateReception,
            dateIncubation,
            dateMirage,
            dateEclosion,
            joursAvantCommande,
            urgence: buildUrgence(joursAvantCommande),
            cartons: lotCartons,
            oeufs,
            poussinsEstimes,
            fournisseur: lotFournisseur,
            race: lotRace,
          });

          currentIncub = addDays(dateMirage, battementApresMirage);
          currentOrigin = `Après mirage Relève #${r} · ${lot.id} (${formatFr(dateMirage)})`;
        }
      });

      rows.sort((a, b) => {
        const diffCmd = a.dateCommande.getTime() - b.dateCommande.getTime();
        if (diffCmd !== 0) return diffCmd;
        const diffIncub = a.dateIncubation.getTime() - b.dateIncubation.getTime();
        if (diffIncub !== 0) return diffIncub;
        return String(a.sourceLotId || '').localeCompare(String(b.sourceLotId || ''));
      });

      return rows.map((row, idx) => ({ ...row, orderIndex: idx + 1 }));
    }

    // Mode 'single' : Point de départ du Cycle 1 (1 lot ou date manuelle)
    let firstIncubDate: Date;
    let firstOriginLabel: string;

    if (anchorMode === 'lot' && activeAnchorObj?.dateMirage) {
      firstIncubDate = addDays(activeAnchorObj.dateMirage, battementApresMirage);
      firstOriginLabel = `Après mirage ${activeAnchorObj.id} (${formatFr(activeAnchorObj.dateMirage)})`;
    } else {
      const parsed = customStartDate ? new Date(`${customStartDate}T00:00:00`) : addDays(today, 1);
      firstIncubDate = isNaN(parsed.getTime()) ? addDays(today, 1) : parsed;
      firstOriginLabel = 'Date de démarrage manuelle';
    }

    const rows: PlannedOrderRow[] = [];
    let currentIncub = firstIncubDate;
    let currentOrigin = firstOriginLabel;

    for (let i = 1; i <= nbCycles; i++) {
      const dateIncubation = currentIncub;
      const dateCommande = addDays(dateIncubation, -safeDelai);
      const dateReception = addDays(dateIncubation, -1);
      const dateMirage = addDays(dateIncubation, 18);
      const dateEclosion = addDays(dateIncubation, 21);
      const joursAvantCommande = diffDays(dateCommande, today);

      const oeufs = safeDefaultCartons * 360;
      const poussinsEstimes = Math.round((oeufs * safeTaux) / 100);

      rows.push({
        rowKey: `single-cycle-${i}`,
        orderIndex: i,
        sourceLotId: anchorMode === 'lot' && activeAnchorObj ? activeAnchorObj.id : null,
        sourceLotStatut: anchorMode === 'lot' && activeAnchorObj ? activeAnchorObj.statut : undefined,
        sourceCartons: anchorMode === 'lot' && activeAnchorObj ? activeAnchorObj.cartons : undefined,
        rotationNum: i,
        origineLabel: currentOrigin,
        dateCommande,
        dateReception,
        dateIncubation,
        dateMirage,
        dateEclosion,
        joursAvantCommande,
        urgence: buildUrgence(joursAvantCommande),
        cartons: safeDefaultCartons,
        oeufs,
        poussinsEstimes,
        fournisseur: fournisseurPrevu,
        race: racePrevue,
      });

      currentIncub = addDays(dateMirage, battementApresMirage);
      currentOrigin = `Après mirage Cycle ${i} (${formatFr(dateMirage)})`;
    }

    return rows;
  }, [
    planningScope,
    selectedGlobalLots,
    rotationsParLot,
    globalVolumeMode,
    anchorMode,
    activeAnchorObj,
    battementApresMirage,
    customStartDate,
    today,
    cartonsParLot,
    delaiCommandeJours,
    tauxEclosionPct,
    nbCycles,
    fournisseurPrevu,
    racePrevue,
  ]);

  const summary = useMemo(() => {
    const firstCmd = plannedRows[0] || null;
    const earliestIncub = plannedRows.length > 0
      ? [...plannedRows].sort((a, b) => a.dateIncubation.getTime() - b.dateIncubation.getTime())[0]
      : null;

    const totalCartons = plannedRows.reduce((s, r) => s + r.cartons, 0);
    const totalOeufs = plannedRows.reduce((s, r) => s + r.oeufs, 0);
    const totalPoussins = plannedRows.reduce((s, r) => s + r.poussinsEstimes, 0);
    const urgentCount = plannedRows.filter((r) => r.urgence === 'retard' || r.urgence === 'urgent').length;

    // Regroupement par fournisseur pour faciliter la passation des commandes
    const byFournisseurMap = new Map<string, { cartons: number; oeufs: number; commandes: number }>();
    plannedRows.forEach((r) => {
      const key = r.fournisseur || 'Couvoir';
      const cur = byFournisseurMap.get(key) || { cartons: 0, oeufs: 0, commandes: 0 };
      cur.cartons += r.cartons;
      cur.oeufs += r.oeufs;
      cur.commandes += 1;
      byFournisseurMap.set(key, cur);
    });
    const byFournisseur = Array.from(byFournisseurMap.entries()).map(([name, stats]) => ({
      name,
      ...stats,
    }));

    return {
      firstCmd,
      earliestIncub,
      totalCartons,
      totalOeufs,
      totalPoussins,
      urgentCount,
      byFournisseur,
      cadenceJours: 18 + battementApresMirage,
    };
  }, [plannedRows, battementApresMirage]);

  // Données pour le chronogramme d'occupation des machines
  const timelineData = useMemo(() => {
    if (plannedRows.length === 0) return null;

    const candidateStartDates: Date[] = plannedRows.map((r) => r.dateIncubation);
    if (planningScope === 'global') {
      selectedGlobalLots.forEach((l) => {
        if (l.dateIncub) candidateStartDates.push(l.dateIncub);
      });
    } else if (anchorMode === 'lot' && activeAnchorObj?.dateIncub) {
      candidateStartDates.push(activeAnchorObj.dateIncub);
    }

    const minDate = new Date(Math.min(...candidateStartDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...plannedRows.map((r) => r.dateEclosion.getTime())));
    const totalDays = Math.max(1, diffDays(maxDate, minDate));

    const todayOffset = diffDays(today, minDate);
    const todayPct = todayOffset >= 0 && todayOffset <= totalDays ? (todayOffset / totalDays) * 100 : null;

    if (planningScope === 'global') {
      const lanes = selectedGlobalLots.map((lot) => ({
        lot,
        cycles: plannedRows
          .filter((r) => r.sourceLotId === lot.id)
          .sort((a, b) => a.rotationNum - b.rotationNum),
      }));
      return { minDate, maxDate, totalDays, todayPct, mode: 'global' as const, lanes };
    }

    return {
      minDate,
      maxDate,
      totalDays,
      todayPct,
      mode: 'single' as const,
      showAnchorLot: Boolean(anchorMode === 'lot' && activeAnchorObj?.dateIncub && activeAnchorObj?.dateMirage && activeAnchorObj?.dateEclo),
    };
  }, [plannedRows, planningScope, selectedGlobalLots, anchorMode, activeAnchorObj, today]);

  const exportCsv = () => {
    const headers = [
      'Ordre',
      'Mode',
      'Lot déclencheur / Ligne',
      'Rotation / Cycle',
      'Origine / Libération incubateur',
      'Date limite commande œufs',
      'Réception couvoir (J-1)',
      'Mise en incubation (J0)',
      'Mirage & transfert (J+18)',
      'Éclosion prévue (J+21)',
      'Cartons',
      'Œufs',
      'Poussins estimés',
      'Fournisseur',
      'Race',
    ];
    const rows = plannedRows.map((r) => [
      `#${r.orderIndex}`,
      planningScope === 'global' ? 'Vision globale lots en cours' : 'Projection Cycle 1',
      r.sourceLotId || 'Ligne manuelle',
      planningScope === 'global' ? `Relève #${r.rotationNum}` : `Cycle ${r.rotationNum}`,
      r.origineLabel,
      formatFr(r.dateCommande),
      formatFr(r.dateReception),
      formatFr(r.dateIncubation),
      formatFr(r.dateMirage),
      formatFr(r.dateEclosion),
      r.cartons,
      r.oeufs,
      r.poussinsEstimes,
      r.fournisseur,
      r.race,
    ]);
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendrier_approvisionnement_incubation_${toIsoInput(today)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderUrgencyLabel = (r: PlannedOrderRow) => {
    if (r.joursAvantCommande < 0) {
      return (
        <span className="text-rose-700 font-bold">
          Action immédiate (retard {Math.abs(r.joursAvantCommande)} j)
        </span>
      );
    }
    if (r.joursAvantCommande === 0) {
      return <span className="text-rose-700 font-bold">À commander aujourd&apos;hui</span>;
    }
    if (r.joursAvantCommande <= 3) {
      return <span className="text-amber-700 font-bold">Urgent · dans {r.joursAvantCommande} j</span>;
    }
    if (r.joursAvantCommande <= 10) {
      return <span className="text-amber-700 font-semibold">À prévoir · dans {r.joursAvantCommande} j</span>;
    }
    return <span className="text-emerald-700 font-medium">Dans {r.joursAvantCommande} j</span>;
  };

  return (
    <div id="incubation-planner-print" className="space-y-6">
      {/* En-tête de section + actions export */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Planification des mises en incubation &amp; commandes d&apos;œufs
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            À <strong className="text-slate-900">J+18 (Mirage)</strong>, les œufs fertiles sont transférés vers l&apos;éclosoir : chaque incubateur redevient disponible dès le{' '}
            <strong className="text-slate-900">lendemain (J+19)</strong>. Pilotez soit la <strong className="text-slate-900">vision globale de tous vos lots en cours</strong>, soit une projection depuis un point de départ unique.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
          <button
            type="button"
            onClick={resetDefaults}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={plannedRows.length === 0}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-300 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={plannedRows.length === 0}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer le planning</span>
          </button>
        </div>
      </div>

      {/* Panneau de paramétrage du planning */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 print:hidden">
        {/* Sélecteur de mode : Vision globale vs Point de départ Cycle 1 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
          <div className="inline-flex flex-wrap items-center gap-1 bg-white border border-slate-300 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setHasUserChangedScope(true);
                setPlanningScope('global');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                planningScope === 'global'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Vision globale — Lots en cours ({validAnchors.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHasUserChangedScope(true);
                setPlanningScope('single');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                planningScope === 'single'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <GitCommitHorizontal className="w-3.5 h-3.5" />
              <span>Point de départ du Cycle 1 (1 lot ou date)</span>
            </button>
          </div>

          {planningScope === 'global' && validAnchors.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => selectGlobalPreset('incubation')}
                className="px-2.5 py-1 rounded-md font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer tabular-nums"
              >
                En incubation ({incubatingAnchors.length})
              </button>
              <button
                type="button"
                onClick={() => selectGlobalPreset('all')}
                className="px-2.5 py-1 rounded-md font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer tabular-nums"
              >
                Tous non éclos ({validAnchors.length})
              </button>
            </div>
          )}
        </div>

        {/* Configuration spécifique au mode choisi */}
        {planningScope === 'global' ? (
          <div className="space-y-4">
            {/* Sélection des lots en incubation à suivre dans le calendrier global */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="text-xs font-semibold text-slate-700">
                  Lots actuellement suivis pour la planification des commandes ({selectedGlobalLots.length}/{validAnchors.length})
                </label>
                <span className="text-[11px] text-slate-500">
                  Chaque lot libère son incubateur après son mirage (J+18) et génère sa commande de relève
                </span>
              </div>

              {validAnchors.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600">
                    Aucun lot actif avec date de mirage n&apos;est actuellement en cours.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setHasUserChangedScope(true);
                      setPlanningScope('single');
                      setAnchorMode('custom');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
                  >
                    Planifier avec une date personnalisée
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {validAnchors.map((a) => {
                    const checked = selectedGlobalIds.includes(a.id);
                    const libre = addDays(a.dateMirage!, battementApresMirage);
                    const cmd = addDays(libre, -Math.max(1, Math.min(45, Number(delaiCommandeJours) || 7)));
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleGlobalLot(a.id)}
                        className={`text-left p-3 rounded-lg border transition cursor-pointer flex items-start gap-2.5 ${
                          checked
                            ? 'bg-white border-slate-900 shadow-xs'
                            : 'bg-slate-100/70 border-slate-200 text-slate-500 hover:bg-white'
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                            checked
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-slate-900 truncate">{a.id}</span>
                            <span
                              className={`text-[10px] font-bold shrink-0 ${
                                a.statut === 'Incubation'
                                  ? 'text-sky-700'
                                  : a.statut === 'Miré'
                                    ? 'text-amber-700'
                                    : 'text-purple-700'
                              }`}
                            >
                              {a.statut}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 truncate tabular-nums">
                            {a.cartons > 0 && a.cartons < MIN_CARTONS_LOT ? (
                              <>
                                <span>{a.cartons} ctn (exceptionnel)</span>
                                <span className="text-amber-700 font-semibold"> → Relève {MIN_CARTONS_LOT} ctn min.</span>
                              </>
                            ) : (
                              <span>{a.cartons || cartonsParLot} cartons</span>
                            )}
                            {' · '}{a.fournisseur} · {a.race}
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            Mirage {formatShortFr(a.dateMirage!)} → Relève {formatShortFr(libre)} · Cde {formatShortFr(cmd)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ligne de paramètres pour la vision globale */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Délai commande œufs (avant J0)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={45}
                    value={delaiCommandeJours}
                    onChange={(e) => setDelaiCommandeJours(Math.max(1, Math.min(45, Number(e.target.value) || 1)))}
                    className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-600 font-medium">j</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {[5, 7, 10, 14].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDelaiCommandeJours(d)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                          delaiCommandeJours === d
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {d}j
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Rotations à projeter par lot
                </label>
                <div className="grid grid-cols-4 gap-1 bg-white border border-slate-300 rounded-lg p-1">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRotationsParLot(n)}
                      className={`py-1.5 rounded text-xs font-bold transition cursor-pointer tabular-nums ${
                        rotationsParLot === n
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Volumes &amp; fournisseurs
                </label>
                <select
                  value={globalVolumeMode}
                  onChange={(e) => setGlobalVolumeMode(e.target.value as 'lot' | 'uniform')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="lot">Selon chaque lot d&apos;origine</option>
                  <option value="uniform">Uniformiser pour tous les lots</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reprise après mirage &amp; taux
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={battementApresMirage}
                    onChange={(e) => setBattementApresMirage(Number(e.target.value))}
                    className="flex-1 min-w-0 px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={1}>J+1 (lendemain)</option>
                    <option value={2}>J+2 (nettoyage)</option>
                    <option value={3}>J+3 (éclosion)</option>
                  </select>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={40}
                      max={98}
                      value={tauxEclosionPct}
                      onChange={(e) => setTauxEclosionPct(Math.max(40, Math.min(98, Number(e.target.value) || 78)))}
                      className="w-14 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                      title="Taux d'éclosion estimé (%)"
                    />
                    <span className="text-xs font-bold text-slate-600">%</span>
                  </div>
                </div>
              </div>
            </div>

            {globalVolumeMode === 'uniform' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cartons uniformes / lot (min. {MIN_CARTONS_LOT})
                  </label>
                  <input
                    type="number"
                    min={MIN_CARTONS_LOT}
                    max={500}
                    value={cartonsParLot}
                    onChange={(e) => setCartonsParLot(Number(e.target.value) || 0)}
                    onBlur={() => setCartonsParLot((v) => Math.max(MIN_CARTONS_LOT, Number(v) || MIN_CARTONS_LOT))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {(Math.max(MIN_CARTONS_LOT, cartonsParLot) * 360).toLocaleString('fr-FR')} œufs · plancher {MIN_CARTONS_LOT} ctn
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fournisseur uniforme
                  </label>
                  <select
                    value={fournisseurPrevu}
                    onChange={(e) => setFournisseurPrevu(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {fournisseurOptions.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Souche / Race uniforme
                  </label>
                  <select
                    value={racePrevue}
                    onChange={(e) => setRacePrevue(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {raceOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Mode 'single' : Point de départ du Cycle 1 (maintenu à l'identique) */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Départ / Lot de référence */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Point de départ du Cycle 1 (libération après mirage)
                </label>
                <select
                  value={anchorMode === 'custom' ? '__custom__' : selectedAnchorId}
                  onChange={(e) => handleSelectAnchorLot(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {validAnchors.map((a) => {
                    const libre = addDays(a.dateMirage!, battementApresMirage);
                    return (
                      <option key={a.id} value={a.id}>
                        {a.id} ({a.cartons} cartons · {a.fournisseur}) — Mirage le {formatFr(a.dateMirage!)} → Incubation libre le {formatFr(libre)}
                      </option>
                    );
                  })}
                  <option value="__custom__">Choisir une date de mise en incubation personnalisée</option>
                </select>
                {anchorMode === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-500">Date souhaitée de mise en incubation (J0)</span>
                  </div>
                )}
              </div>

              {/* Délai commande œufs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Délai commande œufs (avant J0)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={45}
                    value={delaiCommandeJours}
                    onChange={(e) => setDelaiCommandeJours(Math.max(1, Math.min(45, Number(e.target.value) || 1)))}
                    className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-600 font-medium">jours</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {[5, 7, 10, 14].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDelaiCommandeJours(d)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                          delaiCommandeJours === d
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {d}j
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Horizon / Nb cycles */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Cycles à programmer
                </label>
                <div className="grid grid-cols-4 gap-1 bg-white border border-slate-300 rounded-lg p-1">
                  {[3, 4, 6, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNbCycles(n)}
                      className={`py-1.5 rounded text-xs font-bold transition cursor-pointer tabular-nums ${
                        nbCycles === n
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ligne 2 paramètres : Volume, Souche, Fournisseur, Taux, Battement */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cartons / lot (min. {MIN_CARTONS_LOT})
                </label>
                <input
                  type="number"
                  min={MIN_CARTONS_LOT}
                  max={500}
                  value={cartonsParLot}
                  onChange={(e) => setCartonsParLot(Number(e.target.value) || 0)}
                  onBlur={() => setCartonsParLot((v) => Math.max(MIN_CARTONS_LOT, Number(v) || MIN_CARTONS_LOT))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {(Math.max(MIN_CARTONS_LOT, cartonsParLot) * 360).toLocaleString('fr-FR')} œufs · min. {MIN_CARTONS_LOT} ctn
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fournisseur prévu
                </label>
                <select
                  value={fournisseurPrevu}
                  onChange={(e) => setFournisseurPrevu(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {fournisseurOptions.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Souche / Race
                </label>
                <select
                  value={racePrevue}
                  onChange={(e) => setRacePrevue(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {raceOptions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Taux d&apos;éclosion estimé
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={40}
                    max={98}
                    value={tauxEclosionPct}
                    onChange={(e) => setTauxEclosionPct(Math.max(40, Math.min(98, Number(e.target.value) || 78)))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-600">%</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  Moy. couvoir : {historicalHatchRate}%
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reprise après mirage
                </label>
                <select
                  value={battementApresMirage}
                  onChange={(e) => setBattementApresMirage(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value={1}>Lendemain du mirage (J+1)</option>
                  <option value={2}>Surlendemain (J+2 · nettoyage)</option>
                  <option value={3}>Sous 3 jours (J+3 · à éclosion)</option>
                </select>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  Cadence : 1 lot / {summary.cadenceJours} j
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cas où aucun lot n'est sélectionné en mode global */}
      {planningScope === 'global' && validAnchors.length > 0 && plannedRows.length === 0 && (
        <div className="border border-slate-200 rounded-xl p-6 bg-white flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            Sélectionnez au moins un lot actif ci-dessus pour afficher le calendrier prévisionnel d&apos;approvisionnement.
          </div>
          <button
            type="button"
            onClick={() => selectGlobalPreset('all')}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white cursor-pointer"
          >
            Sélectionner tous les lots actifs ({validAnchors.length})
          </button>
        </div>
      )}

      {/* Synthèse KPI (4 indicateurs clés sans imbrication) */}
      {summary.firstCmd && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-500">Prochaine commande d&apos;œufs</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
              {formatFr(summary.firstCmd.dateCommande)}
            </div>
            <div className="text-xs mt-1 truncate">
              {renderUrgencyLabel(summary.firstCmd)}
              {summary.firstCmd.sourceLotId && (
                <span className="text-slate-500 font-medium"> · relève {summary.firstCmd.sourceLotId}</span>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-500">Prochaine mise en incubation</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
              {summary.earliestIncub ? formatFr(summary.earliestIncub.dateIncubation) : '--'}
            </div>
            <div
              className="text-xs text-slate-600 mt-1 truncate"
              title={summary.earliestIncub?.origineLabel}
            >
              {summary.earliestIncub?.origineLabel || '--'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-500">
              Volume à commander ({plannedRows.length} commande{plannedRows.length > 1 ? 's' : ''})
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
              {summary.totalCartons.toLocaleString('fr-FR')} cartons
            </div>
            <div className="text-xs text-slate-600 mt-1 tabular-nums truncate">
              {summary.totalOeufs.toLocaleString('fr-FR')} œufs ·{' '}
              {planningScope === 'global'
                ? `${selectedGlobalLots.length} lot${selectedGlobalLots.length > 1 ? 's' : ''} suivi${selectedGlobalLots.length > 1 ? 's' : ''}`
                : fournisseurPrevu}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-500">Production prévisionnelle</div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1 tabular-nums">
              {summary.totalPoussins.toLocaleString('fr-FR')} poussins
            </div>
            <div className="text-xs text-slate-600 mt-1 tabular-nums">
              Base {tauxEclosionPct}% · cadence {summary.cadenceJours} jours / ligne
            </div>
          </div>
        </div>
      )}

      {/* Tableau principal : Calendrier prévisionnel d'approvisionnement */}
      {plannedRows.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Calendrier prévisionnel d&apos;approvisionnement
                {planningScope === 'global' && (
                  <span className="text-slate-500 font-semibold ml-1.5">
                    — consolidé sur {selectedGlobalLots.length} lot{selectedGlobalLots.length > 1 ? 's' : ''} en cours
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                {planningScope === 'global'
                  ? 'Toutes les commandes à passer classées par ordre chronologique dès libération de chaque incubateur (J+18)'
                  : 'Dates calculées pour enchaîner les lots dès la libération de l\'incubateur après mirage (J+18)'}
              </p>
            </div>
            {summary.urgentCount > 0 && (
              <div className="text-xs font-bold text-amber-800">
                {summary.urgentCount} commande{summary.urgentCount > 1 ? 's' : ''} à engager rapidement
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">
                    {planningScope === 'global' ? 'Ordre / Lot' : 'Cycle'}
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">Déclencheur (Libération)</th>
                  <th className="px-4 py-3 whitespace-nowrap">Commande œufs (J-{delaiCommandeJours})</th>
                  <th className="px-4 py-3 whitespace-nowrap">Réception (J-1)</th>
                  <th className="px-4 py-3 whitespace-nowrap">Incubation (J0)</th>
                  <th className="px-4 py-3 whitespace-nowrap">Mirage (J+18)</th>
                  <th className="px-4 py-3 whitespace-nowrap">Éclosion (J+21)</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Volume &amp; Prévision</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plannedRows.map((r) => {
                  const rowHighlight =
                    r.urgence === 'retard'
                      ? 'bg-rose-50/40'
                      : r.urgence === 'urgent'
                        ? 'bg-amber-50/40'
                        : 'hover:bg-slate-50';

                  return (
                    <tr key={r.rowKey} className={`transition-colors ${rowHighlight}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 tabular-nums">
                          {planningScope === 'global'
                            ? `Cmd #${r.orderIndex} · ${r.sourceLotId}`
                            : `Cycle ${r.rotationNum}`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {planningScope === 'global' ? `Relève #${r.rotationNum} · ` : ''}
                          {r.race} · {r.fournisseur}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{r.origineLabel}</div>
                        {planningScope === 'global' && r.rotationNum === 1 && r.sourceLotStatut && (
                          <div className="text-[11px] text-slate-500">Statut actuel : {r.sourceLotStatut}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 tabular-nums">
                          {formatFr(r.dateCommande)}
                        </div>
                        <div className="text-[11px] tabular-nums">{renderUrgencyLabel(r)}</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-700 font-medium">
                        {formatFr(r.dateReception)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-extrabold text-sky-800 tabular-nums">
                          {formatFr(r.dateIncubation)}
                        </div>
                        <div className="text-[11px] text-slate-500">Entrée incubateur</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-amber-800 tabular-nums">
                          {formatFr(r.dateMirage)}
                        </div>
                        <div className="text-[11px] text-slate-500">Transfert éclosoir</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-emerald-700 tabular-nums">
                          {formatFr(r.dateEclosion)}
                        </div>
                        <div className="text-[11px] text-slate-500">Sortie poussins</div>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                        <div className="font-bold text-slate-900">
                          {r.cartons} cartons · {r.oeufs.toLocaleString('fr-FR')} œufs
                        </div>
                        <div className="text-[11px] text-emerald-700 font-semibold">
                          ~{r.poussinsEstimes.toLocaleString('fr-FR')} poussins
                        </div>
                        {r.sourceCartons !== undefined && r.sourceCartons > 0 && r.sourceCartons < MIN_CARTONS_LOT && (
                          <div className="text-[10px] text-amber-700 font-medium">
                            Plancher {MIN_CARTONS_LOT} ctn (lot source : {r.sourceCartons} ctn)
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap print:hidden">
                        {onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate('depenses')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition inline-flex items-center gap-1 cursor-pointer"
                            title="Créer l'achat d'œufs à couver dans Dépenses"
                          >
                            <span>Commander</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Récapitulatif par fournisseur */}
          {summary.byFournisseur.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Répartition par fournisseur :</span>
              <div className="flex flex-wrap items-center gap-4 tabular-nums">
                {summary.byFournisseur.map((f) => (
                  <span key={f.name}>
                    <strong className="text-slate-900">{f.name}</strong> : {f.commandes} cde{f.commandes > 1 ? 's' : ''} · {f.cartons.toLocaleString('fr-FR')} cartons ({f.oeufs.toLocaleString('fr-FR')} œufs)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chronogramme visuel d'occupation des machines */}
      {timelineData && (
        <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Chronogramme d&apos;occupation des machines (Incubateur &amp; Éclosoir)
              </h3>
              <p className="text-xs text-slate-500">
                Du {formatFr(timelineData.minDate)} au {formatFr(timelineData.maxDate)} ({timelineData.totalDays} jours)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-xs bg-sky-600 inline-block" />
                Incubateur (J0–J18)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                Éclosoir (J18–J21)
              </span>
              {timelineData.todayPct !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-0.5 h-3 bg-rose-500 inline-block" />
                  Aujourd&apos;hui ({formatShortFr(today)})
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {timelineData.mode === 'global' ? (
              timelineData.lanes.map(({ lot, cycles }) => (
                <div key={lot.id} className="grid grid-cols-12 items-center gap-3 text-xs">
                  <div className="col-span-4 sm:col-span-3 truncate">
                    <div className="font-bold text-slate-900 truncate">{lot.id}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums truncate">
                      {cycles[0] ? `Cde ${formatShortFr(cycles[0].dateCommande)} · ${cycles[0].cartons} ctn` : lot.statut}
                    </div>
                  </div>
                  <div className="col-span-8 sm:col-span-9 relative h-9 bg-slate-100 rounded overflow-hidden">
                    {timelineData.todayPct !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-rose-500/80 z-20 pointer-events-none"
                        style={{ left: `${timelineData.todayPct}%` }}
                      />
                    )}
                    {/* Lot actuellement en incubation */}
                    {lot.dateIncub && lot.dateMirage && lot.dateEclo && (() => {
                      const startOffset = Math.max(0, diffDays(lot.dateIncub, timelineData.minDate));
                      const mirOffset = diffDays(lot.dateMirage, timelineData.minDate);
                      const ecloOffset = diffDays(lot.dateEclo, timelineData.minDate);
                      const leftPct = (startOffset / timelineData.totalDays) * 100;
                      const incubWidth = Math.max(2, ((mirOffset - startOffset) / timelineData.totalDays) * 100);
                      const hatchLeftPct = (mirOffset / timelineData.totalDays) * 100;
                      const hatchWidth = Math.max(1.5, ((ecloOffset - mirOffset) / timelineData.totalDays) * 100);
                      return (
                        <>
                          <div
                            className="absolute top-1 h-4 bg-sky-600/80 rounded-xs text-[10px] text-white font-semibold flex items-center px-1.5 truncate tabular-nums"
                            style={{ left: `${leftPct}%`, width: `${incubWidth}%` }}
                            title={`En cours (${lot.id}) Incubateur : ${formatFr(lot.dateIncub)} → Mirage ${formatFr(lot.dateMirage)}`}
                          >
                            En cours → M {formatShortFr(lot.dateMirage)}
                          </div>
                          <div
                            className="absolute bottom-1 h-2.5 bg-emerald-600/80 rounded-xs"
                            style={{ left: `${hatchLeftPct}%`, width: `${hatchWidth}%` }}
                            title={`Éclosoir (${lot.id}) : ${formatFr(lot.dateMirage)} → ${formatFr(lot.dateEclo)}`}
                          />
                        </>
                      );
                    })()}
                    {/* Relèves projetées sur la même ligne */}
                    {cycles.map((c) => {
                      const startOffset = Math.max(0, diffDays(c.dateIncubation, timelineData.minDate));
                      const mirOffset = diffDays(c.dateMirage, timelineData.minDate);
                      const ecloOffset = diffDays(c.dateEclosion, timelineData.minDate);
                      const leftPct = (startOffset / timelineData.totalDays) * 100;
                      const incubWidth = Math.max(2, ((mirOffset - startOffset) / timelineData.totalDays) * 100);
                      const hatchLeftPct = (mirOffset / timelineData.totalDays) * 100;
                      const hatchWidth = Math.max(1.5, ((ecloOffset - mirOffset) / timelineData.totalDays) * 100);
                      return (
                        <React.Fragment key={c.rowKey}>
                          <div
                            className="absolute top-1 h-4 bg-sky-700 rounded-xs text-[10px] text-white font-semibold flex items-center px-1.5 truncate tabular-nums border-l border-white/70"
                            style={{ left: `${leftPct}%`, width: `${incubWidth}%` }}
                            title={`Relève #${c.rotationNum} (${lot.id}) · Cde ${formatFr(c.dateCommande)} · Incub ${formatFr(c.dateIncubation)} → Mirage ${formatFr(c.dateMirage)}`}
                          >
                            #{c.rotationNum} {formatShortFr(c.dateIncubation)}
                          </div>
                          <div
                            className="absolute bottom-1 h-2.5 bg-emerald-600 rounded-xs border-l border-white/70"
                            style={{ left: `${hatchLeftPct}%`, width: `${hatchWidth}%` }}
                            title={`Éclosoir Relève #${c.rotationNum} : ${formatFr(c.dateMirage)} → ${formatFr(c.dateEclosion)}`}
                          />
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <>
                {timelineData.showAnchorLot && activeAnchorObj && (
                  <div className="grid grid-cols-12 items-center gap-3 text-xs">
                    <div className="col-span-4 sm:col-span-3 truncate font-semibold text-slate-700">
                      {activeAnchorObj.id} <span className="text-slate-400 font-normal">· en cours</span>
                    </div>
                    <div className="col-span-8 sm:col-span-9 relative h-6 bg-slate-100 rounded overflow-hidden">
                      {timelineData.todayPct !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-rose-500/80 z-10 pointer-events-none"
                          style={{ left: `${timelineData.todayPct}%` }}
                        />
                      )}
                      {(() => {
                        const startOffset = Math.max(0, diffDays(activeAnchorObj.dateIncub!, timelineData.minDate));
                        const mirOffset = diffDays(activeAnchorObj.dateMirage!, timelineData.minDate);
                        const ecloOffset = diffDays(activeAnchorObj.dateEclo!, timelineData.minDate);
                        const leftPct = (startOffset / timelineData.totalDays) * 100;
                        const incubWidth = Math.max(2, ((mirOffset - startOffset) / timelineData.totalDays) * 100);
                        const hatchWidth = Math.max(1.5, ((ecloOffset - mirOffset) / timelineData.totalDays) * 100);
                        return (
                          <>
                            <div
                              className="absolute top-1 bottom-1 bg-sky-600/80 rounded-l text-[10px] text-white font-semibold flex items-center px-1.5 truncate"
                              style={{ left: `${leftPct}%`, width: `${incubWidth}%` }}
                              title={`Incubation : ${formatFr(activeAnchorObj.dateIncub!)} → Mirage ${formatFr(activeAnchorObj.dateMirage!)}`}
                            >
                              J0 → Mirage {formatShortFr(activeAnchorObj.dateMirage!)}
                            </div>
                            <div
                              className="absolute top-1 bottom-1 bg-emerald-600/80 rounded-r"
                              style={{ left: `${leftPct + incubWidth}%`, width: `${hatchWidth}%` }}
                              title={`Éclosoir : ${formatFr(activeAnchorObj.dateMirage!)} → ${formatFr(activeAnchorObj.dateEclo!)}`}
                            />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {plannedRows.map((c) => {
                  const startOffset = Math.max(0, diffDays(c.dateIncubation, timelineData.minDate));
                  const mirOffset = diffDays(c.dateMirage, timelineData.minDate);
                  const ecloOffset = diffDays(c.dateEclosion, timelineData.minDate);
                  const leftPct = (startOffset / timelineData.totalDays) * 100;
                  const incubWidth = Math.max(2, ((mirOffset - startOffset) / timelineData.totalDays) * 100);
                  const hatchWidth = Math.max(1.5, ((ecloOffset - mirOffset) / timelineData.totalDays) * 100);

                  return (
                    <div key={c.rowKey} className="grid grid-cols-12 items-center gap-3 text-xs">
                      <div className="col-span-4 sm:col-span-3 truncate">
                        <span className="font-bold text-slate-900">Cycle {c.rotationNum}</span>
                        <span className="text-slate-500 ml-1.5 tabular-nums">· Cde {formatShortFr(c.dateCommande)}</span>
                      </div>
                      <div className="col-span-8 sm:col-span-9 relative h-6 bg-slate-100 rounded overflow-hidden">
                        {timelineData.todayPct !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-rose-500/80 z-10 pointer-events-none"
                            style={{ left: `${timelineData.todayPct}%` }}
                          />
                        )}
                        <div
                          className="absolute top-1 bottom-1 bg-sky-600 rounded-l text-[10px] text-white font-semibold flex items-center px-1.5 truncate tabular-nums"
                          style={{ left: `${leftPct}%`, width: `${incubWidth}%` }}
                          title={`Cycle ${c.rotationNum} Incubateur : ${formatFr(c.dateIncubation)} → Mirage ${formatFr(c.dateMirage)}`}
                        >
                          {formatShortFr(c.dateIncubation)} → {formatShortFr(c.dateMirage)}
                        </div>
                        <div
                          className="absolute top-1 bottom-1 bg-emerald-600 rounded-r"
                          style={{ left: `${leftPct + incubWidth}%`, width: `${hatchWidth}%` }}
                          title={`Cycle ${c.rotationNum} Éclosoir : ${formatFr(c.dateMirage)} → Éclosion ${formatFr(c.dateEclosion)}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
