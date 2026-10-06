import React, { useState, useMemo, useEffect } from 'react';
import { Depense, OAC } from '../types';
import { getSourcesPaiement } from '../services/googleSheet';

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
  // Form State
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

  const showNotif = (text: string, ok: boolean) => {
    setNotif({ text, ok });
    setTimeout(() => setNotif(null), 5000);
  };

  // Determine if selected sub-category requires ID
  const isIdComRequired = useMemo(() => {
    if (!sousCategorie) return false;
    const lower = sousCategorie.toLowerCase();
    return (
      lower.includes("achat d'oeuf") ||
      lower.includes("achat d'œuf") ||
      lower.includes('transport des oeuf') ||
      lower.includes('transport des œuf') ||
      lower.includes('dedouanement') ||
      lower.includes('dédouanement') ||
      lower.includes('transit')
    );
  }, [sousCategorie]);

  // Available OAC IDs for selection
  const availableOacIds = useMemo(() => {
    const ids = new Set<string>();
    oacList.forEach((o) => {
      if (o.id) ids.add(o.id);
    });
    depenses.forEach((d) => {
      if (d.idCommande) ids.add(d.idCommande);
    });
    return Array.from(ids);
  }, [oacList, depenses]);

  // Format currency
  const fmt = (v: number | string) => {
    if (v === '' || v === null || v === undefined) return '--';
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? String(v) : n.toLocaleString('fr-FR') + ' FCFA';
  };

  // Load a row for editing
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
  };

  // Reset form
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

  // Select a sub-category from popup
  const handleSelectSousCat = (item: { sousCategorie: string; idRequis?: boolean }, catName: string) => {
    setSousCategorie(item.sousCategorie);
    setCategorie(catName);
    if (item.idRequis) {
      if (!idCommande) {
        setIdCommande('__NOUVEAU__');
      }
    } else {
      setIdCommande('');
    }
    setIsPopupOpen(false);
  };

  // Save new expense
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
    if (isIdComRequired && (!finalIdCom || finalIdCom === '__NOUVEAU__')) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      finalIdCom = `OAC-${yy}${mm}-00${depenses.length + 1}`;
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
    showNotif(`Dépense enregistrée : ${sousCategorie} — ${parseFloat(montant).toLocaleString('fr-FR')} FCFA`, true);
    raz();
  };

  // Modify selected expense
  const handleMod = () => {
    if (selectedLigne === null) return;
    if (!date || !sousCategorie || !montant || !sourcePaiement) {
      showNotif('Veuillez remplir tous les champs obligatoires.', false);
      return;
    }

    let finalIdCom = idCommande;
    if (isIdComRequired && (!finalIdCom || finalIdCom === '__NOUVEAU__')) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      finalIdCom = `OAC-${yy}${mm}-00${depenses.length + 1}`;
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
    showNotif(`Dépense modifiée : ${sousCategorie} — ${parseFloat(montant).toLocaleString('fr-FR')} FCFA`, true);
    raz();
  };

  // Delete selected expense
  const confirmDelete = () => {
    if (selectedLigne === null) return;
    setDeleteConfirmOpen(false);
    if (onDeleteDepense) {
      onDeleteDepense(selectedLigne);
    }
    showNotif('Dépense supprimée avec succès.', true);
    raz();
  };

  // Filtered expenses list
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

  // Categories list for filter dropdown
  const allCategoriesForFilter = useMemo(() => {
    return Array.from(new Set(CATEGORIES_SOUS_CATEGORIES.map((c) => c.categorie)));
  }, []);

  // Filtered popup items
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

  return (
    <div className="space-y-5 max-w-5xl mx-auto font-sans animate-fade-in text-[#1a2332]">
      {/* Top Notification Banner */}
      {notif && (
        <div
          className={`sticky top-2 z-50 p-4 rounded-xl text-center font-bold text-sm shadow-xl transition-all ${
            notif.ok
              ? 'bg-gradient-to-r from-[#1E8449] to-[#27AE60] text-white'
              : 'bg-gradient-to-r from-[#922B21] to-[#E74C3C] text-white'
          }`}
        >
          {notif.ok ? '✔ ' : '✖ '}
          {notif.text}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 1: NOUVELLE DEPENSE (Screenshot 1)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        {/* Form Header Bar */}
        <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center gap-3 text-white">
          <span className="text-2xl">💰</span>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">Nouvelle depense</h1>
        </div>

        {/* Form Fields */}
        <div className="p-6 space-y-4">
          {/* Row 1: Date + N deg Piece */}
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
                <span>N deg Piece</span>
              </label>
              <input
                type="text"
                placeholder="N deg facture/recu"
                value={numPiece}
                onChange={(e) => setNumPiece(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#fafbfc] border-2 border-[#d5dde5] rounded-lg text-sm text-[#1a2332] placeholder-slate-400 focus:outline-none focus:border-[#2E86C1] focus:bg-white"
              />
            </div>
          </div>

          {/* Row 2: Sous-categorie (Popup trigger) + Categorie (auto) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                <span className="opacity-70">📁</span>
                <span>Sous-categorie</span>
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
                <span>Categorie (auto)</span>
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
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[#c8d5e0] to-transparent my-4" />

          {/* Row 3: Libelle + Montant + Source de paiement */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                <span className="opacity-70">📝</span>
                <span>Libelle</span>
              </label>
              <input
                type="text"
                placeholder="Description de la depense"
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

          {/* Row 4: ID Commande (Conditional) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                <span className="opacity-70">🔗</span>
                <span>ID Commande</span>
                {isIdComRequired && <span className="text-[#E74C3C]">*</span>}
              </label>
              <select
                disabled={!isIdComRequired}
                value={idCommande}
                onChange={(e) => setIdCommande(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                style={
                  isIdComRequired
                    ? {
                        background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                        border: '2px solid #f39c12',
                        cursor: 'pointer',
                        color: '#1a2332',
                      }
                    : {
                        background: '#eef2f7',
                        color: '#a8b4c0',
                        cursor: 'not-allowed',
                        border: '2px solid #d5dde5',
                      }
                }
              >
                <option value="">-- Choisir --</option>
                <option value="__NOUVEAU__">Nouvel ID (auto)</option>
                {availableOacIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isRowSelected}
              onClick={handleSave}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition ${
                !isRowSelected ? 'active:scale-95' : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: 'linear-gradient(135deg, #1B4F72, #2E86C1)',
              }}
            >
              ✔ ENREGISTRER
            </button>
            <button
              type="button"
              disabled={!isRowSelected}
              onClick={handleMod}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition ${
                isRowSelected ? 'active:scale-95' : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: 'linear-gradient(135deg, #1E8449, #27AE60)',
              }}
            >
              ✎ MODIFIER
            </button>
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
            >
              🗑 SUPPRIMER
            </button>
            <button
              type="button"
              onClick={raz}
              className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition"
            >
              ↺ ANNULER
            </button>
            <button
              type="button"
              onClick={onClose || raz}
              className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #922B21, #E74C3C)',
              }}
            >
              ✕ QUITTER
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 2: DERNIERES DEPENSES (Screenshot 1 Bottom Table)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        {/* Table Card Header with Filters */}
        <div className="p-5 sm:p-6 pb-2 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-base font-bold text-[#1B4F72] tracking-tight">Dernieres depenses</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Rechercher..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="px-3 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white w-full sm:w-36"
            />
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="px-2.5 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
            >
              <option value="">-- Categorie --</option>
              {allCategoriesForFilter.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              title="Date début"
              value={filterDate1}
              onChange={(e) => setFilterDate1(e.target.value)}
              className="px-2 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1]"
            />
            <input
              type="date"
              title="Date fin"
              value={filterDate2}
              onChange={(e) => setFilterDate2(e.target.value)}
              className="px-2 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1]"
            />
            <button
              onClick={() => {
                setFilterText('');
                setFilterCat('');
                setFilterDate1('');
                setFilterDate2('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition"
            >
              REINITIALISER
            </button>
          </div>
        </div>

        {/* Counter */}
        <div className="px-6 py-2 text-xs text-slate-500 font-medium">
          {filteredDepenses.length} resultat(s) sur {depenses.length}
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-6 pb-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white uppercase text-[11px] font-bold tracking-wider">
                <th className="px-3 py-3 w-[100px] whitespace-nowrap">DATE</th>
                <th className="px-3 py-3 w-[190px] whitespace-nowrap">SOUS-CAT.</th>
                <th className="px-3 py-3 w-[240px]">LIBELLE</th>
                <th className="px-3 py-3 w-[170px] whitespace-nowrap">SOURCE PAIEMENT</th>
                <th className="px-3 py-3 w-[120px] text-right whitespace-nowrap">MONTANT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDepenses.map((d, idx) => {
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
              {filteredDepenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Aucune dépense trouvée avec ces critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          POPUP SOUS-CATEGORIE (Screenshot 2)
         ══════════════════════════════════════════════════════════════════════════ */}
      {isPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(10,30,50,0.55)] backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center justify-between text-white shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📁</span>
                <h3 className="font-bold text-base tracking-tight">Choisir une sous-categorie</h3>
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
                placeholder="Rechercher une sous-categorie..."
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
