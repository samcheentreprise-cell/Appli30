import { 
  OAC, 
  CommandePoussin, 
  Client, 
  Facture, 
  Depense, 
  Vente, 
  MouvementCaisse, 
  Bordereau, 
  SoumissionEnAttente 
} from '../types';

export const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbxx29xyOv788OteXrmly5c2VgOgT6nzyZv6uyVYtU5yXaUnhkj6WIcHykV9L9VkJ40/exec';
export const DEFAULT_API_TOKEN = 'samche_2023_1972KlaBgni2';

export function getGSheetWebappUrl(): string {
  const storedUrl = localStorage.getItem('gsheet_webapp_url');
  if (storedUrl && (storedUrl.includes('AKfycbx5SOLLsYoFPLj') || storedUrl.includes('AKfycbwZLonbfs4JZLy'))) {
    localStorage.setItem('gsheet_webapp_url', DEFAULT_API_URL);
    return DEFAULT_API_URL;
  }
  return storedUrl || (import.meta as any).env?.VITE_GSHEET_WEBAPP_URL || DEFAULT_API_URL;
}

export function setGSheetWebappUrl(url: string): void {
  const cleanUrl = url ? url.trim() : '';
  if (!cleanUrl) {
    localStorage.removeItem('gsheet_webapp_url');
  } else {
    localStorage.setItem('gsheet_webapp_url', cleanUrl);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gsheet_url_changed', { detail: { url: cleanUrl } }));
  }
}

export function getGSheetApiToken(): string {
  const storedToken = localStorage.getItem('gsheet_api_token');
  return storedToken || (import.meta as any).env?.VITE_GSHEET_API_TOKEN || DEFAULT_API_TOKEN;
}

export function setGSheetApiToken(token: string): void {
  const cleanToken = token ? token.trim() : '';
  if (!cleanToken) {
    localStorage.removeItem('gsheet_api_token');
  } else {
    localStorage.setItem('gsheet_api_token', cleanToken);
  }
}

export type HtmlErrorCategory = 
  | 'google_auth' 
  | 'gas_runtime_error' 
  | 'proxy_spa_fallback' 
  | 'redirect_loop' 
  | 'http_error' 
  | 'unknown_html';

export interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  parsedData?: ParsedSheetsData;
  timestamp: string;
  isHtmlError?: boolean;
  errorCategory?: HtmlErrorCategory;
  errorTitle?: string;
  errorDetails?: string;
  suggestedAction?: string;
  htmlPreview?: string;
  statusCode?: number;
}

export interface ParsedSheetsData {
  commandesPoussins?: CommandePoussin[];
  clients?: Client[];
  factures?: Facture[];
  oacList?: OAC[];
  depenses?: Depense[];
  ventes?: Vente[];
  mouvementsCaisse?: MouvementCaisse[];
  bordereaux?: Bordereau[];
  soumissions?: SoumissionEnAttente[];
  categoriesDepenses?: string[];
  produitsPrix?: { nom: string; prix: number }[];
  clientsNoms?: string[];
}

function formatDateFr(val: any): string {
  if (!val) return '';
  if (typeof val === 'string' && val.includes('T')) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  if (typeof val === 'string' && val.includes('GMT')) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  return String(val);
}

/**
 * Appel principal de l'API JSON Couvoir Samche
 */
export async function callApi(action: string, data: any = {}): Promise<any> {
  const apiUrl = getGSheetWebappUrl();
  const apiToken = getGSheetApiToken();

  const body = {
    action,
    token: apiToken,
    data
  };

  try {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(apiUrl)}`;
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.toLowerCase().includes('application/json')) {
      const rawText = await response.text();
      return { success: false, code: 'HTTP_' + response.status, error: rawText.slice(0, 300) };
    }

    return await response.json();
  } catch (err: any) {
    return { success: false, code: 'NETWORK', error: err.message };
  }
}

export async function ping(): Promise<any> {
  const apiUrl = getGSheetWebappUrl();
  const targetUrl = `${apiUrl}?action=api.ping`;
  try {
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
    return await response.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function help(): Promise<any> {
  const apiUrl = getGSheetWebappUrl();
  const targetUrl = `${apiUrl}?action=api.help`;
  try {
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
    return await response.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Client API unifié Couvoir Samche
 */
export const api = {
  ping,
  help,

  // -- Dashboard --
  async dashboard() {
    return callApi('dashboard.data');
  },

  // -- OAC --
  async listerOAC(filtre: string = 'tous', limite: number = 200) {
    return callApi('oac.lister', { filtre, limite });
  },
  async commanderOAC(data: any) {
    return callApi('oac.commander', data);
  },
  async mirerOAC(idCommande: string, clairs: number) {
    return callApi('oac.mirer', { idCommande, clairs });
  },
  async ecloreOAC(idCommande: string, commercial: number, morts: number = 0, handicapes: number = 0) {
    return callApi('oac.eclore', { idCommande, commercial, morts, handicapes });
  },

  // -- Dépenses --
  async listerDepenses(limite: number = 200) {
    return callApi('depenses.lister', { limite });
  },
  async enregistrerDepense(data: any) {
    return callApi('depenses.enregistrer', data);
  },
  async supprimerDepense(ligne: number) {
    return callApi('depenses.supprimer', { ligne });
  },
  async categoriesDepenses() {
    return callApi('depenses.categories');
  },
  async sousCategoriesDepenses(categorie?: string) {
    return callApi('depenses.sousCategories', { categorie });
  },
  async genererIdOAC() {
    return callApi('depenses.genererIdOAC');
  },
  async idsOACNonLivres() {
    return callApi('depenses.idsNonLivres');
  },

  // -- Ventes --
  async listerVentes(limite: number = 200) {
    return callApi('ventes.lister', { limite });
  },
  async enregistrerVente(data: any) {
    return callApi('ventes.enregistrer', data);
  },
  async supprimerVente(ligne: number) {
    return callApi('ventes.supprimer', { ligne });
  },
  async produits() {
    return callApi('ventes.produits');
  },
  async produitsPrix() {
    return callApi('ventes.produitsPrix');
  },
  async clients() {
    return callApi('ventes.clients');
  },
  async ajouterClient(data: any) {
    return callApi('ventes.ajouterClient', data);
  },

  // -- Caisse --
  async listerCaisse(limite: number = 200) {
    return callApi('caisse.lister', { limite });
  },
  async soldeCaisse() {
    return callApi('caisse.solde');
  },
  async statsCaisse() {
    return callApi('caisse.stats');
  },
  async enregistrerCaisse(data: any) {
    return callApi('caisse.enregistrer', data);
  },
  async supprimerCaisse(ligne: number) {
    return callApi('caisse.supprimer', { ligne });
  },

  // -- Commande Poussins --
  async listerCommandesPoussins() {
    return callApi('commandePoussins.lister');
  },
  async enregistrerCommandePoussin(data: any) {
    return callApi('commandePoussins.enregistrer', data);
  },
  async modifierCommandePoussin(rowIndex: number, quantite: number, statut: string, notes?: string) {
    return callApi('commandePoussins.modifier', { rowIndex, quantite, statut, notes });
  },
  async supprimerCommandePoussin(rowIndex: number, idCommande?: string) {
    return callApi('commandePoussins.supprimer', { rowIndex, idCommande });
  },
  async previsionsPoussins() {
    return callApi('commandePoussins.previsions');
  },
  async typeProduitActif() {
    return callApi('commandePoussins.typeProduit');
  },
  async prixUnitaire(typeProduit: string) {
    return callApi('commandePoussins.prixUnitaire', { typeProduit });
  },

  // -- Factures --
  async listerFactures(limite: number = 200) {
    return callApi('factures.lister', { limite });
  },
  async enregistrerFacture(data: any) {
    return callApi('factures.enregistrer', data);
  },

  // -- Bordereaux --
  async listerBordereaux(limite: number = 200) {
    return callApi('bordereaux.lister', { limite });
  },
  async enregistrerBordereau(data: any) {
    return callApi('bordereaux.enregistrer', data);
  },

  // -- Clients --
  async listerClients() {
    return callApi('clients.lister');
  }
};

/**
 * Synchronisation descendante (Lecture) depuis l'API Google Apps Script
 */
export async function fetchGoogleSheetsData(retries: number = 1): Promise<SyncResult> {
  const now = new Date().toLocaleTimeString('fr-FR');
  try {
    const [
      oacRes,
      poussinsRes,
      ventesRes,
      depensesRes,
      caisseRes,
      facturesRes,
      bordereauxRes,
      clientsRes,
      prodPrixRes,
      categoriesRes,
      clientsNomsRes
    ] = await Promise.all([
      api.listerOAC('tous', 200),
      api.listerCommandesPoussins(),
      api.listerVentes(200),
      api.listerDepenses(200),
      api.listerCaisse(200),
      api.listerFactures(200),
      api.listerBordereaux(200),
      api.listerClients(),
      api.produitsPrix(),
      api.categoriesDepenses(),
      api.clients()
    ]);

    const parsedData: ParsedSheetsData = {};

    // 0. Metadata options from Sheet
    if (prodPrixRes?.success && Array.isArray(prodPrixRes.data)) {
      parsedData.produitsPrix = prodPrixRes.data;
    }
    if (categoriesRes?.success && Array.isArray(categoriesRes.data)) {
      parsedData.categoriesDepenses = categoriesRes.data;
    }
    if (clientsNomsRes?.success && Array.isArray(clientsNomsRes.data)) {
      parsedData.clientsNoms = clientsNomsRes.data;
    }

    // 1. OAC
    if (oacRes?.success && Array.isArray(oacRes?.data?.commandes)) {
      parsedData.oacList = oacRes.data.commandes.map((c: any) => {
        let dateVal = String(c.date || c.dateCommande || c.dateCmd || '').trim();
        const ecloStr = String(c.dateEclosion || c.eclosion || '').trim();
        if ((!dateVal || dateVal === '--') && ecloStr) {
          const parts = ecloStr.split('/');
          if (parts.length === 3) {
            const dt = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (!isNaN(dt.getTime())) {
              dt.setDate(dt.getDate() - 21);
              dateVal = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
            }
          }
        }
        return {
          ligne: c.ligne,
          id: String(c.id || ''),
          date: dateVal,
          type: String(c.type || 'Chairs'),
          race: String(c.race || ''),
          fournisseur: String(c.fournisseur || ''),
          cartons: Number(c.cartons) || 0,
          recus: Number(c.recus) || 0,
          nbCasses: Number(c.casses) || 0,
          cubes: Number(c.cubes) || 0,
          eclosion: ecloStr,
          clairs: c.clairs != null ? Number(c.clairs) : null,
          fertiles: c.fertiles != null ? Number(c.fertiles) : null,
          attendus: c.attendus != null ? Number(c.attendus) : null,
          commerciaux: c.poussins != null ? Number(c.poussins) : null,
          morts: c.morts != null ? Number(c.morts) : null,
          handicapes: c.handicapes != null ? Number(c.handicapes) : null,
          pourVente: c.pourVente != null ? Number(c.pourVente) : null,
          complet: c.statut === 'Eclos'
        };
      });
    } else {
      parsedData.oacList = [];
    }

    // 2. Commandes Poussins
    if (poussinsRes?.success && Array.isArray(poussinsRes.data)) {
      parsedData.commandesPoussins = poussinsRes.data.map((p: any) => ({
        id: String(p.id || ''),
        date: formatDateFr(p.date),
        prenom: String(p.prenom || ''),
        nom: String(p.nom || ''),
        email: p.email || undefined,
        tel: p.tel || undefined,
        typeProduit: String(p.type || 'Chairs'),
        dateEclosion: formatDateFr(p.eclosion),
        quantite: Number(p.quantite) || 0,
        prixUnitaire: Number(p.prix) || 0,
        total: Number(p.total) || 0,
        statut: (p.statut || 'En attente') as any,
        notes: p.notes || undefined
      }));
    } else {
      parsedData.commandesPoussins = [];
    }

    // 3. Ventes
    if (ventesRes?.success && Array.isArray(ventesRes?.data?.ventes)) {
      parsedData.ventes = ventesRes.data.ventes.map((v: any) => {
        const qte = Number(v.quantite) || 0;
        const pu = Number(v.prixUnitaire ?? v.pu ?? v.prix) || 0;
        const calcMontant = qte * pu;
        const mt = (v.montant !== undefined && v.montant !== null && v.montant !== '' && Number(v.montant) > 0)
          ? Number(v.montant)
          : (Number(v.montantTotal || v.montantPaye) || calcMontant);

        const av = (v.avance !== undefined && v.avance !== null && v.avance !== '' && Number(v.avance) > 0)
          ? Number(v.avance)
          : (Number(v.montantPaye) || (v.statutPaiement === 'Payee' ? mt : 0));

        const rel = (v.reliquat !== undefined && v.reliquat !== null && v.reliquat !== '')
          ? Number(v.reliquat)
          : Math.max(0, mt - av);

        const typeV = String(v.typeVente || (v.produit === 'Poulet' ? 'Autre produit' : 'Poussins couvoir'));

        return {
          ligne: v.ligne,
          date: formatDateFr(v.date),
          client: String(v.client || ''),
          produit: String(v.produit || v.nature || v.typeProduit || (typeV === 'Autre produit' ? 'Poulet' : 'Chairs')),
          quantite: qte,
          prixUnitaire: pu,
          montant: mt,
          typeVente: typeV as any,
          statutPaiement: (v.statutPaiement || (rel === 0 ? 'Payee' : av > 0 ? 'Avance' : 'Non payee')) as any,
          avance: av,
          reliquat: rel,
          dateEclosion: formatDateFr(v.dateEclosion || v.eclosion),
          observation: v.observation || v.remarques || v.obs || undefined
        };
      });
    } else {
      parsedData.ventes = [];
    }

    // 4. Dépenses
    if (depensesRes?.success && Array.isArray(depensesRes?.data?.depenses)) {
      parsedData.depenses = depensesRes.data.depenses.map((d: any) => ({
        ligne: d.ligne,
        date: String(d.date || ''),
        dateMs: d.dateMs,
        categorie: String(d.categorie || 'Divers'),
        sousCategorie: String(d.sousCategorie || ''),
        montant: Number(d.montant) || 0,
        libelle: String(d.libelle || ''),
        sourcePaiement: String(d.sourcePaiement || 'Caisse'),
        numPiece: d.numPiece || undefined,
        idCommande: d.idCommande || undefined
      }));
    } else {
      parsedData.depenses = [];
    }

    // 5. Caisse
    if (caisseRes?.success && Array.isArray(caisseRes?.data?.mouvements)) {
      parsedData.mouvementsCaisse = caisseRes.data.mouvements.map((m: any) => ({
        ligne: m.ligne,
        date: String(m.date || ''),
        type: String(m.type || 'Mouvement'),
        detail: m.detail || undefined,
        entree: Number(m.entree) || 0,
        sortie: Number(m.sortie) || 0,
        solde: Number(m.solde) || 0,
        observation: m.observation || undefined
      }));
    } else {
      parsedData.mouvementsCaisse = [];
    }

    // 6. Factures
    if (facturesRes?.success && Array.isArray(facturesRes?.data?.factures)) {
      parsedData.factures = facturesRes.data.factures.map((f: any) => ({
        ligne: f.ligne,
        numero: String(f.numero || ''),
        date: String(f.date || ''),
        client: String(f.client || ''),
        telephone: f.telephone || undefined,
        ville: f.ville || undefined,
        refCmd: f.refCmd || undefined,
        nbArticles: Number(f.nbArticles) || 1,
        montantHT: Number(f.montantHT) || 0,
        remisePct: Number(f.remisePct) || 0,
        remiseVal: Number(f.remiseVal) || 0,
        tvaPct: Number(f.tvaPct) || 0,
        tvaVal: Number(f.tvaVal) || 0,
        total: Number(f.total) || 0,
        modeReglement: String(f.modeReglement || 'Espèces'),
        echeance: String(f.echeance || ''),
        statut: (f.statut || 'Emise') as any,
        notes: f.notes || undefined
      }));
    } else {
      parsedData.factures = [];
    }

    // 7. Bordereaux
    if (bordereauxRes?.success && Array.isArray(bordereauxRes?.data?.bordereaux)) {
      parsedData.bordereaux = bordereauxRes.data.bordereaux.map((b: any) => ({
        numero: String(b.numero || ''),
        date: String(b.date || ''),
        client: String(b.client || ''),
        lignes: [{ designation: 'Poussins d’un jour', qte: Number(b.nbArticles) || 0, unite: 'Cartons' }],
        statut: (b.statut || 'Emis') as any
      }));
    } else {
      parsedData.bordereaux = [];
    }

    // 8. Clients
    if (clientsRes?.success && Array.isArray(clientsRes.data)) {
      parsedData.clients = clientsRes.data.map((cl: any, idx: number) => ({
        index: cl.index || idx + 1,
        prenom: String(cl.prenom || ''),
        nom: String(cl.nom || ''),
        ville: String(cl.ville || 'Bamako'),
        telephone: String(cl.telephone || ''),
        email: cl.email || undefined,
        label: cl.label || `${cl.prenom || ''} ${cl.nom || ''}`.trim() || 'Client',
        totalAchats: 0
      }));
    } else {
      parsedData.clients = [];
    }

    return {
      success: true,
      message: 'Données synchronisées avec succès depuis le Couvoir SAMCHE',
      parsedData,
      timestamp: now
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erreur de synchronisation : ${err.message}`,
      timestamp: now,
      errorDetails: err.message
    };
  }
}

/**
 * Synchronisation montante (Écriture) vers l'API Google Apps Script
 */
function toIsoDate(val: any): string {
  if (!val) return '';
  const s = String(val).trim();
  if (s.includes('-')) return s;
  const parts = s.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return s;
}

export async function syncPushToGoogleSheets(payload: any, retries: number = 1): Promise<SyncResult> {
  const now = new Date().toLocaleTimeString('fr-FR');
  try {
    let result: any;
    const { type, action, item } = payload;

    if (type === 'oac') {
      if (action === 'insert') {
        const ecloIso = toIsoDate(item.eclosion || item.dateEclosion);
        const dateIso = toIsoDate(item.date) || item.date;
        result = await api.commanderOAC({
          date: dateIso,
          id: item.id,
          type: item.type || 'Chairs',
          race: item.race || '',
          fournisseur: item.fournisseur || '',
          cartons: Number(item.cartons) || 1,
          casses: Number(item.nbCasses || item.casses) || 0,
          eclosion: ecloIso,
          dateEclosion: item.eclosion || item.dateEclosion
        });
      } else if (action === 'update') {
        if (item.clairs !== undefined && item.clairs !== null && (item.commerciaux === undefined || item.commerciaux === null)) {
          result = await api.mirerOAC(item.id, Number(item.clairs) || 0);
        } else if (item.commerciaux !== undefined || item.morts !== undefined) {
          result = await api.ecloreOAC(
            item.id, 
            Number(item.commerciaux || item.nes) || 0, 
            Number(item.morts) || 0, 
            Number(item.handicapes) || 0
          );
        } else {
          result = await api.commanderOAC(item);
        }
      }
    } else if (type === 'ventes') {
      if (action === 'insert' || action === 'update') {
        result = await api.enregistrerVente({
          date: item.date,
          produit: item.produit || 'Chairs',
          typeVente: item.typeVente || 'Poussins couvoir',
          dateEclosion: item.dateEclosion || item.date,
          client: item.client,
          telephone: item.telephone || '',
          quantite: Number(item.quantite) || 0,
          prixUnitaire: Number(item.prixUnitaire) || 0,
          montant: Number(item.montant) || 0,
          montantTotal: Number(item.montant) || 0,
          montantPaye: Number(item.avance !== undefined ? item.avance : item.montant) || 0,
          avance: Number(item.avance !== undefined ? item.avance : item.montant) || 0,
          reliquat: Number(item.reliquat) || 0,
          statutPaiement: item.statutPaiement || 'Payee',
          modePaiement: item.modePaiement || 'Espèces',
          observation: item.observation || '',
          numFacture: item.numFacture || ''
        });
      } else if (action === 'delete') {
        result = await api.supprimerVente(item.ligne);
      }
    } else if (type === 'depenses') {
      if (action === 'insert' || action === 'update') {
        result = await api.enregistrerDepense({
          date: item.date,
          categorie: item.categorie,
          sousCategorie: item.sousCategorie,
          montant: Number(item.montant) || 0,
          libelle: item.libelle || '',
          sourcePaiement: item.sourcePaiement || 'Caisse',
          numPiece: item.numPiece || '',
          idCommande: item.idCommande || ''
        });
      } else if (action === 'delete') {
        result = await api.supprimerDepense(item.ligne);
      }
    } else if (type === 'caisse') {
      if (action === 'insert' || action === 'update') {
        result = await api.enregistrerCaisse({
          date: item.date,
          type: item.type,
          detail: item.detail || '',
          entree: Number(item.entree || 0),
          sortie: Number(item.sortie || 0),
          observation: item.observation || ''
        });
      } else if (action === 'delete') {
        result = await api.supprimerCaisse(item.ligne);
      }
    } else if (type === 'commandes_poussins') {
      if (action === 'insert') {
        result = await api.enregistrerCommandePoussin({
          date: item.date,
          prenom: item.prenom || '',
          nom: item.nom || '',
          tel: item.tel || '',
          email: item.email || '',
          ville: item.ville || 'Bamako',
          type: item.typeProduit || item.type || 'Chairs',
          typeProduit: item.typeProduit || item.type || 'Chairs',
          dateEclosion: item.dateEclosion || item.eclosion,
          eclosion: item.dateEclosion || item.eclosion,
          quantite: Number(item.quantite) || 0,
          prix: Number(item.prixUnitaire || item.prix) || 0,
          prixUnitaire: Number(item.prixUnitaire || item.prix) || 0,
          total: Number(item.total) || 0,
          statut: item.statut || 'En attente',
          notes: item.notes || ''
        });
      } else if (action === 'update') {
        result = await api.modifierCommandePoussin(
          item.rowIndex || item.ligne || 2, 
          Number(item.quantite) || 0, 
          item.statut, 
          item.notes
        );
      } else if (action === 'delete') {
        result = await api.supprimerCommandePoussin(item.rowIndex || item.ligne || 2, item.id);
      }
    } else if (type === 'factures') {
      if (action === 'insert' || action === 'update') {
        result = await api.enregistrerFacture({
          date: item.date,
          client: item.client,
          telephone: item.telephone || '',
          ville: item.ville || 'Bamako',
          modeReglement: item.modeReglement || 'Espèces',
          total: Number(item.total) || 0,
          lignes: item.lignes && item.lignes.length > 0 ? item.lignes : [
            { designation: 'Poussins d’un jour', quantite: item.nbArticles || 1, prixUnitaire: Number(item.total) || 0, total: Number(item.total) || 0 }
          ]
        });
      } else if (action === 'delete') {
        result = await callApi('factures.supprimer', { ligne: item.ligne });
      }
    } else if (type === 'bordereaux') {
      result = await api.enregistrerBordereau(item);
    } else if (type === 'clients') {
      if (action === 'insert') {
        result = await callApi('clients.ajouter', {
          prenom: item.prenom || '',
          nom: item.nom || '',
          ville: item.ville || 'Bamako',
          telephone: item.telephone || '',
          email: item.email || ''
        });
      } else if (action === 'update') {
        result = await callApi('clients.modifier', {
          ligne: item.index || item.ligne,
          prenom: item.prenom || '',
          nom: item.nom || '',
          ville: item.ville || 'Bamako',
          telephone: item.telephone || '',
          email: item.email || ''
        });
      } else if (action === 'delete') {
        result = await callApi('clients.supprimer', { ligne: item.index || item.ligne });
      }
    }

    const isOk = 
      result?.success === true && 
      result?.data?.succes !== false && 
      result?.data?.success !== false;

    const msg = 
      result?.data?.message || 
      result?.message || 
      result?.error || 
      (isOk ? 'Enregistré avec succès dans Google Sheets' : 'Erreur d\'enregistrement dans le classeur');

    return {
      success: isOk,
      message: msg,
      data: result,
      timestamp: now
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erreur d'envoi : ${err.message}`,
      timestamp: now,
      errorDetails: err.message
    };
  }
}
