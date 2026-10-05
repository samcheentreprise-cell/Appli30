export interface OAC {
  _v?: number;
  ligne?: number;
  id: string;
  date: string;
  type: string;
  race: string;
  fournisseur: string;
  cartons: number;
  recus: number;
  nbCasses: number;
  incubés?: number;
  eclosion: string;
  clairs?: number | null;
  fertiles?: number | null;
  commerciaux?: number | null;
  nes?: number | null;
  pourVente?: number | null;
  handicapes?: number | null;
  morts?: number | null;
  complet?: boolean;
  notes?: string;
}

export interface SoumissionEnAttente {
  ligne: number;
  idSoumission: string;
  type: 'Commande' | 'Mirage' | 'Éclosion';
  soumisPar: string;
  dateSoumission: string;
  statut: 'En attente' | 'Approuvé' | 'Rejeté';
  resume: string;
  validPar?: string;
  dateValid?: string;
  raison?: string;
  donnees?: any;
}

export interface CommandePoussin {
  rowIndex?: number;
  id: string;
  date: string;
  prenom: string;
  nom: string;
  email?: string;
  tel?: string;
  ville?: string;
  typeProduit: string;
  dateEclosion: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
  statut: 'En attente' | 'Confirmée' | 'Livrée' | 'Annulée';
  notes?: string;
  quantiteFournie?: number;
  statutLivraison?: 'En attente' | 'Livré' | 'Partiel' | 'Non retiré';
  receptionnaire?: string;
  heureLivraison?: string;
  nbCartons?: number;
  notesLivraison?: string;
  dateLivraison?: string;
  signatureClient?: string;
  dateSignature?: string;
  isUnlockedByAdmin?: boolean;
  unlockedByAdminInfo?: string;
}

export interface LivraisonRecord {
  idCommande: string;
  quantiteFournie: number;
  statutLivraison: 'En attente' | 'Livré' | 'Partiel' | 'Non retiré';
  receptionnaire?: string;
  heureLivraison?: string;
  nbCartons?: number;
  notesLivraison?: string;
  dateValidation?: string;
}

export interface MouvementCaisse {
  ligne?: number;
  date: string;
  type: string;
  detail?: string;
  entree: number;
  sortie: number;
  solde: number;
  observation?: string;
}

export interface Vente {
  ligne?: number;
  date: string;
  client: string;
  produit: string;
  quantite: number;
  prixUnitaire: number;
  montant: number;
  dateEclosion?: string;
  observation?: string;
  typeVente: 'Poussins couvoir' | 'Autre produit';
  statutPaiement: 'Payee' | 'Avance' | 'Non payee';
  avance: number;
  reliquat: number;
}

export interface Depense {
  ligne?: number;
  id?: string;
  date: string;
  dateMs?: number;
  categorie: string;
  sousCategorie: string;
  montant: number;
  libelle: string;
  sourcePaiement: string;
  numPiece?: string;
  idCommande?: string;
}

export interface Client {
  index?: number;
  id?: string;
  prenom: string;
  nom: string;
  ville: string;
  telephone: string;
  email?: string;
  label: string;
  totalAchats?: number;
}

export interface FactureLigne {
  designation: string;
  qte: number;
  pu: number;
}

export interface Facture {
  ligne?: number;
  numero: string;
  date: string;
  client: string;
  telephone?: string;
  ville?: string;
  adresseClient?: string;
  emailClient?: string;
  refCmd?: string;
  lignes?: FactureLigne[];
  nbArticles: number;
  montantHT: number;
  remisePct?: number;
  remiseVal?: number;
  tvaPct?: number;
  tvaVal?: number;
  total: number;
  modeReglement: string;
  echeance: string;
  datePaiement?: string;
  statut: 'Emise' | 'Payée' | 'En attente' | 'Annulée' | 'Litige';
  notes?: string;
}

export interface BordereauLigne {
  designation: string;
  qte: number;
  unite?: string;
  observations?: string;
}

export interface Bordereau {
  numero: string;
  date: string;
  client: string;
  adresseClient?: string;
  refCmd?: string;
  lignes: BordereauLigne[];
  statut: 'Emis' | 'Livré';
}

export type UserRole = 'admin' | 'utilisateur' | 'comptable';
