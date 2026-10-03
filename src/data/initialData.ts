import { OAC, Depense, Client, Facture, SoumissionEnAttente, Vente, MouvementCaisse, CommandePoussin, Bordereau } from '../types';

export const TYPES_OAC = ['Chairs', 'Sasso', 'Fermier', 'Cou-nu'];
export const RACES_OAC = ['Ross 308', 'Sasso', 'Cou-nu', 'Fermier', 'Cobb 500'];
export const FOURNISSEURS_OAC = [
  'Pak tavuk',
  'Golfa',
  'Garanti',
  'HSI',
  'Soudis',
  'Ferme Mariama',
  'Poussin Mali',
  'Local',
  'Importation'
];

export const PRODUITS_PRIX: { nom: string; prix: number }[] = [
  { nom: 'Chairs', prix: 600 },
  { nom: 'Sasso', prix: 900 },
  { nom: 'Poussins_1mois', prix: 1300 },
  { nom: 'Fermier', prix: 700 },
  { nom: 'Cartons', prix: 0 },
  { nom: 'Alvéoles', prix: 3750 },
  { nom: 'Poulet', prix: 4000 },
  { nom: 'Cou-nu', prix: 650 }
];

export const CATEGORIES_DEPENSES_SHEET = [
  'Approvisionnement',
  'Personnel',
  'Locaux/Sécurité',
  'Services externes',
  'Énergie',
  'Maintenance',
  'Investissements',
  'Commercial',
  'Administration',
  'Finance'
];

export const INITIAL_SOUMISSIONS: SoumissionEnAttente[] = [];
export const INITIAL_OAC: OAC[] = [];
export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_FACTURES: Facture[] = [];
export const INITIAL_DEPENSES: Depense[] = [];
export const INITIAL_BORDEREAUX: Bordereau[] = [];
export const INITIAL_VENTES: Vente[] = [];
export const INITIAL_CAISSE: MouvementCaisse[] = [];
export const INITIAL_COMMANDES_POUSSINS: CommandePoussin[] = [];

export function getStoredData<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(`samche_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      // If cached data contains old mock markers, discard it so the sheet data takes over
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (
          first?.id === 'OAC-2609-002' ||
          first?.id === 'CMD-20260915-151823' ||
          first?.prenom === 'Moussa' ||
          first?.numero === 'FAC-2026-001' ||
          first?.libelle?.includes('Électrogène')
        ) {
          localStorage.removeItem(`samche_${key}`);
          return defaultVal;
        }

        if (key === 'ventes') {
          return parsed.map((v: any) => {
            const qte = Number(v.quantite) || 0;
            const pu = Number(v.prixUnitaire) || 0;
            const calc = qte * pu;
            const mt = Number(v.montant) > 0 ? Number(v.montant) : calc;
            const av = (v.avance !== undefined && v.avance !== null && Number(v.avance) > 0)
              ? Number(v.avance)
              : (v.statutPaiement === 'Payee' ? mt : (Number(v.avance) || 0));
            const rel = (v.reliquat !== undefined && v.reliquat !== null)
              ? Number(v.reliquat)
              : (v.statutPaiement === 'Payee' ? 0 : Math.max(0, mt - av));
            return {
              ...v,
              montant: mt,
              avance: av,
              reliquat: rel,
            };
          }) as T;
        }
      }
      return parsed;
    }
  } catch (e) {
    console.warn(`Error reading localStorage for ${key}:`, e);
  }
  return defaultVal;
}

export function setStoredData<T>(key: string, val: T): void {
  try {
    localStorage.setItem(`samche_${key}`, JSON.stringify(val));
  } catch (e) {
    console.warn(`Error saving localStorage for ${key}:`, e);
  }
}

export function clearAllAppCache(keepGsheetUrl: boolean = true): void {
  try {
    const savedUrl = keepGsheetUrl ? localStorage.getItem('gsheet_webapp_url') : null;
    const savedToken = keepGsheetUrl ? localStorage.getItem('gsheet_api_token') : null;
    
    // Clear all localStorage items
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    // Restore Google Sheets URL and Token if requested
    if (savedUrl) {
      localStorage.setItem('gsheet_webapp_url', savedUrl);
    }
    if (savedToken) {
      localStorage.setItem('gsheet_api_token', savedToken);
    }

    sessionStorage.clear();

    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      }).catch((err) => console.warn('Error clearing CacheStorage:', err));
    }
  } catch (e) {
    console.error('Error clearing app cache:', e);
  }
}
