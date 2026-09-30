import React, { useState, useMemo } from 'react';
import { CommandePoussin, Client, OAC } from '../types';

interface CommandesPoussinsModuleProps {
  commandes: CommandePoussin[];
  clients: Client[];
  oacList: OAC[];
  onAddCommande: (cmd: CommandePoussin) => void;
  onUpdateCommande?: (cmd: CommandePoussin) => void;
  onDeleteCommande?: (id: string) => void;
  onAddClient?: (client: Client) => void;
  onClose?: () => void;
}

export const CommandesPoussinsModule: React.FC<CommandesPoussinsModuleProps> = ({
  commandes,
  clients,
  oacList,
  onAddCommande,
  onUpdateCommande,
  onDeleteCommande,
  onAddClient,
  onClose,
}) => {
  // Navigation View: 'accueil' | 'dashboard' | 'nouvelle' | 'chercher'
  const [view, setView] = useState<'accueil' | 'dashboard' | 'nouvelle' | 'chercher'>('accueil');

  // Form State for "Nouvelle Commande"
  const [selDateKey, setSelDateKey] = useState<string>('04/10/2026');
  const [selClient, setSelClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [showNewClientForm, setShowNewClientForm] = useState<boolean>(false);
  const [ncPrenom, setNcPrenom] = useState<string>('');
  const [ncNom, setNcNom] = useState<string>('');
  const [ncVille, setNcVille] = useState<string>('');
  const [ncTel, setNcTel] = useState<string>('');
  const [ncEmail, setNcEmail] = useState<string>('');
  const [quantite, setQuantite] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  // Search State for "Chercher une Commande"
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingCommande, setEditingCommande] = useState<CommandePoussin | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [editStatut, setEditStatut] = useState<'En attente' | 'Confirmée' | 'Livrée' | 'Annulée'>('En attente');
  const [editNotes, setEditNotes] = useState<string>('');

  // Notification / Alert / Success Modals
  const [notif, setNotif] = useState<{ text: string; ok: boolean } | null>(null);
  const [successModal, setSuccessModal] = useState<{
    open: boolean;
    id: string;
    waClient?: string;
    waGest?: string;
  }>({
    open: false,
    id: '',
  });

  const showNotif = (text: string, ok: boolean) => {
    setNotif({ text, ok });
    setTimeout(() => setNotif(null), 5000);
  };

  // Hatch dates forecast & capacity data
  const hatchDatesData = useMemo(() => {
    const datesMap: Record<
      string,
      {
        date: string;
        dateFormatee: string;
        type: string;
        prix: number;
        prevision: number;
        commande: number;
      }
    > = {
      '04/10/2026': {
        date: '04/10/2026',
        dateFormatee: 'dim. 4 oct. 2026',
        type: 'Chairs',
        prix: 600,
        prevision: 14274,
        commande: 0,
      },
      '07/10/2026': {
        date: '07/10/2026',
        dateFormatee: 'mer. 7 oct. 2026',
        type: 'Chairs',
        prix: 600,
        prevision: 14319,
        commande: 0,
      },
      '15/10/2026': {
        date: '15/10/2026',
        dateFormatee: 'jeu. 15 oct. 2026',
        type: 'Chairs',
        prix: 600,
        prevision: 3590,
        commande: 0,
      },
    };

    // Aggregate orders
    commandes.forEach((cmd) => {
      if (cmd.statut === 'Annulée') return;
      const key = cmd.dateEclosion;
      if (datesMap[key]) {
        datesMap[key].commande += cmd.quantite;
      } else if (key) {
        datesMap[key] = {
          date: key,
          dateFormatee: key,
          type: cmd.typeProduit || 'Chairs',
          prix: cmd.prixUnitaire || 600,
          prevision: 14000,
          commande: cmd.quantite,
        };
      }
    });

    return Object.values(datesMap);
  }, [commandes]);

  // Overall KPI
  const { totalPrevision, totalCommande, totalDisponible, tauxGlobal } = useMemo(() => {
    let prev = 0;
    let cmd = 0;
    hatchDatesData.forEach((d) => {
      prev += d.prevision;
      cmd += d.commande;
    });
    const dispo = Math.max(0, prev - cmd);
    const taux = prev > 0 ? Math.round((cmd / prev) * 100) : 0;
    return {
      totalPrevision: prev,
      totalCommande: cmd,
      totalDisponible: dispo,
      tauxGlobal: taux,
    };
  }, [hatchDatesData]);

  // Current selected hatch date info
  const selectedHatchDate = useMemo(() => {
    return hatchDatesData.find((d) => d.date === selDateKey) || hatchDatesData[0];
  }, [hatchDatesData, selDateKey]);

  const prixUnitaire = selectedHatchDate ? selectedHatchDate.prix : 600;
  const typeProduit = selectedHatchDate ? selectedHatchDate.type : 'Chairs';
  const montantTotal = quantite * prixUnitaire;

  // Filtered clients for selection
  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.telephone && c.telephone.includes(q)) ||
        (c.ville && c.ville.toLowerCase().includes(q))
    );
  }, [clients, clientSearch]);

  // Filtered orders for "Chercher"
  const filteredCommandes = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return commandes;
    return commandes.filter((c) => {
      const full = `${c.id} ${c.prenom} ${c.nom} ${c.ville || ''} ${c.tel || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [commandes, searchTerm]);

  // Save new client inline
  const handleSaveNewClient = () => {
    if (!ncPrenom.trim() && !ncNom.trim()) {
      showNotif('Veuillez renseigner au moins le prénom ou le nom.', false);
      return;
    }
    const full = `${ncPrenom} ${ncNom}`.trim();
    const newC: Client = {
      prenom: ncPrenom.trim(),
      nom: ncNom.trim(),
      ville: ncVille.trim(),
      telephone: ncTel.trim(),
      email: ncEmail.trim(),
      label: full,
    };
    if (onAddClient) {
      onAddClient(newC);
    }
    setSelClient(newC);
    setShowNewClientForm(false);
    setNcPrenom('');
    setNcNom('');
    setNcVille('');
    setNcTel('');
    setNcEmail('');
    showNotif(`Client "${full}" créé et sélectionné.`, true);
  };

  // Submit Order
  const handleSaveCommande = () => {
    if (!selDateKey) {
      showNotif("Veuillez sélectionner une date d'éclosion.", false);
      return;
    }
    if (!selClient) {
      showNotif('Veuillez sélectionner ou créer un client.', false);
      return;
    }
    if (quantite <= 0) {
      showNotif('La quantité doit être supérieure à 0.', false);
      return;
    }

    const available = selectedHatchDate ? selectedHatchDate.prevision - selectedHatchDate.commande : 0;
    if (quantite > available && available > 0) {
      showNotif(
        `Stock insuffisant : il ne reste que ${available.toLocaleString('fr-FR')} place(s) pour cette date.`,
        false
      );
      return;
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const id = `CMD-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const todayFormatted = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    const newCmd: CommandePoussin = {
      id,
      date: todayFormatted,
      prenom: selClient.prenom,
      nom: selClient.nom,
      ville: selClient.ville || '',
      tel: selClient.telephone || '',
      email: selClient.email || '',
      typeProduit,
      dateEclosion: selDateKey,
      quantite,
      prixUnitaire,
      total: montantTotal,
      statut: 'En attente',
      notes,
    };

    onAddCommande(newCmd);

    // Prepare WhatsApp links
    const cleanTel = (selClient.telephone || '').replace(/[^0-9]/g, '');
    const waPhone = cleanTel.startsWith('223') ? cleanTel : `223${cleanTel}`;
    const clientMsg = encodeURIComponent(
      `Bonjour ${selClient.prenom} ${selClient.nom},\n\nVotre commande de poussins a bien été enregistrée !\n\nRéférence : ${id}\nType : ${typeProduit}\nQuantité : ${quantite} poussin(s)\nMontant total : ${montantTotal.toLocaleString('fr-FR')} F CFA\nDate d'éclosion : ${selDateKey}\n\nMerci de votre confiance !\nCOUVOIR SAMCHE`
    );
    const waClientLink = waPhone ? `https://wa.me/${waPhone}?text=${clientMsg}` : '';
    const gestMsg = encodeURIComponent(
      `Nouvelle commande enregistrée !\n\nRéférence : ${id}\nClient : ${selClient.prenom} ${selClient.nom}\nTél : ${selClient.telephone}\nQuantité : ${quantite} poussin(s)\nTotal : ${montantTotal.toLocaleString('fr-FR')} F CFA\nÉclosion : ${selDateKey}\n\nCOUVOIR SAMCHE`
    );
    const waGestLink = `https://wa.me/22366565055?text=${gestMsg}`;

    setSuccessModal({
      open: true,
      id,
      waClient: waClientLink,
      waGest: waGestLink,
    });

    // Reset Form
    setQuantite(1);
    setNotes('');
    setSelClient(null);
  };

  // Open Edit Modal
  const handleOpenEdit = (cmd: CommandePoussin) => {
    setEditingCommande(cmd);
    setEditQty(cmd.quantite);
    setEditStatut(cmd.statut);
    setEditNotes(cmd.notes || '');
  };

  // Save Modified Order
  const handleSaveModified = () => {
    if (!editingCommande) return;
    if (editQty <= 0) {
      showNotif('La quantité doit être supérieure à 0.', false);
      return;
    }
    const updated: CommandePoussin = {
      ...editingCommande,
      quantite: editQty,
      total: editQty * editingCommande.prixUnitaire,
      statut: editStatut,
      notes: editNotes,
    };
    if (onUpdateCommande) {
      onUpdateCommande(updated);
    }
    showNotif('Commande modifiée avec succès.', true);
    setEditingCommande(null);
  };

  // Delete Order
  const handleDelete = () => {
    if (!editingCommande) return;
    if (onDeleteCommande) {
      onDeleteCommande(editingCommande.id);
    }
    showNotif(`Commande #${editingCommande.id} supprimée avec succès.`, true);
    setEditingCommande(null);
  };

  return (
    <div className="min-h-[85vh] font-sans text-slate-800 animate-fade-in flex flex-col justify-start">
      {/* ══════════════════════════════════════════════════════════════════════════
          TOP NAVIGATION BAR (Exact as in all screenshots)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-[#1a3050] to-[#2e5984] text-white px-4 py-2.5 shadow-md flex items-center justify-between rounded-2xl mb-4">
        {/* Brand */}
        <div
          onClick={() => setView('accueil')}
          className="flex items-center gap-2.5 font-bold text-sm tracking-wide cursor-pointer hover:opacity-90 select-none"
        >
          <div className="w-7 h-7 bg-[#f39c12] text-[#1a3050] font-black rounded-full flex items-center justify-center text-xs">
            CS
          </div>
          <span className="hidden sm:inline">COUVOIR SAMCHE</span>
        </div>

        {/* Center Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView('accueil')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              view === 'accueil'
                ? 'bg-[#f39c12] text-[#1a3050] shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
            }`}
          >
            <span>⌂</span>
            <span>Accueil</span>
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              view === 'dashboard'
                ? 'bg-[#f39c12] text-[#1a3050] shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
            }`}
          >
            <span>☰</span>
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setView('nouvelle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              view === 'nouvelle'
                ? 'bg-[#f39c12] text-[#1a3050] shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
            }`}
          >
            <span>+</span>
            <span>Nouvelle Cmd</span>
          </button>
          <button
            onClick={() => setView('chercher')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              view === 'chercher'
                ? 'bg-[#f39c12] text-[#1a3050] shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
            }`}
          >
            <span>🔍</span>
            <span>Chercher</span>
          </button>
        </div>

        {/* Right buttons */}
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition hidden sm:inline"
            >
              ⌂ Couvoir
            </button>
          )}
          <button
            onClick={onClose || (() => setView('accueil'))}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-[#e74c3c] hover:bg-[#c0392b] text-white transition"
          >
            ✕ Quitter
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {notif && (
        <div
          className={`mb-4 p-3.5 rounded-xl font-bold text-xs sm:text-sm text-center shadow-lg transition animate-fade-in ${
            notif.ok
              ? 'bg-[#10b981] text-white'
              : 'bg-[#ef4444] text-white'
          }`}
        >
          {notif.ok ? '✅ ' : '⚠️ '}
          {notif.text}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          VIEW 1: ACCUEIL (Screenshot 1)
         ══════════════════════════════════════════════════════════════════════════ */}
      {view === 'accueil' && (
        <div className="bg-gradient-to-br from-[#1e3c72] via-[#2a5298] to-[#7e8ba3] rounded-3xl p-6 sm:p-10 text-white shadow-2xl space-y-8 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight drop-shadow-md">
              Gestion Commandes Poussins
            </h1>
            <p className="text-sm sm:text-base text-sky-100 font-light tracking-wide">
              Choisissez une action
            </p>
          </div>

          {/* 3 Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Tableau de Bord */}
            <div
              onClick={() => setView('dashboard')}
              className="rounded-2xl p-6 text-center cursor-pointer transition transform hover:-translate-y-2 hover:shadow-2xl shadow-xl flex flex-col items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
              }}
            >
              <div className="text-5xl mb-3">📊</div>
              <h2 className="text-xl font-bold mb-2">Tableau de Bord</h2>
              <p className="text-xs text-purple-100 leading-relaxed opacity-90">
                Consultez vos commandes et disponibilites par date d'eclosion
              </p>
            </div>

            {/* Card 2: Nouvelle Commande */}
            <div
              onClick={() => setView('nouvelle')}
              className="rounded-2xl p-6 text-center cursor-pointer transition transform hover:-translate-y-2 hover:shadow-2xl shadow-xl flex flex-col items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
              }}
            >
              <div className="text-5xl mb-3">➕</div>
              <h2 className="text-xl font-bold mb-2">Nouvelle Commande</h2>
              <p className="text-xs text-emerald-100 leading-relaxed opacity-90">
                Creez une nouvelle commande de poussins
              </p>
            </div>

            {/* Card 3: Chercher / Modifier */}
            <div
              onClick={() => setView('chercher')}
              className="rounded-2xl p-6 text-center cursor-pointer transition transform hover:-translate-y-2 hover:shadow-2xl shadow-xl flex flex-col items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              }}
            >
              <div className="text-5xl mb-3">🔍</div>
              <h2 className="text-xl font-bold mb-2">Chercher / Modifier</h2>
              <p className="text-xs text-amber-100 leading-relaxed opacity-90">
                Recherchez et modifiez vos commandes existantes
              </p>
            </div>
          </div>

          {/* Contact Section */}
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 text-white space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <span>📞</span>
              <span>Contact</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white/10 rounded-xl p-3">
                <span className="block text-white/70 text-[11px] mb-1">Tel 1</span>
                <span className="font-bold text-sm">+223 66 56 50 55</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <span className="block text-white/70 text-[11px] mb-1">Tel 2</span>
                <span className="font-bold text-sm">+223 66 71 97 17</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 sm:col-span-2">
                <span className="block text-white/70 text-[11px] mb-1">Email</span>
                <span className="font-bold text-sm">samcheentreprise@gmail.com</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          VIEW 2: DASHBOARD (Screenshot 2)
         ══════════════════════════════════════════════════════════════════════════ */}
      {view === 'dashboard' && (
        <div className="bg-gradient-to-br from-[#f8f9fa] to-[#e0f2fe] rounded-3xl p-5 sm:p-8 space-y-6 shadow-xl border border-sky-100 animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5b7c99] to-[#6b8db5] text-white p-6 rounded-2xl shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📊</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Tableau de Bord</h1>
                <p className="text-xs text-sky-100 font-light mt-0.5">
                  Vue d'ensemble de vos commandes de poussins
                </p>
              </div>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-[#5b7c99]">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                📦 PRÉVISION TOTALE
              </div>
              <div className="text-3xl font-extrabold text-[#5b7c99] tabular-nums">
                {totalPrevision.toLocaleString('fr-FR')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Tous les poussins prévus</div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-[#f97316]">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                ✅ COMMANDÉ
              </div>
              <div className="text-3xl font-extrabold text-[#f97316] tabular-nums">
                {totalCommande.toLocaleString('fr-FR')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{tauxGlobal}% du total</div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-[#10b981]">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                🎯 DISPONIBLE
              </div>
              <div className="text-3xl font-extrabold text-[#10b981] tabular-nums">
                {totalDisponible.toLocaleString('fr-FR')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Encore à réserver</div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-[#5b7c99]">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                📈 TAUX REMPLISSAGE
              </div>
              <div className="text-3xl font-extrabold text-[#5b7c99] tabular-nums">
                {tauxGlobal}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Global</div>
            </div>
          </div>

          {/* Dates d'Éclosion Cards */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
              <span>📅</span>
              <span>Dates d'Éclosion</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hatchDatesData.map((d) => {
                const dispo = d.prevision - d.commande;
                const taux = d.prevision > 0 ? Math.round((d.commande / d.prevision) * 100) : 0;
                const progressWidth = Math.min(100, Math.max(0, taux));

                return (
                  <div
                    key={d.date}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 transition hover:shadow-md hover:-translate-y-1"
                    style={{ borderLeft: '5px solid #10b981' }}
                  >
                    {/* Header */}
                    <div className="bg-[#f8f9fa] px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <span className="font-bold text-sm text-[#1e293b]">{d.dateFormatee}</span>
                      <span className="bg-white border border-slate-200 px-2.5 py-0.5 rounded-full text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Ouvert</span>
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span className="font-medium">Prévision</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {d.prevision.toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="font-medium">Commandé</span>
                        <span className="font-bold text-[#5b7c99] text-sm">
                          {d.commande.toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="font-medium">Disponible</span>
                        <span className="font-bold text-[#10b981] text-sm">
                          {dispo.toLocaleString('fr-FR')}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progressWidth}%`,
                            background:
                              progressWidth >= 90
                                ? '#ef4444'
                                : progressWidth >= 50
                                ? '#f97316'
                                : '#10b981',
                          }}
                        />
                      </div>
                      <div className="text-right text-[11px] font-bold text-slate-400">
                        {taux}% rempli
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setView('accueil')}
              className="px-6 py-2.5 bg-gradient-to-r from-[#5b7c99] to-[#6b8db5] hover:opacity-90 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition"
            >
              Fermer
            </button>
            <button
              onClick={() => showNotif('Dashboard rafraîchi avec succès.', true)}
              className="px-6 py-2.5 bg-white hover:bg-slate-50 text-[#5b7c99] border-2 border-[#5b7c99] rounded-xl text-xs font-bold uppercase tracking-wider transition"
            >
              Rafraîchir
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          VIEW 3: NOUVELLE COMMANDE (Screenshots 3 & 4)
         ══════════════════════════════════════════════════════════════════════════ */}
      {view === 'nouvelle' && (
        <div className="bg-white rounded-3xl max-w-2xl mx-auto shadow-2xl overflow-hidden border border-slate-200 animate-slide-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5b7c99] to-[#6b8db5] text-white p-5 text-center">
            <h1 className="text-lg font-bold flex items-center justify-center gap-2">
              <span>🐣</span>
              <span>Nouvelle Commande</span>
            </h1>
            <p className="text-xs text-sky-100 font-light mt-0.5">
              Complétez les informations ci-dessous
            </p>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Section 1: Date d'éclosion cards */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#5b7c99] flex items-center gap-1.5 border-l-2 border-[#5b7c99] pl-2">
                <span>📅</span>
                <span>Date d'éclosion</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {hatchDatesData.slice(0, 2).map((d) => {
                  const isSelected = selDateKey === d.date;
                  const dispo = d.prevision - d.commande;

                  return (
                    <div
                      key={d.date}
                      onClick={() => setSelDateKey(d.date)}
                      className={`p-3.5 rounded-xl cursor-pointer transition text-white shadow-md ${
                        isSelected
                          ? 'ring-4 ring-sky-300 scale-[1.02]'
                          : 'opacity-90 hover:opacity-100'
                      }`}
                      style={{
                        background:
                          dispo <= 50
                            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      }}
                    >
                      <div className="font-extrabold text-sm">{d.date}</div>
                      <div className="text-xs text-white/90">{dispo} place(s)</div>
                      <div className="text-[11px] text-white/80 mt-1">{d.type}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Client */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#5b7c99] flex items-center gap-1.5 border-l-2 border-[#5b7c99] pl-2">
                <span>👤</span>
                <span>Client</span>
              </div>

              {!selClient ? (
                <>
                  <input
                    type="text"
                    placeholder="Rechercher un client..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gradient-to-r from-[#f0f4f8] to-[#ede9fe] border-2 border-[#5b7c99] rounded-xl text-sm font-semibold text-[#4f46e5] focus:outline-none"
                  />

                  {/* Clients List */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {filteredClients.slice(0, 4).map((c, i) => {
                      const ini = `${(c.prenom[0] || '').toUpperCase()}${(c.nom[0] || '').toUpperCase()}`;

                      return (
                        <div
                          key={i}
                          onClick={() => setSelClient(c)}
                          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition hover:border-[#1a5d3d]"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[#1a5d3d] to-[#2a8659] text-white font-bold text-xs flex items-center justify-center">
                            {ini}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-800">{c.label}</div>
                            <div className="text-xs text-slate-400">
                              {c.ville || 'Bamako'} · {c.telephone || '--'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Button + Créer un nouveau client */}
                  {!showNewClientForm && (
                    <button
                      type="button"
                      onClick={() => setShowNewClientForm(true)}
                      className="w-full py-3 border-2 border-dashed border-[#5b7c99] bg-gradient-to-r from-[#f0f4f8] to-[#ede9fe] text-[#5b7c99] hover:bg-[#d5dce3] rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                    >
                      <span>+</span>
                      <span>Créer un nouveau client</span>
                    </button>
                  )}
                </>
              ) : (
                /* Selected Client banner */
                <div className="p-3 bg-gradient-to-r from-[#d5dce3] to-[#e8ecf1] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                      {(selClient.prenom[0] || 'C') + (selClient.nom[0] || '')}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800">{selClient.label}</div>
                      <div className="text-xs text-slate-500">
                        {selClient.ville} · {selClient.telephone}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelClient(null)}
                    className="px-3 py-1 bg-white border border-[#5b7c99] text-[#5b7c99] rounded-lg text-xs font-bold hover:bg-[#5b7c99] hover:text-white transition"
                  >
                    Changer
                  </button>
                </div>
              )}

              {/* Inline New Client Form */}
              {showNewClientForm && (
                <div className="bg-slate-50 border-l-4 border-[#1a5d3d] p-4 rounded-xl space-y-3 animate-slide-up">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Prénom"
                      value={ncPrenom}
                      onChange={(e) => setNcPrenom(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Nom"
                      value={ncNom}
                      onChange={(e) => setNcNom(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Ville"
                      value={ncVille}
                      onChange={(e) => setNcVille(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-xs"
                    />
                    <input
                      type="tel"
                      placeholder="Tél"
                      value={ncTel}
                      onChange={(e) => setNcTel(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewClientForm(false)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNewClient}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                    >
                      Ajouter le client
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Type produit & Prix unitaire */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#5b7c99] mb-1.5 flex items-center gap-1.5">
                  <span>📦</span>
                  <span>Type Produit</span>
                </div>
                <div className="p-3 bg-gradient-to-r from-[#f0f4f8] to-[#ede9fe] border-l-4 border-[#5b7c99] rounded-lg text-sm font-bold text-[#5b7c99]">
                  {typeProduit || '(Sélectionnez une date →)'}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#5b7c99] mb-1.5 flex items-center gap-1.5">
                  <span>💰</span>
                  <span>Prix Unitaire</span>
                </div>
                <input
                  type="text"
                  readOnly
                  value={prixUnitaire}
                  className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 font-semibold"
                />
              </div>
            </div>

            {/* Section 4: Quantité */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                <span>📦</span>
                <span>Quantité</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantite((q) => Math.max(1, q - 50))}
                  className="w-10 h-10 border border-slate-300 rounded-lg font-black text-lg bg-white text-[#5b7c99] hover:bg-slate-50 transition"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantite}
                  onChange={(e) => setQuantite(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 py-2.5 px-3 border-2 border-[#5b7c99] rounded-lg text-center font-bold text-base bg-gradient-to-r from-[#f0f4f8] to-[#ede9fe] text-[#4f46e5] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantite((q) => q + 50)}
                  className="w-10 h-10 border border-slate-300 rounded-lg font-black text-lg bg-white text-[#5b7c99] hover:bg-slate-50 transition"
                >
                  +
                </button>
              </div>
            </div>

            {/* Section 5: Notes */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#2c3e50] mb-1.5 flex items-center gap-1.5">
                <span>📝</span>
                <span>Notes (Optionnel)</span>
              </div>
              <textarea
                rows={2}
                placeholder="Remarques supplémentaires..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border-2 border-[#5b7c99] rounded-xl text-xs bg-gradient-to-r from-[#f0f4f8] to-[#ede9fe] text-[#4f46e5] focus:outline-none"
              />
            </div>

            {/* Section 6: Montant total banner */}
            <div className="bg-gradient-to-r from-[#5b7c99] to-[#6b8db5] text-white p-4 rounded-xl text-center shadow-md">
              <div className="text-[10px] uppercase font-bold tracking-widest opacity-90 mb-1">
                MONTANT TOTAL
              </div>
              <div className="text-2xl font-black">
                {montantTotal.toLocaleString('fr-FR')} F CFA
              </div>
            </div>
          </div>

          {/* Footer Buttons (Screenshot 4) */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
            <button
              type="button"
              onClick={handleSaveCommande}
              className="flex-1 py-3 bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition"
            >
              ✅ Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setView('accueil')}
              className="flex-1 py-3 bg-gradient-to-r from-[#ef4444] to-[#f87171] hover:from-[#dc2626] hover:to-[#ef4444] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition"
            >
              🏠 Quitter
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          VIEW 4: CHERCHER / MODIFIER (Screenshot 5)
         ══════════════════════════════════════════════════════════════════════════ */}
      {view === 'chercher' && (
        <div className="bg-white rounded-3xl max-w-4xl mx-auto shadow-2xl overflow-hidden border border-slate-200 animate-fade-in space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5b7c99] to-[#6b8db5] text-white p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Chercher une Commande</h1>
                <p className="text-xs text-sky-100 font-light mt-0.5">
                  Trouvez et modifiez vos commandes facilement
                </p>
              </div>
            </div>
            <button
              onClick={() => setView('accueil')}
              className="text-white hover:text-slate-200 text-2xl font-bold p-1 leading-none"
            >
              ✕
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Rechercher par ID, Prénom ou Nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#5b7c99]"
              />
              <button
                type="button"
                className="px-6 py-2.5 bg-gradient-to-r from-[#5b7c99] to-[#6b8db5] text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm hover:opacity-95"
              >
                Chercher
              </button>
            </div>
          </div>

          {/* Orders List (Screenshot 5) */}
          <div className="p-6 pt-2 space-y-3 max-h-[60vh] overflow-y-auto">
            {filteredCommandes.map((cmd) => {
              const isConfirmed = cmd.statut === 'Confirmée';

              return (
                <div
                  key={cmd.id}
                  onClick={() => handleOpenEdit(cmd)}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition cursor-pointer hover:border-[#5b7c99] space-y-1.5"
                  style={{ borderLeft: '4px solid #5b7c99' }}
                >
                  <div className="text-xs font-bold text-[#5b7c99] uppercase tracking-wide">
                    {cmd.id}
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {cmd.prenom} {cmd.nom}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <span>📦</span>
                      <strong className="text-slate-800">{cmd.quantite} poussin(s)</strong>
                    </span>
                    <span
                      className={`font-semibold ${
                        isConfirmed ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {cmd.statut}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredCommandes.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">
                Aucune commande trouvée.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          EDIT MODAL (Screenshot 6)
         ══════════════════════════════════════════════════════════════════════════ */}
      {editingCommande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-slide-up">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#5b7c99] to-[#6b8db5] text-white p-4 flex items-center justify-between">
              <h2 className="font-bold text-base">Modifier la Commande</h2>
              <button
                onClick={() => setEditingCommande(null)}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Info Box */}
              <div className="bg-[#f8f9fa] border-l-4 border-[#5b7c99] p-3.5 rounded-lg space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">ID:</span>
                  <span className="font-bold text-slate-900">{editingCommande.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Client:</span>
                  <span className="font-bold text-slate-900">
                    {editingCommande.prenom} {editingCommande.nom}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Quantité:</span>
                  <span className="font-bold text-slate-900">{editQty} poussin(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Total:</span>
                  <span className="font-bold text-slate-900">
                    {(editQty * editingCommande.prixUnitaire).toLocaleString('fr-FR')} F CFA
                  </span>
                </div>
              </div>

              {/* Edit Quantité */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  QUANTITÉ
                </label>
                <input
                  type="number"
                  min="1"
                  value={editQty}
                  onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                />
              </div>

              {/* Edit Statut */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  STATUT
                </label>
                <select
                  value={editStatut}
                  onChange={(e) => setEditStatut(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold bg-white"
                >
                  <option value="En attente">En attente</option>
                  <option value="Confirmée">Confirmée</option>
                  <option value="Livrée">Livrée</option>
                  <option value="Annulée">Annulée</option>
                </select>
              </div>

              {/* Edit Notes */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  NOTES
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleSaveModified}
                className="px-4 py-2 bg-gradient-to-r from-[#5b7c99] to-[#6b8db5] text-white rounded-lg font-bold text-xs uppercase"
              >
                ✅ ENREGISTRER
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-[#ef4444] text-white rounded-lg font-bold text-xs uppercase"
              >
                🗑️ SUPPRIMER
              </button>
              <button
                type="button"
                onClick={() => setEditingCommande(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold text-xs uppercase"
              >
                ANNULER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal with WhatsApp Links */}
      {successModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Commande enregistrée !</h3>
              <p className="text-xs text-slate-500 mt-1">
                Référence : <strong>{successModal.id}</strong>
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {successModal.waClient && (
                <a
                  href={successModal.waClient}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  💬 WhatsApp Client
                </a>
              )}
              {successModal.waGest && (
                <a
                  href={successModal.waGest}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full py-2.5 px-4 bg-[#128C7E] hover:bg-[#0e7468] text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  📱 WhatsApp Gestionnaire
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSuccessModal({ open: false, id: '' })}
              className="w-full py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
