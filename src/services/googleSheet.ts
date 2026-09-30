export const GSHEET_WEBAPP_URL = 
  (import.meta as any).env?.VITE_GSHEET_WEBAPP_URL || 
  'https://script.google.com/macros/s/AKfycbwnzF6ptccDsjjNFi6NfOvcIcWK_IHVqLB-G4X2k4RwZsOKgGhs2bvnyVc4om8qNJii/exec';

export interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
}

export async function fetchGoogleSheetsData(): Promise<SyncResult> {
  const now = new Date().toLocaleTimeString('fr-FR');
  try {
    const url = `${GSHEET_WEBAPP_URL}?action=getAll&t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Données synchronisées avec succès depuis Google Sheets',
      data,
      timestamp: now,
    };
  } catch (error: any) {
    console.warn('Google Sheets sync warning/fallback:', error);
    return {
      success: false,
      message: `Connexion Google Sheets : mode local actif (${error.message || 'CORS / Réseau'})`,
      timestamp: now,
    };
  }
}

export async function syncPushToGoogleSheets(payload: {
  type: 'oac' | 'depenses' | 'clients' | 'factures';
  action: 'insert' | 'update' | 'delete';
  item: any;
}): Promise<SyncResult> {
  const now = new Date().toLocaleTimeString('fr-FR');
  try {
    const response = await fetch(GSHEET_WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({ status: 'ok' }));
    return {
      success: true,
      message: 'Mise à jour transmise au classeur Google Sheets',
      data,
      timestamp: now,
    };
  } catch (error: any) {
    console.warn('Sync push notice:', error);
    return {
      success: false,
      message: `Enregistré localement (non transmis à Google Sheets : ${error.message || 'réseau'})`,
      timestamp: now,
    };
  }
}
