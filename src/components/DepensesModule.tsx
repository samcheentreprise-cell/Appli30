import React, { useState, useMemo, useEffect } from 'react';
import { Depense, OAC } from '../types';
import { getSourcesPaiement, callApi } from '../services/googleSheet';
import { JustificatifsDepense, cleJustificatif } from './JustificatifsDepense';

export const CATEGORIES_SOUS_CATEGORIES: {
  categorie: string;
  items: { sousCategorie: string; idRequis?: boolean }[];
}[] = [
  {
    categorie: 'Approvisionnement',
    items: [
      { sousCategorie: "Achat d'œufs à couver", idRequis: true },
      { sousCategorie: "Transport des œufs", idRequis: true },
      { sousCategorie: "Dédouanement œufs importés", idRequis: true },
      { sousCategorie: "Cartons/plateaux emballage" },
      { sousCategorie: "Transport des poussins" },
    ],
  },
  {
    categorie: 'Personnel',
    items: [
      { sousCategorie: "Salaires opérateurs production" },
      { sousCategorie: "Salaires personnel admin" },
      { sousCategorie: "Repas/collations employés" },
      { sousCategorie: "Formation personnel" },
    ],
  },
  {
    categorie: 'Locaux/Sécurité',
    items: [
      { sousCategorie: "Location couvoir" },
      { sousCategorie: "Gardiennage 24h" },
      { sousCategorie: "Caméras surveillance" },
    ],
  },
  {
    categorie: 'Services externes',
    items: [
      { sousCategorie: "Nettoyage locaux" },
      { sousCategorie: "Enlèvement déchets" },
      { sousCategorie: "Fournitures admin diverses" },
    ],
  },
  {
    categorie: 'Énergie',
    items: [
      { sousCategorie: "Électricité" },
      { sousCategorie: "Carburant" },
      { sousCategorie: "Huile/lubrifiants" },
    ],
  },
  {
    categorie: 'Maintenance',
    items: [
      { sousCategorie: "Entretien courant machines" },
      { sousCategorie: "Remplacement pièces usées" },
      { sousCategorie: "Réparations techniques" },
      { sousCategorie: "Produits désinfection" },
      { sousCategorie: "Petits outils/consommables" },
    ],
  },
  {
    categorie: 'Investissements',
    items: [
      { sousCategorie: "Amortissement incubateurs" },
      { sousCategorie: "Amortissement bâtiments" },
      { sousCategorie: "Achat nouveaux équipements" },
      { sousCategorie: "Travaux construction/rénovation" },
    ],
  },
  {
    categorie: 'Commercial',
    items: [
      { sousCategorie: "Publicité/marketing digital" },
      { sousCategorie: "Études marché/prospection" },
    ],
  },
  {
    categorie: 'Administration',
    items: [
      { sousCategorie: "Frais administratifs" },
      { sousCategorie: "Télécom & Internet" },
      { sousCategorie: "Impôts et taxes" },
    ],
  },
  {
    categorie: 'Finance',
    items: [
      { sousCategorie: "Frais bancaires" },
      { sousCategorie: "Agios & commissions" },
    ],
  },
];

export const SOURCES_PAIEMENT = [
  'Caisse',
  'Coris Banque',
  'Orange Money',
  'Moov Money',
  'Espèces',
  'Virement',
];

interface DepensesModuleProps {
  depenses: Depense[];
  oacList?: OAC[];
  onAddDepense: (depense: Depense) => void;
  onUpdateDepense?: (depense: Depense) => void;
  onDeleteDepense?: (ligne: number) => void;
  onClose?: () => void;
}

export const DepensesModule: React.FC<DepensesModuleProps> = ({
  depenses,
  oacList = [],
  onAddDepense,
  onUpdateDepense,
  onDeleteDepense,
  onClose,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // FORM STATE  (formules inchangées)
  // ─────────────────────────────────────────────────────────────────
  const [selectedLigne, setSelectedLigne] = useState<number | null>(null);
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [numPiece, setNumPiece] = useState<string>('');
  const [sousCategorie, setSousCategorie] = useState<string>('');
  const [categorie, setCategorie] = useState<string>('');
  const [libelle, setLibelle] = useState<string>('');
  const [montant, setMontant] = useState<string>('');
  const [sourcePaiement, setSourcePaiement] = useState<string>('');
  const [sourcesPaiement, setSourcesPaiement] = useState<string[]>([]);

  // UI visibility (nouveau)
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      const sources = await getSourcesPaiement();
      if (sources && sources.length > 0) {
        setSourcesPaiement(sources);
        console.log('[Depenses] Sources de paiement chargées:', sources);
      } else {
        setSourcesPaiement(['Especes', 'Cheque', 'Virement', 'Carte', 'Mobile Money', 'Autre']);
      }
    })();
  }, []);
  const [idCommande, setIdCommande] = useState<string>('');

  // Popup Sous-catégorie state
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupSearch, setPopupSearch] = useState('');

  // Table Filters State
  const [filterText, setFilterText] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterDate1, setFilterDate1] = useState('');
  const [filterDate2, setFilterDate2] = useState('');

  // Notification Banner
  const [notif, setNotif] = useState<{ text: string; ok: boolean } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Dépense enregistrée actuellement sélectionnée (pour ses justificatifs)
  const depenseSelectionnee = selectedLigne !== null
    ? depenses.find((d, idx) => (d.ligne !== undefined ? d.ligne : idx + 16) === selectedLigne)
    : undefined;

  // Nombre de justificatifs par dépense (badges du tableau)
  const [justifCounts, setJustifCounts] = useState<Record<string, number>>({});
  const chargerJustifCounts = async () => {
    try {
      const res = await callApi('depenses.justificatifsCles', {}, 'GET');
      // ✅ CORRECTION : la réponse est enveloppée dans { success, data: { success, counts } }
      const inner = res?.data || res;
      if (res?.success || inner?.success) setJustifCounts(inner?.counts || res?.counts || {});
    } catch {
      // Le badge est facultatif : on ignore l'erreur
    }
  };
  useEffect(() => {
    chargerJustifCounts();
  }, [depenses]);

  // ─────────────────────────────────────────────────────────────────
  // FICHIERS JUSTIFICATIFS de la dépense sélectionnée
  // ─────────────────────────────────────────────────────────────────
  // Quand l'utilisateur sélectionne une dépense, on charge la liste de
  // ses justificatifs pour afficher un indicateur immédiat en haut du
  // formulaire avec liens directs pour ouvrir chaque fichier.
  interface JustifFichier { nom: string; type: string; url: string; auteur?: string; }
  const [justifSelectedFiles, setJustifSelectedFiles] = useState<JustifFichier[]>([]);
  const [justifSelectedLoading, setJustifSelectedLoading] = useState(false);

  useEffect(() => {
    if (!depenseSelectionnee) {
      setJustifSelectedFiles([]);
      return;
    }
    const cle = cleJustificatif(depenseSelectionnee);
    if (!cle) {
      setJustifSelectedFiles([]);
      return;
    }
    setJustifSelectedLoading(true);
    callApi('depenses.justificatifs', { cle }, 'GET')
      .then((res) => {
        // ✅ CORRECTION : la réponse est enveloppée dans { success, data: { success, fichiers } }
        const inner = res?.data || res;
        if (res?.success || inner?.success) setJustifSelectedFiles(inner?.fichiers || res?.fichiers || []);
        else setJustifSelectedFiles([]);
      })
      .catch(() => setJustifSelectedFiles([]))
      .finally(() => setJustifSelectedLoading(false));
  }, [depenseSelectionnee, justifCounts]);

  const showNotif = (text: string, ok: boolean) => {
    setNotif({ text, ok });
    setTimeout(() => setNotif(null), 5000);
  };

  const isAchatOacSubCat = (subCat: string): boolean => {
    const lower = (subCat || '').toLowerCase().trim();
    return (
      lower.includes("achat d'oeuf") ||
      lower.includes("achat d'œuf") ||
      lower.includes('achat oeuf') ||
      lower.includes('achat œuf')
    );
  };

  const isAchatOac = useMemo(() => isAchatOacSubCat(sousCategorie), [sousCategorie]);

  const isIdComRequired = useMemo(() => {
    if (!sousCategorie) return false;
    const lower = sousCategorie.toLowerCase();
    return (
      isAchatOacSubCat(sousCategorie) ||
      lower.includes('transport des oeuf') ||
      lower.includes('transport des œuf') ||
      lower.includes('dedouanement') ||
      lower.includes('dédouanement') ||
      lower.includes('transit')
    );
  }, [sousCategorie]);

  const parseDateToMs = (d?: string, fallbackMs?: number): number => {
    if (d) {
      const parts = String(d).trim().split('/').map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(d).trim())) {
        const ms = new Date(String(d).trim()).getTime();
        if (!isNaN(ms)) return ms;
      }
    }
    return fallbackMs && !isNaN(fallbackMs) ? fallbackMs : 0;
  };

  const parseOacIdOrder = (id: string): number => {
    const m = String(id || '').match(/OAC-(\d{4})-(\d+)/i);
    if (!m) return 0;
    return parseInt(m[1], 10) * 10000 + parseInt(m[2], 10);
  };

  // Prochain ID OAC auto-généré en vérifiant à la fois oacList ET depenses
  const nextAutoOacId = useMemo(() => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `OAC-${yy}${mm}-`;

    const allIds = new Set<string>();
    oacList.forEach((o) => {
      if (o.id) allIds.add(String(o.id).trim());
    });
    depenses.forEach((d) => {
      if (d.idCommande) allIds.add(String(d.idCommande).trim());
    });

    let nextNum = 1;
    allIds.forEach((id) => {
      if (id.startsWith(prefix)) {
        const num = parseInt(id.split('-')[2] || '0', 10);
        if (!isNaN(num) && num >= nextNum) {
          nextNum = num + 1;
        }
      }
    });
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }, [oacList, depenses]);

  interface OacChoiceItem {
    id: string;
    libelle: string;
    dateStr: string;
    sortMs: number;
    statutLabel: string;
    meta: string;
    ligneOrder: number;
  }

  // Tous les lots OAC enrichis avec leur libellé de demande, triés du plus récent au plus ancien
  const allOacChoices = useMemo<OacChoiceItem[]>(() => {
    const idSet = new Set<string>();
    oacList.forEach((o) => {
      const id = String(o.id || '').trim();
      if (id && id !== '__NOUVEAU__') idSet.add(id);
    });
    depenses.forEach((d) => {
      const id = String(d.idCommande || '').trim();
      if (id && id !== '__NOUVEAU__') idSet.add(id);
    });

    const items: OacChoiceItem[] = [];
    idSet.forEach((id) => {
      const oac = oacList.find((o) => String(o.id || '').trim() === id);
      const relatedDeps = depenses.filter((d) => String(d.idCommande || '').trim() === id);
      const achatDep = relatedDeps.find((d) => isAchatOacSubCat(d.sousCategorie || ''));
      const fallbackDep = relatedDeps[0];

      const primaryLibelle =
        (achatDep?.libelle && achatDep.libelle.trim()) ||
        (oac
          ? `Commande ${oac.type || 'OAC'} ${oac.race || ''} — ${oac.cartons || 0} cartons (${oac.fournisseur || 'Fournisseur N/A'})`
          : '') ||
        (fallbackDep?.libelle && fallbackDep.libelle.trim()) ||
        fallbackDep?.sousCategorie ||
        'Demande OAC';

      const dateStr = achatDep?.date || oac?.date || fallbackDep?.date || '--';
      const sortMs =
        parseDateToMs(achatDep?.date, achatDep?.dateMs) ||
        parseDateToMs(oac?.date) ||
        parseDateToMs(fallbackDep?.date, fallbackDep?.dateMs);

      const metaParts: string[] = [];
      if (oac?.fournisseur) metaParts.push(oac.fournisseur);
      if (oac?.cartons) metaParts.push(`${oac.cartons} cartons`);
      if (oac?.race) metaParts.push(oac.race);
      if (!oac && achatDep?.montant) {
        metaParts.push(`${Number(achatDep.montant).toLocaleString('fr-FR')} FCFA`);
      }

      const statutLabel = oac?.statut
        ? oac.statut
        : achatDep
          ? 'Achat OAC enregistré'
          : 'Dépense OAC';

      const ligneOrder = Math.max(oac?.ligne ?? 0, achatDep?.ligne ?? 0, fallbackDep?.ligne ?? 0);

      items.push({
        id,
        libelle: primaryLibelle,
        dateStr,
        sortMs,
        statutLabel,
        meta: metaParts.join(' • '),
        ligneOrder,
      });
    });

    return items.sort((a, b) => {
      if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
      const idDiff = parseOacIdOrder(b.id) - parseOacIdOrder(a.id);
      if (idDiff !== 0) return idDiff;
      return b.ligneOrder - a.ligneOrder;
    });
  }, [oacList, depenses]);

  // Limite stricte aux 4 ID les plus récents
  const recentOacChoices = useMemo(() => allOacChoices.slice(0, 4), [allOacChoices]);

  const fmt = (v: number | string) => {
    if (v === '' || v === null || v === undefined) return '--';
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? String(v) : n.toLocaleString('fr-FR') + ' FCFA';
  };

  const loadRow = (d: Depense, idx: number) => {
    const ligneNum = d.ligne !== undefined ? d.ligne : idx + 16;
    setSelectedLigne(ligneNum);
    if (d.date) {
      const parts = d.date.split('/');
      if (parts.length === 3) {
        setDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        setDate(d.date);
      }
    }
    setNumPiece(d.numPiece || '');
    setSousCategorie(d.sousCategorie || '');
    setCategorie(d.categorie || '');
    setLibelle(d.libelle || '');
    setMontant(d.montant ? String(d.montant) : '');
    setSourcePaiement(d.sourcePaiement || '');
    setIdCommande(d.idCommande || '');
    setShowForm(true);
  };

  const raz = () => {
    setSelectedLigne(null);
    const d = new Date();
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setNumPiece('');
    setSousCategorie('');
    setCategorie('');
    setLibelle('');
    setMontant('');
    setSourcePaiement('');
    setIdCommande('');
  };

  const handleSelectSousCat = (item: { sousCategorie: string; idRequis?: boolean }, catName: string) => {
    setSousCategorie(item.sousCategorie);
    setCategorie(catName);
    if (isAchatOacSubCat(item.sousCategorie)) {
      // Pour "Achat d'œufs à couver" : création automatique d'un nouvel ID
      if (!isRowSelected || !idCommande || idCommande === '__NOUVEAU__') {
        setIdCommande(nextAutoOacId);
      }
    } else if (item.idRequis) {
      // Pour Transport / Dédouanement : l'utilisateur doit choisir l'ID correspondant dans la liste
      if (!isRowSelected || idCommande === '__NOUVEAU__' || idCommande === nextAutoOacId) {
        setIdCommande('');
      }
    } else {
      setIdCommande('');
    }
    setIsPopupOpen(false);
  };

  const handleSave = () => {
    if (!date) {
      showNotif('Veuillez renseigner la date.', false);
      return;
    }
    if (!sousCategorie) {
      showNotif('Veuillez sélectionner une sous-catégorie.', false);
      return;
    }
    if (!montant || parseFloat(montant) <= 0) {
      showNotif('Veuillez renseigner un montant valide.', false);
      return;
    }
    if (!sourcePaiement) {
      showNotif('Veuillez sélectionner une source de paiement.', false);
      return;
    }

    let finalIdCom = idCommande;
    if (isAchatOac) {
      finalIdCom = idCommande && idCommande !== '__NOUVEAU__' ? idCommande : nextAutoOacId;
    } else if (isIdComRequired) {
      if (!finalIdCom || finalIdCom === '__NOUVEAU__') {
        showNotif("Veuillez sélectionner l'ID commande correspondant dans la liste.", false);
        return;
      }
    } else {
      finalIdCom = '';
    }

    const dateParts = date.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : date;

    const newDepense: Depense = {
      ligne: depenses.length + 16,
      date: formattedDate,
      dateMs: new Date(date).getTime(),
      categorie: categorie || 'Approvisionnement',
      sousCategorie,
      montant: parseFloat(montant) || 0,
      sourcePaiement,
      libelle: libelle || sousCategorie,
      numPiece,
      idCommande: finalIdCom,
    };

    onAddDepense(newDepense);
    showNotif(
      `Dépense enregistrée${finalIdCom ? ` (${finalIdCom})` : ''} : ${sousCategorie} — ${parseFloat(montant).toLocaleString('fr-FR')} FCFA`,
      true
    );
    raz();
    setShowForm(false);
  };

  const handleMod = () => {
    if (selectedLigne === null) return;
    if (!date || !sousCategorie || !montant || !sourcePaiement) {
      showNotif('Veuillez remplir tous les champs obligatoires.', false);
      return;
    }

    let finalIdCom = idCommande;
    if (isAchatOac) {
      finalIdCom = idCommande && idCommande !== '__NOUVEAU__' ? idCommande : nextAutoOacId;
    } else if (isIdComRequired) {
      if (!finalIdCom || finalIdCom === '__NOUVEAU__') {
        showNotif("Veuillez sélectionner l'ID commande correspondant dans la liste.", false);
        return;
      }
    } else {
      finalIdCom = '';
    }

    const dateParts = date.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : date;

    const updated: Depense = {
      ligne: selectedLigne,
      date: formattedDate,
      dateMs: new Date(date).getTime(),
      categorie: categorie || 'Approvisionnement',
      sousCategorie,
      montant: parseFloat(montant) || 0,
      sourcePaiement,
      libelle: libelle || sousCategorie,
      numPiece,
      idCommande: finalIdCom,
    };

    if (onUpdateDepense) {
      onUpdateDepense(updated);
    } else {
      onAddDepense(updated);
    }
    showNotif(
      `Dépense modifiée${finalIdCom ? ` (${finalIdCom})` : ''} : ${sousCategorie} — ${parseFloat(montant).toLocaleString('fr-FR')} FCFA`,
      true
    );
    raz();
    setShowForm(false);
  };

  const confirmDelete = () => {
    if (selectedLigne === null) return;
    setDeleteConfirmOpen(false);
    if (onDeleteDepense) {
      onDeleteDepense(selectedLigne);
    }
    showNotif('Dépense supprimée avec succès.', true);
    raz();
    setShowForm(false);
  };

  const filteredDepenses = useMemo(() => {
    const q = filterText.toLowerCase().trim();
    return depenses.filter((r) => {
      let matchText = true;
      if (q) {
        const searchStr = `${r.date || ''} ${r.sousCategorie || ''} ${r.libelle || ''} ${r.sourcePaiement || ''} ${r.numPiece || ''} ${r.idCommande || ''}`.toLowerCase();
        matchText = searchStr.includes(q);
      }
      let matchCat = true;
      if (filterCat) {
        matchCat = r.categorie === filterCat;
      }
      let matchDate = true;
      if (filterDate1 || filterDate2) {
        const p = (r.date || '').split('/');
        const rowISO = p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
        if (filterDate1 && rowISO < filterDate1) matchDate = false;
        if (filterDate2 && rowISO > filterDate2) matchDate = false;
      }
      return matchText && matchCat && matchDate;
    });
  }, [depenses, filterText, filterCat, filterDate1, filterDate2]);

  // Convertit une date "jj/mm/aaaa" en timestamp pour le tri
  const dateToMs = (s: string): number => {
    const [j, m, a] = (s || '').split('/').map(Number);
    if (!j || !m || !a) return 0;
    return new Date(a, m - 1, j).getTime();
  };

  // Tri : de la plus récente à la plus ancienne
  const depensesTriees = useMemo(() => {
    return [...filteredDepenses].sort((a, b) => {
      const diff = dateToMs(b.date) - dateToMs(a.date);
      if (diff !== 0) return diff;
      return (b.ligne ?? 0) - (a.ligne ?? 0);
    });
  }, [filteredDepenses]);

  // Liste affichée : limitée aux 10 dépenses les plus récentes
  const LIMITE_LISTE = 10;
  const depensesAffichees = useMemo(
    () => depensesTriees.slice(0, LIMITE_LISTE),
    [depensesTriees]
  );

  const allCategoriesForFilter = useMemo(() => {
    return Array.from(new Set(CATEGORIES_SOUS_CATEGORIES.map((c) => c.categorie)));
  }, []);

  const filteredPopupCategories = useMemo(() => {
    const q = popupSearch.toLowerCase().trim();
    if (!q) return CATEGORIES_SOUS_CATEGORIES;
    return CATEGORIES_SOUS_CATEGORIES.map((cat) => ({
      categorie: cat.categorie,
      items: cat.items.filter(
        (it) => it.sousCategorie.toLowerCase().includes(q) || cat.categorie.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [popupSearch]);

  const isRowSelected = selectedLigne !== null;
  const totalFiltre = useMemo(
    () => filteredDepenses.reduce((s, d) => s + (Number(d.montant) || 0), 0),
    [filteredDepenses]
  );

  // ─────────────────────────────────────────────────────────────────
  // DÉPENSE "FORMULAIRE" pour les justificatifs en mode création
  // ─────────────────────────────────────────────────────────────────
  // Quand l'utilisateur saisit une NOUVELLE dépense (aucune ligne
  // sélectionnée), on construit un objet Depense à partir des champs
  // du formulaire pour pouvoir lier des justificatifs AVANT la
  // sauvegarde. La clé de liaison est calculée depuis ces valeurs.
  //
  // ⚠️ La date du formulaire est au format YYYY-MM-DD (input HTML),
  //    mais la date sauvegardée est au format DD/MM/YYYY. On convertit
  //    ici pour que la clé corresponde à celle de la dépense sauvegardée.
  //
  // Conditions pour activer le panel justificatifs en mode création :
  //   - sousCategorie renseignée
  //   - montant renseigné et > 0
  //   - date renseignée
  const formDepense: Depense | null = useMemo(() => {
    if (isRowSelected) return null; // Mode édition : on utilise depenseSelectionnee
    if (!showForm) return null;     // Formulaire non visible
    if (!sousCategorie || !montant || !date) return null;
    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum <= 0) return null;

    // Conversion YYYY-MM-DD → DD/MM/YYYY (format de la dépense sauvegardée)
    const dateParts = date.split('-');
    const formattedDate = dateParts.length === 3
      ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
      : date;

    return {
      date: formattedDate,
      sousCategorie,
      montant: montantNum,
      libelle: libelle || sousCategorie,
      categorie: categorie || '',
      sourcePaiement: sourcePaiement || '',
    };
  }, [isRowSelected, showForm, date, sousCategorie, montant, libelle, categorie, sourcePaiement]);

  // Ouvre le formulaire vierge
  const openNewForm = () => {
    raz();
    setShowForm(true);
  };

  // Ferme le formulaire et revient à la liste
  const closeForm = () => {
    raz();
    setShowForm(false);
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-5xl mx-auto font-sans animate-fade-in text-[#1a2332]">
      {/* Notification Banner */}
      {notif && (
        <div
          className={`sticky top-2 z-50 p-3 rounded-xl text-center font-bold text-sm shadow-xl transition-all ${
            notif.ok
              ? 'bg-gradient-to-r from-[#1E8449] to-[#27AE60] text-white'
              : 'bg-gradient-to-r from-[#922B21] to-[#E74C3C] text-white'
          }`}
        >
          {notif.ok ? '✔ ' : '✖ '}
          {notif.text}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CARTE PRINCIPALE (vue liste + formulaire déroulant)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        {/* ─────────── BARRE D'OUTILS ─────────── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Gauche : Titre + compteur */}
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1B4F72] to-[#2E86C1] text-white flex items-center justify-center text-lg shadow-sm">
                💰
              </span>
              <div>
                <h2 className="text-base font-bold text-[#1B4F72] tracking-tight leading-tight">
                  Dépenses
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {depenses.length} enregistrement{depenses.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Centre : Recherche */}
            <div className="relative flex-1 md:max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Rechercher..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border-2 border-[#e0e6ec] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white transition"
              />
            </div>

            {/* Droite : Boutons d'action */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase border transition flex items-center gap-1.5 ${
                  showFilters
                    ? 'bg-[#1B4F72] text-white border-[#1B4F72]'
                    : 'bg-white text-[#2c3e50] border-[#d5dde5] hover:bg-[#eaf2f8]'
                }`}
                title="Afficher / masquer les filtres avancés (catégorie, dates)"
              >
                <span>✱</span>
                <span>Filtrer</span>
              </button>
              <button
                type="button"
                onClick={openNewForm}
                className="px-3 py-2 rounded-lg text-xs font-bold uppercase text-white shadow-sm transition hover:opacity-90 flex items-center gap-1.5 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #1B4F72, #2E86C1)' }}
                title="Ouvrir le formulaire pour enregistrer une nouvelle dépense"
              >
                <span>+</span>
                <span>Ajouter une dépense</span>
              </button>
              <button
                type="button"
                onClick={onClose || closeForm}
                className="px-3 py-2 rounded-lg text-xs font-bold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition flex items-center gap-1.5"
                title="Fermer le module des dépenses"
              >
                <span>✕</span>
                <span className="hidden sm:inline">Quitter</span>
              </button>
            </div>
          </div>

          {/* Filtres avancés (collapsible) */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-slate-100 animate-slide-up">
              <div className="text-[10px] font-bold uppercase text-slate-500 mb-2 tracking-wider">
                Filtrer les dépenses
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                  className="px-3 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                  title="Filtrer par catégorie de dépense"
                >
                  <option value="">Toutes catégories</option>
                  {allCategoriesForFilter.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  title="Date de début"
                  value={filterDate1}
                  onChange={(e) => setFilterDate1(e.target.value)}
                  className="px-3 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1]"
                />
                <input
                  type="date"
                  title="Date de fin"
                  value={filterDate2}
                  onChange={(e) => setFilterDate2(e.target.value)}
                  className="px-3 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1]"
                />
                <button
                  onClick={() => {
                    setFilterText('');
                    setFilterCat('');
                    setFilterDate1('');
                    setFilterDate2('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition"
                  title="Effacer tous les filtres"
                >
                  ↺ Réinitialiser
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─────────── FORMULAIRE DÉROULANT ─────────── */}
        {showForm && (
          <div className="border-b border-slate-200 bg-gradient-to-br from-[#f8fafb] to-white animate-slide-up">
            {/* Form Header */}
            <div className="px-5 sm:px-6 py-3 bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{isRowSelected ? '✎' : '➕'}</span>
                <h3 className="text-sm font-bold tracking-tight">
                  {isRowSelected ? 'Modifier la dépense' : 'Nouvelle dépense'}
                </h3>
                {isRowSelected && (
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                    Ligne #{selectedLigne}
                  </span>
                )}
              </div>
              <button
                onClick={closeForm}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white font-bold transition"
                title="Fermer le formulaire sans enregistrer"
              >
                ✕
              </button>
            </div>
            {!isRowSelected && (
              <div className="px-5 sm:px-6 py-2 bg-[#fef9e7] border-b border-[#f39c12]/30 text-[11px] text-[#7d6608] font-medium flex items-center gap-1.5">
                <span>💡</span>
                <span>Renseignez les champs ci-dessous puis cliquez sur <strong>Enregistrer</strong>. Les champs marqués <span className="text-[#E74C3C] font-bold">*</span> sont obligatoires.</span>
              </div>
            )}

            {/* ✅ Indicateur justificatifs — visible immédiatement quand on sélectionne une dépense */}
            {isRowSelected && depenseSelectionnee && (
              <div className={`px-5 sm:px-6 py-2.5 border-b flex items-center justify-between gap-3 ${
                justifSelectedFiles.length > 0
                  ? 'bg-[#eafaf1] border-[#27ae60]/30'
                  : justifSelectedLoading
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#fef5e7] border-[#f39c12]/30'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">
                    {justifSelectedLoading ? '⏳' : justifSelectedFiles.length > 0 ? '📎' : '📄'}
                  </span>
                  <div className="min-w-0">
                    {justifSelectedLoading ? (
                      <span className="text-[11px] text-slate-500 font-medium">
                        Vérification des justificatifs…
                      </span>
                    ) : justifSelectedFiles.length > 0 ? (
                      <>
                        <span className="text-[11px] font-bold text-[#1e8449]">
                          {justifSelectedFiles.length} justificatif{justifSelectedFiles.length > 1 ? 's' : ''} lié{justifSelectedFiles.length > 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-2 hidden sm:inline">
                          Cliquez sur un fichier pour l'ouvrir
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] font-bold text-[#b9770e]">
                        Aucun justificatif lié à cette dépense
                      </span>
                    )}
                  </div>
                </div>

                {/* Liens directs vers les fichiers (mode édition avec justificatifs) */}
                {justifSelectedFiles.length > 0 && !justifSelectedLoading && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                    {justifSelectedFiles.slice(0, 3).map((f, i) => {
                      const isImg = f.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(f.nom);
                      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.nom);
                      return (
                        <a
                          key={f.url + i}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Ouvrir : ${f.nom}`}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition border ${
                            isPdf
                              ? 'bg-[#c0392b]/10 text-[#c0392b] border-[#c0392b]/30 hover:bg-[#c0392b]/20'
                              : isImg
                                ? 'bg-[#2980b9]/10 text-[#2980b9] border-[#2980b9]/30 hover:bg-[#2980b9]/20'
                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <span className="text-xs">{isPdf ? '📕' : isImg ? '🖼️' : '📄'}</span>
                          <span className="truncate max-w-[100px]">
                            {f.nom.length > 14 ? f.nom.slice(0, 12) + '…' : f.nom}
                          </span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </a>
                      );
                    })}
                    {justifSelectedFiles.length > 3 && (
                      <span className="text-[10px] text-slate-500 font-medium px-1">
                        +{justifSelectedFiles.length - 3} autre{justifSelectedFiles.length - 3 > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Form Fields */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Row 1: Date + N° Pièce */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                    <span className="opacity-70">📅</span>
                    <span>Date</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                    <span className="opacity-70">📄</span>
                    <span>N° Pièce</span>
                  </label>
                  <input
                    type="text"
                    placeholder="N° facture/reçu"
                    value={numPiece}
                    onChange={(e) => setNumPiece(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fafbfc] border-2 border-[#d5dde5] rounded-lg text-sm text-[#1a2332] placeholder-slate-400 focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 2: Sous-catégorie + Catégorie (auto) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                    <span className="opacity-70">📁</span>
                    <span>Sous-catégorie</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <div
                    onClick={() => {
                      setPopupSearch('');
                      setIsPopupOpen(true);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-between cursor-pointer transition select-none shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[#1B4F72] truncate">
                        {sousCategorie || '-- Cliquer pour choisir --'}
                      </span>
                      {categorie && <span className="text-[11px] text-slate-500 font-normal">({categorie})</span>}
                    </div>
                    <span className="text-[#2E86C1] text-lg font-bold ml-2">▾</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                    <span className="opacity-70">🏷</span>
                    <span>Catégorie (auto)</span>
                  </label>
                  <div
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm font-bold text-[#1B4F72] select-none min-h-[42px] flex items-center"
                    style={{
                      background: 'linear-gradient(135deg, #eef2f7, #e8eef5)',
                      border: '2px solid #c8d5e0',
                    }}
                  >
                    {categorie || '--'}
                  </div>
                </div>
              </div>

              {/* Section Divider */}
              <div className="h-[1px] bg-gradient-to-r from-transparent via-[#c8d5e0] to-transparent my-2" />

              {/* Row 3: Libellé + Montant + Source de paiement */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                    <span className="opacity-70">📝</span>
                    <span>Libellé</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Description de la dépense"
                    value={libelle}
                    onChange={(e) => setLibelle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fafbfc] border-2 border-[#d5dde5] rounded-lg text-sm text-[#1a2332] placeholder-slate-400 focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                    <span className="opacity-70">💰</span>
                    <span>Montant (FCFA)</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder=""
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm font-black text-[#1a2332] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                    <span className="opacity-70">🏦</span>
                    <span>Source de paiement</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <select
                    value={sourcePaiement}
                    onChange={(e) => setSourcePaiement(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  >
                    <option value="">-- Choisir --</option>
                    {sourcesPaiement.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: ID Commande (Auto pour Achat OAC, sélection limitée à 4 récents pour Transport/Dédouanement) */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-bold text-[#2c3e50] flex items-center gap-1.5">
                    <span className="opacity-70">🔗</span>
                    <span>ID Commande (Lot OAC)</span>
                    {isIdComRequired && <span className="text-[#E74C3C]">*</span>}
                  </label>
                  {isAchatOac && (
                    <span className="text-[11px] font-bold text-[#1E8449] bg-[#eafaf1] border border-[#27AE60]/30 px-2 py-0.5 rounded-md">
                      Création automatique
                    </span>
                  )}
                  {isIdComRequired && !isAchatOac && (
                    <span className="text-[11px] font-medium text-slate-500">
                      4 lots les plus récents (du plus récent au plus ancien)
                    </span>
                  )}
                </div>

                {!isIdComRequired ? (
                  <div className="w-full md:w-1/2 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-[#eef2f7] text-[#7f8c8d] border-2 border-[#d5dde5]">
                    Non requis pour cette sous-catégorie
                  </div>
                ) : isAchatOac ? (
                  <div
                    className="rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #eafaf1, #f4fcf7)',
                      border: '2px solid #27AE60',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1.5 rounded-lg bg-[#1E8449] text-white font-mono text-sm font-black tracking-wide shadow-xs">
                        {idCommande && idCommande !== '__NOUVEAU__' ? idCommande : nextAutoOacId}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#1E8449]">
                          {isRowSelected && idCommande && idCommande !== nextAutoOacId
                            ? 'Identifiant OAC lié à cet achat'
                            : 'Nouvel ID OAC généré automatiquement'}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Cet identifiant servira ensuite à rattacher le transport et le dédouanement de ce lot.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-[#f39c12] bg-[#fefcf6] overflow-hidden">
                    {recentOacChoices.length === 0 ? (
                      <div className="p-4 text-xs text-amber-800 bg-amber-50/70">
                        Aucun lot OAC disponible. Enregistrez d&apos;abord une dépense « Achat d&apos;œufs à couver ».
                      </div>
                    ) : (
                      <div className="divide-y divide-amber-200/70">
                        {recentOacChoices.map((choice) => {
                          const selected = idCommande === choice.id;
                          return (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() => setIdCommande(choice.id)}
                              className={`w-full text-left px-3.5 py-2.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer ${
                                selected
                                  ? 'bg-[#eaf2f8] ring-2 ring-inset ring-[#2E86C1]'
                                  : 'hover:bg-[#fef5e7]'
                              }`}
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <span
                                  className={`mt-0.5 sm:mt-0 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    selected
                                      ? 'border-[#1B4F72] bg-[#1B4F72] text-white'
                                      : 'border-slate-400 bg-white'
                                  }`}
                                >
                                  {selected && <span className="text-[10px] font-black leading-none">✓</span>}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-xs font-black shrink-0 ${
                                    selected
                                      ? 'bg-[#1B4F72] text-white'
                                      : 'bg-slate-200 text-slate-800'
                                  }`}
                                >
                                  {choice.id}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 truncate">
                                    {choice.libelle}
                                  </div>
                                  {choice.meta && (
                                    <div className="text-[11px] text-slate-500 truncate">
                                      {choice.meta}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5 sm:text-right shrink-0 pl-7 sm:pl-0">
                                <span className="text-[11px] font-bold text-slate-700 tabular-nums">
                                  {choice.dateStr}
                                </span>
                                <span className="text-[10px] font-semibold text-[#1B4F72] bg-white px-2 py-0.5 rounded border border-slate-200">
                                  {choice.statutLabel}
                                </span>
                              </div>
                            </button>
                          );
                        })}

                        {/* Si modification d'une dépense ancienne dont l'ID n'est plus dans les 4 plus récents */}
                        {isRowSelected &&
                          idCommande &&
                          idCommande !== '__NOUVEAU__' &&
                          !recentOacChoices.some((c) => c.id === idCommande) && (() => {
                            const currentChoice = allOacChoices.find((c) => c.id === idCommande);
                            return (
                              <button
                                type="button"
                                onClick={() => setIdCommande(idCommande)}
                                className="w-full text-left px-3.5 py-2.5 bg-[#eaf2f8] ring-2 ring-inset ring-[#2E86C1] flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-4 h-4 rounded-full border-2 border-[#1B4F72] bg-[#1B4F72] text-white flex items-center justify-center shrink-0">
                                    <span className="text-[10px] font-black leading-none">✓</span>
                                  </span>
                                  <span className="px-2 py-0.5 rounded font-mono text-xs font-black bg-[#1B4F72] text-white shrink-0">
                                    {idCommande}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-900 truncate">
                                      {currentChoice?.libelle || 'Lot OAC sélectionné'}
                                    </div>
                                    <div className="text-[11px] text-slate-500">Sélection actuelle</div>
                                  </div>
                                </div>
                                {currentChoice?.dateStr && (
                                  <span className="text-[11px] font-bold text-slate-700 shrink-0 pl-7 sm:pl-0">
                                    {currentChoice.dateStr}
                                  </span>
                                )}
                              </button>
                            );
                          })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Justificatifs (photos / PDF)
                  — visible en mode ÉDITION (dépense sélectionnée)
                  — ET en mode CRÉATION (nouvelle dépense, champs remplis) */}
              {isRowSelected && depenseSelectionnee ? (
                <div className="mb-4">
                  <JustificatifsDepense depense={depenseSelectionnee} onChange={chargerJustifCounts} />
                </div>
              ) : formDepense ? (
                <div className="mb-4">
                  <JustificatifsDepense
                    depense={formDepense}
                    onChange={chargerJustifCounts}
                    titre="Justificatifs (nouvelle dépense)"
                  />
                  {/* Avertissement : ne pas modifier les champs après ajout */}
                  <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-800 flex items-start gap-1.5">
                    <span className="text-sm leading-none mt-0.5">⚠️</span>
                    <span>
                      Les justificatifs sont liés à la <b>date</b>, <b>sous-catégorie</b>,
                      <b> montant</b> et <b>libellé</b>. Si vous modifiez un de ces champs
                      après avoir ajouté un justificatif, la liaison sera perdue.
                      Enregistrez la dépense telle quelle pour conserver les justificatifs.
                    </span>
                  </div>
                </div>
              ) : !isRowSelected && showForm ? (
                <div className="mb-4 px-3 py-2.5 rounded-lg bg-slate-50 border border-dashed border-slate-300 text-[11px] text-slate-500 flex items-center gap-2">
                  <span className="text-base">📎</span>
                  <span>
                    Pour ajouter des justificatifs, renseignez d'abord la{' '}
                    <b>sous-catégorie</b> et le <b>montant</b>. Le bouton
                    « + Ajouter » apparaîtra alors automatiquement.
                  </span>
                </div>
              ) : null}

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={!isRowSelected}
                  onClick={() => setDeleteConfirmOpen(true)}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition ${
                    isRowSelected ? 'active:scale-95' : 'opacity-40 cursor-not-allowed'
                  }`}
                  style={{
                    background: 'linear-gradient(135deg, #922B21, #E74C3C)',
                  }}
                  title="Supprimer définitivement cette dépense"
                >
                  🗑 Supprimer
                </button>
                {isRowSelected ? (
                  <button
                    type="button"
                    onClick={handleMod}
                    className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #1E8449, #27AE60)',
                    }}
                    title="Enregistrer les modifications"
                  >
                    ✔ Enregistrer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #1B4F72, #2E86C1)',
                    }}
                    title="Enregistrer la nouvelle dépense"
                  >
                    ✔ Enregistrer
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition"
                  title="Annuler et revenir à la liste"
                >
                  ↺ Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────── COMPTEUR RÉSULTATS ─────────── */}
        <div className="px-5 sm:px-6 py-2 text-[11px] text-slate-500 font-medium border-b border-slate-100 bg-[#fafbfc]">
          {depensesAffichees.length} affichée(s) sur {filteredDepenses.length} résultat(s) sur {depenses.length}
          {filterText || filterCat || filterDate1 || filterDate2 ? ' (filtré)' : ''}
        </div>

        {/* ─────────── TABLEAU ─────────── */}
        <div className="overflow-x-auto px-2 sm:px-4 py-2">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white uppercase text-[11px] font-bold tracking-wider">
                <th className="px-3 py-3 w-[100px] whitespace-nowrap">DATE</th>
                <th className="px-3 py-3 w-[190px] whitespace-nowrap">SOUS-CAT.</th>
                <th className="px-3 py-3 w-[240px]">LIBELLÉ</th>
                <th className="px-3 py-3 w-[170px] whitespace-nowrap">SOURCE</th>
                <th className="px-3 py-3 w-[120px] text-right whitespace-nowrap">MONTANT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {depensesAffichees.map((d, idx) => {
                const currentLigne = d.ligne !== undefined ? d.ligne : idx + 16;
                const isSelected = selectedLigne === currentLigne;

                return (
                  <tr
                    key={idx}
                    onClick={() => loadRow(d, idx)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? 'bg-[#d6eaf8] font-bold shadow-inner border-l-4 border-[#2E86C1]'
                        : 'hover:bg-[#d6eaf8]/60 even:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-700">
                      {d.date}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-900">
                      {d.sousCategorie || '--'}
                      {/* Badge justificatifs cliquable */}
                      {(justifCounts[cleJustificatif(d)] || 0) > 0 && (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadRow(d, idx);
                            // Le panneau justificatifs s'affichera automatiquement
                            // en bas du formulaire après sélection de la ligne.
                          }}
                          title={`${justifCounts[cleJustificatif(d)]} justificatif(s) — cliquer pour voir`}
                          className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#eaf2f8] text-[#1B4F72] text-[10px] font-bold hover:bg-[#d4e6f4] transition cursor-pointer border border-[#2E86C1]/20"
                        >
                          <span>📎</span>
                          <span>{justifCounts[cleJustificatif(d)]}</span>
                        </a>
                      )}
                      {(justifCounts[cleJustificatif(d)] || 0) === 0 && (
                        <span
                          title="Aucun justificatif"
                          className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px] font-bold border border-slate-200"
                        >
                          <span>📎</span>
                          <span>0</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-800 truncate max-w-[240px]">
                      {d.libelle || '--'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                      {d.sourcePaiement || '--'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-black whitespace-nowrap text-[#D4AC0D]">
                      {fmt(d.montant)}
                    </td>
                  </tr>
                );
              })}
              {depensesAffichees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Aucune dépense trouvée avec ces critères.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Footer Total */}
            <tfoot>
              <tr className="bg-gradient-to-r from-[#f0f4f8] to-[#e8eef5] border-t-2 border-[#c8d5e0]">
                <td colSpan={4} className="px-3 py-3 text-xs font-bold uppercase text-[#2c3e50] tracking-wider">
                  Total filtré :
                </td>
                <td className="px-3 py-3 text-right text-sm font-black text-[#1B4F72] whitespace-nowrap">
                  {totalFiltre.toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Indication bas de tableau */}
        <div className="px-5 sm:px-6 py-2 text-[10px] text-slate-400 italic border-t border-slate-100">
          💡 Astuce : cliquez sur une ligne du tableau pour la modifier, ou sur <strong>+ Ajouter une dépense</strong> pour en créer une nouvelle.
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          POPUP SOUS-CATÉGORIE
         ═══════════════════════════════════════════════════════════════ */}
      {isPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(10,30,50,0.55)] backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center justify-between text-white shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📁</span>
                <h3 className="font-bold text-base tracking-tight">Choisir une sous-catégorie</h3>
              </div>
              <button
                onClick={() => setIsPopupOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-lg font-bold transition transform hover:rotate-90"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 bg-[#f8fafb] border-b border-slate-100">
              <input
                type="text"
                autoFocus
                placeholder="Rechercher une sous-catégorie..."
                value={popupSearch}
                onChange={(e) => setPopupSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border-2 border-[#d5dde5] rounded-xl text-sm focus:outline-none focus:border-[#2E86C1] focus:ring-2 focus:ring-[#2E86C1]/20 shadow-inner"
              />
            </div>

            {/* Popup Body (Grouped Categories Grid) */}
            <div className="p-5 overflow-y-auto max-h-[58vh] space-y-5">
              {filteredPopupCategories.map((group) => (
                <div key={group.categorie} className="space-y-2">
                  <div className="inline-block px-3 py-1 bg-gradient-to-r from-[#d6eaf8] to-[#eaf2f8] border-l-4 border-[#2E86C1] rounded-r-md text-[11px] font-extrabold text-[#1B4F72] uppercase tracking-wider">
                    {group.categorie}
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {group.items.map((item) => {
                      const isSelected = sousCategorie === item.sousCategorie;

                      return (
                        <div
                          key={item.sousCategorie}
                          onClick={() => handleSelectSousCat(item, group.categorie)}
                          className={`min-w-[150px] p-2.5 sm:p-3 rounded-xl border-2 text-xs font-semibold cursor-pointer transition text-center shadow-xs ${
                            isSelected
                              ? 'border-[#27AE60] bg-gradient-to-r from-[#d5f5e3] to-[#e8f8e8] text-[#1E8449] font-bold shadow-md'
                              : item.idRequis
                              ? 'border-l-4 border-l-[#f39c12] border-slate-200 bg-gradient-to-r from-[#fef9e7] to-white text-[#2c3e50] hover:border-[#2E86C1] hover:bg-[#eaf2f8] hover:-translate-y-0.5'
                              : 'bg-white border-[#e0e6ec] text-[#2c3e50] hover:border-[#2E86C1] hover:bg-[#eaf2f8] hover:-translate-y-0.5'
                          }`}
                        >
                          {item.idRequis && (
                            <div className="text-[10px] text-[#f39c12] font-black uppercase mb-0.5 flex items-center justify-center gap-1">
                              <span>▲</span>
                              <span>ID requis</span>
                            </div>
                          )}
                          <span>{item.sousCategorie}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Supprimer Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-[#922B21] to-[#E74C3C] text-white px-6 py-3.5 flex items-center gap-2">
              <span className="text-lg">⚠</span>
              <h3 className="font-bold text-base">Confirmation</h3>
            </div>
            <div className="p-6">
              <p className="text-xs sm:text-sm text-slate-800">
                Supprimer cette dépense ({sousCategorie} - {montant} FCFA) ?
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e8eef5] text-slate-700 border border-[#c8d5e0]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#922B21] to-[#E74C3C]"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
