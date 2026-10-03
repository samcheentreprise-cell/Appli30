import { CommandePoussin } from '../types';

export interface BonImageData {
  cmd: CommandePoussin;
  fourni: number;
  cartons: number;
  receptionnaire: string;
  heureLivraison: string;
  statutLivraison: string;
  notesLivraison?: string;
  signatureClient?: string;
  dateSignature?: string;
  numBL?: string;
  lotDate?: string;
  lotType?: string;
  lotId?: string;
  visaCouvoirSignature?: string;
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Erreur de chargement de signature'));
    img.src = src;
  });
};

export async function generateSignedBonImage(data: BonImageData): Promise<{ blob: Blob; dataUrl: string; file: File }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1450;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte 2D');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Header Banner
  const gradient = ctx.createLinearGradient(0, 10, canvas.width, 160);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(0.5, '#1e3a8a');
  gradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = gradient;
  ctx.fillRect(10, 10, canvas.width - 20, 150);

  // Couvoir Samche Title
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('COUVOIR SAMCHE', canvas.width / 2, 65);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText("Production & Vente de Poussins d'un jour au Mali", canvas.width / 2, 100);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'normal 15px sans-serif';
  ctx.fillText('Tél : +223 66 56 50 55 / +223 66 71 97 17 • Bamako, Mali', canvas.width / 2, 130);

  // Document Badge Title
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 28px sans-serif';
  ctx.fillText('BON DE LIVRAISON & ÉMARGEMENT DE SORTIE', canvas.width / 2, 205);

  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('CONDITIONNEMENT : 50 POUSSINS PAR CARTON', canvas.width / 2, 232);

  // Metadata Bar (N° BL, Réf Commande, Date)
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(40, 250, 920, 48);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 250, 920, 48);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`N° BL : ${data.numBL || 'BL-OFFICIEL'}`, 60, 280);
  ctx.textAlign = 'center';
  ctx.fillText(`RÉF CMD : ${data.cmd.id}`, canvas.width / 2, 280);
  ctx.textAlign = 'right';
  ctx.fillText(`DATE : ${new Date().toLocaleDateString('fr-FR')}`, 940, 280);

  // Boxes: Destinataire & Lot
  // Left Box: Client
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(40, 315, 445, 140);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(40, 315, 445, 140);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CLIENT DESTINATAIRE :', 60, 340);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${data.cmd.prenom} ${data.cmd.nom}`, 60, 372);

  ctx.fillStyle = '#334155';
  ctx.font = 'normal 14px sans-serif';
  ctx.fillText(`Téléphone : ${data.cmd.tel || 'Non renseigné'}`, 60, 402);
  ctx.fillText(`Ville / Destination : ${data.cmd.ville || 'Bamako'}`, 60, 428);

  // Right Box: Lot
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(515, 315, 445, 140);
  ctx.strokeRect(515, 315, 445, 140);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('DÉTAILS DU LOT D’ÉCLOSION :', 535, 340);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${data.lotType || data.cmd.typeProduit}`, 535, 372);

  ctx.fillStyle = '#334155';
  ctx.font = 'normal 14px sans-serif';
  ctx.fillText(`Date d'éclosion : ${data.cmd.dateEclosion || data.lotDate || '--'}`, 535, 402);
  ctx.fillText(`N° Lot OAC : ${data.lotId || '--'}`, 535, 428);

  // Table Header
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(40, 475, 920, 45);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DÉSIGNATION', 60, 503);
  ctx.textAlign = 'right';
  ctx.fillText('COMMANDÉ', 480, 503);
  ctx.fillText('RÉEL FOURNI', 650, 503);
  ctx.textAlign = 'center';
  ctx.fillText('CARTONS (50/CTN)', 770, 503);
  ctx.fillText('STATUT', 900, 503);

  // Table Row
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(40, 520, 920, 60);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(40, 520, 920, 60);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Poussins d'un jour (${data.cmd.typeProduit})`, 60, 556);

  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(data.cmd.quantite.toLocaleString('fr-FR'), 480, 556);

  ctx.fillStyle = '#16a34a';
  ctx.font = '900 20px sans-serif';
  ctx.fillText(data.fourni.toLocaleString('fr-FR'), 650, 556);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${data.cartons} ctn (de 50)`, 770, 556);

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(data.statutLivraison || 'Livré', 900, 556);

  // Delivery Metadata Box
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(40, 600, 920, 90);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(40, 600, 920, 90);

  ctx.fillStyle = '#334155';
  ctx.font = 'normal 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`• Réceptionné par / Chauffeur : ${data.receptionnaire || `${data.cmd.prenom} ${data.cmd.nom}`}`, 60, 628);
  ctx.fillText(`• Heure de sortie du couvoir : ${data.heureLivraison || '06:30'}`, 60, 654);
  ctx.fillText(`• Observations : ${data.notesLivraison || 'Sortie conforme sans réserve'}`, 60, 678);

  // Signatures Area
  // Left: Visa Couvoir
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(40, 710, 445, 180);
  ctx.strokeStyle = '#94a3b8';
  ctx.strokeRect(40, 710, 445, 180);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VISA COUVOIR SAMCHE / SORTIE', 262, 735);

  if (data.visaCouvoirSignature) {
    try {
      const vImg = await loadImage(data.visaCouvoirSignature);
      ctx.drawImage(vImg, 162, 745, 200, 90);
    } catch {}
  } else {
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('✓ VALIDÉ COUVOIR SAMCHE', 262, 795);
  }
  ctx.fillStyle = '#64748b';
  ctx.font = '11px sans-serif';
  ctx.fillText('Contrôle Qualité & Comptage 50/carton', 262, 875);

  // Right: Signature Client / Chauffeur
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(515, 710, 445, 180);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;
  ctx.strokeRect(515, 710, 445, 180);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ÉMARGEMENT CLIENT / CHAUFFEUR', 737, 735);

  if (data.signatureClient) {
    try {
      const sigImg = await loadImage(data.signatureClient);
      ctx.drawImage(sigImg, 565, 745, 345, 95);
    } catch {}
    ctx.fillStyle = '#16a34a';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`✓ Signé numériquement au quai le ${data.dateSignature || new Date().toLocaleDateString('fr-FR')}`, 737, 860);
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 14px sans-serif';
    ctx.fillText('[Émargement en attente]', 737, 795);
  }
  ctx.fillStyle = '#64748b';
  ctx.font = '11px sans-serif';
  ctx.fillText('"Reçu conforme en bon état (50 poussins/carton)"', 737, 878);

  // Thank You Footer Banner
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(40, 910, 920, 90);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 910, 920, 90);

  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('« Le Couvoir SAMCHE vous remercie pour votre confiance ! »', canvas.width / 2, 942);
  ctx.font = 'normal 13px sans-serif';
  ctx.fillText("Nous vous souhaitons un excellent démarrage et plein succès dans votre bande d'élevage.", canvas.width / 2, 968);
  ctx.fillText('Service Technique & Conseils : +223 66 56 50 55 / +223 66 71 97 17', canvas.width / 2, 988);

  // Bottom Notice
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px monospace';
  ctx.fillText(`Document officiel certifié COUVOIR SAMCHE • Généré le ${new Date().toLocaleString('fr-FR')}`, canvas.width / 2, 1025);

  // Export
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Erreur de conversion canvas to blob'));
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
      const filename = `Bon_Livraison_Signe_${data.cmd.id}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      resolve({ blob, dataUrl, file });
    }, 'image/png');
  });
}
