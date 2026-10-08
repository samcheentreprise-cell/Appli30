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
  typesOAC: string[];
  races: string[];
  racesOac: string[];
  fournisseurs: string[];
  fournisseursOac: string[];
}> {
  if (_fparamCache && !force) return _fparamCache;
  const result = await callApi('fparam.get');
  if (result?.success && result?.data) {
    _fparamCache = result.data;
    return _fparamCache;
  }
  return {
    produitsPrix: {}, sourcesPaiement: [], typesProduits: [],
    typesOAC: [], races: [], racesOac: [], fournisseurs: [], fournisseursOac: []
  };
}

// Helper : récupère le prix d'un type de produit (avec fallback)
export async function getPrixUnitaire(typeProduit: string, force: boolean = false): Promise<number> {
  const fp = await getFParamData(force);
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

// Helper : récupère les données de configuration OAC (Race, Fournisseur, Type)
// Ces données sont supposées provenir de la feuille "F-Param"
export async function getOacConfig(force = false): Promise<{
  races: string[];
  fournisseurs: string[];
  typesOac: string[];
}> {
  const result = await getFParamData(force);
  return {
    races: result.races || result.racesOac || [],
    fournisseurs: result.fournisseurs || result.fournisseursOac || [],
    typesOac: result.typesOAC || result.typesProduits || [],
  };
}

// Helper : récupère la liste des sources de paiement
export async function getSourcesPaiement(): Promise<string[]> {
  const fp = await getFParamData();
  return fp.sourcesPaiement;
}

// ============================================================
//  Helper local : extraction sécurisée d'un tableau depuis une réponse GAS
//  - res peut être undefined / null
//  - res peut être directement un tableau
//  - res.data peut être un tableau
//  - res.data peut contenir la clé cherchée
//  - la clé peut aussi être à la racine de res (sans wrapper `data`)
//  - on vérifie systématiquement Array.isArray() pour éviter objets/strings
// ============================================================
function safeArray(res: any, ...keys: string[]): any[] {
  try {
    if (!res) return [];
    if (Array.isArray(res)) return res;

    const data = res.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (const k of keys) {
        if (Array.isArray(data[k])) return data[k];
      }
    }
    // Fallback : chercher à la racine de res
    for (const k of keys) {
      if (Array.isArray(res[k])) return res[k];
    }
    return [];
  } catch (err) {
    console.error('[safeArray] erreur lors de l\'extraction:', err, { res, keys });
    return [];
  }
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

    // Vérification : si une réponse est manquante ou marquée échouée, on sort tôt
    const responses = [
      { name: 'oac',          res: oacRes },
      { name: 'ventes',       res: ventesRes },
      { name: 'depenses',     res: depensesRes },
      { name: 'caisse',       res: caisseRes },
      { name: 'clients',      res: clientsRes },
      { name: 'factures',     res: facturesRes },
      { name: 'cmdPoussins',  res: cmdPoussinsRes },
      { name: 'bordereaux',   res: bordereauxRes },
    ];

    // Ne pas échouer la sync globale si une seule action échoue
    const failedActions = responses.filter(r => !r.res?.success);
    if (failedActions.length > 0) {
      console.warn('[fetchGoogleSheetsData] Certaines actions ont échoué:', failedActions);
    }

    // Log léger pour diagnostic (à retirer une fois stabilisé)
    if (typeof console !== 'undefined') {
      responses.forEach(({ name, res }) => {
        const hasData = res && (Array.isArray(res.data) || (res.data && typeof res.data === 'object'));
        if (!hasData) {
          console.warn(`[fetchGoogleSheetsData] Réponse "${name}" sans champ data exploitable:`, res);
        }
      });
    }

    // Mapping OAC : transforme les champs GAS → React
    // Supporte { commandes: [...] } ou directement [...]
    const rawOacData = safeArray(oacRes, 'commandes');
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
      eclosion: o.dateEclosion || o.eclosion || o.dateEclo || '',  // ← fallback dateEclo
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

    // ============================================================
    //  Construction du parsedData — extraction sécurisée via safeArray()
    //  Ancien code :
    //    ventes: ventesRes.data?.ventes || [],
    //  Nouveau code : tolère data null/undefined, vérifie Array.isArray,
    //                 et cherche aussi à la racine de la réponse GAS.
    // ============================================================
    const parsedData = {
      oacList,
      ventes:            safeArray(ventesRes,        'ventes'),
      depenses:          safeArray(depensesRes,      'depenses'),
      mouvementsCaisse:  safeArray(caisseRes,        'mouvements'),
      clients:           safeArray(clientsRes,       'clients'),
      factures:          safeArray(facturesRes,      'factures'),
      commandesPoussins: safeArray(cmdPoussinsRes,   'commandes', 'commandesPoussins'),
      bordereaux:        safeArray(bordereauxRes,    'bordereaux'),
      soumissions:       [],
    };

    return {
      success: true,
      message: 'Synchronisation réussie',
      parsedData,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    };
  } catch (err: any) {
    console.error('[fetchGoogleSheetsData] Exception:', err);
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
    console.log(`[DEBUG] SyncPush DELETE initiated for type: ${type}, action: ${gasAction}, item:`, item);
    const deleteData: Record<string, any> = {};

    // Cas spécial : commandePoussins a besoin de rowIndex + idCommande
    if (type === 'commandes_poussins') {
      if (item.rowIndex) deleteData.rowIndex = item.rowIndex;
      if (item.id || item.idCommande) deleteData.idCommande = item.id || item.idCommande;
    }
    // Cas général : ligne (pour ventes, depenses, caisse, factures, bordereaux, clients)
    else if (item.ligne) {
      deleteData.ligne = item.ligne;
    } else if (item.index) {
      deleteData.ligne = item.index;
    } else if (item.id) {
      deleteData.id = item.id;
    } else {
      console.log(`[DEBUG] SyncPush DELETE error: missing key for ${type}`, item);
      return {
        success: false,
        message: `Impossible de supprimer : ligne manquante pour ${type}`,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
      };
    }

    console.log(`[DEBUG] SyncPush DELETE sending data (action: ${gasAction}):`, deleteData);
    const result = await callApi(gasAction, deleteData, 'GET');
    console.log(`[DEBUG] SyncPush DELETE raw response:`, result);
    return {
      success: !!result?.success && result?.data?.succes !== false,
      message: result?.data?.message || result?.error || 'Suppression effectuée',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    };
  }

  const result = await callApi(gasAction, data, 'POST');
  // ✅ Vérifier les deux orthographes (succes FR + success EN)
  // Certaines fonctions GAS retournent "succes" (FR), d'autres "success" (EN)
  const innerSuccess = result?.data?.succes !== false && result?.data?.success !== false;
  const ok = !!result?.success && innerSuccess;
  return {
    success: ok,
    message: result?.data?.message || result?.error || (ok ? 'Écriture OK' : 'Écriture échouée'),
    timestamp: new Date().toLocaleTimeString('fr-FR'),
  };
}

// ============================================================
//  Helper : gestion spécifique des actions OAC (insert/update/delete)
// ============================================================
async function _handleOacPush(
  crudAction: string,
  item: any,
  subAction?: 'commander' | 'mirer' | 'eclore'
): Promise<SyncResult> {
  // INSERT = nouvelle commande → oac.commander
  if (crudAction === 'insert') {
    return _oacCommander(item);
  }

  // UPDATE → mirage / éclosion / commande
  if (crudAction === 'update') {
    if (subAction === 'mirer') return _oacMirer(item);
    if (subAction === 'eclore') return _oacEclore(item);
    if (subAction === 'commander') return _oacCommander(item);

    if (item.complet === true) return _oacEclore(item);
    if (item.clairs !== undefined && item.clairs !== null && item.clairs !== '') {
      return _oacMirer(item);
    }
    return _oacCommander(item);
  }

  // DELETE → oac.supprimer (par ligne ou par idCommande)
  if (crudAction === 'delete') {
    return _oacSupprimer(item);
  }

  return {
    success: false,
    message: `Action OAC non supportée : ${crudAction}`,
  };
}

// ── Action : oac.supprimer ──
async function _oacSupprimer(item: any): Promise<SyncResult> {
  console.log('[DEBUG] _oacSupprimer item:', item);

  const data: Record<string, any> = {};
  if (item.ligne) {
    data.ligne = item.ligne;
  } else if (item.id) {
    data.idCommande = item.id;
  } else if (item.idCommande) {
    data.idCommande = item.idCommande;
  } else {
    return {
      success: false,
      message: 'Impossible de supprimer : ligne ou idCommande manquant.',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    };
  }

  console.log('[DEBUG] _oacSupprimer data sent to GAS:', data);

  // ✅ GET marche mieux avec GAS (redirections 302)
  const result = await callApi('oac.supprimer', data, 'GET');

  console.log('[DEBUG] _oacSupprimer GAS response:', result);

  const ok = result?.success && result?.data?.succes !== false;
  return {
    success: ok,
    message: result?.data?.message || result?.error || (ok ? 'OAC supprimée' : 'Échec suppression'),
    timestamp: new Date().toLocaleTimeString('fr-FR'),
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

// ── Action : oac.mirer (via GET — testé et validé) ──
async function _oacMirer(item: any): Promise<SyncResult> {
  console.log('[DEBUG] _oacMirer item:', item);

  if (!item.id) {
    return {
      success: false,
      message: 'ID commande manquant pour le mirage.',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    };
  }

  const data = {
    idCommande: item.id,
    clairs: Number(item.clairs) || 0,
  };

  console.log('[DEBUG] _oacMirer data sent to GAS:', data);

  // ✅ GET (pas POST) — GET marche pour oac.mirer
  const result = await callApi('oac.mirer', data, 'GET');

  console.log('[DEBUG] _oacMirer GAS response:', result);

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
