import React, { useState, useMemo } from 'react';
import { MouvementCaisse } from '../types';

export const MOUVEMENTS_CAISSE_ENTREES = [
  'Encaissement vente',
  'Encaissement facture',
  'Remboursement',
  'Depot',
];

export const MOUVEMENTS_CAISSE_SORTIES = [
  'Retrait',
  'Paiement fournisseur',
  'Paiement salaire',
  'Frais divers',
];

interface CaisseModuleProps {
  mouvements: MouvementCaisse[];
  onAddMouvement: (mvt: MouvementCaisse) => void;
  onUpdateMouvement?: (mvt: MouvementCaisse) => void;
  onDeleteMouvement?: (ligne: number) => void;
  onClose?: () => void;
}

export const CaisseModule: React.FC<CaisseModuleProps> = ({
  mouvements,
  onAddMouvement,
  onUpdateMouvement,
  onDeleteMouvement,
  onClose,
}) => {
  // Form State
  const [selectedLigne, setSelectedLigne] = useState<number | null>(null);
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [typeMvt, setTypeMvt] = useState<string>('Encaissement vente');
  const [detail, setDetail] = useState<string>('');
  const [montantEntree, setMontantEntree] = useState<string>('0');
  const [montantSortie, setMontantSortie] = useState<string>('0');
  const [observation, setObservation] = useState<string>('');

  // Table search
  const [searchQuery, setSearchQuery] = useState('');

  // Toast & Modals
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const showToast = (message: string, ok: boolean) => {
    setToast({ message, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // Determine movement direction: 'entree' | 'sortie' | 'autre'
  const direction = useMemo(() => {
    if (
      typeMvt.includes('Encaissement') ||
      typeMvt.includes('Remboursement') ||
      typeMvt.includes('Depot') ||
      typeMvt.includes('Dépôt')
    ) {
      return 'entree';
    }
    if (
      typeMvt.includes('Paiement') ||
      typeMvt.includes('Retrait') ||
      typeMvt.includes('Frais')
    ) {
      return 'sortie';
    }
    return 'autre';
  }, [typeMvt]);

  // Global KPIs calculation
  const { soldeActuel, totalEntree, totalSortie, nbMouvements } = useMemo(() => {
    let totE = 0;
    let totS = 0;
    mouvements.forEach((m) => {
      totE += m.entree || 0;
      totS += m.sortie || 0;
    });
    return {
      soldeActuel: totE - totS,
      totalEntree: totE,
      totalSortie: totS,
      nbMouvements: mouvements.length,
    };
  }, [mouvements]);

  // Preview Nouveau Solde based on current input
  const previewNouveauSolde = useMemo(() => {
    const e = direction === 'sortie' ? 0 : parseFloat(montantEntree) || 0;
    const s = direction === 'entree' ? 0 : parseFloat(montantSortie) || 0;
    return soldeActuel + e - s;
  }, [soldeActuel, direction, montantEntree, montantSortie]);

  // Reset form
  const raz = () => {
    setSelectedLigne(null);
    const d = new Date();
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setTypeMvt('Encaissement vente');
    setDetail('');
    setMontantEntree('0');
    setMontantSortie('0');
    setObservation('');
  };

  // Load a row into form for editing
  const loadRow = (m: MouvementCaisse, idx: number) => {
    const ligneNum = m.ligne !== undefined ? m.ligne : idx + 5;
    setSelectedLigne(ligneNum);
    if (m.date) {
      const parts = m.date.split('/');
      if (parts.length === 3) {
        setDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        setDate(m.date);
      }
    }
    setTypeMvt(m.type || 'Encaissement vente');
    setDetail(m.detail && m.detail !== '--' ? m.detail : '');
    setMontantEntree(m.entree ? String(m.entree) : '0');
    setMontantSortie(m.sortie ? String(m.sortie) : '0');
    setObservation(m.observation || '');
  };

  // Save new movement
  const handleSave = () => {
    if (!date) {
      showToast('Veuillez renseigner la date.', false);
      return;
    }
    if (!typeMvt) {
      showToast('Veuillez sélectionner un type de mouvement.', false);
      return;
    }

    const e = direction === 'sortie' ? 0 : parseFloat(montantEntree) || 0;
    const s = direction === 'entree' ? 0 : parseFloat(montantSortie) || 0;

    if (e === 0 && s === 0) {
      showToast('Veuillez renseigner un montant.', false);
      return;
    }

    const dateParts = date.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : date;

    const newMvt: MouvementCaisse = {
      ligne: mouvements.length + 5,
      date: formattedDate,
      type: typeMvt,
      detail: detail.trim() || '--',
      entree: e,
      sortie: s,
      solde: previewNouveauSolde,
      observation,
    };

    onAddMouvement(newMvt);
    showToast('Mouvement enregistré avec succès.', true);
    raz();
  };

  // Modify selected movement
  const handleMod = () => {
    if (selectedLigne === null) {
      showToast('Veuillez sélectionner un mouvement dans la liste.', false);
      return;
    }

    const e = direction === 'sortie' ? 0 : parseFloat(montantEntree) || 0;
    const s = direction === 'entree' ? 0 : parseFloat(montantSortie) || 0;

    if (e === 0 && s === 0) {
      showToast('Veuillez renseigner un montant.', false);
      return;
    }

    const dateParts = date.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : date;

    const updated: MouvementCaisse = {
      ligne: selectedLigne,
      date: formattedDate,
      type: typeMvt,
      detail: detail.trim() || '--',
      entree: e,
      sortie: s,
      solde: previewNouveauSolde,
      observation,
    };

    if (onUpdateMouvement) {
      onUpdateMouvement(updated);
    } else {
      onAddMouvement(updated);
    }
    showToast('Mouvement modifié avec succès.', true);
    raz();
  };

  // Delete selected movement
  const confirmDelete = () => {
    if (selectedLigne === null) return;
    setDeleteConfirmOpen(false);
    if (onDeleteMouvement) {
      onDeleteMouvement(selectedLigne);
    }
    showToast('Mouvement supprimé avec succès.', true);
    raz();
  };

  // Filtered table rows
  const filteredMouvements = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return mouvements;
    return mouvements.filter((m) => {
      const txt = `${m.date || ''} ${m.type || ''} ${m.detail || ''} ${m.entree || ''} ${m.sortie || ''} ${m.solde || ''} ${m.observation || ''}`.toLowerCase();
      return txt.includes(q);
    });
  }, [mouvements, searchQuery]);

  const isRowSelected = selectedLigne !== null;

  return (
    <div className="bg-[#F0F4F8] min-h-full p-4 sm:p-6 font-['Inter',sans-serif] text-[#1E293B] space-y-5 animate-fade-in">
      {/* ══════════════════════════════════════════════════════════════════════════
          HEADER
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E293B] tracking-tight">
            Caisse Couvoir SAMCHE
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5 font-medium">
            Gestion des mouvements financiers
          </p>
        </div>
        <button
          onClick={onClose || raz}
          className="bg-white hover:bg-slate-50 text-[#475569] border border-[#E2E8F0] px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition"
        >
          Quitter
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          KPI ROW (4 cards with top color lines)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Solde actuel */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden border border-slate-100">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]" />
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            SOLDE ACTUEL
          </div>
          <div
            className={`text-xl sm:text-2xl font-extrabold tabular-nums ${
              soldeActuel >= 0 ? 'text-[#4F46E5]' : 'text-[#DC2626]'
            }`}
          >
            {soldeActuel.toLocaleString('fr-FR')}
          </div>
          <div className="text-[10px] text-[#94A3B8] mt-0.5">FCFA</div>
        </div>

        {/* Card 2: Total entrées */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden border border-slate-100">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#059669] to-[#10B981]" />
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            TOTAL ENTREES
          </div>
          <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-[#059669]">
            {totalEntree.toLocaleString('fr-FR')}
          </div>
          <div className="text-[10px] text-[#94A3B8] mt-0.5">FCFA</div>
        </div>

        {/* Card 3: Total sorties */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden border border-slate-100">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#DC2626] to-[#EF4444]" />
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            TOTAL SORTIES
          </div>
          <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-[#DC2626]">
            {totalSortie.toLocaleString('fr-FR')}
          </div>
          <div className="text-[10px] text-[#94A3B8] mt-0.5">FCFA</div>
        </div>

        {/* Card 4: Mouvements */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden border border-slate-100">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#D97706] to-[#F59E0B]" />
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            MOUVEMENTS
          </div>
          <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-[#D97706]">
            {nbMouvements}
          </div>
          <div className="text-[10px] text-[#94A3B8] mt-0.5">total</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MAIN GRID: FORM CARD (Left 340px) + TABLE CARD (Right 1fr)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* -- LEFT CARD: Nouveau mouvement -- */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-3.5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#1E293B]">
            <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center font-black text-sm">
              +
            </div>
            <span>Nouveau mouvement</span>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#92400E]">
              DATE <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              style={{
                background: '#FFFBEB',
                border: '1.5px solid #F59E0B',
              }}
            />
          </div>

          {/* Type de mouvement */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#92400E]">
              TYPE DE MOUVEMENT <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={typeMvt}
              onChange={(e) => setTypeMvt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              style={{
                background: '#FFFBEB',
                border: '1.5px solid #F59E0B',
              }}
            >
              <optgroup label="↓  Entrées">
                <option value="Encaissement vente">Encaissement vente</option>
                <option value="Encaissement facture">Encaissement facture</option>
                <option value="Remboursement">Remboursement</option>
                <option value="Depot">Dépôt</option>
              </optgroup>
              <optgroup label="↑  Sorties">
                <option value="Retrait">Retrait</option>
                <option value="Paiement fournisseur">Paiement fournisseur</option>
                <option value="Paiement salaire">Paiement salaire</option>
                <option value="Frais divers">Frais divers</option>
              </optgroup>
              <optgroup label="◆  Autre">
                <option value="Autre">Autre</option>
              </optgroup>
            </select>
          </div>

          {/* Detail */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              DETAIL
            </label>
            <input
              type="text"
              placeholder="Detail du mouvement..."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-lg text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#4F46E5] focus:bg-white"
            />
          </div>

          {/* Dynamic Amount Container */}
          <div
            className={`rounded-xl p-3.5 space-y-2 transition-all ${
              direction === 'entree'
                ? 'bg-[#F0FDF4] border-[1.5px] border-[#BBF7D0]'
                : direction === 'sortie'
                ? 'bg-[#FEF2F2] border-[1.5px] border-[#FECACA]'
                : 'bg-[#FFFBEB] border-[1.5px] border-[#FDE68A]'
            }`}
          >
            {/* Direction Badge */}
            <div className="mb-1">
              <span
                className={`inline-block px-3 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-white ${
                  direction === 'entree'
                    ? 'bg-[#059669]'
                    : direction === 'sortie'
                    ? 'bg-[#DC2626]'
                    : 'bg-[#D97706]'
                }`}
              >
                {direction === 'entree'
                  ? 'ENTRÉE'
                  : direction === 'sortie'
                  ? 'SORTIE'
                  : 'AUTRE'}
              </span>
            </div>

            {/* Input Entrée */}
            {direction !== 'sortie' && (
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#065F46]">
                  MONTANT ENTRÉE (FCFA) <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={montantEntree}
                  onChange={(e) => setMontantEntree(e.target.value)}
                  className="w-full px-3 py-2 bg-[#ECFDF5] border border-[#6EE7B7] rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-[#059669]"
                />
              </div>
            )}

            {/* Input Sortie */}
            {direction !== 'entree' && (
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#991B1B]">
                  MONTANT SORTIE (FCFA) <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={montantSortie}
                  onChange={(e) => setMontantSortie(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-[#DC2626]"
                />
              </div>
            )}
          </div>

          {/* Nouveau Solde Preview Box */}
          <div className="bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] border-2 border-[#C7D2FE] rounded-xl p-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6366F1]">
              NOUVEAU SOLDE
            </div>
            <div
              className={`text-lg font-black mt-0.5 tabular-nums ${
                previewNouveauSolde >= 0 ? 'text-[#4F46E5]' : 'text-[#DC2626]'
              }`}
            >
              {previewNouveauSolde.toLocaleString('fr-FR')} FCFA
            </div>
          </div>

          {/* Observation */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              OBSERVATION
            </label>
            <textarea
              rows={2}
              placeholder="Observation..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-lg text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#4F46E5] focus:bg-white resize-y"
            />
          </div>

          {/* Form Actions Buttons */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <button
              type="button"
              disabled={isRowSelected}
              onClick={handleSave}
              className={`py-2 px-1 rounded-lg text-xs font-bold text-white shadow-sm transition ${
                !isRowSelected ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:shadow-md' : 'opacity-40 cursor-not-allowed bg-slate-400'
              }`}
            >
              Enregistrer
            </button>
            <button
              type="button"
              disabled={!isRowSelected}
              onClick={handleMod}
              className={`py-2 px-1 rounded-lg text-xs font-bold transition border-[1.5px] ${
                isRowSelected
                  ? 'bg-[#F0FDF4] text-[#059669] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                  : 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
              }`}
            >
              Modifier
            </button>
            <button
              type="button"
              disabled={!isRowSelected}
              onClick={() => setDeleteConfirmOpen(true)}
              className={`py-2 px-1 rounded-lg text-xs font-bold transition border-[1.5px] ${
                isRowSelected
                  ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] hover:bg-[#FEE2E2]'
                  : 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
              }`}
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={raz}
              className="py-2 px-1 rounded-lg text-xs font-bold bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#64748B] transition"
            >
              Annuler
            </button>
          </div>
        </div>

        {/* -- RIGHT CARD: Derniers mouvements (Table) -- */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-3">
          {/* Table Header with Search */}
          <div className="flex justify-between items-center pb-1">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1E293B]">
              <span className="text-base text-[#4F46E5]">☰</span>
              <span>Derniers mouvements</span>
            </div>
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border-[1.5px] border-[#E2E8F0] rounded-lg text-xs font-medium bg-[#F8FAFC] focus:outline-none focus:border-[#4F46E5] focus:bg-white w-36 sm:w-48"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="bg-[#F8FAFC] py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0] rounded-tl-lg">
                    DATE
                  </th>
                  <th className="bg-[#F8FAFC] py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
                    TYPE
                  </th>
                  <th className="bg-[#F8FAFC] py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
                    DETAIL
                  </th>
                  <th className="bg-[#F8FAFC] py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0] text-right">
                    ENTREE
                  </th>
                  <th className="bg-[#F8FAFC] py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0] text-right">
                    SORTIE
                  </th>
                  <th className="bg-[#F8FAFC] py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0] text-right rounded-tr-lg">
                    SOLDE
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredMouvements.map((m, idx) => {
                  const currentLigne = m.ligne !== undefined ? m.ligne : idx + 5;
                  const isSelected = selectedLigne === currentLigne;
                  const isEntree = m.entree > 0 || (m.type && (m.type.includes('Encaissement') || m.type.includes('Remboursement') || m.type.includes('Depot')));

                  return (
                    <tr
                      key={idx}
                      onClick={() => loadRow(m, idx)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#EEF2FF] font-semibold'
                          : 'hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                        {m.date}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                            isEntree
                              ? 'bg-[#ECFDF5] text-[#059669]'
                              : 'bg-[#FEF2F2] text-[#DC2626]'
                          }`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[120px] truncate">
                        {m.detail || '--'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap tabular-nums">
                        {m.entree > 0 ? (
                          <span className="text-[#059669]">{m.entree.toLocaleString('fr-FR')}</span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap tabular-nums">
                        {m.sortie > 0 ? (
                          <span className="text-[#DC2626]">{m.sortie.toLocaleString('fr-FR')}</span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold whitespace-nowrap tabular-nums ${
                          m.solde < 0 ? 'text-[#DC2626]' : 'text-[#1E293B]'
                        }`}
                      >
                        {m.solde < 0
                          ? `- ${Math.abs(m.solde).toLocaleString('fr-FR')}`
                          : m.solde.toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  );
                })}
                {filteredMouvements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Aucun mouvement trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count indicator */}
          <div className="pt-2 border-t border-[#F1F5F9] text-[11px] text-[#94A3B8]">
            {filteredMouvements.length} mouvement{filteredMouvements.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Confirmation Delete Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-[#DC2626] to-[#EF4444] text-white px-6 py-3.5 flex items-center gap-2">
              <span className="text-lg">⚠</span>
              <h3 className="font-bold text-base">Confirmation</h3>
            </div>
            <div className="p-6">
              <p className="text-xs sm:text-sm text-slate-800">
                Supprimer ce mouvement de caisse ? Les soldes seront recalculés automatiquement. Cette action est irréversible.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F1F5F9] text-slate-700 border border-[#E2E8F0]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#DC2626] to-[#EF4444]"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition-all ${
            toast.ok
              ? 'bg-[#ECFDF5] text-[#059669] border border-[#BBF7D0]'
              : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};
