// ============================================================
// MOTEUR COÛT DU POUSSIN — Couvoir SAMCHE (v1.4.0)
// ------------------------------------------------------------
// Principes :
//  1. Chaque dépense d'achat d'œufs (ou transport/dédouanement) est rattachée
//     à SON lot via l'ID Commande. Si la date tombe dans la fenêtre d'un lot
//     (commande → éclosion + 5 j), elle est rattachée au lot correspondant.
//  2. Un lot non encore éclos (Incubation, Mirage, commande non livrée) n'est
//     PAS compté dans le coût des poussins vendus : son montant payé est un
//     "engagement" (œufs en cours) affiché à part, avec un coût unitaire estimé.
//  3. Les dépenses de fonctionnement (électricité, salaires, loyer, produits...)
//     sont imputées aux lots éclos du même mois, au prorata des poussins éclos.
//  4. Les investissements (catégorie "Investissements", équipements, travaux)
//     sont amortis linéairement sur N mois ; la charge mensuelle est imputée
//     comme les frais de fonctionnement.
//  5. Coût unitaire = coût total du lot / poussins vendables (pour vente).
// ============================================================

import type { OAC, Depense, Vente } from '../types';

export interface OptionsCoutPoussin {
  mois: number;            // 0-11
  annee: number;
  inclureAmortissement?: boolean;  // défaut false : tableau sans amortissement
  dureeAmortissementMois?: number; // défaut 60 (5 ans), utilisé si inclureAmortissement
  prixVenteDefaut?: number;        // utilisé si aucune vente sur le mois
}

export interface LotCout {
  id: string;
  dateCommande: string;
  dateEclo: string;
  race: string;
  fournisseur: string;
  oeufsRecus: number;
  poussinsEclos: number;
  poussinsVendables: number;
  poussinsBonus: number;      // offerts aux clients (2 %)
  poussinsVendus: number;     // vendables − bonus
  morts: number;
  handicapes: number;
  tauxEclosion: number;
  coutOeufs: number;          // achats d'œufs + transport + dédouanement liés au lot
  coutFrais: number;          // quote-part des frais de fonctionnement
  coutAmortissement: number;  // quote-part des équipements amortis
  coutTotal: number;
  coutUnitaire: number | null; // FCFA par poussin vendable (null si aucune dépense d'œufs rattachée)
  prixVente: number;
  valeurVente: number;
  margeNette: number;
  pctMarge: number;
  alertes: string[];
}

export interface Engagement {
  id: string;
  statut: string;             // 'Incubation' | 'Mirage' | 'Non livré'
  montantPaye: number;
  oeufsAttendus: number;
  coutUnitaireEstime: number | null;
  dateEclosionPrevue: string;
}

export interface ResultatCoutPoussin {
  periode: { mois: number; annee: number };
  lots: LotCout[];
  engagements: Engagement[];
  kpis: {
    nbLotsEclos: number;
    totalPoussinsEclos: number;
    totalPoussinsVendables: number;
    totalCoutOeufs: number;
    totalCoutFrais: number;
    totalCoutAmortissement: number;
    totalCouts: number;
    coutUnitaireMoyen: number;
    prixVenteMoyen: number;
    totalVentes: number;
    totalMarge: number;
    rentabilitePct: number;
    totalEngagements: number;
    investissementsTotal: number;
    chargeAmortissementMois: number;
  };
  alertes: string[];
}

// ---------- utilitaires ----------
const MS_JOUR = 86400000;
const TAUX_BONUS_CLIENT = 0.02; // 2 % de poussins offerts à chaque client

function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  const fr = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (fr) return new Date(Date.UTC(+fr[3], +fr[2] - 1, +fr[1]));
  const iso = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const num = (v: unknown) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

function moisIndex(d: Date) {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function estEclos(lot: OAC) {
  const st = norm(lot.statut);
  return st === 'eclo' || st === 'eclos' || st === 'éclos';
}

function poussinsEclos(lot: OAC) {
  return num(lot.commerciaux) || num(lot.nes) || num(lot.pourVente);
}

function poussinsVendables(lot: OAC) {
  const pv = num(lot.pourVente);
  if (pv > 0) return pv;
  return Math.max(0, poussinsEclos(lot) - num(lot.handicapes) - num(lot.morts));
}

// ---------- classification des dépenses ----------
const MOTS_OEUFS = ['oeuf', 'œuf', 'dedouanement', 'dédouanement', 'transit', 'carton', 'plateau', 'emballage', 'transport des'];

function estDepenseOeufs(d: Depense) {
  const sc = norm(d.sousCategorie);
  const lb = norm(d.libelle);
  return MOTS_OEUFS.some((m) => sc.includes(m) || lb.includes(m));
}

function estInvestissement(d: Depense) {
  const cat = norm(d.categorie);
  const sc = norm(d.sousCategorie);
  if (cat.includes('invest')) return true;
  return ['equipement', 'équipement', 'travaux', 'amortissement', 'incubateur'].some((m) => sc.includes(m));
}


// ---------- rattachement d'un achat sans ID valide ----------
// Les œufs sont payés à l'avance : le paiement a lieu avant ou peu après le début
// d'incubation, qui se situe 21 jours avant l'éclosion.
const JOURS_INCUBATION = 21;
const PAIEMENT_AVANT_INCUB_JOURS = 45;  // paiement jusqu'à 45 j avant l'incubation
const PAIEMENT_APRES_INCUB_JOURS = 21;  // reliquat / transport jusqu'à 21 j après

function debutIncubation(l: { dEclo: Date | null }): Date | null {
  return l.dEclo ? new Date(l.dEclo.getTime() - JOURS_INCUBATION * MS_JOUR) : null;
}

// Vrai si l'achat peut concerner le lot (incubation démarrée dans la fenêtre du paiement)
function dansFenetrePaiement(l: { dEclo: Date | null }, date: Date): boolean {
  const debut = debutIncubation(l);
  if (!debut) return false;
  const t = debut.getTime();
  return t >= date.getTime() - PAIEMENT_APRES_INCUB_JOURS * MS_JOUR
      && t <= date.getTime() + PAIEMENT_AVANT_INCUB_JOURS * MS_JOUR;
}

// Nombre de cartons cité dans un libellé ("54 Cartons Camara" → 54)
function parseCartons(libelle: unknown): number | null {
  const m = String(libelle ?? '').match(/(\d+)\s*cartons?/i);
  return m ? parseInt(m[1], 10) : null;
}

// ---------- moteur ----------
export function computeCoutPoussin(
  oacList: OAC[],
  depenses: Depense[],
  ventes: Vente[],
  opts: OptionsCoutPoussin
): ResultatCoutPoussin {
  const { mois, annee } = opts;
  const duree = opts.dureeAmortissementMois ?? 60;
  const alertes: string[] = [];

  // 1. Lots (avec dates parsées)
  const lots = oacList
    .map((l) => ({
      raw: l,
      id: String(l.id || '').trim().toUpperCase(),
      dCmd: parseDate(l.date),
      dEclo: parseDate(l.eclosion || (l as any).dateEclosion),
    }))
    .filter((l) => l.id);

  const lotById = new Map(lots.map((l) => [l.id, l]));
  const lotsEcloMois = lots.filter(
    (l) => estEclos(l.raw) && l.dEclo && l.dEclo.getUTCMonth() === mois && l.dEclo.getUTCFullYear() === annee
  );

  // 2. Dépenses : affectation
  const coutOeufsParLot = new Map<string, number>();
  const engagementParLot = new Map<string, number>();
  const invest: { montant: number; date: Date }[] = [];
  const fraisParMois = new Map<number, number>(); // clé = index mois
  let fraisOrphelins = 0;

  const sansAffectation: Depense[] = [];
  const achatDejaPour = new Set<string>();
  const achatsSansId: { d: Depense; montant: number; date: Date }[] = [];
  const affecter = (l: { raw: OAC; id: string }, mt: number) => {
    const map = estEclos(l.raw) ? coutOeufsParLot : engagementParLot;
    map.set(l.id, (map.get(l.id) || 0) + mt);
  };

  for (const d of depenses) {
    const montant = num(d.montant);
    if (!montant) continue;
    const date = parseDate(d.date);
    if (!date) continue;

    // 2a. Investissements → amortissement
    if (estInvestissement(d)) {
      invest.push({ montant, date });
      continue;
    }

    // 2b. Achats d'œufs / transport / dédouanement
    // Les œufs sont payés à l'avance : le paiement précède l'éclosion d'environ 21 jours
    // (et souvent la date de commande). On ne se fie donc pas au mois de paiement.
    if (estDepenseOeufs(d)) {
      const cmd = String(d.idCommande || '').trim().toUpperCase();
      // Chaque achat constitue un lot : un ID valide est rattaché directement
      if (cmd && lotById.has(cmd)) {
        affecter(lotById.get(cmd)!, montant);
        achatDejaPour.add(cmd);
        continue;
      }
      // ID absent de Gestion OAC : lot pas encore enregistré → engagement propre à cet ID
      if (cmd) {
        engagementParLot.set(cmd, (engagementParLot.get(cmd) || 0) + montant);
        alertes.push(`Achat ${montant.toLocaleString('fr-FR')} FCFA lié à ${cmd} : ce lot n'existe pas encore dans Gestion OAC (engagement).`);
        continue;
      }
      // Sans ID : traité après les achats avec ID
      achatsSansId.push({ d, montant, date });
      continue;
    }

    // 2c. Frais de fonctionnement → imputés au mois de la dépense
    const key = moisIndex(date);
    fraisParMois.set(key, (fraisParMois.get(key) || 0) + montant);
  }

  // Achats sans ID : un seul achat par lot, sur le lot le plus cohérent
  for (const { d, montant, date } of achatsSansId) {
    const candidats = lots.filter((l) => !achatDejaPour.has(l.id) && dansFenetrePaiement(l, date));
    if (candidats.length === 0) {
      sansAffectation.push(d);
      continue;
    }
    let choisis = candidats;
    const cartonsLib = parseCartons(d.libelle);
    if (cartonsLib) {
      const parCartons = candidats.filter((c) => num(c.raw.cartons) === cartonsLib);
      if (parCartons.length) choisis = parCartons;
    }
    choisis = choisis.slice().sort(
      (a, b) => Math.abs(debutIncubation(a)!.getTime() - date.getTime()) - Math.abs(debutIncubation(b)!.getTime() - date.getTime())
    );
    const retenu = choisis[0];
    affecter(retenu, montant);
    achatDejaPour.add(retenu.id);
    alertes.push(
      `Achat ${montant.toLocaleString('fr-FR')} FCFA du ${date.toISOString().slice(0, 10)} sans ID : attribué à ${retenu.id}. Corrigez l'ID dans la feuille Dépenses.`
    );
  }

  // Dépenses d'œufs sans rattachement possible
  const totalSansAffectation = sansAffectation.reduce((s, d) => s + num(d.montant), 0);
  if (totalSansAffectation > 0) {
    alertes.push(`${totalSansAffectation.toLocaleString('fr-FR')} FCFA de dépenses d'œufs ne sont rattachées à aucun lot (ID manquant ou date hors période).`);
  }

  // 3. Amortissement : charge du mois cible
  const cibleIdx = annee * 12 + mois;
  let chargeAmortMois = 0;
  let investTotal = 0;
  const amortActif = opts.inclureAmortissement === true;
  for (const i of invest) {
    investTotal += i.montant;
    if (!amortActif) continue;
    const idxInv = moisIndex(i.date);
    const ecart = cibleIdx - idxInv;
    if (ecart >= 0 && ecart < duree) chargeAmortMois += i.montant / duree;
  }

  // 4. Frais du mois (fonctionnement) + amortissement → à répartir sur les lots du mois
  const fraisMois = fraisParMois.get(cibleIdx) || 0;
  const poolIndirect = fraisMois + chargeAmortMois;
  const totalPoussinsEcloMois = lotsEcloMois.reduce((s, l) => s + poussinsEclos(l.raw), 0);

  if (lotsEcloMois.length === 0 && poolIndirect > 0) {
    alertes.push(`Aucun lot éclos sur la période : ${Math.round(poolIndirect).toLocaleString('fr-FR')} FCFA de frais non imputés.`);
  }

  // 5. Ventes du mois → prix moyen
  let totalVentesMois = 0;
  let totalQteMois = 0;
  for (const v of ventes) {
    const dv = parseDate(v.date);
    if (!dv || dv.getUTCMonth() !== mois || dv.getUTCFullYear() !== annee) continue;
    const qte = num(v.quantite);
    const mt = num(v.montant) || qte * num(v.prixUnitaire);
    totalVentesMois += mt;
    totalQteMois += qte;
  }
  const prixVenteMoyen = totalQteMois > 0
    ? Math.round(totalVentesMois / totalQteMois)
    : (opts.prixVenteDefaut ?? 0);
  if (totalQteMois === 0) alertes.push('Aucune vente sur la période : prix de vente par défaut utilisé.');

  // 6. Construction des lots
  const lotsRes: LotCout[] = lotsEcloMois.map((l) => {
    const lot = l.raw;
    const eclos = poussinsEclos(lot);
    const vendables = poussinsVendables(lot);
    const oeufs = num(lot.recus) || num(lot.cartons) * 360;
    const coutOeufs = Math.round(coutOeufsParLot.get(l.id) || 0);
    const part = totalPoussinsEcloMois > 0 ? eclos / totalPoussinsEcloMois : 0;
    const coutFrais = Math.round(fraisMois * part);
    const coutAmort = Math.round(chargeAmortMois * part);
    const coutTotal = coutOeufs + coutFrais + coutAmort;
    const coutUnitaire = vendables > 0 && coutOeufs > 0 ? Math.round(coutTotal / vendables) : null;
    const bonus = Math.round(vendables * TAUX_BONUS_CLIENT);
    const vendus = vendables - bonus;
    const valeurVente = Math.round(vendus * prixVenteMoyen);
    const marge = valeurVente - coutTotal;

    const alertesLot: string[] = [];
    if (coutOeufs === 0) alertesLot.push('Aucune dépense d\'œufs rattachée à ce lot');
    if (vendables === 0) alertesLot.push('Poussins vendables non renseignés');

    return {
      id: lot.id,
      dateCommande: lot.date || '',
      dateEclo: lot.eclosion || '',
      race: lot.race || '',
      fournisseur: lot.fournisseur || '',
      oeufsRecus: oeufs,
      poussinsEclos: eclos,
      poussinsVendables: vendables,
      poussinsBonus: bonus,
      poussinsVendus: vendus,
      morts: num(lot.morts),
      handicapes: num(lot.handicapes),
      tauxEclosion: oeufs > 0 ? Math.round((eclos / oeufs) * 1000) / 10 : 0,
      coutOeufs,
      coutFrais,
      coutAmortissement: coutAmort,
      coutTotal,
      coutUnitaire,
      prixVente: prixVenteMoyen,
      valeurVente,
      margeNette: marge,
      pctMarge: valeurVente > 0 ? Math.round((marge / valeurVente) * 1000) / 10 : 0,
      alertes: alertesLot,
    };
  });

  // 7. Engagements : œufs payés non encore éclos
  const engagements: Engagement[] = [];
  for (const [id, montant] of engagementParLot.entries()) {
    const lot = lotById.get(id);
    const statut = !lot
      ? 'Non livré'
      : norm(lot.raw.statut) === 'mirage' ? 'Mirage' : 'En incubation';
    const attendus = lot ? num(lot.raw.attendus) || num(lot.raw.recus) : 0;
    engagements.push({
      id,
      statut,
      montantPaye: Math.round(montant),
      oeufsAttendus: attendus,
      coutUnitaireEstime: attendus > 0 ? Math.round(montant / attendus) : null,
      dateEclosionPrevue: lot?.raw.eclosion || '',
    });
  }

  // 8. KPIs
  const totalPoussinsEclos = lotsRes.reduce((s, l) => s + l.poussinsEclos, 0);
  const totalVendables = lotsRes.reduce((s, l) => s + l.poussinsVendables, 0);
  const totalCoutOeufs = lotsRes.reduce((s, l) => s + l.coutOeufs, 0);
  const totalCoutFrais = lotsRes.reduce((s, l) => s + l.coutFrais, 0);
  const totalCoutAmort = lotsRes.reduce((s, l) => s + l.coutAmortissement, 0);
  const totalCouts = totalCoutOeufs + totalCoutFrais + totalCoutAmort;
  const totalVentes = lotsRes.reduce((s, l) => s + l.valeurVente, 0);
  const totalMarge = totalVentes - totalCouts;

  return {
    periode: { mois, annee },
    lots: lotsRes,
    engagements,
    kpis: {
      nbLotsEclos: lotsRes.length,
      totalPoussinsEclos,
      totalPoussinsVendables: totalVendables,
      totalCoutOeufs,
      totalCoutFrais,
      totalCoutAmortissement: totalCoutAmort,
      totalCouts,
      coutUnitaireMoyen: totalVendables > 0 ? Math.round(totalCouts / totalVendables) : 0,
      prixVenteMoyen,
      totalVentes,
      totalMarge,
      rentabilitePct: totalCouts > 0 ? Math.round((totalMarge / totalCouts) * 1000) / 10 : 0,
      totalEngagements: engagements.reduce((s, e) => s + e.montantPaye, 0),
      investissementsTotal: Math.round(investTotal),
      chargeAmortissementMois: Math.round(chargeAmortMois),
    },
    alertes,
  };
}

// ============================================================
// ADAPTATEUR : format attendu par CoutRentabiliteModule (écran actuel)
// ============================================================
export function toCoutRentabiliteData(
  oacList: OAC[],
  depenses: Depense[],
  ventes: Vente[],
  mois: number,
  annee: number,
  dureeAmortissementMois?: number,
  inclureAmortissement = false
) {
  const opts = (m: number, a: number) => ({ mois: m, annee: a, dureeAmortissementMois, inclureAmortissement });
  const r = computeCoutPoussin(oacList, depenses, ventes, opts(mois, annee));

  const resumeMensuel = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(annee, mois - i, 1));
    const rm = computeCoutPoussin(oacList, depenses, ventes, opts(d.getUTCMonth(), d.getUTCFullYear()));
    resumeMensuel.push({
      mois: d.getUTCMonth(),
      annee: d.getUTCFullYear(),
      label: `${d.toLocaleString('fr-FR', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`,
      nbLots: rm.kpis.nbLotsEclos,
      poussins: rm.kpis.totalPoussinsVendables,
      couts: rm.kpis.totalCouts,
      ventes: rm.kpis.totalVentes,
      marge: rm.kpis.totalMarge,
      rentabilitePct: rm.kpis.rentabilitePct,
      coutMoyenParPoussin: rm.kpis.coutUnitaireMoyen,
    });
  }

  return {
    success: true,
    periode: { mois, annee },
    kpis: {
      nbLotsEclos: r.kpis.nbLotsEclos,
      totalPoussins: r.kpis.totalPoussinsVendables,
      totalCoutsDirects: r.kpis.totalCoutOeufs,
      totalCoutsIndirects: r.kpis.totalCoutFrais + r.kpis.totalCoutAmortissement,
      totalCouts: r.kpis.totalCouts,
      coutMoyenParPoussin: r.kpis.coutUnitaireMoyen,
      prixVenteMoyen: r.kpis.prixVenteMoyen,
      totalVentes: r.kpis.totalVentes,
      totalMarge: r.kpis.totalMarge,
      margeMoyenneParLot: r.kpis.nbLotsEclos ? Math.round(r.kpis.totalMarge / r.kpis.nbLotsEclos) : 0,
      rentabilitePct: r.kpis.rentabilitePct,
    },
    lots: r.lots.map((l) => ({
      id: l.id,
      date: l.dateCommande,
      dateEclo: l.dateEclo,
      type: '',
      race: l.race,
      fournisseur: l.fournisseur,
      oeufsRecus: l.oeufsRecus,
      poussins: l.poussinsEclos,
      morts: l.morts,
      handicapes: l.handicapes,
      pourVente: l.poussinsVendables,
      poussinsVendus: l.poussinsVendus,
      tauxEclosion: l.tauxEclosion,
      coutDirect: l.coutOeufs,
      coutIndirect: l.coutFrais + l.coutAmortissement,
      coutTotal: l.coutTotal,
      coutParPoussin: l.coutUnitaire ?? 0,
      prixVente: l.prixVente,
      valeurVente: l.valeurVente,
      margeBrute: l.valeurVente - l.coutOeufs,
      margeNette: l.margeNette,
      pctMarge: l.pctMarge,
      alertes: l.alertes,
    })),
    engagements: r.engagements,
    alertes: r.alertes,
    resumeMensuel,
  };
}
