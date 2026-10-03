import React, { useState, useMemo } from 'react';
import { Vente, Client, OAC } from '../types';
import { PRODUITS_PRIX } from '../data/initialData';

interface VentesModuleProps {
  ventes: Vente[];
  clients: Client[];
  oacList: OAC[];
  onAddVente: (vente: Vente) => void;
  onUpdateVente?: (vente: Vente) => void;
  onDeleteVente?: (ligne: number) => void;
  onAddClient?: (client: Client) => void;
  onClose?: () => void;
}

export const VentesModule: React.FC<VentesModuleProps> = ({
  ventes,
  clients,
  oacList,
  onAddVente,
  onUpdateVente,
  onDeleteVente,
  onAddClient,
  onClose,
}) => {
  // Form State
  const [selectedLigne, setSelectedLigne] = useState<number | null>(null);
  const [typeVente, setTypeVente] = useState<'Poussins couvoir' | 'Autre produit'>('Poussins couvoir');
  const [dateVente, setDateVente] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [client, setClient] = useState<string>('');
  const [produit, setProduit] = useState<string>('');
  const [dateEclosion, setDateEclosion] = useState<string>('');
  const [quantite, setQuantite] = useState<string>('');
  const [prixUnitaire, setPrixUnitaire] = useState<string>('');
  const [statutPaiement, setStatutPaiement] = useState<'Payee' | 'Avance' | 'Non payee'>('Payee');

  // Avance fields
  const [avanceAncien, setAvanceAncien] = useState<number>(0);
  const [avanceNouveau, setAvanceNouveau] = useState<string>('');

  const [observation, setObservation] = useState<string>('');

  // Inline "Nouveau Client" form toggle
  const [showNouveauClient, setShowNouveauClient] = useState(false);
  const [ncPrenom, setNcPrenom] = useState('');
  const [ncNom, setNcNom] = useState('');
  const [ncVille, setNcVille] = useState('');
  const [ncTel, setNcTel] = useState('');
  const [ncEmail, setNcEmail] = useState('');

  // Table Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [filtrePaie, setFiltrePaie] = useState('');
  const [filtreType, setFiltreType] = useState('');

  // Notifications & Modals
  const [notif, setNotif] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    body: string;
    actionType: 'save' | 'mod' | 'del';
  }>({
    open: false,
    title: '',
    body: '',
    actionType: 'save',
  });

  const showNotif = (text: string, ok: boolean) => {
    setNotif({ text, ok });
    setTimeout(() => setNotif(null), 6000);
  };

  // Available hatch dates from OAC
  const datesEclosionDispos = useMemo(() => {
    const dates = new Set<string>();
    oacList.forEach((o) => {
      if (o.eclosion && o.eclosion !== '--') dates.add(o.eclosion);
    });
    ventes.forEach((v) => {
      if (v.dateEclosion && v.dateEclosion !== '--') dates.add(v.dateEclosion);
    });
    // Add default dates if empty
    if (dates.size === 0) {
      dates.add('15/10/2026');
      dates.add('07/10/2026');
      dates.add('04/10/2026');
      dates.add('03/10/2026');
    }
    return Array.from(dates);
  }, [oacList, ventes]);

  // Total amount calculation
  const montantTotal = useMemo(() => {
    const q = parseFloat(quantite) || 0;
    const p = parseFloat(prixUnitaire) || 0;
    return q * p;
  }, [quantite, prixUnitaire]);

  // Avance and Reliquat calculation
  const { avanceTotal, reliquat } = useMemo(() => {
    if (statutPaiement === 'Payee') {
      return { avanceTotal: montantTotal, reliquat: 0 };
    }
    if (statutPaiement === 'Non payee') {
      return { avanceTotal: 0, reliquat: montantTotal };
    }
    // Avance
    const nouv = parseFloat(avanceNouveau) || 0;
    const tot = avanceAncien + nouv;
    const cappedTot = Math.min(tot, montantTotal);
    const rel = Math.max(0, montantTotal - cappedTot);
    return { avanceTotal: cappedTot, reliquat: rel };
  }, [statutPaiement, montantTotal, avanceAncien, avanceNouveau]);

  // Product selection handler: auto fills prix unitaire
  const handleProduitChange = (prodNom: string) => {
    setProduit(prodNom);
    const found = PRODUITS_PRIX.find((p) => p.nom === prodNom);
    if (found) {
      setPrixUnitaire(String(found.prix));
    }
  };

  // Load a row for editing
  const loadRow = (v: Vente, idx: number) => {
    const ligneNum = v.ligne !== undefined ? v.ligne : idx + 4;
    setSelectedLigne(ligneNum);
    setTypeVente(v.typeVente || 'Poussins couvoir');

    if (v.date && v.date !== '--') {
      const parts = v.date.split('/');
      if (parts.length === 3) {
        setDateVente(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        setDateVente(v.date);
      }
    }

    setClient(v.client || '');
    setProduit(v.produit || '');
    setDateEclosion(v.dateEclosion || '');
    setQuantite(v.quantite ? String(v.quantite) : '');
    setPrixUnitaire(v.prixUnitaire ? String(v.prixUnitaire) : '');
    setStatutPaiement(v.statutPaiement || 'Payee');
    setObservation(v.observation || '');

    if (v.statutPaiement === 'Avance') {
      setAvanceAncien(v.avance || 0);
      setAvanceNouveau('');
    } else {
      setAvanceAncien(0);
      setAvanceNouveau('');
    }

    showNotif('Vente chargée — prête pour modification.', true);
  };

  // Reset form
  const raz = () => {
    setSelectedLigne(null);
    setTypeVente('Poussins couvoir');
    const d = new Date();
    setDateVente(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setClient('');
    setProduit('');
    setDateEclosion('');
    setQuantite('');
    setPrixUnitaire('');
    setStatutPaiement('Payee');
    setAvanceAncien(0);
    setAvanceNouveau('');
    setObservation('');
  };

  // Quick add new client
  const handleSaveNouveauClient = () => {
    if (!ncPrenom.trim() && !ncNom.trim()) {
      showNotif('Veuillez renseigner au moins le prénom ou le nom.', false);
      return;
    }
    const full = `${ncPrenom} ${ncNom}`.trim();
    if (onAddClient) {
      onAddClient({
        prenom: ncPrenom.trim(),
        nom: ncNom.trim(),
        ville: ncVille.trim(),
        telephone: ncTel.trim(),
        email: ncEmail.trim(),
        label: full,
      });
    }
    setClient(full);
    setShowNouveauClient(false);
    setNcPrenom('');
    setNcNom('');
    setNcVille('');
    setNcTel('');
    setNcEmail('');
    showNotif(`Client "${full}" ajouté avec succès.`, true);
  };

  // Validation
  const validateForm = () => {
    if (typeVente === 'Autre produit' && !dateVente) {
      showNotif('La date de vente est obligatoire.', false);
      return null;
    }
    if (!client) {
      showNotif('Veuillez sélectionner un client.', false);
      return null;
    }
    if (!produit) {
      showNotif('Veuillez sélectionner un produit.', false);
      return null;
    }
    const q = parseFloat(quantite) || 0;
    const p = parseFloat(prixUnitaire) || 0;
    if (q <= 0) {
      showNotif('Quantité invalide.', false);
      return null;
    }
    if (p <= 0) {
      showNotif('Prix unitaire invalide.', false);
      return null;
    }
    if (typeVente === 'Poussins couvoir' && !dateEclosion) {
      showNotif("Date d'éclosion obligatoire pour les poussins.", false);
      return null;
    }
    if (statutPaiement === 'Avance') {
      const nouv = parseFloat(avanceNouveau) || 0;
      if (nouv <= 0 && avanceAncien <= 0) {
        showNotif("Saisissez le montant payé aujourd'hui.", false);
        return null;
      }
      if (avanceTotal >= montantTotal) {
        showNotif(
          `L'avance (${avanceTotal.toLocaleString('fr-FR')} FCFA) égale ou dépasse le montant. Choisissez le statut Payée si la vente est réglée.`,
          false
        );
        return null;
      }
    }

    const dateParts = dateVente.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : dateVente;

    return {
      date: typeVente === 'Poussins couvoir' ? formattedDate : formattedDate,
      client,
      produit,
      quantite: q,
      prixUnitaire: p,
      montant: montantTotal,
      dateEclosion: typeVente === 'Poussins couvoir' ? dateEclosion : '',
      typeVente,
      statutPaiement,
      avance: avanceTotal,
      reliquat,
      observation,
    };
  };

  // Trigger Save with confirmation
  const handleSaveClick = () => {
    const data = validateForm();
    if (!data) return;

    const recap = `* Client : ${data.client}\n* Produit : ${data.produit}\n* Quantité : ${data.quantite}\n* PU : ${data.prixUnitaire.toLocaleString('fr-FR')} FCFA\n* Montant : ${data.montant.toLocaleString('fr-FR')} FCFA\n* Paiement : ${data.statutPaiement}${data.statutPaiement === 'Avance' ? ` (Avance: ${data.avance.toLocaleString('fr-FR')} FCFA, Reliquat: ${data.reliquat.toLocaleString('fr-FR')} FCFA)` : ''}\n${data.dateEclosion ? `* Éclosion : ${data.dateEclosion}\n` : ''}${data.observation ? `* Observation : ${data.observation}` : ''}`;

    setConfirmModal({
      open: true,
      title: 'Enregistrer la vente',
      body: `Confirmer l'enregistrement ?\n\n${recap}`,
      actionType: 'save',
    });
  };

  // Trigger Modify with confirmation
  const handleModClick = () => {
    if (selectedLigne === null) {
      showNotif("Sélectionnez d'abord une vente à modifier.", false);
      return;
    }
    const data = validateForm();
    if (!data) return;

    const recap = `* Client : ${data.client}\n* Produit : ${data.produit}\n* Quantité : ${data.quantite}\n* Montant : ${data.montant.toLocaleString('fr-FR')} FCFA\n* Statut : ${data.statutPaiement}`;

    setConfirmModal({
      open: true,
      title: 'Modifier la vente',
      body: `Confirmer la modification ?\n\n${recap}`,
      actionType: 'mod',
    });
  };

  // Trigger Delete with confirmation
  const handleDelClick = () => {
    if (selectedLigne === null) {
      showNotif("Sélectionnez d'abord une vente à supprimer.", false);
      return;
    }
    const current = ventes.find((v, idx) => (v.ligne !== undefined ? v.ligne : idx + 4) === selectedLigne);

    setConfirmModal({
      open: true,
      title: 'Supprimer la vente',
      body: `Client : ${current?.client || '-'}\nProduit : ${current?.produit || '-'}\nMontant : ${(current?.montant || 0).toLocaleString('fr-FR')} FCFA\n\nCette action est irréversible. Confirmer ?`,
      actionType: 'del',
    });
  };

  // Execute confirmed action
  const executeModalConfirm = () => {
    const action = confirmModal.actionType;
    setConfirmModal((prev) => ({ ...prev, open: false }));

    if (action === 'save') {
      const data = validateForm();
      if (!data) return;
      const newVente: Vente = {
        ligne: ventes.length + 4,
        ...data,
      };
      onAddVente(newVente);
      showNotif(`Vente enregistrée avec succès pour ${data.client} (${data.montant.toLocaleString('fr-FR')} FCFA).`, true);
      raz();
    } else if (action === 'mod') {
      if (selectedLigne === null) return;
      const data = validateForm();
      if (!data) return;
      const updated: Vente = {
        ligne: selectedLigne,
        ...data,
      };
      if (onUpdateVente) {
        onUpdateVente(updated);
      } else {
        onAddVente(updated);
      }
      showNotif(`Vente modifiée avec succès.`, true);
      raz();
    } else if (action === 'del') {
      if (selectedLigne === null) return;
      if (onDeleteVente) {
        onDeleteVente(selectedLigne);
      }
      showNotif(`Vente supprimée définitivement.`, true);
      raz();
    }
  };

  // Filtered sales list
  const filteredVentes = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    return ventes.filter((r) => {
      if (filtrePaie && r.statutPaiement !== filtrePaie) return false;
      if (filtreType && r.typeVente !== filtreType) return false;
      if (q) {
        const txt = `${r.client || ''} ${r.produit || ''} ${r.date || ''} ${r.dateEclosion || ''} ${r.observation || ''}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [ventes, searchFilter, filtrePaie, filtreType]);

  // Totals calculations
  const { totalMt, totalAv, totalRel } = useMemo(() => {
    let mt = 0;
    let av = 0;
    let rel = 0;
    filteredVentes.forEach((r) => {
      const rowMt = r.montant > 0 ? r.montant : ((Number(r.quantite) || 0) * (Number(r.prixUnitaire) || 0));
      const rowAv = r.avance > 0 ? r.avance : (r.statutPaiement === 'Payee' ? rowMt : 0);
      const rowRel = (r.reliquat !== undefined && r.reliquat !== null) ? r.reliquat : (r.statutPaiement === 'Payee' ? 0 : Math.max(0, rowMt - rowAv));
      mt += rowMt;
      av += rowAv;
      rel += rowRel;
    });
    return { totalMt: mt, totalAv: av, totalRel: rel };
  }, [filteredVentes]);

  const isRowSelected = selectedLigne !== null;

  return (
    <div className="space-y-5 max-w-5xl mx-auto font-sans animate-fade-in text-[#1a2332]">
      {/* Toast Notification */}
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
          CARD 1: GESTION DES VENTES (Screenshot 1 & 2)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        {/* Form Header Bar */}
        <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center gap-3 text-white">
          <span className="text-2xl">💰</span>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">Gestion des Ventes</h1>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {/* Row 1: Type de vente */}
          <div>
            <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
              <span className="opacity-70">📁</span>
              <span>Type de vente</span>
              <span className="text-[#E74C3C]">*</span>
            </label>
            <div className="flex items-center gap-6 py-1">
              <label className="flex items-center gap-2 text-sm font-normal text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="v_type"
                  checked={typeVente === 'Poussins couvoir'}
                  onChange={() => setTypeVente('Poussins couvoir')}
                  className="w-4 h-4 text-[#2E86C1] focus:ring-[#2E86C1]"
                />
                <span>Poussins du couvoir</span>
              </label>

              <label className="flex items-center gap-2 text-sm font-normal text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="v_type"
                  checked={typeVente === 'Autre produit'}
                  onChange={() => setTypeVente('Autre produit')}
                  className="w-4 h-4 text-[#2E86C1] focus:ring-[#2E86C1]"
                />
                <span>Autre produit</span>
              </label>
            </div>
          </div>

          {/* Row 2: Client with [+] quick add button */}
          <div>
            <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
              <span className="opacity-70">👤</span>
              <span>Client</span>
              <span className="text-[#E74C3C]">*</span>
            </label>
            <div className="flex items-center gap-2">
              <select
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                style={{
                  background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                  border: '2px solid #f39c12',
                }}
              >
                <option value="">-- Choisir --</option>
                {clients.map((c, i) => (
                  <option key={i} value={c.label}>
                    {c.label} {c.ville ? `(${c.ville})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNouveauClient(!showNouveauClient)}
                className="w-10 h-10 rounded-lg bg-[#27AE60] hover:bg-[#1E8449] text-white flex items-center justify-center text-xl font-bold transition shadow-sm"
                title="Ajouter un nouveau client"
              >
                +
              </button>
            </div>
          </div>

          {/* Inline Nouveau Client Form */}
          {showNouveauClient && (
            <div className="bg-[#eafaf1] border-2 border-[#27AE60] rounded-xl p-4 space-y-3 animate-slide-up shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-[#27AE60]/30">
                <span className="font-bold text-[#1E8449] text-xs uppercase flex items-center gap-1.5">
                  <span>👤</span>
                  <span>Nouveau client</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowNouveauClient(false)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Prénom <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Prénom"
                    value={ncPrenom}
                    onChange={(e) => setNcPrenom(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nom <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nom"
                    value={ncNom}
                    onChange={(e) => setNcNom(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Ville</label>
                  <input
                    type="text"
                    placeholder="Bamako..."
                    value={ncVille}
                    onChange={(e) => setNcVille(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    placeholder="Numéro"
                    value={ncTel}
                    onChange={(e) => setNcTel(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Email"
                    value={ncEmail}
                    onChange={(e) => setNcEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveNouveauClient}
                  className="px-4 py-2 bg-[#27AE60] hover:bg-[#1E8449] text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Ajouter le client
                </button>
              </div>
            </div>
          )}

          {/* Row 3: Produit + Date d'éclosion OR Date de vente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                <span className="opacity-70">📦</span>
                <span>Produit</span>
                <span className="text-[#E74C3C]">*</span>
              </label>
              <select
                value={produit}
                onChange={(e) => handleProduitChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                style={{
                  background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                  border: '2px solid #f39c12',
                }}
              >
                <option value="">-- Choisir --</option>
                {PRODUITS_PRIX.map((p) => (
                  <option key={p.nom} value={p.nom}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </div>

            {typeVente === 'Poussins couvoir' ? (
              <div>
                <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                  <span className="opacity-70">🎆</span>
                  <span>Date eclosion</span>
                  <span className="text-[#E74C3C]">*</span>
                </label>
                <select
                  value={dateEclosion}
                  onChange={(e) => setDateEclosion(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  style={{
                    background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                    border: '2px solid #f39c12',
                  }}
                >
                  <option value="">-- Choisir --</option>
                  {datesEclosionDispos.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                  <span className="opacity-70">📅</span>
                  <span>Date de vente</span>
                  <span className="text-[#E74C3C]">*</span>
                </label>
                <input
                  type="date"
                  value={dateVente}
                  onChange={(e) => setDateVente(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  style={{
                    background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                    border: '2px solid #f39c12',
                  }}
                />
              </div>
            )}
          </div>

          {/* Row 4: Quantité & Prix unitaire */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                <span className="opacity-70">🔢</span>
                <span>Quantite</span>
                <span className="text-[#E74C3C]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder=""
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                style={{
                  background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                  border: '2px solid #f39c12',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                <span className="opacity-70">💲</span>
                <span>Prix unitaire (FCFA)</span>
                <span className="text-[#E74C3C]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder=""
                value={prixUnitaire}
                onChange={(e) => setPrixUnitaire(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                style={{
                  background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                  border: '2px solid #f39c12',
                }}
              />
            </div>
          </div>

          {/* Row 5: Montant total (FCFA) */}
          <div>
            <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
              <span className="opacity-70">💰</span>
              <span>Montant total (FCFA)</span>
            </label>
            <div className="w-full px-3.5 py-2.5 bg-[#eef5fb] border-2 border-[#a8c6d8] rounded-lg text-base font-bold text-[#1B4F72] min-h-[42px] flex items-center select-none">
              {montantTotal ? montantTotal.toLocaleString('fr-FR') : '0'}
            </div>
          </div>

          {/* Row 6: Paiement */}
          <div>
            <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
              <span className="opacity-70">💳</span>
              <span>Paiement</span>
              <span className="text-[#E74C3C]">*</span>
            </label>
            <div className="flex items-center gap-6 py-1">
              <label className="flex items-center gap-2 text-sm font-normal text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="v_paie"
                  checked={statutPaiement === 'Payee'}
                  onChange={() => setStatutPaiement('Payee')}
                  className="w-4 h-4 text-[#2E86C1] focus:ring-[#2E86C1]"
                />
                <span>Payee</span>
              </label>

              <label className="flex items-center gap-2 text-sm font-normal text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="v_paie"
                  checked={statutPaiement === 'Avance'}
                  onChange={() => setStatutPaiement('Avance')}
                  className="w-4 h-4 text-[#2E86C1] focus:ring-[#2E86C1]"
                />
                <span>Avance</span>
              </label>

              <label className="flex items-center gap-2 text-sm font-normal text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="v_paie"
                  checked={statutPaiement === 'Non payee'}
                  onChange={() => setStatutPaiement('Non payee')}
                  className="w-4 h-4 text-[#2E86C1] focus:ring-[#2E86C1]"
                />
                <span>Non payee</span>
              </label>
            </div>
          </div>

          {/* Conditional Avance sub-fields */}
          {statutPaiement === 'Avance' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200 animate-slide-up">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Avance antérieure (FCFA)
                </label>
                <input
                  type="text"
                  readOnly
                  value={avanceAncien ? avanceAncien.toLocaleString('fr-FR') : '0'}
                  className="w-full px-3 py-1.5 bg-[#eef5fb] border-2 border-[#d5dde5] rounded-lg text-xs font-bold text-[#1B4F72]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Paiement ce jour (FCFA) <span className="text-[#E74C3C]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={avanceNouveau}
                  onChange={(e) => setAvanceNouveau(e.target.value)}
                  className="w-full px-3 py-1.5 border-2 border-amber-400 bg-white rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#c0392b] mb-1">
                  Avance totale (FCFA)
                </label>
                <input
                  type="text"
                  readOnly
                  value={avanceTotal ? avanceTotal.toLocaleString('fr-FR') : '0'}
                  className="w-full px-3 py-1.5 bg-[#fdf2e9] border-2 border-[#c0392b] rounded-lg text-xs font-bold text-[#c0392b]"
                />
              </div>
            </div>
          )}

          {/* Row 7: Reliquat (FCFA) */}
          <div>
            <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
              <span className="opacity-70">⚠</span>
              <span>Reliquat (FCFA)</span>
            </label>
            <div className="w-full px-3.5 py-2.5 bg-[#fdf2e9] border-2 border-[#e6b0aa] rounded-lg text-base font-bold text-[#c0392b] min-h-[42px] flex items-center select-none">
              {reliquat ? reliquat.toLocaleString('fr-FR') : '0'}
            </div>
          </div>

          {/* Row 8: Observation */}
          <div>
            <label className="block text-xs font-bold text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
              <span className="opacity-70">📝</span>
              <span>Observation</span>
            </label>
            <textarea
              rows={2}
              placeholder="Detail complementaire..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#fafbfc] border-2 border-[#d5dde5] rounded-lg text-sm text-[#1a2332] placeholder-slate-400 focus:outline-none focus:border-[#2E86C1] focus:bg-white resize-y"
            />
          </div>

          {/* Buttons Bar (Screenshot 2) */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isRowSelected}
              onClick={handleSaveClick}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition flex items-center gap-1.5 ${
                !isRowSelected ? 'active:scale-95' : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: 'linear-gradient(135deg, #1B4F72, #2E86C1)',
              }}
            >
              <span>💾</span>
              <span>ENREGISTRER</span>
            </button>
            <button
              type="button"
              disabled={!isRowSelected}
              onClick={handleModClick}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition flex items-center gap-1.5 ${
                isRowSelected ? 'active:scale-95' : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: 'linear-gradient(135deg, #1E8449, #27AE60)',
              }}
            >
              <span>✎</span>
              <span>MODIFIER</span>
            </button>
            <button
              type="button"
              disabled={!isRowSelected}
              onClick={handleDelClick}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition flex items-center gap-1.5 ${
                isRowSelected ? 'active:scale-95' : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: 'linear-gradient(135deg, #922B21, #E74C3C)',
              }}
            >
              <span>🗑</span>
              <span>SUPPRIMER</span>
            </button>
            <button
              type="button"
              onClick={raz}
              className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition"
            >
              ANNULER
            </button>
            <button
              type="button"
              onClick={onClose || raz}
              className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition"
            >
              QUITTER
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 2: DERNIERES VENTES (Screenshot 2 bottom table)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        {/* Table Header and Filters */}
        <div className="p-5 sm:p-6 pb-2 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-base font-bold text-[#1B4F72] tracking-tight">Dernieres ventes</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Rechercher (client, produit)..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="px-3 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white w-full sm:w-48"
            />
            <select
              value={filtrePaie}
              onChange={(e) => setFiltrePaie(e.target.value)}
              className="px-2.5 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
            >
              <option value="">Tous paiements</option>
              <option value="Payee">Payée</option>
              <option value="Avance">Avance</option>
              <option value="Non payee">Non payée</option>
            </select>
            <select
              value={filtreType}
              onChange={(e) => setFiltreType(e.target.value)}
              className="px-2.5 py-1.5 border-2 border-[#d5dde5] rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
            >
              <option value="">Tous types</option>
              <option value="Poussins couvoir">Poussins</option>
              <option value="Autre produit">Autre produit</option>
            </select>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto px-6 py-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white uppercase text-[11px] font-bold tracking-wider">
                <th className="px-3 py-3 w-[110px] whitespace-nowrap">DATE / ECLO...</th>
                <th className="px-3 py-3 w-[110px] whitespace-nowrap">TYPE</th>
                <th className="px-3 py-3 w-[140px] whitespace-nowrap">CLIENT</th>
                <th className="px-3 py-3 w-[130px] whitespace-nowrap">PRODUIT</th>
                <th className="px-3 py-3 w-[60px] text-right whitespace-nowrap">QTE</th>
                <th className="px-3 py-3 w-[110px] text-right whitespace-nowrap">MONTANT</th>
                <th className="px-3 py-3 w-[100px] text-right whitespace-nowrap">AVANCE</th>
                <th className="px-3 py-3 w-[100px] text-right whitespace-nowrap">RELIQUAT</th>
                <th className="px-3 py-3 w-[90px] whitespace-nowrap">PAIEMENT</th>
                <th className="px-3 py-3 w-[120px] whitespace-nowrap">OBS.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVentes.map((v, idx) => {
                const currentLigne = v.ligne !== undefined ? v.ligne : idx + 4;
                const isSelected = selectedLigne === currentLigne;

                return (
                  <tr
                    key={idx}
                    onClick={() => loadRow(v, idx)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? 'bg-[#d6eaf8] font-bold shadow-inner border-l-4 border-[#2E86C1]'
                        : 'hover:bg-[#d6eaf8]/60 even:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-bold text-slate-800">{v.date || '--'}</div>
                      {v.dateEclosion && v.dateEclosion !== '--' && (
                        <div className="text-[10px] font-bold text-[#2980b9]">
                          Ecl: {v.dateEclosion}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-bold text-xs">
                      <span
                        className={
                          v.typeVente === 'Autre produit'
                            ? 'text-[#8e44ad]'
                            : 'text-[#1a5276]'
                        }
                      >
                        {v.typeVente === 'Autre produit' ? 'Autre' : 'Poussins'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                      {v.client}
                    </td>
                    <td className="px-3 py-2.5 text-slate-800 whitespace-nowrap">
                      {v.produit}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                      {v.quantite?.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-[#D4AC0D] whitespace-nowrap">
                      {(v.montant > 0 ? v.montant : (Number(v.quantite || 0) * Number(v.prixUnitaire || 0)))?.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-700 whitespace-nowrap">
                      {(v.avance > 0 ? v.avance : (v.statutPaiement === 'Payee' ? (v.montant > 0 ? v.montant : Number(v.quantite || 0) * Number(v.prixUnitaire || 0)) : 0))?.toLocaleString('fr-FR')}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                        (v.reliquat !== undefined && v.reliquat > 0) ? 'text-[#c0392b]' : 'text-[#1e8449]'
                      }`}
                    >
                      {(v.reliquat !== undefined && v.reliquat !== null ? v.reliquat : (v.statutPaiement === 'Payee' ? 0 : Math.max(0, (v.montant || 0) - (v.avance || 0))))?.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-bold text-xs">
                      <span
                        className={
                          v.statutPaiement === 'Payee'
                            ? 'text-[#1e8449]'
                            : v.statutPaiement === 'Non payee'
                            ? 'text-[#c0392b]'
                            : 'text-[#b9770e]'
                        }
                      >
                        {v.statutPaiement}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-[11px] truncate max-w-[120px]">
                      {v.observation || '--'}
                    </td>
                  </tr>
                );
              })}
              {filteredVentes.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    Aucune vente trouvée avec ces critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totaux récapitulatifs (as in GAS) */}
        <div className="bg-gradient-to-r from-[#f0f4f8] to-[#e8eef5] border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center gap-6 text-xs font-semibold">
          <span className="text-[#2c3e50] font-bold text-sm">
            {filteredVentes.length} vente(s)
          </span>
          <span className="text-slate-600">
            Montant :{' '}
            <strong className="text-[#1a5276] text-sm">
              {totalMt.toLocaleString('fr-FR')} FCFA
            </strong>
          </span>
          <span className="text-slate-600">
            Avance :{' '}
            <strong className="text-[#27ae60] text-sm">
              {totalAv.toLocaleString('fr-FR')} FCFA
            </strong>
          </span>
          <span className="text-slate-600">
            Reliquat :{' '}
            <strong className="text-[#c0392b] text-sm">
              {totalRel.toLocaleString('fr-FR')} FCFA
            </strong>
          </span>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div
              className={`px-6 py-3.5 text-white font-bold text-base ${
                confirmModal.actionType === 'del'
                  ? 'bg-gradient-to-r from-[#922B21] to-[#E74C3C]'
                  : confirmModal.actionType === 'mod'
                  ? 'bg-gradient-to-r from-[#1E8449] to-[#27AE60]'
                  : 'bg-gradient-to-r from-[#1B4F72] to-[#2E86C1]'
              }`}
            >
              {confirmModal.title}
            </div>
            <div className="p-6 text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed">
              {confirmModal.body}
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e8eef5] text-slate-700 border border-[#c8d5e0]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={executeModalConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm ${
                  confirmModal.actionType === 'del'
                    ? 'bg-gradient-to-r from-[#922B21] to-[#E74C3C]'
                    : confirmModal.actionType === 'mod'
                    ? 'bg-gradient-to-r from-[#1E8449] to-[#27AE60]'
                    : 'bg-gradient-to-r from-[#1B4F72] to-[#2E86C1]'
                }`}
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
