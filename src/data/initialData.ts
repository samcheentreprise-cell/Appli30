import { OAC, Depense, Client, Facture, SoumissionEnAttente, Vente, MouvementCaisse, CommandePoussin, Bordereau } from '../types';

export const TYPES_OAC = ['Chairs', 'Sasso', 'Pintade', 'Fermiers', 'Pondeuses'];
export const RACES_OAC = ['Ross 308', 'Sasso', 'Galor', 'Pintade', 'Fermier', 'Cobb 500'];
export const FOURNISSEURS_OAC = [
  'Pak tavuk',
  'Golfa',
  'Garanti',
  'HSI',
  'Soudis',
  'Poussin Mali',
  'UPRA',
  'Local',
  'Importation'
];

export const INITIAL_SOUMISSIONS: SoumissionEnAttente[] = [
  {
    ligne: 2,
    idSoumission: 'ATT-20260929-45812',
    type: 'Commande',
    soumisPar: 'Agent Couvoir',
    dateSoumission: '29/09/2026',
    statut: 'En attente',
    resume: 'Ross 308 | Pak tavuk | Cartons: 50 | Cassés: 80',
    donnees: {
      date: '2026-09-29',
      type: 'Chairs',
      race: 'Ross 308',
      fournisseur: 'Pak tavuk',
      cartons: 50,
      casses: 80,
      eclosion: '2026-10-20'
    }
  },
  {
    ligne: 3,
    idSoumission: 'ATT-20260923-10294',
    type: 'Commande',
    soumisPar: 'Inconnu',
    dateSoumission: '23/09/2026',
    statut: 'Approuvé',
    resume: 'Ross 308 | Golfa | Cartons: 10 | Cassés: 10',
    validPar: 'Cheick',
    dateValid: '23/09/2026'
  },
  {
    ligne: 4,
    idSoumission: 'ATT-20260920-88314',
    type: 'Commande',
    soumisPar: 'Inconnu',
    dateSoumission: '20/09/2026',
    statut: 'Approuvé',
    resume: 'Ross 308 | Pak tavuk | Cartons: 54 | Cassés: 150',
    validPar: 'admin',
    dateValid: '20/09/2026'
  },
  {
    ligne: 5,
    idSoumission: 'ATT-20260920-77123',
    type: 'Commande',
    soumisPar: 'Inconnu',
    dateSoumission: '20/09/2026',
    statut: 'Approuvé',
    resume: 'Ross 308 | Pak tavuk | Cartons: 54 | Cassés: 90',
    validPar: 'admin',
    dateValid: '20/09/2026'
  },
  {
    ligne: 6,
    idSoumission: 'ATT-20260919-66241',
    type: 'Commande',
    soumisPar: 'Inconnu',
    dateSoumission: '19/09/2026',
    statut: 'Rejeté',
    resume: 'Sasso | Garanti | Cartons: 30 | Cassés: 123',
    validPar: 'Cheick',
    dateValid: '19/09/2026',
    raison: 'Mauvaise déclaration de lot fournisseur'
  },
  {
    ligne: 7,
    idSoumission: 'ATT-20260919-55102',
    type: 'Commande',
    soumisPar: 'Inconnu',
    dateSoumission: '19/09/2026',
    statut: 'Approuvé',
    resume: 'Galor | HSI | Cartons: 24 | Cassés: 120',
    validPar: 'Cheick',
    dateValid: '19/09/2026'
  }
];

export const INITIAL_OAC: OAC[] = [
  {
    _v: 25,
    ligne: 5,
    date: "23/09/2026",
    id: "OAC-2609-002",
    type: "Chairs",
    race: "Ross 308",
    fournisseur: "Golfa",
    cartons: 10,
    recus: 3600,
    nbCasses: 10,
    cubes: 3590,
    eclosion: "15/10/2026",
    clairs: null,
    fertiles: 3590,
    commerciaux: null,
    pourVente: null,
    handicapes: null,
    morts: null,
    notes: "Lot reçu Golfa"
  },
  {
    _v: 25,
    ligne: 4,
    date: "15/09/2026",
    id: "OAC-2609-003",
    type: "Chairs",
    race: "Ross 308",
    fournisseur: "Pak tavuk",
    cartons: 54,
    recus: 19440,
    nbCasses: 90,
    cubes: 19350,
    eclosion: "07/10/2026",
    clairs: null,
    fertiles: 19350,
    commerciaux: null,
    pourVente: null,
    handicapes: null,
    morts: null,
    notes: "Lot reçu en bon état sanitaire"
  },
  {
    _v: 25,
    ligne: 3,
    date: "12/09/2026",
    id: "OAC-2609-002",
    type: "Chairs",
    race: "Ross 308",
    fournisseur: "Pak tavuk",
    cartons: 54,
    recus: 19440,
    nbCasses: 150,
    cubes: 19290,
    eclosion: "04/10/2026",
    clairs: null,
    fertiles: 19290,
    commerciaux: null,
    pourVente: null,
    handicapes: null,
    morts: null,
    notes: "Incubation en cours - Incubateur A"
  },
  {
    _v: 25,
    ligne: 2,
    date: "01/09/2026",
    id: "OAC-2609-001",
    type: "Chairs",
    race: "Ross 308",
    fournisseur: "Poussin Mali",
    cartons: 50,
    recus: 18000,
    nbCasses: 85,
    cubes: 17915,
    eclosion: "22/09/2026",
    clairs: 1200,
    fertiles: 16715,
    commerciaux: 16000,
    pourVente: 15680,
    handicapes: 110,
    morts: 80,
    notes: "Lot éclos avec succès (taux 89%)"
  }
];

export const INITIAL_DEPENSES: Depense[] = [
  {
    ligne: 16,
    date: "18/09/2026",
    dateMs: 1789747200000,
    categorie: "Approvisionnement",
    sousCategorie: "Achat d'œufs à couver",
    montant: 700000,
    libelle: "ACHAT oac Camara",
    sourcePaiement: "Coris Banque",
    numPiece: "",
    idCommande: "OAC-2609-003"
  },
  {
    ligne: 17,
    date: "08/09/2026",
    dateMs: 1788883200000,
    categorie: "Approvisionnement",
    sousCategorie: "Achat d'œufs à couver",
    montant: 7830000,
    libelle: "Soudis",
    sourcePaiement: "Coris Banque",
    numPiece: "Samche/2026/010",
    idCommande: "OAC-2609-002"
  },
  {
    ligne: 18,
    date: "07/09/2026",
    dateMs: 1788796800000,
    categorie: "Approvisionnement",
    sousCategorie: "Achat d'œufs à couver",
    montant: 7617500,
    libelle: "Poussin Mali",
    sourcePaiement: "Coris Banque",
    numPiece: "Poussin Mali",
    idCommande: "OAC-2609-001"
  }
];

export const INITIAL_CLIENTS: Client[] = [
  { index: 2, prenom: "Soumi", nom: "Maiga", ville: "Bamako", telephone: "22374478880", email: "", label: "Soumi Maiga" },
  { index: 3, prenom: "Sarafa", nom: "Yekini", ville: "Koutiala", telephone: "77525630", email: "", label: "Sarafa Yekini" },
  { index: 4, prenom: "Sacko", nom: "AfrcanDream", ville: "Bamako", telephone: "79476879", email: "", label: "Sacko AfrcanDream" },
  { index: 5, prenom: "Sidibé", nom: "france", ville: "Bamako", telephone: "+33646276491", email: "", label: "Sidibé france" },
  { index: 6, prenom: "Idrissa", nom: "Sacko (Sidibé)", ville: "BAMAKO", telephone: "76237569", email: "sackoidrissa56@gmail.com", label: "Idrissa Sacko (Sidibé)" },
  { index: 7, prenom: "NENE", nom: "FOFANA", ville: "KOUTIALA", telephone: "72056936", email: "", label: "NENE FOFANA" },
  { index: 8, prenom: "", nom: "Ballo", ville: "BAMAKO", telephone: "68686894", email: "", label: "Ballo" },
  { index: 9, prenom: "Mr", nom: "Yalcouyé", ville: "Bamako", telephone: "92542506", email: "", label: "Mr Yalcouyé" },
  { index: 10, prenom: "Ferme", nom: "Lika", ville: "Bamako", telephone: "72114816", email: "", label: "Ferme Lika" },
  { index: 11, prenom: "Couvoir", nom: "SamChe", ville: "Bamako", telephone: "", email: "couvoirsamche@gmail.com", label: "Couvoir SamChe" },
  { index: 12, prenom: "Balla", nom: "Camara", ville: "Bamako", telephone: "76126919", email: "", label: "Balla Camara" },
  { index: 13, prenom: "Boubakar", nom: "BALLO", ville: "Sikasso", telephone: "72 56 24 80", email: "bouakarballo8@gmail.com", label: "Boubakar BALLO" },
  { index: 14, prenom: "SOUDIS", nom: "Soumaré", ville: "Bamako", telephone: "77389999", email: "", label: "SOUDIS Soumaré" },
  { index: 15, prenom: "Alou", nom: "Traoré", ville: "Yanfoila", telephone: "74584296", email: "", label: "Alou Traoré" }
];

export const INITIAL_FACTURES: Facture[] = [
  {
    ligne: 7,
    numero: "FAC-2026-007",
    date: "14/06/2026",
    client: "Mr Yalcouyé",
    telephone: "92542506",
    ville: "Bamako",
    refCmd: "CMD-2026-007",
    nbArticles: 1,
    montantHT: 975000,
    remisePct: 0,
    remiseVal: 0,
    tvaPct: 0,
    tvaVal: 0,
    total: 975000,
    modeReglement: "Virement",
    echeance: "14/07/2026",
    datePaiement: "",
    statut: "Emise",
    notes: "1500 poussins d'un jour race Ross 308"
  },
  {
    ligne: 6,
    numero: "FAC-2026-006",
    date: "10/06/2026",
    client: "Soumi Maiga",
    telephone: "66565055",
    ville: "Bamako",
    refCmd: "CMD-2026-006",
    nbArticles: 1,
    montantHT: 1200000,
    remisePct: 0,
    remiseVal: 0,
    tvaPct: 0,
    tvaVal: 0,
    total: 1200000,
    modeReglement: "Virement",
    echeance: "09/07/2026",
    datePaiement: "10/06/2026",
    statut: "Payée",
    notes: "Règlement reçu par virement Coris"
  },
  {
    ligne: 5,
    numero: "FAC-2026-005",
    date: "02/06/2026",
    client: "Soumi Maiga",
    telephone: "66565055",
    ville: "Bamako",
    refCmd: "CMD-2026-005",
    nbArticles: 1,
    montantHT: 600,
    remisePct: 0,
    remiseVal: 0,
    tvaPct: 0,
    tvaVal: 0,
    total: 600,
    modeReglement: "Virement",
    echeance: "02/07/2026",
    datePaiement: "",
    statut: "Emise",
    notes: "Solde complémentaire"
  },
  {
    ligne: 4,
    numero: "FAC-2026-004",
    date: "06/05/2026",
    client: "Sarafa Yekini",
    telephone: "77525630",
    ville: "Koutiala",
    refCmd: "CMD-2026-004",
    nbArticles: 1,
    montantHT: 1200000,
    remisePct: 0,
    remiseVal: 0,
    tvaPct: 0,
    tvaVal: 0,
    total: 1200000,
    modeReglement: "Virement",
    echeance: "05/06/2026",
    datePaiement: "",
    statut: "Emise",
    notes: "Livraison Koutiala"
  },
  {
    ligne: 3,
    numero: "FAC-2026-003",
    date: "06/05/2026",
    client: "NENE FOFANA",
    telephone: "72056936",
    ville: "KOUTIALA",
    refCmd: "CMD-2026-003",
    nbArticles: 1,
    montantHT: 600000,
    remisePct: 0,
    remiseVal: 0,
    tvaPct: 0,
    tvaVal: 0,
    total: 600000,
    modeReglement: "Virement",
    echeance: "05/06/2026",
    datePaiement: "",
    statut: "Emise",
    notes: "Commande 1000 poussins"
  },
  {
    ligne: 2,
    numero: "FAC-2026-001",
    date: "06/05/2026",
    client: "Sacko AfrcanDream",
    telephone: "79476879",
    ville: "Bamako",
    refCmd: "CMD-2026-001",
    nbArticles: 1,
    montantHT: 1200000,
    remisePct: 0,
    remiseVal: 0,
    tvaPct: 0,
    tvaVal: 0,
    total: 1200000,
    modeReglement: "Virement",
    echeance: "05/06/2026",
    datePaiement: "",
    statut: "Emise",
    notes: "Première commande client test"
  }
];

export const INITIAL_BORDEREAUX: Bordereau[] = [
  {
    numero: "BL-2026-001",
    date: "14/06/2026",
    client: "Mr Yalcouyé",
    adresseClient: "Bamako",
    refCmd: "CMD-2026-007",
    lignes: [
      { designation: "Poussins d'un jour Chair (Ross 308)", qte: 1500, unite: "pcs", observations: "Livraison effectuée" }
    ],
    statut: "Livré"
  },
  {
    numero: "BL-2026-002",
    date: "10/06/2026",
    client: "Soumi Maiga",
    adresseClient: "Bamako",
    refCmd: "CMD-2026-006",
    lignes: [
      { designation: "Poussins d'un jour Chair (Ross 308)", qte: 2000, unite: "pcs", observations: "Livraison conforme" }
    ],
    statut: "Livré"
  }
];

export const PRODUITS_PRIX = [
  { nom: "Poussins d'un jour Chair (Ross 308)", prix: 600 },
  { nom: "Poussins Sasso", prix: 650 },
  { nom: "Poussins Galor", prix: 625 },
  { nom: "Poussins Pondeuses", prix: 750 },
  { nom: "Poussins Pintade", prix: 700 },
  { nom: "Alvéoles", prix: 3750 },
  { nom: "Cartons d'emballage poussins", prix: 1500 },
  { nom: "Aliment démarrage (50kg)", prix: 22500 }
];

export const INITIAL_VENTES: Vente[] = [
  {
    ligne: 4,
    date: "18/09/2026",
    dateEclosion: "03/10/2026",
    typeVente: "Poussins couvoir",
    client: "Ballo",
    produit: "Alvéoles",
    quantite: 2444,
    prixUnitaire: 3750,
    montant: 9165000,
    avance: 2000000,
    reliquat: 7165000,
    statutPaiement: "Avance",
    observation: "Acompte versé par chèque Coris"
  },
  {
    ligne: 5,
    date: "14/06/2026",
    dateEclosion: "14/06/2026",
    typeVente: "Poussins couvoir",
    client: "Mr Yalcouyé",
    produit: "Poussins d'un jour Chair (Ross 308)",
    quantite: 1500,
    prixUnitaire: 650,
    montant: 975000,
    avance: 0,
    reliquat: 975000,
    statutPaiement: "Non payee",
    observation: "1500 poussins race Ross 308"
  },
  {
    ligne: 6,
    date: "10/06/2026",
    dateEclosion: "10/06/2026",
    typeVente: "Poussins couvoir",
    client: "Soumi Maiga",
    produit: "Poussins d'un jour Chair (Ross 308)",
    quantite: 2000,
    prixUnitaire: 600,
    montant: 1200000,
    avance: 1200000,
    reliquat: 0,
    statutPaiement: "Payee",
    observation: "Règlement reçu par virement Coris"
  },
  {
    ligne: 7,
    date: "02/06/2026",
    dateEclosion: "02/06/2026",
    typeVente: "Poussins couvoir",
    client: "Soumi Maiga",
    produit: "Poussins d'un jour Chair (Ross 308)",
    quantite: 1000,
    prixUnitaire: 600,
    montant: 600000,
    avance: 0,
    reliquat: 600000,
    statutPaiement: "Non payee",
    observation: "Solde à régler à la livraison"
  },
  {
    ligne: 8,
    date: "06/05/2026",
    dateEclosion: "06/05/2026",
    typeVente: "Poussins couvoir",
    client: "Sarafa Yekini",
    produit: "Poussins d'un jour Chair (Ross 308)",
    quantite: 2000,
    prixUnitaire: 600,
    montant: 1200000,
    avance: 0,
    reliquat: 1200000,
    statutPaiement: "Non payee",
    observation: "Livraison Koutiala"
  },
  {
    ligne: 9,
    date: "06/05/2026",
    dateEclosion: "06/05/2026",
    typeVente: "Poussins couvoir",
    client: "NENE FOFANA",
    produit: "Poussins d'un jour Chair (Ross 308)",
    quantite: 1000,
    prixUnitaire: 600,
    montant: 600000,
    avance: 0,
    reliquat: 600000,
    statutPaiement: "Non payee",
    observation: "Commande 1000 poussins"
  },
  {
    ligne: 10,
    date: "06/05/2026",
    dateEclosion: "06/05/2026",
    typeVente: "Poussins couvoir",
    client: "Sacko AfrcanDream",
    produit: "Poussins d'un jour Chair (Ross 308)",
    quantite: 2000,
    prixUnitaire: 600,
    montant: 1200000,
    avance: 0,
    reliquat: 1200000,
    statutPaiement: "Non payee",
    observation: "Première commande client test"
  }
];

export const INITIAL_CAISSE: MouvementCaisse[] = [
  {
    ligne: 5,
    date: "18/09/2026",
    type: "Frais divers",
    detail: "--",
    entree: 0,
    sortie: 200000,
    solde: -200000,
    observation: ""
  },
  {
    ligne: 6,
    date: "18/09/2026",
    type: "Encaissement vente",
    detail: "--",
    entree: 400000,
    sortie: 0,
    solde: 200000,
    observation: ""
  }
];

export const INITIAL_COMMANDES_POUSSINS: CommandePoussin[] = [
  {
    id: "CMD-20260915-151823",
    date: "15/09/2026",
    prenom: "Boubakar",
    nom: "BALLO",
    tel: "+223 72 56 24 80",
    ville: "Sikasso",
    email: "bouakarballo8@gmail.com",
    typeProduit: "Chairs",
    dateEclosion: "04/10/2026",
    quantite: 7000,
    prixUnitaire: 800,
    total: 5600000,
    statut: "Confirmée",
    notes: "Paiement Obligatoire de 50% dans une semaine."
  },
  {
    id: "CMD-20260915-152813",
    date: "15/09/2026",
    prenom: "SOUDIS",
    nom: "Soumaré",
    tel: "+223 77 38 99 99",
    ville: "Bamako",
    email: "",
    typeProduit: "Chairs",
    dateEclosion: "04/10/2026",
    quantite: 4500,
    prixUnitaire: 600,
    total: 2700000,
    statut: "Confirmée",
    notes: ""
  },
  {
    id: "CMD-20260920-182224",
    date: "20/09/2026",
    prenom: "Alou",
    nom: "Traoré",
    tel: "+223 74 58 42 96",
    ville: "Yanfoila",
    email: "",
    typeProduit: "Chairs",
    dateEclosion: "07/10/2026",
    quantite: 3000,
    prixUnitaire: 600,
    total: 1800000,
    statut: "En attente",
    notes: ""
  },
  {
    id: "CMD-20260920-183311",
    date: "20/09/2026",
    prenom: "Boubakar",
    nom: "BALLO",
    tel: "+223 72 56 24 80",
    ville: "Sikasso",
    email: "bouakarballo8@gmail.com",
    typeProduit: "Chairs",
    dateEclosion: "07/10/2026",
    quantite: 7000,
    prixUnitaire: 800,
    total: 5600000,
    statut: "En attente",
    notes: ""
  },
  {
    id: "CMD-20260920-184621",
    date: "20/09/2026",
    prenom: "Soumi",
    nom: "Maiga",
    tel: "+223 74 47 88 80",
    ville: "Bamako",
    email: "",
    typeProduit: "Chairs",
    dateEclosion: "07/10/2026",
    quantite: 2500,
    prixUnitaire: 600,
    total: 1500000,
    statut: "Confirmée",
    notes: ""
  },
  {
    id: "CMD-20260920-185012",
    date: "20/09/2026",
    prenom: "Sarafa",
    nom: "Yekini",
    tel: "+223 77 52 56 30",
    ville: "Koutiala",
    email: "",
    typeProduit: "Chairs",
    dateEclosion: "04/10/2026",
    quantite: 2750,
    prixUnitaire: 600,
    total: 1650000,
    statut: "Confirmée",
    notes: ""
  }
];

export function getStoredData<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(`samche_${key}`);
    if (raw) return JSON.parse(raw);
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
