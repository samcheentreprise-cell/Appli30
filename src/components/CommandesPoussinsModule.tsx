import React, { useState, useMemo, useEffect } from 'react';
import { CommandePoussin, Client, OAC, UserRole } from '../types';
import { getFParamData } from '../services/googleSheet';

interface CommandesPoussinsModuleProps {
  commandes: CommandePoussin[];
  clients: Client[];
  oacList: OAC[];
  currentUser: {username: string, role: UserRole} | null;
  onAddCommande: (cmd: CommandePoussin) => void;
  onUpdateCommande?: (cmd: CommandePoussin) => void;
  onDeleteCommande?: (id: string) => void;
  onAddClient?: (client: Client) => void;
  onNavigateToLivraisons?: () => void;
  onClose?: () => void;
}

// Distinct vibrant gradients for each available hatch date card
export const HATCH_COLOR_PALETTES = [
  {
    bg: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)', // Bleu Roi
    ring: 'ring-sky-300',
    border: '#60a5fa',
  },
  {
    bg: 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)', // Vert Émeraude
    ring: 'ring-emerald-300',
    border: '#34d399',
  },
  {
    bg: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)', // Violet
    ring: 'ring-purple-300',
    border: '#a78bfa',
  },
  {
    bg: 'linear-gradient(135deg, #9a3412 0%, #ea580c 50%, #f97316 100%)', // Orange / Ambre
    ring: 'ring-orange-300',
    border: '#fb923c',
  },
  {
    bg: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)', // Sarcelle
    ring: 'ring-teal-300',
    border: '#2dd4bf',
  },
  {
    bg: 'linear-gradient(135deg, #9d174d 0%, #db2777 50%, #f43f5e 100%)', // Rose Framboise
    ring: 'ring-rose-300',
    border: '#fb7185',
  },
  {
    bg: 'linear-gradient(135deg, #854d0e 0%, #d97706 50%, #f59e0b 100%)', // Bronze / Or
    ring: 'ring-amber-300',
    border: '#fde047',
  },
];

export const CommandesPoussinsModule: React.FC<CommandesPoussinsModuleProps> = ({
  commandes,
  clients,
  oacList,
  currentUser,
  onAddCommande,
  onUpdateCommande,
  onDeleteCommande,
  onAddClient,
  onNavigateToLivraisons,
  onClose,
}) => {
  // Navigation View: 'accueil' | 'dashboard' | 'nouvelle' | 'chercher'
  const [view, setView] = useState<'accueil' | 'dashboard' | 'nouvelle' | 'chercher'>('accueil');

  // ✅ Prix chargés dynamiquement depuis F-Param (col E/F, à partir ligne 4)
  const [produitsPrix, setProduitsPrix] = useState<Record<string, number>>({
    'Chairs': 700,        // fallback si F-Param indisponible
    'Sasso': 900,
    'Fermier': 700,
    'Cou-nu': 650,
    'Pondeuse': 800,
  });

  // Charger F-Param au montage
  useEffect(() => {
    (async () => {
      const fp = await getFParamData();
      if (fp && Object.keys(fp.produitsPrix).length > 0) {
        setProduitsPrix(fp.produitsPrix);
        console.log('[CommandesPoussins] F-Param chargé:', fp);
      }
    })();
  }, []);

  // Prix d'un type (synchrone, avec fallback)
  const getPriceForType = (t: string): number => {
    const key = (t || '').trim();
    if (produitsPrix[key] !== undefined) return produitsPrix[key];
    // Recherche insensible à la casse
    const lowerKey = key.toLowerCase();
    for (const k of Object.keys(produitsPrix)) {
      if (k.toLowerCase() === lowerKey) return produitsPrix[k];
    }
    return 0; // 0 si inconnu
  };

  // Helper to parse French date string DD/MM/YYYY into Date
  const parseFrDate = (str: string | undefined): Date | null => {
    if (!str) return null;
    const clean = str.trim();
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (!isNaN(d.getTime())) return d;
      }
    }
    if (clean.includes('-')) {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // State for "Nouvelle Commande"
  const [selDateKey, setSelDateKey] = useState<string>('23/10/2026');
  const [selType, setSelType] = useState<string>('Fermier');
  const [selClient, setSelClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [showNewClientForm, setShowNewClientForm] = useState<boolean>(false);
  const [ncPrenom, setNcPrenom] = useState<string>('');
  const [ncNom, setNcNom] = useState<string>('');
  const [ncVille, setNcVille] = useState<string>('');
  const [ncTel, setNcTel] = useState<string>('');
  const [ncEmail, setNcEmail] = useState<string>('');
  const [quantite, setQuantite] = useState<number>(100);
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

  // Hatch dates forecast & capacity data derived strictly from real Sheet OAC and orders
  const hatchDatesData = useMemo(() => {
    const datesMap: Record<
      string,
      {
        id: string;
        date: string;
        dateFormatee: string;
        dateObj: Date | null;
        type: string;
        race: string;
        lotId?: string;
        fournisseur?: string;
        prix: number;
        prevision: number;
        commande: number;
        lots: OAC[];
        isPast: boolean;
      }
    > = {};

    const todayTime = new Date();
    todayTime.setHours(0, 0, 0, 0);

    // 1. Build from real OAC batches in the Sheet (each batch/race has its own planned hatching)
    oacList.forEach((oac) => {
      if (!oac.eclosion) return;
      const dateKey = oac.eclosion.trim();
      const prevQty = oac.attendus || (oac.fertiles ? Math.round(oac.fertiles * 0.8) : Math.round((oac.recus || (oac.cartons || 0) * 360) * 0.75));
      const type = (oac.type || oac.race || 'Chairs').trim();
      const race = (oac.race || '').trim();
      const prix = getPriceForType(type);
      const dObj = parseFrDate(dateKey);
      // ✅ CORRECTION : une date passée = strictement avant aujourd'hui
      // (indépendamment de "complet" — si la date est passée, on masque)
      const isPast = dObj ? dObj.getTime() < todayTime.getTime() : false;

      const dateFormatee = dObj
        ? dObj.toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : dateKey;

      // Unique key per batch so each distinct hatching/race on the same date is kept separate
      const key = oac.id
        ? `${dateKey}___${oac.id}`
        : `${dateKey}___${type.toLowerCase()}${race && race.toLowerCase() !== type.toLowerCase() ? `___${race.toLowerCase()}` : ''}`;

      if (!datesMap[key]) {
        datesMap[key] = {
          id: key,
          date: dateKey,
          dateFormatee,
          dateObj: dObj,
          type,
          race: race && race.toLowerCase() !== type.toLowerCase() ? race : '',
          lotId: oac.id || '',
          fournisseur: oac.fournisseur || '',
          prix,
          prevision: 0,
          commande: 0,
          lots: [],
          isPast: Boolean(isPast),
        };
      } else {
        // Mettre à jour le prix au cas où il a changé
        datesMap[key].prix = prix;
      }

      datesMap[key].prevision += prevQty;
      datesMap[key].lots.push(oac);
    });

    // 2. Aggregate orders from sheet
    commandes.forEach((cmd) => {
      if (cmd.statut === 'Annulée') return;
      const cmdDate = cmd.dateEclosion?.trim();
      if (!cmdDate) return;

      const cmdType = (cmd.typeProduit || 'Chairs').trim().toLowerCase();

      // Find matching hatching for this date and type
      const matching = Object.values(datesMap).find(
        (item) => item.date === cmdDate && (item.type.toLowerCase() === cmdType || (item.race && item.race.toLowerCase() === cmdType))
      );

      if (matching) {
        matching.commande += Number(cmd.quantite) || 0;
        matching.prix = getPriceForType(matching.type);
      } else {
        const dObj = parseFrDate(cmdDate);
        const isPast = dObj ? dObj.getTime() < todayTime.getTime() : false;
        
        // Exclude past dates from new hatches
        if (isPast) return;

        const rawType = cmd.typeProduit || 'Chairs';
        const cmdPrix = cmd.prixUnitaire || getPriceForType(rawType);
        const dateFormatee = dObj
          ? dObj.toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : cmdDate;

        const key = `${cmdDate}___${rawType.toLowerCase()}`;
        if (!datesMap[key]) {
          datesMap[key] = {
            id: key,
            date: cmdDate,
            dateFormatee,
            dateObj: dObj,
            type: rawType,
            race: '',
            lotId: '',
            fournisseur: '',
            prix: cmdPrix,
            prevision: 0,
            commande: Number(cmd.quantite) || 0,
            lots: [],
            isPast: Boolean(isPast),
          };
        } else {
          datesMap[key].commande += Number(cmd.quantite) || 0;
          datesMap[key].prix = getPriceForType(datesMap[key].type);
        }
      }
    });

    // Sort chronologically: active/future dates first, then past dates
    const sorted = Object.values(datesMap)
      .filter(d => !d.isPast) // Exclude past dates
      .sort((a, b) => {
        const ta = a.dateObj ? a.dateObj.getTime() : 0;
        const tb = b.dateObj ? b.dateObj.getTime() : 0;
        if (ta !== tb) return ta - tb;
        return a.type.localeCompare(b.type);
      });

    return sorted;
  }, [oacList, commandes, produitsPrix]);

  // Active / Upcoming hatch dates (with incubator batches or future dates)
  const activeHatchDates = useMemo(() => {
    const list = hatchDatesData.filter((d) => !d.isPast || d.prevision > 0);
    return list.length > 0 ? list : hatchDatesData;
  }, [hatchDatesData]);

  // Synchronize selDateKey & selType with available active hatch dates
  useEffect(() => {
    if (activeHatchDates.length > 0) {
      const match = activeHatchDates.find(
        (d) => d.date === selDateKey && d.type.toLowerCase() === selType.toLowerCase()
      );
      if (!match) {
        setSelDateKey(activeHatchDates[0].date);
        setSelType(activeHatchDates[0].type);
      }
    }
  }, [activeHatchDates, selDateKey, selType]);

  // Current selected hatch date info
  const selectedHatchDate = useMemo(() => {
    return (
      activeHatchDates.find(
        (d) => d.date === selDateKey && d.type.toLowerCase() === selType.toLowerCase()
      ) ||
      activeHatchDates.find((d) => d.date === selDateKey) ||
      activeHatchDates[0]
    );
  }, [activeHatchDates, selDateKey, selType]);

  const prixUnitaire = selectedHatchDate ? selectedHatchDate.prix : getPriceForType(selType || 'Chairs');
  const typeProduit = selectedHatchDate?.type || selType || 'Chairs';
  const montantTotal = quantite * prixUnitaire;

  // Overall KPI across active dates
  const { totalPrevision, totalCommande, totalDisponible, tauxGlobal } = useMemo(() => {
    let prev = 0;
    let cmd = 0;
    activeHatchDates.forEach((d) => {
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
  }, [activeHatchDates]);

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
    if (quantite > available) {
      showNotif(
        `Stock insuffisant : il ne reste que ${Math.max(0, available).toLocaleString('fr-FR')} place(s) pour cette date.`,
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
      receptionnaire: currentUser?.username || 'Système',
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

    // Reset Form completely
    setQuantite(100);
    setNotes('');
    setSelClient(null);
    setClientSearch('');
    setShowNewClientForm(false);
    setNcPrenom('');
    setNcNom('');
    setNcVille('');
    setNcTel('');
    setNcEmail('');
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
          {onNavigateToLivraisons && (
            <button
              onClick={onNavigateToLivraisons}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 bg-white/10 text-white hover:bg-white/20 border border-white/15"
              title="Passer au module de livraison et contrôle des sorties"
            >
              <span>🚚</span>
              <span>Livraisons</span>
            </button>
          )}
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

          {/* 4 Modules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Card 4: Livraisons & Sorties */}
            <div
              onClick={() => {
                if (onNavigateToLivraisons) {
                  onNavigateToLivraisons();
                }
              }}
              className="rounded-2xl p-6 text-center cursor-pointer transition transform hover:-translate-y-2 hover:shadow-2xl shadow-xl flex flex-col items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              }}
            >
              <div className="text-5xl mb-3">🚚</div>
              <h2 className="text-xl font-bold mb-2">Livraisons Poussins</h2>
              <p className="text-xs text-sky-100 leading-relaxed opacity-90">
                Pointage des poussins réellement fournis par éclosion
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
                <span>📅</span>
                <span>Dates d'Éclosion & Prévisions Poussins</span>
              </h2>
              <div className="text-xs font-semibold text-slate-500">
                {activeHatchDates.length} date(s) active(s)
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeHatchDates.map((d) => {
                const dispo = Math.max(0, d.prevision - d.commande);
                // Correction du calcul du taux de remplissage : utiliser division flottante * 100 et arrondir
                const taux = d.prevision > 0 ? Math.round((d.commande / d.prevision) * 100) : 0;
                const progressWidth = Math.min(100, Math.max(0, taux));
                const isComplet = dispo === 0 && d.prevision > 0;

                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSelDateKey(d.date);
                      setSelType(d.type);
                      setView('nouvelle');
                    }}
                    className="bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between border border-slate-200/80"
                    style={{ borderLeft: '5px solid #10b981' }}
                  >
                    {/* Header */}
                    <div className="bg-[#f8f9fa] px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 text-sm sm:text-base tracking-tight">
                          {d.dateFormatee}
                        </div>
                        <div className="text-xs font-bold text-[#1a5276] uppercase tracking-wide mt-0.5 flex items-center gap-1.5">
                          <span>{d.type}</span>
                          {d.race && d.race.toLowerCase() !== d.type.toLowerCase() && (
                            <span className="text-slate-500 font-normal">({d.race})</span>
                          )}
                          {d.lotId && (
                            <span className="text-[10px] text-slate-400 font-medium font-mono">
                              • {d.lotId}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200/90 px-3 py-1 rounded-full text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isComplet ? 'bg-red-500' : 'bg-[#10b981]'
                          }`}
                        />
                        <span>{isComplet ? 'Complet' : 'Ouvert'}</span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-semibold">Prévision</span>
                        <span className="font-extrabold text-slate-900 text-base sm:text-lg tabular-nums">
                          {d.prevision.toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-semibold">Commandé</span>
                        <span className="font-bold text-[#334155] text-base sm:text-lg tabular-nums">
                          {d.commande.toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-semibold">Disponible</span>
                        <span className="font-bold text-[#10b981] text-base sm:text-lg tabular-nums">
                          {dispo.toLocaleString('fr-FR')}
                        </span>
                      </div>

                      {/* Progress Bar & percentage */}
                      <div className="pt-2">
                        <div className="w-full bg-[#f1f5f9] rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progressWidth}%`,
                              background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 60%, #ef4444 100%)',
                            }}
                          />
                        </div>
                        <div className="text-center text-xs font-semibold text-slate-500 mt-2">
                          {taux}% rempli
                        </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {hatchDatesData.map((d, idx) => {
                  const isSelected = selDateKey === d.date && selType.toLowerCase() === d.type.toLowerCase();
                  const dispo = Math.max(0, d.prevision - d.commande);
                  const palette = HATCH_COLOR_PALETTES[idx % HATCH_COLOR_PALETTES.length];

                  return (
                    <div
                      key={d.id}
                      onClick={async () => {
                        setSelDateKey(d.date);
                        setSelType(d.type);
                        const fp = await getFParamData(true);
                        setProduitsPrix(fp.produitsPrix);
                      }}
                      className={`p-3.5 rounded-xl cursor-pointer transition text-white shadow-md relative overflow-hidden select-none ${
                        isSelected
                          ? 'ring-4 ring-offset-2 ring-sky-300 scale-[1.03] shadow-lg'
                          : 'opacity-90 hover:opacity-100 hover:scale-[1.01]'
                      }`}
                      style={{
                        background: palette.bg,
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-extrabold text-sm tracking-wide">{d.date}</div>
                        {isSelected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" title="Sélectionné" />
                        )}
                      </div>
                      <div className="text-xs font-bold text-white mt-1 uppercase tracking-wide">
                        {d.type} {d.race && d.race.toLowerCase() !== d.type.toLowerCase() ? `(${d.race})` : ''}
                      </div>
                      <div className="text-[11px] font-medium text-white/90 mt-1 flex items-center justify-between">
                        <span>{dispo.toLocaleString('fr-FR')} place(s)</span>
                        {dispo <= 50 && dispo > 0 && (
                          <span className="text-[9px] bg-black/25 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                            Presque plein
                          </span>
                        )}
                      </div>
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
