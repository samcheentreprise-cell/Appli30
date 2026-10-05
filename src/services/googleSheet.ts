export const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbzdSJH0MVF3KFaZnMy9zJstg3fLbcJQpeWSUs72w4EnVsLM_Z0HnEHRlMI_6Lbx6X4L/exec';
export const DEFAULT_API_TOKEN = 'samche_2023_1972KlaBgni2';

export interface SyncResult {
  success: boolean;
  message: string;
  parsedData?: any;
  timestamp?: string;
  sourceName?: string;
}

export function getGSheetWebappUrl(): string {
  const storedUrl = localStorage.getItem('gsheet_webapp_url');
  return storedUrl || (import.meta as any).env?.VITE_GSHEET_WEBAPP_URL || DEFAULT_API_URL;
}

export function setGSheetWebappUrl(url: string): void {
  const cleanUrl = url ? url.trim() : '';
  if (!cleanUrl) localStorage.removeItem('gsheet_webapp_url');
  else localStorage.setItem('gsheet_webapp_url', cleanUrl);
}

export function getGSheetApiToken(): string {
  const storedToken = localStorage.getItem('gsheet_api_token');
  return storedToken || (import.meta as any).env?.VITE_GSHEET_API_TOKEN || DEFAULT_API_TOKEN;
}

export function setGSheetApiToken(token: string): void {
  const cleanToken = token ? token.trim() : '';
  if (!cleanToken) localStorage.removeItem('gsheet_api_token');
  else localStorage.setItem('gsheet_api_token', cleanToken);
}

// ============================================================
//  Actions en lecture seule (GET)
// ============================================================
const GET_ACTIONS = new Set([
  'dashboard.data', 'api.ping', 'api.help', 'api.diagnostic',
  'caisse.solde', 'caisse.stats',
  'depenses.categories', 'depenses.sousCategories', 'depenses.modesPaiement',
  'depenses.comptes', 'depenses.genererIdOAC', 'depenses.idsNonLivres',
  'ventes.produits', 'ventes.produitsPrix', 'ventes.clients',
  'commandePoussins.previsions', 'commandePoussins.clients', 'commandePoussins.typeProduit',
  'commandePoussins.prixUnitaire',
  'factures.statistiques', 'factures.genererNum',
  'bordereaux.genererNum',
  'rapport.donneesSemaine', 'rapport.donneesMois', 'rapport.dernierEnvoi',
  'recherches.toutesVentes', 'recherches.toutesDepenses', 'recherches.filtresRef',
  'fparam.get',
]);

function isGetAction(action: string): boolean {
  if (GET_ACTIONS.has(action)) return true;
  if (action.endsWith('.lister')) return true;
  return false;
}

// ============================================================
//  callApi : GET pour lecture, POST pour écriture
//  + support explicite de method 'POST' / 'GET' en 3e arg
// ============================================================
export async function callApi(
  action: string,
  data: Record<string, any> = {},
  method?: 'GET' | 'POST'
): Promise<any> {
  const useGet = method ? method === 'GET' : isGetAction(action);

  try {
    const apiUrl = getGSheetWebappUrl();
    const apiToken = getGSheetApiToken();

    if (useGet) {
      const params = new URLSearchParams({ action });
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'object') params.set(key, JSON.stringify(value));
        else params.set(key, String(value));
      }
      if (apiUrl)   params.set('_gas_url', apiUrl);
      if (apiToken) params.set('_gas_token', apiToken);

      const response = await fetch(`/api/gas?${params.toString()}`, { method: 'GET' });
      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${text}` };
      }
      return await response.json();
    }

    // POST : body JSON avec action + data + url/token personnalisés
    const response = await fetch(`/api/gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        data,
        _gas_url: apiUrl,
        _gas_token: apiToken,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }
    return await response.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function ping(): Promise<any> { return callApi('api.ping'); }
export async function help(): Promise<any> { return callApi('api.help'); }

// Cache global pour les données F-Param
let _fparamCache: any = null;

export async function getFParamData(force = false): Promise<{
  produitsPrix: Record<string, number>;
  sourcesPaiement: string[];
  typesProduits: string[];
}> {
  if (_fparamCache && !force) return _fparamCache;
  const result = await callApi('fparam.get');
  if (result?.success && result?.data) {
    _fparamCache = result.data;
    return _fparamCache;
  }
  return { produitsPrix: {}, sourcesPaiement: [], typesProduits: [] };
}

// Helper : récupère le prix d'un type de produit (avec fallback)
export async function getPrixUnitaire(typeProduit: string): Promise<number> {
  const fp = await getFParamData();
  const key = (typeProduit || '').trim();
  // Recherche exacte
  if (fp.produitsPrix[key] !== undefined) return fp.produitsPrix[key];
  // Recherche insensible à la casse
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(fp.produitsPrix)) {
    if (k.toLowerCase() === lowerKey) return fp.produitsPrix[k];
  }
  return 0;
}

// Helper : récupère la liste des sources de paiement
export async function getSourcesPaiement(): Promise<string[]> {
  const fp = await getFParamData();
  return fp.sourcesPaiement;
}

// ============================================================
//  Synchronisation : lit toutes les listes en parallèle
// ============================================================
export async function fetchGoogleSheetsData(): Promise<SyncResult> {
  try {
    const [
      oacRes, ventesRes, depensesRes, caisseRes,
      clientsRes, facturesRes, cmdPoussinsRes, bordereauxRes
    ] = await Promise.all([
      callApi('oac.lister'),
      callApi('ventes.lister'),
      callApi('depenses.lister'),
      callApi('caisse.lister'),
      callApi('clients.lister'),
      callApi('factures.lister'),
      callApi('commandePoussins.lister'),
      callApi('bordereaux.lister'),
    ]);

    const failed = [oacRes, ventesRes, depensesRes, caisseRes, clientsRes, facturesRes, cmdPoussinsRes, bordereauxRes]
      .find(r => !r?.success);
    if (failed) {
      return {
        success: false,
        message: failed.error || failed.data?.error || 'Une action GAS a échoué',
      };
    }

    // Mapping OAC : transforme les champs GAS → React
    // Supporte { commandes: [...] } ou directement [...]
    const rawOacData = oacRes.data?.commandes || (Array.isArray(oacRes.data) ? oacRes.data : []);
    const oacList = rawOacData.map((o: any) => ({
      _v: 25,
      ligne: o.ligne,
      id: o.id,
      date: o.dateCmd || o.date || '',
      type: o.type,
      race: o.race,
      fournisseur: o.fournisseur,
      cartons: o.cartons,
      recus: o.recus,
      nbCasses: o.casses ?? o.nbCasses ?? 0,
      cubes: o.cubes ?? ((o.cartons || 0) * 360 - (o.casses || 0)),
      eclosion: o.dateEclosion || o.eclosion || '',
      clairs: o.clairs ?? null,
      fertiles: o.fertiles ?? o.cubes ?? 0,
      commerciaux: o.poussins ?? null,
      nes: o.poussins ?? null,
      pourVente: o.pourVente ?? null,
      handicapes: o.handicapes ?? null,
      morts: o.morts ?? null,
      complet: o.statut === 'Éclos' || o.statut === 'Terminé',
      attendus: o.attendus,
      tauxEclosion: o.tauxEclosion,
      tauxIncubation: o.tauxIncubation,
      statut: o.statut,
    }));

    const parsedData = {
      oacList,
      ventes:            ventesRes.data?.ventes         || [],
      depenses:          depensesRes.data?.depenses     || [],
      mouvementsCaisse:  caisseRes.data?.mouvements     || [],
      clients:           Array.isArray(clientsRes.data) ? clientsRes.data : (clientsRes.data?.clients || []),
      factures:          facturesRes.data?.factures     || [],
      commandesPoussins: Array.isArray(cmdPoussinsRes.data) ? cmdPoussinsRes.data : (cmdPoussinsRes.data?.commandes || []),
      bordereaux:        bordereauxRes.data?.bordereaux || [],
      soumissions:       [],
    };

    return {
      success: true,
      message: 'Synchronisation réussie',
      parsedData,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erreur réseau' };
  }
}

// ============================================================
//  Push vers Google Sheets — utilise POST
// ============================================================

// Mapping des champs React → GAS pour chaque type
const FIELD_MAP: Record<string, Record<string, string>> = {
  oac: {
    nbCasses: 'casses',
    eclosion: 'eclosion',
    dateEclosion: 'eclosion',
    commerciaux: 'commercial',
    nes: 'commercial',
    id: 'idCommande',
    incubés: 'incubés',
  },
  ventes: {},
  depenses: {},
  caisse: {},
  clients: {},
  factures: {},
  commandes_poussins: {},
  bordereaux: {},
};

// Logging
const OAC_LOGS: any[] = [];
export function getOacLogs() { return [...OAC_LOGS]; }

// Mapping type → action GAS (insert/update/delete)
const ACTION_MAP: Record<string, { insert: string; update: string; delete: string }> = {
  oac:                { insert: 'oac.commander',            update: 'oac.commander',         delete: 'oac.commander' },
  ventes:             { insert: 'ventes.enregistrer',       update: 'ventes.enregistrer',    delete: 'ventes.supprimer' },
  depenses:           { insert: 'depenses.enregistrer',     update: 'depenses.enregistrer',  delete: 'depenses.supprimer' },
  caisse:             { insert: 'caisse.enregistrer',       update: 'caisse.enregistrer',    delete: 'caisse.supprimer' },
  clients:            { insert: 'clients.ajouter',          update: 'clients.modifier',      delete: 'clients.supprimer' },
  factures:           { insert: 'factures.enregistrer',     update: 'factures.modifier',     delete: 'factures.supprimer' },
  commandes_poussins: { insert: 'commandePoussins.enregistrer', update: 'commandePoussins.modifier', delete: 'commandePoussins.supprimer' },
  bordereaux:         { insert: 'bordereaux.enregistrer',   update: 'bordereaux.enregistrer', delete: 'bordereaux.supprimer' },
};

export async function syncPushToGoogleSheets(payload: any): Promise<SyncResult> {
  const { type, action: crudAction, item, subAction } = payload || {};

  if (type === 'oac') {
    OAC_LOGS.unshift({ ...payload, timestamp: new Date().toISOString() });
    if (OAC_LOGS.length > 5) OAC_LOGS.pop();
  }

  if (!type || !item) {
    return { success: false, message: 'Payload invalide (type ou item manquant)' };
  }

  const actions = ACTION_MAP[type];
  if (!actions) {
    return { success: false, message: `Type inconnu: ${type}` };
  }

  // ── Cas spécial OAC : 3 actions distinctes ──
  if (type === 'oac') {
    return _handleOacPush(crudAction, item, subAction);
  }

  // ── Cas général ──
  const gasAction = actions[crudAction as keyof typeof actions];
  if (!gasAction) {
    return { success: false, message: `Action "${crudAction}" non supportée pour le type "${type}"` };
  }

  const fieldMap = FIELD_MAP[type] || {};
  const data: Record<string, any> = {};
  for (const [key, value] of Object.entries(item)) {
    if (value === undefined || value === null) continue;
    const gasKey = fieldMap[key] || key;
    data[gasKey] = value;
  }
  delete data._v;
  delete data.complet;
  delete data.statut;

  // DELETE : envoyer uniquement la clé
  if (crudAction === 'delete') {
    const deleteData: Record<string, any> = {};
    if (item.ligne) deleteData.ligne = item.ligne;
    else if (item.id) deleteData.id = item.id;
    else if (item.rowIndex) deleteData.rowIndex = item.rowIndex;
    else if (item.index) deleteData.ligne = item.index;
    const result = await callApi(gasAction, deleteData, 'POST');
    return {
      success: !!result?.success,
      message: result?.data?.message || result?.error || 'Suppression effectuée',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    };
  }

  const result = await callApi(gasAction, data, 'POST');
  const ok = result?.success && result?.data?.succes !== false;
  return {
    success: ok,
    message: result?.data?.message || result?.error || (ok ? 'Écriture OK' : 'Écriture échouée'),
    timestamp: new Date().toLocaleTimeString('fr-FR'),
  };
}

// ============================================================
//  Helper : gestion spécifique des 3 actions OAC
//  - subAction explicite ('commander' | 'mirer' | 'eclore')
//  - à défaut, détection automatique robuste
// ============================================================
async function _handleOacPush(
  crudAction: string,
  item: any,
  subAction?: 'commander' | 'mirer' | 'eclore'
): Promise<SyncResult> {
  // ── INSERT = nouvelle commande ──
  if (crudAction === 'insert') {
    const { ligne, ...rest } = item;
    return _oacCommander(rest);   // laisse GAS ajouter la ligne
  }

  // ── UPDATE ──
  if (crudAction === 'update') {
    // 1) subAction explicite prioritaire
    if (subAction === 'mirer') return _oacMirer(item);
    if (subAction === 'eclore') return _oacEclore(item);
    if (subAction === 'commander') return _oacCommander(item);

    // 2) Détection automatique robuste
    if (item.complet === true) return _oacEclore(item);

    const hasEclosionFields =
      (item.commerciaux ?? null) !== null ||
      (item.nes ?? null) !== null ||
      (item.handicapes ?? null) !== null ||
      (item.morts ?? null) !== null ||
      (item.pourVente ?? null) !== null;
    if (hasEclosionFields) return _oacEclore(item);   // ✅ éclosion détectée AVANT mirage

    if (item.clairs !== undefined && item.clairs !== null && item.clairs !== '') {
      return _oacMirer(item);
    }
    return _oacCommander(item);
  }

  // ── DELETE : pas supporté côté GAS ──
  return {
    success: false,
    message: 'Suppression OAC non supportée par GAS. Ajoutez "oac.supprimer" côté Apps Script.',
  };
}

// ── Action : oac.commander (insert ou update avec ligne) ──
async function _oacCommander(item: any): Promise<SyncResult> {
  const data = {
    ligne: item.ligne || '',
    id: item.id || '',
    date: item.date || '',
    type: item.type || 'Chairs',
    race: item.race || 'Ross 308',
    fournisseur: item.fournisseur || '',
    cartons: item.cartons || 0,
    casses: item.nbCasses || 0,
    eclosion: item.eclosion || item.dateEclosion || '',
    incubés: item.cubes || 0,
  };
  // Champs obligatoires côté GAS : cartons > 0 et eclosion non vide
  if (!data.cartons || data.cartons <= 0) {
    return { success: false, message: 'Le nombre de cartons est obligatoire et doit être > 0.', timestamp: new Date().toLocaleTimeString('fr-FR') };
  }
  if (!data.eclosion) {
    return { success: false, message: "La date d'éclosion est obligatoire.", timestamp: new Date().toLocaleTimeString('fr-FR') };
  }
  const result = await callApi('oac.commander', data, 'POST');
  const ok = result?.success && result?.data?.succes !== false;
  return {
    success: ok,
    message: result?.data?.message || result?.error || (ok ? 'Commande enregistrée' : 'Échec commande'),
    timestamp: new Date().toLocaleTimeString('fr-FR'),
  };
}

// ── Action : oac.mirer ──
async function _oacMirer(item: any): Promise<SyncResult> {
  if (!item.id) {
    return { success: false, message: 'ID commande manquant pour le mirage.', timestamp: new Date().toLocaleTimeString('fr-FR') };
  }
  const data = {
    id: item.id,
    clairs: Number(item.clairs) || 0,
  };
  const result = await callApi('oac.mirer', data, 'POST');
  const ok = result?.success && result?.data?.succes !== false;
  return {
    success: ok,
    message: result?.data?.message || result?.error || (ok ? 'Mirage enregistré' : 'Échec mirage'),
    timestamp: new Date().toLocaleTimeString('fr-FR'),
  };
}

// ── Action : oac.eclore ──
async function _oacEclore(item: any): Promise<SyncResult> {
  console.log('[DEBUG] _oacEclore item:', item);

  if (!item.id) {
    return {
      success: false,
      message: 'ID commande manquant pour l\'éclosion.',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    };
  }

  const commNum = Number(item.commerciaux) || 0;
  if (commNum < 0) {
    return {
      success: false,
      message: 'Le nombre de poussins commerciaux ne peut pas être négatif.',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    };
  }

  // ✅ CORRECTION : utiliser idCommande (pas id)
  const data = {
    idCommande: item.id,                // ← 🔑 CORRIGÉ
    commercial: commNum,
    morts: Number(item.morts) || 0,
    handicapes: Number(item.handicapes) || 0,
  };

  console.log('[DEBUG] _oacEclore data sent to GAS:', data);

  const result = await callApi('oac.eclore', data, 'POST');
  console.log('[DEBUG] _oacEclore GAS response:', result);

  const ok = result?.success && result?.data?.succes !== false;
  return {
    success: ok,
    message: result?.data?.message || result?.error || (ok ? 'Éclosion enregistrée' : 'Échec éclosion'),
    timestamp: new Date().toLocaleTimeString('fr-FR'),
  };
}

export const api = {
  ping,
  help,
  async listerUtilisateurs() { return callApi('utilisateurs.lister'); },
  async authentifier(data: { username: string; password: string }) {
    return callApi('utilisateurs.authentifier', data);
  },
};