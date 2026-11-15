/**
 * Téléchargement et ouverture fiabilisés du Guide d'Utilisation PDF.
 * Vérifie systématiquement la signature binaire "%PDF-" avant d'enregistrer
 * ou d'afficher le document, afin d'éviter tout fichier HTML/corrompu.
 */

const GUIDE_FILENAME = 'Guide_Utilisation_Couvoir_SAMCHE.pdf';
const GUIDE_ENDPOINTS = [
  '/api/guide-pdf',
  '/Guide_Utilisation_Couvoir_SAMCHE.pdf',
];

async function fetchValidatedPdfBuffer(): Promise<ArrayBuffer> {
  let lastError: string = 'Impossible de récupérer le guide PDF.';

  for (const endpoint of GUIDE_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?t=${Date.now()}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/pdf',
        },
      });

      if (!response.ok) {
        lastError = `Erreur serveur (${response.status})`;
        continue;
      }

      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength < 1024) {
        lastError = 'Fichier PDF vide ou incomplet.';
        continue;
      }

      // Vérifier les 5 premiers octets (%PDF-)
      const header = new TextDecoder('ascii').decode(buffer.slice(0, 5));
      if (!header.startsWith('%PDF-')) {
        lastError = 'Le serveur n’a pas renvoyé un document PDF valide.';
        continue;
      }

      return buffer;
    } catch (err: any) {
      lastError = err?.message || 'Erreur réseau lors du téléchargement.';
    }
  }

  throw new Error(lastError);
}

export async function createGuidePdfBlobUrl(): Promise<string> {
  const buffer = await fetchValidatedPdfBuffer();
  const blob = new Blob([buffer], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function downloadGuidePdf(): Promise<void> {
  const buffer = await fetchValidatedPdfBuffer();
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = GUIDE_FILENAME;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Laisser le temps au navigateur d'enregistrer le Blob avant révocation
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
