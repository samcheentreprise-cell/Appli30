import React, { useState, useMemo, useEffect } from 'react';
import { Facture, Client, Bordereau, FactureLigne, BordereauLigne } from '../types';
import { getFParamData } from '../services/googleSheet';

interface FacturesModuleProps {
  factures: Facture[];
  clients: Client[];
  bordereaux?: Bordereau[];
  onAddFacture: (facture: Facture) => void;
  onUpdateFacture?: (facture: Facture) => void;
  onDeleteFacture?: (ligne: number) => void;
  onAddBordereau?: (bl: Bordereau) => void;
  onAddClient?: (client: Client) => void;
  onUpdateClient?: (client: Client) => void;
  onDeleteClient?: (index: number) => void;
  onClose?: () => void;
}

export const FacturesModule: React.FC<FacturesModuleProps> = ({
  factures,
  clients,
  bordereaux = [],
  onAddFacture,
  onUpdateFacture,
  onDeleteFacture,
  onAddBordereau,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onClose,
}) => {
  // Active Tab: 'f' | 'b' | 's' | 'mc' | 'cb'
  const [activeTab, setActiveTab] = useState<'f' | 'b' | 's' | 'mc' | 'cb'>('f');

  // Next invoice number
  const nextNumFact = useMemo(() => {
    const annee = new Date().getFullYear();
    const count = factures.length + 1;
    return `FAC-${annee}-${String(count).padStart(3, '0')}`;
  }, [factures]);

  // Next BL number
  const nextNumBL = useMemo(() => {
    const annee = new Date().getFullYear();
    const count = bordereaux.length + 1;
    return `BL-${annee}-${String(count).padStart(3, '0')}`;
  }, [bordereaux]);

  // Current date
  const isoToday = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // TAB FACTURE STATE
  // ══════════════════════════════════════════════════════════════════════════
  const [factDate, setFactDate] = useState<string>(isoToday);
  const [factModeReglement, setFactModeReglement] = useState<string>('Virement');
  const [factRefCmd, setFactRefCmd] = useState<string>('');
  const [factClient, setFactClient] = useState<string>('');
  const [factAdresse, setFactAdresse] = useState<string>('');
  const [factRemise, setFactRemise] = useState<number>(0);
  const [factTVA, setFactTVA] = useState<number>(18);
  const [factAvecTVA, setFactAvecTVA] = useState<boolean>(false);
  const [factNotes, setFactNotes] = useState<string>('');

  // Produits et Prix dynamiques depuis F-Param
  const [produitsPrix, setProduitsPrix] = useState<Record<string, number>>({});
  
  useEffect(() => {
    (async () => {
      const fp = await getFParamData();
      setProduitsPrix(fp.produitsPrix);
    })();
  }, []);

  // Facture lines
  const [factLignes, setFactLignes] = useState<FactureLigne[]>([
    { designation: '', qte: 1, pu: 0 },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // TAB BL STATE
  // ══════════════════════════════════════════════════════════════════════════
  const [blDate, setBlDate] = useState<string>(isoToday);
  const [blClient, setBlClient] = useState<string>('');
  const [blAdresse, setBlAdresse] = useState<string>('');
  const [blRefCmd, setBlRefCmd] = useState<string>('');
  const [blLignes, setBlLignes] = useState<BordereauLigne[]>([
    { designation: '', qte: 1, unite: 'pcs', observations: '' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // MODALS & MESSAGES
  // ══════════════════════════════════════════════════════════════════════════
  const [notif, setNotif] = useState<{ text: string; ok: boolean } | null>(null);
  const [showNouveauClientModal, setShowNouveauClientModal] = useState<boolean>(false);
  const [ncPrenom, setNcPrenom] = useState('');
  const [ncNom, setNcNom] = useState('');
  const [ncVille, setNcVille] = useState('');
  const [ncTel, setNcTel] = useState('');
  const [ncEmail, setNcEmail] = useState('');

  // Validation output preview / WhatsApp state
  const [validatedDoc, setValidatedDoc] = useState<{
    type: 'f' | 'b';
    numero: string;
    client: string;
    total?: number;
    tel?: string;
    date?: string;
    adresse?: string;
    refCmd?: string;
    modeReglement?: string;
    lignes?: Array<{ designation: string; qte: number; pu?: number; total?: number; unite?: string }>;
    montantHT?: number;
    remise?: number;
    remiseVal?: number;
    tva?: number;
    tvaVal?: number;
    notes?: string;
  } | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // Search invoices tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFacture, setEditingFacture] = useState<Facture | null>(null);

  // Clients tab state
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientFormVisible, setClientFormVisible] = useState(false);

  const showMsg = (text: string, ok: boolean) => {
    setNotif({ text, ok });
    setTimeout(() => setNotif(null), 5000);
  };

  // Format currency helper
  const fm = (n: number) => Math.round(n).toLocaleString('fr-FR');

  // Selected client info lookup
  const selectedClientObj = useMemo(() => {
    return clients.find((c) => c.label.toLowerCase() === factClient.toLowerCase()) || null;
  }, [clients, factClient]);

  // Auto-fill address and phone when client is selected
  const handleClientChange = (val: string) => {
    setFactClient(val);
    const found = clients.find((c) => c.label.toLowerCase() === val.toLowerCase());
    if (found) {
      setFactAdresse(found.ville || '');
    }
  };

  const handleBLClientChange = (val: string) => {
    setBlClient(val);
    const found = clients.find((c) => c.label.toLowerCase() === val.toLowerCase());
    if (found) {
      setBlAdresse(found.ville || '');
    }
  };

  // Facture Calculations
  const { sousTotal, remiseMnt, tvaMnt, totalTTC } = useMemo(() => {
    let sous = 0;
    factLignes.forEach((l) => {
      sous += (l.qte || 0) * (l.pu || 0);
    });
    const remMnt = (sous * (factRemise || 0)) / 100;
    const ht = sous - remMnt;
    const tvMnt = factAvecTVA ? (ht * (factTVA || 0)) / 100 : 0;
    const ttc = ht + tvMnt;
    return {
      sousTotal: sous,
      remiseMnt: remMnt,
      tvaMnt: tvMnt,
      totalTTC: ttc,
    };
  }, [factLignes, factRemise, factTVA, factAvecTVA]);

  // Update line item in Facture
  const handleFactLineChange = (index: number, field: keyof FactureLigne, value: any) => {
    setFactLignes((prev) => {
      const next = [...prev];
      if (field === 'designation') {
        next[index] = {
          ...next[index],
          designation: value,
          pu: produitsPrix[value] || 0,
        };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const addFactLine = () => {
    setFactLignes((prev) => [...prev, { designation: '', qte: 1, pu: 0 }]);
  };

  const removeFactLine = (index: number) => {
    if (factLignes.length <= 1) return;
    setFactLignes((prev) => prev.filter((_, i) => i !== index));
  };

  // Update line item in BL
  const handleBLLineChange = (index: number, field: keyof BordereauLigne, value: any) => {
    setBlLignes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addBLLine = () => {
    setBlLignes((prev) => [
      ...prev,
      { designation: '', qte: 1, unite: 'pcs', observations: '' },
    ]);
  };

  const removeBLLine = (index: number) => {
    if (blLignes.length <= 1) return;
    setBlLignes((prev) => prev.filter((_, i) => i !== index));
  };

  // Reset Facture form inputs
  const resetFactureInputs = () => {
    setFactDate(isoToday);
    setFactModeReglement('Virement');
    setFactRefCmd('');
    setFactClient('');
    setFactAdresse('');
    setFactRemise(0);
    setFactAvecTVA(false);
    setFactNotes('');
    setFactLignes([{ designation: '', qte: 1, pu: 0 }]);
  };

  const razF = () => {
    resetFactureInputs();
    setValidatedDoc(null);
  };

  // Reset BL form inputs
  const resetBLInputs = () => {
    setBlDate(isoToday);
    setBlClient('');
    setBlAdresse('');
    setBlRefCmd('');
    setBlLignes([{ designation: '', qte: 1, unite: 'pcs', observations: '' }]);
  };

  const razBL = () => {
    resetBLInputs();
    setValidatedDoc(null);
  };

  // Save New Client from inline modal
  const handleSaveInlineClient = () => {
    if (!ncNom.trim()) {
      showMsg('Le nom est obligatoire.', false);
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
    setFactClient(full);
    setFactAdresse(ncVille.trim());
    setShowNouveauClientModal(false);
    setNcPrenom('');
    setNcNom('');
    setNcVille('');
    setNcTel('');
    setNcEmail('');
    showMsg(`Client "${full}" ajouté avec succès.`, true);
  };

  // Validate and Save Facture
  const handleValiderFacture = () => {
    if (!factClient.trim()) {
      showMsg('Veuillez saisir ou sélectionner un client.', false);
      return;
    }
    const validLines = factLignes.filter((l) => l.designation && l.qte > 0);
    if (validLines.length === 0) {
      showMsg('Veuillez ajouter au moins un article avec une quantité valide.', false);
      return;
    }

    const dateParts = factDate.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : factDate;

    const newFact: Facture = {
      ligne: factures.length + 2,
      numero: nextNumFact,
      date: formattedDate,
      client: factClient,
      telephone: selectedClientObj?.telephone || '',
      ville: factAdresse || selectedClientObj?.ville || '',
      adresseClient: factAdresse,
      emailClient: selectedClientObj?.email || '',
      refCmd: factRefCmd,
      lignes: validLines,
      nbArticles: validLines.length,
      montantHT: Math.round(sousTotal - remiseMnt),
      remisePct: factRemise,
      remiseVal: Math.round(remiseMnt),
      tvaPct: factAvecTVA ? factTVA : 0,
      tvaVal: Math.round(tvaMnt),
      total: Math.round(totalTTC),
      modeReglement: factModeReglement,
      echeance: '30 jours',
      statut: 'Emise',
      notes: factNotes,
    };

    onAddFacture(newFact);
    showMsg(`Facture ${nextNumFact} validée avec succès.`, true);
    setValidatedDoc({
      type: 'f',
      numero: nextNumFact,
      client: factClient,
      total: Math.round(totalTTC),
      tel: selectedClientObj?.telephone || '',
      date: formattedDate,
      adresse: factAdresse,
      refCmd: factRefCmd,
      modeReglement: factModeReglement,
      lignes: validLines.map((l) => ({ ...l, total: l.qte * l.pu })),
      montantHT: Math.round(sousTotal),
      remise: factRemise,
      remiseVal: Math.round(remiseMnt),
      tva: factAvecTVA ? factTVA : 0,
      tvaVal: Math.round(tvaMnt),
      notes: factNotes,
    });
    setIsDocModalOpen(true);
    // Immediately clear all input form fields
    resetFactureInputs();
  };

  // Validate and Save BL
  const handleValiderBL = () => {
    if (!blClient.trim()) {
      showMsg('Veuillez saisir un destinataire.', false);
      return;
    }
    const validLines = blLignes.filter((l) => l.designation && l.qte > 0);
    if (validLines.length === 0) {
      showMsg('Veuillez ajouter au moins un article avec une quantité valide.', false);
      return;
    }

    const dateParts = blDate.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : blDate;

    const newBL: Bordereau = {
      numero: nextNumBL,
      date: formattedDate,
      client: blClient,
      adresseClient: blAdresse,
      refCmd: blRefCmd,
      lignes: validLines,
      statut: 'Emis',
    };

    if (onAddBordereau) {
      onAddBordereau(newBL);
    }
    showMsg(`Bordereau ${nextNumBL} validé avec succès.`, true);
    setValidatedDoc({
      type: 'b',
      numero: nextNumBL,
      client: blClient,
      date: formattedDate,
      adresse: blAdresse,
      refCmd: blRefCmd,
      lignes: validLines.map((l) => ({ designation: l.designation, qte: l.qte, unite: l.unite })),
      tel: clients.find((c) => c.label.toLowerCase() === blClient.toLowerCase())?.telephone || '',
    });
    setIsDocModalOpen(true);
    // Immediately clear all input form fields
    resetBLInputs();
  };

  // Download printable PDF / View preview
  const handleDownloadPDF = () => {
    setIsDocModalOpen(true);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Send via WhatsApp
  const handleSendWhatsApp = () => {
    if (!validatedDoc) return;
    const tel = (validatedDoc.tel || '').replace(/[^0-9]/g, '');
    const cleanTel = tel.startsWith('223') ? tel : `223${tel}`;
    const txt = encodeURIComponent(
      `Bonjour ${validatedDoc.client},\n\nVeuillez trouver ci-joint votre facture N° ${validatedDoc.numero}\nMontant total : ${fm(validatedDoc.total || 0)} F CFA\n\nCouvoir SAMCHE\nTel : 66 56 50 55 / 66 71 97 17`
    );
    window.open(`https://wa.me/${cleanTel}?text=${txt}`, '_blank');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // CAHIER DE BORD (Screenshot 4) CALCULATIONS
  // ══════════════════════════════════════════════════════════════════════════
  const cahierDeBordStats = useMemo(() => {
    let totFactures = factures.length;
    let payees = 0;
    let emises = 0;
    let retard = 0;
    let caTotal = 0;
    let caEncaisse = 0;
    let caImpaye = 0;

    const clientMap: Record<string, number> = {};

    factures.forEach((f) => {
      const tot = f.total || 0;
      caTotal += tot;
      if (f.statut === 'Payée') {
        payees += 1;
        caEncaisse += tot;
      } else {
        emises += 1;
        caImpaye += tot;
      }

      if (f.client) {
        clientMap[f.client] = (clientMap[f.client] || 0) + tot;
      }
    });

    const topClients = Object.entries(clientMap)
      .map(([client, ca]) => ({ client, ca }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5);

    return {
      totalFactures: totFactures,
      payees,
      emises,
      retard,
      caTotal,
      caEncaisse,
      caImpaye,
      topClients,
    };
  }, [factures]);

  // Filtered invoices for Tab 's'
  const filteredFactures = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return factures;
    return factures.filter((f) => {
      const full = `${f.numero} ${f.client} ${f.telephone || ''} ${f.date || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [factures, searchQuery]);

  return (
    <div className="bg-[#f4f6f9] text-[#1a3050] min-h-[85vh] rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col font-sans animate-fade-in text-xs sm:text-sm">
      {/* ══════════════════════════════════════════════════════════════════════════
          TOP HEADER BAR (Dark Navy with Gold Tag)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#1a3050] px-5 py-3 flex items-center justify-between text-white flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-2xs flex-shrink-0">
            <img
              src="/logo-samche.png"
              alt="Logo SamChe"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = '/logo-samche.svg';
              }}
            />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold text-[#c8a850] tracking-wide flex items-center gap-1.5 font-serif">
              COUVOIR SAMCHE <span className="text-white/70 font-sans font-normal text-xs">— Factures &amp; BL</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-[#c8a850]/20 text-[#c8a850] border border-[#c8a850]/30 px-3 py-1 rounded-full text-xs font-bold tracking-wider">
            {activeTab === 'b' ? nextNumBL : nextNumFact}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              title="Fermer"
              className="text-slate-300 hover:text-white text-xl font-bold leading-none p-1 transition"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Toast Alert */}
      {notif && (
        <div
          className={`py-2 px-4 text-center font-bold text-xs shadow-md transition ${
            notif.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {notif.ok ? '✅ ' : '⚠️ '}
          {notif.text}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TABS ROW (Screenshots 1, 2, 3, 4)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex bg-white border-b-2 border-slate-200 px-3 flex-shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('f')}
          className={`py-3 px-4 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition border-b-2 -mb-[2px] ${
            activeTab === 'f'
              ? 'text-[#1a3050] font-bold border-[#c8a850]'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
        >
          <span>📄</span>
          <span>Facture</span>
        </button>

        <button
          onClick={() => setActiveTab('b')}
          className={`py-3 px-4 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition border-b-2 -mb-[2px] ${
            activeTab === 'b'
              ? 'text-[#1a3050] font-bold border-[#c8a850]'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
        >
          <span>🚚</span>
          <span>BL</span>
        </button>

        <button
          onClick={() => setActiveTab('s')}
          className={`py-3 px-4 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition border-b-2 -mb-[2px] ${
            activeTab === 's'
              ? 'text-[#1a3050] font-bold border-[#c8a850]'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
        >
          <span>🔍</span>
          <span>Factures</span>
        </button>

        <button
          onClick={() => setActiveTab('mc')}
          className={`py-3 px-4 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition border-b-2 -mb-[2px] ${
            activeTab === 'mc'
              ? 'text-[#1a3050] font-bold border-[#c8a850]'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
        >
          <span>👥</span>
          <span>Clients</span>
        </button>

        <button
          onClick={() => setActiveTab('cb')}
          className={`py-3 px-4 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition border-b-2 -mb-[2px] ${
            activeTab === 'cb'
              ? 'text-[#1a3050] font-bold border-[#c8a850]'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
        >
          <span>📊</span>
          <span>Cahier de bord</span>
        </button>
      </div>

      {/* Datalist for Client autocomplete */}
      <datalist id="dlcli">
        {clients.map((c, i) => (
          <option key={i} value={c.label} />
        ))}
      </datalist>

      {/* ══════════════════════════════════════════════════════════════════════════
          BODY CONTAINER
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
        {/* ────────────────────────────────────────────────────────────────────
            TAB 1: FACTURE (Screenshots 1 & 2)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'f' && (
          <div className="space-y-4">
            {/* Section INFORMATIONS */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex justify-between items-center border-l-4 border-[#c8a850] pl-2.5 pb-1">
                <span className="font-extrabold text-xs uppercase tracking-wider text-[#1a3050]">
                  INFORMATIONS
                </span>
                <button
                  type="button"
                  onClick={razF}
                  className="px-3 py-1 rounded-lg text-xs font-bold border border-[#c8a850] text-[#1a3050] hover:bg-[#c8a850]/10 transition flex items-center gap-1"
                >
                  <span>↺</span>
                  <span>Nouveau</span>
                </button>
              </div>

              {/* Row 1: N° Facture & Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    N° FACTURE
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={nextNumFact}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 select-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                    <span>DATE</span>
                    <span className="text-red-500 font-black">*</span>
                  </label>
                  <input
                    type="date"
                    value={factDate}
                    onChange={(e) => setFactDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-[#1a3050] focus:outline-none"
                    style={{
                      background: 'linear-gradient(135deg, #FFFEF5 0%, #FFFBF0 100%)',
                      border: '2px solid #E8D4A8',
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Mode de règlement & Réf. commande */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    MODE DE RÈGLEMENT
                  </label>
                  <select
                    value={factModeReglement}
                    onChange={(e) => setFactModeReglement(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:border-[#1a3050]"
                  >
                    <option value="Virement">Virement</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Comptant">Comptant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    RÉF. COMMANDE
                  </label>
                  <input
                    type="text"
                    placeholder="Optionnel"
                    value={factRefCmd}
                    onChange={(e) => setFactRefCmd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1a3050]"
                  />
                </div>
              </div>

              {/* Row 3: Client & Adresse / Ville */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                    <span>CLIENT</span>
                    <span className="text-red-500 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    list="dlcli"
                    placeholder="Saisir ou sélectionner..."
                    value={factClient}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-[#1a3050] focus:outline-none"
                    style={{
                      background: 'linear-gradient(135deg, #FFFEF5 0%, #FFFBF0 100%)',
                      border: '2px solid #E8D4A8',
                    }}
                  />
                  {selectedClientObj && (
                    <div className="bg-[#EEF8F8] border-l-4 border-[#0D6E6E] p-2 rounded-r-lg text-[11px] font-medium text-[#0D6E6E] mt-1.5 animate-fade-in">
                      {selectedClientObj.telephone && `Tel: ${selectedClientObj.telephone}`}
                      {selectedClientObj.telephone && selectedClientObj.email && ' | '}
                      {selectedClientObj.email && selectedClientObj.email}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                    <span>ADRESSE / VILLE</span>
                    <span className="text-red-500 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Adresse ou ville"
                    value={factAdresse}
                    onChange={(e) => setFactAdresse(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-[#1a3050] focus:outline-none"
                    style={{
                      background: 'linear-gradient(135deg, #FFFEF5 0%, #FFFBF0 100%)',
                      border: '2px solid #E8D4A8',
                    }}
                  />
                </div>
              </div>

              {/* Button Ajouter un nouveau client */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowNouveauClientModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-[#0e4d2e] to-[#10652c] hover:opacity-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <span>➕</span>
                  <span>Ajouter un nouveau client</span>
                </button>
              </div>
            </div>

            {/* Section ARTICLES */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="border-l-4 border-[#c8a850] pl-2.5 pb-1">
                <span className="font-extrabold text-xs uppercase tracking-wider text-[#1a3050]">
                  ARTICLES
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1a3050] text-[#c8a850] uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-2.5 px-3 w-[35px] text-center">#</th>
                      <th className="py-2.5 px-3">ARTICLE</th>
                      <th className="py-2.5 px-3 w-[80px] text-center">QTÉ</th>
                      <th className="py-2.5 px-3 w-[110px] text-right">P.U. (F)</th>
                      <th className="py-2.5 px-3 w-[100px] text-right">TOTAL</th>
                      <th className="py-2.5 px-2 w-[30px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {factLignes.map((line, idx) => {
                      const totalLigne = (line.qte || 0) * (line.pu || 0);

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center text-slate-400 font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={line.designation}
                              onChange={(e) => handleFactLineChange(idx, 'designation', e.target.value)}
                              className="w-full py-1.5 px-2.5 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:border-[#1a3050]"
                            >
                              <option value="">-- Sélectionner --</option>
                              {Object.keys(produitsPrix).map((nom) => (
                                <option key={nom} value={nom}>
                                  {nom} ({fm(produitsPrix[nom])} F)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              value={line.qte}
                              onChange={(e) =>
                                handleFactLineChange(idx, 'qte', parseFloat(e.target.value) || 0)
                              }
                              className="w-16 py-1.5 px-2 border border-slate-300 rounded-md text-center text-xs font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={line.pu}
                              onChange={(e) =>
                                handleFactLineChange(idx, 'pu', parseFloat(e.target.value) || 0)
                              }
                              className="w-24 py-1.5 px-2 border border-slate-300 rounded-md text-right text-xs font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-black text-[#1a3050] whitespace-nowrap">
                            {fm(totalLigne)} F
                          </td>
                          <td className="py-2 px-2 text-center">
                            {factLignes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeFactLine(idx)}
                                className="text-red-500 hover:text-red-700 font-black text-sm px-1"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add line button */}
              <button
                type="button"
                onClick={addFactLine}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition"
                style={{
                  background: 'linear-gradient(135deg, #067B7B 0%, #05A9A9 100%)',
                }}
              >
                ＋ Ajouter un article
              </button>

              {/* Total Box (.tot) */}
              <div className="bg-[#1a3050] text-white rounded-xl p-4 space-y-1.5 mt-3 shadow-inner">
                <div className="flex justify-between text-xs text-white/70 font-semibold">
                  <span>Sous-total</span>
                  <span>{fm(sousTotal)} F</span>
                </div>
                {factRemise > 0 && (
                  <div className="flex justify-between text-xs text-rose-300 font-semibold">
                    <span>Remise ({factRemise}%)</span>
                    <span>- {fm(remiseMnt)} F</span>
                  </div>
                )}
                {factAvecTVA && (
                  <div className="flex justify-between text-xs text-sky-200 font-semibold">
                    <span>TVA ({factTVA}%)</span>
                    <span>+ {fm(tvaMnt)} F</span>
                  </div>
                )}
                <div className="flex justify-between text-sm sm:text-base font-black text-[#c8a850] pt-2 border-t border-white/20">
                  <span>TOTAL TTC</span>
                  <span>{fm(totalTTC)} F CFA</span>
                </div>
              </div>
            </div>

            {/* Section CONDITIONS */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="border-l-4 border-[#c8a850] pl-2.5 pb-1">
                <span className="font-extrabold text-xs uppercase tracking-wider text-[#1a3050]">
                  CONDITIONS
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    REMISE (%) <span className="text-red-500 font-black">%</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={factRemise}
                    onChange={(e) => setFactRemise(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-[#1a3050]"
                    style={{
                      background: 'linear-gradient(135deg, #FFFEF5 0%, #FFFBF0 100%)',
                      border: '2px solid #E8D4A8',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    TVA (%) <span className="text-red-500 font-black">%</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={factTVA}
                    onChange={(e) => setFactTVA(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-[#1a3050]"
                    style={{
                      background: 'linear-gradient(135deg, #FFFEF5 0%, #FFFBF0 100%)',
                      border: '2px solid #E8D4A8',
                    }}
                  />
                </div>

                <div className="pb-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={factAvecTVA}
                      onChange={(e) => setFactAvecTVA(e.target.checked)}
                      className="w-4 h-4 text-[#1a3050] rounded focus:ring-0"
                    />
                    <span>Appliquer TVA</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  NOTE / OBSERVATIONS
                </label>
                <textarea
                  rows={2}
                  placeholder="Conditions..."
                  value={factNotes}
                  onChange={(e) => setFactNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1a3050] bg-white resize-y"
                />
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            TAB 2: BON DE LIVRAISON (Screenshot 3)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'b' && (
          <div className="space-y-4">
            {/* Section BON DE LIVRAISON */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex justify-between items-center border-l-4 border-[#c8a850] pl-2.5 pb-1">
                <span className="font-extrabold text-xs uppercase tracking-wider text-[#1a3050]">
                  BON DE LIVRAISON
                </span>
                <button
                  type="button"
                  onClick={razBL}
                  className="px-3 py-1 rounded-lg text-xs font-bold border border-[#c8a850] text-[#1a3050] hover:bg-[#c8a850]/10 transition flex items-center gap-1"
                >
                  <span>↺</span>
                  <span>Nouveau</span>
                </button>
              </div>

              {/* N° BL & Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    N° BL
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={nextNumBL}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 select-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                    <span>DATE</span>
                    <span className="text-red-500 font-black">*</span>
                  </label>
                  <input
                    type="date"
                    value={blDate}
                    onChange={(e) => setBlDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-[#1a3050] focus:outline-none"
                    style={{
                      background: 'linear-gradient(135deg, #FFFEF5 0%, #FFFBF0 100%)',
                      border: '2px solid #E8D4A8',
                    }}
                  />
                </div>
              </div>

              {/* Client */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                  <span>CLIENT</span>
                  <span className="text-red-500 font-black">*</span>
                </label>
                <input
                  type="text"
                  list="dlcli"
                  placeholder="Saisir nom..."
                  value={blClient}
                  onChange={(e) => handleBLClientChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold text-[#1a3050] focus:outline-none"
                  style={{
                    background: 'linear-gradient(135deg, #FFFEF5 0%, #FFFBF0 100%)',
                    border: '2px solid #E8D4A8',
                  }}
                />
              </div>

              {/* Adresse livraison & Réf. commande */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                    <span>ADRESSE LIVRAISON</span>
                    <span className="text-red-500 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Adresse complète"
                    value={blAdresse}
                    onChange={(e) => setBlAdresse(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-[#1a3050] focus:outline-none"
                    style={{
                      background: 'linear-gradient(135deg, #FFFEF5 0%, #FFFBF0 100%)',
                      border: '2px solid #E8D4A8',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    RÉF. COMMANDE
                  </label>
                  <input
                    type="text"
                    value={blRefCmd}
                    onChange={(e) => setBlRefCmd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Section ARTICLES LIVRÉS */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="border-l-4 border-[#c8a850] pl-2.5 pb-1">
                <span className="font-extrabold text-xs uppercase tracking-wider text-[#1a3050]">
                  ARTICLES LIVRÉS
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1a3050] text-[#c8a850] uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-2.5 px-3 w-[35px] text-center">#</th>
                      <th className="py-2.5 px-3">DÉSIGNATION</th>
                      <th className="py-2.5 px-3 w-[80px] text-center">QTÉ</th>
                      <th className="py-2.5 px-3 w-[80px]">UNITÉ</th>
                      <th className="py-2.5 px-3">OBSERVATIONS</th>
                      <th className="py-2.5 px-2 w-[30px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {blLignes.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={line.designation}
                            onChange={(e) => handleBLLineChange(idx, 'designation', e.target.value)}
                            className="w-full py-1.5 px-2.5 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:border-[#1a3050]"
                          >
                            <option value="">-- Sélectionner --</option>
                            {Object.keys(produitsPrix).map((nom) => (
                              <option key={nom} value={nom}>
                                {nom}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={line.qte}
                            onChange={(e) =>
                              handleBLLineChange(idx, 'qte', parseFloat(e.target.value) || 0)
                            }
                            className="w-16 py-1.5 px-2 border border-slate-300 rounded-md text-center text-xs font-bold"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={line.unite || 'pcs'}
                            onChange={(e) => handleBLLineChange(idx, 'unite', e.target.value)}
                            className="w-16 py-1.5 px-2 border border-slate-300 rounded-md text-xs font-semibold"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Observations"
                            value={line.observations || ''}
                            onChange={(e) =>
                              handleBLLineChange(idx, 'observations', e.target.value)
                            }
                            className="w-full py-1.5 px-2 border border-slate-300 rounded-md text-xs"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          {blLignes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBLLine(idx)}
                              className="text-red-500 hover:text-red-700 font-black text-sm px-1"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={addBLLine}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition"
                style={{
                  background: 'linear-gradient(135deg, #067B7B 0%, #05A9A9 100%)',
                }}
              >
                ＋ Ajouter un article
              </button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            TAB 3: RECHERCHE FACTURES
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 's' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="border-l-4 border-[#c8a850] pl-2.5 pb-1">
                <span className="font-extrabold text-xs uppercase tracking-wider text-[#1a3050]">
                  RECHERCHE DE FACTURES
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="N° facture, nom client ou téléphone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3.5 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1a3050] bg-white"
                />
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Tout
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <th className="py-2 px-3">N°</th>
                      <th className="py-2 px-3">DATE</th>
                      <th className="py-2 px-3">CLIENT</th>
                      <th className="py-2 px-3 text-right">TOTAL</th>
                      <th className="py-2 px-3">STATUT</th>
                      <th className="py-2 px-3 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFactures.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-[#1a3050]">{f.numero}</td>
                        <td className="py-2.5 px-3 text-slate-500">{f.date}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{f.client}</td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-800">
                          {fm(f.total)} F
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              f.statut === 'Payée'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {f.statut}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              title="Aperçu officiel et Impression"
                              onClick={() => {
                                setValidatedDoc({
                                  type: 'f',
                                  numero: f.numero,
                                  client: f.client,
                                  total: f.total,
                                  tel: f.telephone || '',
                                  date: f.date,
                                  adresse: f.adresseClient || '',
                                  refCmd: f.refCmd || '',
                                  modeReglement: f.modeReglement,
                                  lignes: f.lignes && f.lignes.length > 0
                                    ? f.lignes.map(l => ({ ...l, total: l.qte * l.pu }))
                                    : [{ designation: 'Poussins d’un jour', qte: f.nbArticles || 1, pu: Math.round(f.total / (f.nbArticles || 1)), total: f.total }],
                                  montantHT: f.montantHT || f.total,
                                  remise: f.remisePct || 0,
                                  remiseVal: f.remiseVal || 0,
                                  tva: f.tvaPct || 0,
                                  tvaVal: f.tvaVal || 0,
                                  notes: f.notes,
                                });
                                setIsDocModalOpen(true);
                              }}
                              className="px-2 py-1 rounded border border-sky-400 text-sky-700 hover:bg-sky-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <span>👁️</span>
                              <span className="hidden sm:inline">Aperçu</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFacture(f)}
                              className="px-2 py-1 rounded border border-[#c8a850] text-[#1a3050] hover:bg-amber-50 text-xs font-bold cursor-pointer"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (f.ligne && onDeleteFacture) {
                                  onDeleteFacture(f.ligne);
                                  showMsg(`Facture ${f.numero} supprimée.`, true);
                                }
                              }}
                              className="px-2 py-1 rounded border border-rose-400 text-rose-600 hover:bg-rose-50 text-xs font-bold"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredFactures.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          Aucune facture trouvée.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Edit Invoice Form */}
            {editingFacture && (
              <div className="bg-white rounded-xl p-5 border-2 border-[#c8a850] shadow-md space-y-3.5 animate-slide-up">
                <div className="font-bold text-sm text-[#1a3050] flex items-center justify-between border-b pb-2">
                  <span>✏️ Modifier la facture</span>
                  <button
                    onClick={() => setEditingFacture(null)}
                    className="text-slate-400 hover:text-slate-700 text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">N° Facture</label>
                    <input
                      type="text"
                      value={editingFacture.numero}
                      onChange={(e) =>
                        setEditingFacture({ ...editingFacture, numero: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Date émission</label>
                    <input
                      type="text"
                      value={editingFacture.date}
                      onChange={(e) =>
                        setEditingFacture({ ...editingFacture, date: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Client</label>
                    <input
                      type="text"
                      value={editingFacture.client}
                      onChange={(e) =>
                        setEditingFacture({ ...editingFacture, client: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Total TTC (F)</label>
                    <input
                      type="number"
                      value={editingFacture.total}
                      onChange={(e) =>
                        setEditingFacture({
                          ...editingFacture,
                          total: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Statut</label>
                    <select
                      value={editingFacture.statut}
                      onChange={(e) =>
                        setEditingFacture({
                          ...editingFacture,
                          statut: e.target.value as any,
                          datePaiement:
                            e.target.value === 'Payée' ? new Date().toLocaleDateString('fr-FR') : '',
                        })
                      }
                      className="w-full px-3 py-1.5 border rounded-lg bg-white"
                    >
                      <option value="Emise">Emise</option>
                      <option value="Payée">Payée</option>
                      <option value="Annulée">Annulée</option>
                      <option value="En attente">En attente</option>
                      <option value="Litige">Litige</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Date paiement</label>
                    <input
                      type="text"
                      placeholder="jj/mm/aaaa"
                      value={editingFacture.datePaiement || ''}
                      onChange={(e) =>
                        setEditingFacture({ ...editingFacture, datePaiement: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingFacture(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateFacture && editingFacture) {
                        onUpdateFacture(editingFacture);
                        showMsg(`Facture ${editingFacture.numero} mise à jour.`, true);
                        setEditingFacture(null);
                      }
                    }}
                    className="px-4 py-2 bg-[#1a3050] text-[#c8a850] rounded-lg text-xs font-bold"
                  >
                    ✓ Enregistrer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            TAB 4: CLIENTS
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'mc' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex justify-between items-center border-l-4 border-[#c8a850] pl-2.5 pb-1">
                <span className="font-extrabold text-xs uppercase tracking-wider text-[#1a3050]">
                  BASE CLIENTS
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
                    setNcPrenom('');
                    setNcNom('');
                    setNcVille('');
                    setNcTel('');
                    setNcEmail('');
                    setClientFormVisible(true);
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold border border-[#c8a850] text-[#1a3050] hover:bg-[#c8a850]/10 transition"
                >
                  + Nouveau
                </button>
              </div>

              <input
                type="text"
                placeholder="Rechercher par nom, ville, tél ou email..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1a3050] bg-white"
              />

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <th className="py-2 px-3">NOM</th>
                      <th className="py-2 px-3">VILLE</th>
                      <th className="py-2 px-3">TÉL</th>
                      <th className="py-2 px-3">EMAIL</th>
                      <th className="py-2 px-3 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clients
                      .filter((c) => {
                        const q = clientSearchQuery.toLowerCase().trim();
                        if (!q) return true;
                        return (
                          c.label.toLowerCase().includes(q) ||
                          (c.ville && c.ville.toLowerCase().includes(q)) ||
                          (c.email && c.email.toLowerCase().includes(q)) ||
                          (c.telephone && c.telephone.includes(q))
                        );
                      })
                      .map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{c.label}</td>
                          <td className="py-2.5 px-3 text-slate-500">{c.ville || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono">{c.telephone || '-'}</td>
                          <td className="py-2.5 px-3 text-[#0D6E6E]">{c.email || '-'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClient(c);
                                  setNcPrenom(c.prenom);
                                  setNcNom(c.nom);
                                  setNcVille(c.ville);
                                  setNcTel(c.telephone);
                                  setNcEmail(c.email || '');
                                  setClientFormVisible(true);
                                }}
                                className="px-2 py-1 rounded border border-[#c8a850] text-[#1a3050] hover:bg-amber-50 text-xs font-bold"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (c.index && onDeleteClient) {
                                    onDeleteClient(c.index);
                                    showMsg(`Client ${c.label} supprimé.`, true);
                                  }
                                }}
                                className="px-2 py-1 rounded border border-rose-400 text-rose-600 hover:bg-rose-50 text-xs font-bold"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Client Form */}
            {clientFormVisible && (
              <div className="bg-white rounded-xl p-5 border-2 border-[#1a3050] shadow-md space-y-3.5 animate-slide-up">
                <div className="font-bold text-sm text-[#1a3050] flex items-center justify-between border-b pb-2">
                  <span>{editingClient ? `Modifier : ${editingClient.label}` : 'Nouveau client'}</span>
                  <button
                    onClick={() => setClientFormVisible(false)}
                    className="text-slate-400 hover:text-slate-700 text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Prénom</label>
                    <input
                      type="text"
                      value={ncPrenom}
                      onChange={(e) => setNcPrenom(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ncNom}
                      onChange={(e) => setNcNom(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Ville</label>
                    <input
                      type="text"
                      value={ncVille}
                      onChange={(e) => setNcVille(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Tél</label>
                    <input
                      type="tel"
                      value={ncTel}
                      onChange={(e) => setNcTel(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-500 mb-1">Email</label>
                    <input
                      type="email"
                      value={ncEmail}
                      onChange={(e) => setNcEmail(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setClientFormVisible(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!ncNom.trim()) {
                        showMsg('Le nom est obligatoire.', false);
                        return;
                      }
                      const full = `${ncPrenom} ${ncNom}`.trim();
                      if (editingClient) {
                        const updated: Client = {
                          ...editingClient,
                          prenom: ncPrenom.trim(),
                          nom: ncNom.trim(),
                          ville: ncVille.trim(),
                          telephone: ncTel.trim(),
                          email: ncEmail.trim(),
                          label: full,
                        };
                        if (onUpdateClient) onUpdateClient(updated);
                        showMsg(`Client ${full} modifié.`, true);
                      } else {
                        const newC: Client = {
                          index: clients.length + 2,
                          prenom: ncPrenom.trim(),
                          nom: ncNom.trim(),
                          ville: ncVille.trim(),
                          telephone: ncTel.trim(),
                          email: ncEmail.trim(),
                          label: full,
                        };
                        if (onAddClient) onAddClient(newC);
                        showMsg(`Client ${full} ajouté.`, true);
                      }
                      setClientFormVisible(false);
                    }}
                    className="px-4 py-2 bg-[#1a3050] text-[#c8a850] rounded-lg text-xs font-bold"
                  >
                    ✓ Enregistrer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            TAB 5: CAHIER DE BORD (Screenshot 4)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'cb' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
              {/* Header */}
              <div className="flex justify-between items-center border-l-4 border-[#c8a850] pl-2.5 pb-1">
                <span className="font-extrabold text-xs uppercase tracking-wider text-[#1a3050]">
                  📊 CAHIER DE BORD — FACTURES
                </span>
                <button
                  type="button"
                  onClick={() => showMsg('Données actualisées.', true)}
                  className="px-3 py-1 rounded-lg text-xs font-bold border border-[#c8a850] text-[#1a3050] hover:bg-[#c8a850]/10 transition flex items-center gap-1"
                >
                  <span>↺</span>
                  <span>Actualiser</span>
                </button>
              </div>

              {/* 8 KPI Cards Grid (4 columns × 2 rows) - Screenshot 4 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Card 1: TOTAL FACTURES */}
                <div className="bg-[#e8f0fe] rounded-xl p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                    TOTAL FACTURES
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#1a3050]">
                    {cahierDeBordStats.totalFactures}
                  </div>
                </div>

                {/* Card 2: PAYÉES */}
                <div className="bg-[#dcfce7] rounded-xl p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-emerald-700 mb-1">
                    PAYÉES
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#166534]">
                    {cahierDeBordStats.payees}
                  </div>
                </div>

                {/* Card 3: ÉMISES (IMPAYÉES) */}
                <div className="bg-[#fef9c3] rounded-xl p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-amber-700 mb-1">
                    ÉMISES (IMPAYÉES)
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#92400e]">
                    {cahierDeBordStats.emises}
                  </div>
                </div>

                {/* Card 4: EN RETARD */}
                <div className="bg-[#fee2e2] rounded-xl p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-rose-700 mb-1">
                    EN RETARD
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#991b1b]">
                    {cahierDeBordStats.retard}
                  </div>
                </div>

                {/* Card 5: CA TOTAL (F) */}
                <div className="bg-[#e8f0fe] rounded-xl p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                    CA TOTAL (F)
                  </div>
                  <div className="text-lg sm:text-xl font-black text-[#1a3050]">
                    {fm(cahierDeBordStats.caTotal)} F
                  </div>
                </div>

                {/* Card 6: CA ENCAISSÉ (F) */}
                <div className="bg-[#dcfce7] rounded-xl p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-emerald-700 mb-1">
                    CA ENCAISSÉ (F)
                  </div>
                  <div className="text-lg sm:text-xl font-black text-[#166534]">
                    {fm(cahierDeBordStats.caEncaisse)} F
                  </div>
                </div>

                {/* Card 7: CA IMPAYÉ (F) */}
                <div className="bg-[#fee2e2] rounded-xl p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-rose-700 mb-1">
                    CA IMPAYÉ (F)
                  </div>
                  <div className="text-lg sm:text-xl font-black text-[#991b1b]">
                    {fm(cahierDeBordStats.caImpaye)} F
                  </div>
                </div>

                {/* Card 8: FACT. 30 DERNIERS J. */}
                <div className="bg-[#dbeafe] rounded-xl p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-blue-700 mb-1">
                    FACT. 30 DERNIERS J.
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#1e40af]">
                    0
                  </div>
                </div>
              </div>

              {/* Top 5 Clients Table - Screenshot 4 */}
              <div className="pt-2 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#1a3050] flex items-center gap-1.5">
                  <span>🏆</span>
                  <span>TOP 5 CLIENTS PAR CA</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">CLIENT</th>
                        <th className="py-2.5 px-3 text-right">CA TOTAL (F)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cahierDeBordStats.topClients.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-[#1a3050] flex items-center gap-2">
                            <span>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•'}
                            </span>
                            <span>{c.client}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            {fm(c.ca)} F
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          BOTTOM ACTION BAR (Screenshots 1, 2, 3)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-t-2 border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-end gap-2.5 shadow-md flex-shrink-0">
        {validatedDoc && (
          <>
            <button
              type="button"
              onClick={() => setIsDocModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-sky-700 to-sky-900 hover:opacity-95 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>👁️</span>
              <span>Aperçu document ({validatedDoc.numero})</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-gradient-to-r from-[#0D6E6E] to-[#067B7B] hover:opacity-95 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>📥</span>
              <span>Imprimer / PDF</span>
            </button>

            {validatedDoc.tel && (
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="px-4 py-2 bg-gradient-to-r from-[#128C7E] to-[#25D366] hover:opacity-95 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>📲</span>
                <span>Envoyer via WhatsApp</span>
              </button>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClose || razF}
          className="px-4 py-2 bg-[#f3f4f6] hover:bg-[#e5e7eb] text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
        >
          <span>❌</span>
          <span>Fermer</span>
        </button>

        {activeTab === 'f' && (
          <button
            type="button"
            onClick={handleValiderFacture}
            className="px-5 py-2 rounded-lg text-xs font-extrabold tracking-wide uppercase text-[#c8a850] shadow-sm flex items-center gap-1.5 transition hover:shadow-md"
            style={{
              background: 'linear-gradient(135deg, #1a3050 0%, #1e4d7b 100%)',
            }}
          >
            <span>✅</span>
            <span>Valider la facture</span>
          </button>
        )}

        {activeTab === 'b' && (
          <button
            type="button"
            onClick={handleValiderBL}
            className="px-5 py-2 rounded-lg text-xs font-extrabold tracking-wide uppercase text-white shadow-sm flex items-center gap-1.5 transition hover:shadow-md"
            style={{
              background: 'linear-gradient(135deg, #1a3050 0%, #1e4d7b 100%)',
            }}
          >
            <span>✅</span>
            <span>Valider la facture</span>
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          POPUP MODAL: AJOUTER UN NOUVEAU CLIENT
         ══════════════════════════════════════════════════════════════════════════ */}
      {showNouveauClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-slide-up">
            <div className="bg-[#1a3050] text-[#c8a850] px-6 py-4 font-bold text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>👤</span>
                <span>Ajouter un nouveau client</span>
              </span>
              <button
                type="button"
                onClick={() => setShowNouveauClientModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Prénom</label>
                  <input
                    type="text"
                    placeholder="Optionnel"
                    value={ncPrenom}
                    onChange={(e) => setNcPrenom(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Obligatoire"
                    value={ncNom}
                    onChange={(e) => setNcNom(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-lg font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Ville</label>
                  <input
                    type="text"
                    placeholder="Optionnel"
                    value={ncVille}
                    onChange={(e) => setNcVille(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Tél</label>
                  <input
                    type="tel"
                    placeholder="Optionnel"
                    value={ncTel}
                    onChange={(e) => setNcTel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Optionnel"
                    value={ncEmail}
                    onChange={(e) => setNcEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowNouveauClientModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 border border-slate-300"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveInlineClient}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#0e4d2e] to-[#10652c] shadow-sm"
              >
                ✓ Enregistrer client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          OFFICIAL DOCUMENT PREVIEW & PRINT MODAL (Facture & Bon de Livraison)
         ══════════════════════════════════════════════════════════════════════════ */}
      {isDocModalOpen && validatedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in print:p-0 print:bg-white print:fixed">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 max-h-[94vh] flex flex-col print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none">
            {/* Modal Controls (Hidden in print) */}
            <div className="bg-gradient-to-r from-[#1a3050] to-[#1e4d7b] px-6 py-4 text-white flex items-center justify-between print:hidden flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📄</span>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#c8a850]">
                    Document Officiel — {validatedDoc.type === 'f' ? 'Facture de Vente' : 'Bordereau de Livraison'}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    N° {validatedDoc.numero} • Prêt pour expédition et impression
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#c8a850] hover:bg-[#d8b860] text-slate-950 rounded-xl text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📥</span>
                  <span>Imprimer / PDF</span>
                </button>
                {validatedDoc.tel && (
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="px-4 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📲</span>
                    <span>Envoyer WhatsApp</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-6 sm:p-10 overflow-y-auto print:overflow-visible print:p-6 text-slate-800 space-y-6 bg-white" id="printable-facture-doc">
              {/* Document Header with Official SamChe Logo */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-slate-900">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-white p-1 border border-slate-200 shadow-2xs flex-shrink-0 flex items-center justify-center">
                    <img
                      src="/logo-samche.png"
                      alt="Logo SamChe"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.src = '/logo-samche.svg';
                      }}
                    />
                  </div>
                  <div>
                    <h1
                      className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                    >
                      COUVOIR SAMCHE
                    </h1>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-0.5">
                      Production &amp; Vente de Poussins d'un Jour au Mali
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Agrément N° 0418/MDR-SG • RCCM : MA.BKO.2023.B.1142 • NIF : 085202611S
                    </p>
                    <p className="text-[11px] text-slate-600 font-semibold">
                      Tél : +223 66 56 50 55 / +223 66 71 97 17 • Bamako, Mali
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right w-full sm:w-auto bg-slate-50 p-3.5 sm:p-0 sm:bg-transparent rounded-xl border sm:border-none border-slate-200">
                  <div className="inline-block bg-[#1a3050] text-[#c8a850] text-xs font-black uppercase px-3 py-1 rounded-md tracking-wider">
                    {validatedDoc.type === 'f' ? 'FACTURE OFFICIELLE' : 'BORDEREAU DE LIVRAISON'}
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                    N° {validatedDoc.numero}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Date : <strong>{validatedDoc.date || new Date().toLocaleDateString('fr-FR')}</strong>
                  </div>
                  {validatedDoc.refCmd && (
                    <div className="text-xs text-slate-600 font-mono">
                      Réf. Commande : <strong>{validatedDoc.refCmd}</strong>
                    </div>
                  )}
                  {validatedDoc.modeReglement && (
                    <div className="text-xs text-slate-600">
                      Règlement : <strong>{validatedDoc.modeReglement}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Client Destinataire Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    DESTINATAIRE / FACTURÉ À :
                  </span>
                  <div className="text-base font-extrabold text-slate-900">
                    {validatedDoc.client}
                  </div>
                  {validatedDoc.adresse && (
                    <div className="text-slate-600 mt-1">
                      Adresse : <strong>{validatedDoc.adresse}</strong>
                    </div>
                  )}
                  {validatedDoc.tel && (
                    <div className="text-slate-600">
                      Téléphone : <strong>{validatedDoc.tel}</strong>
                    </div>
                  )}
                </div>

                <div className="sm:text-right flex flex-col justify-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    LIEU D'ÉMISSION :
                  </span>
                  <div className="text-xs font-semibold text-slate-700">
                    Bamako, République du Mali
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Échéance : <strong>30 jours</strong>
                  </div>
                </div>
              </div>

              {/* Articles Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1a3050] text-white uppercase text-[10px] font-black tracking-wider">
                      <th className="py-3 px-4">Désignation</th>
                      <th className="py-3 px-3 text-center">Quantité</th>
                      {validatedDoc.type === 'f' && (
                        <>
                          <th className="py-3 px-4 text-right">Prix Unitaire</th>
                          <th className="py-3 px-4 text-right">Total HT</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(validatedDoc.lignes || []).map((ligne, idx) => (
                      <tr key={idx} className="even:bg-slate-50/60">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {ligne.designation}
                        </td>
                        <td className="py-3 px-3 text-center font-black font-mono text-slate-900">
                          {ligne.qte.toLocaleString('fr-FR')} {ligne.unite || ''}
                        </td>
                        {validatedDoc.type === 'f' && (
                          <>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {fm(ligne.pu || 0)} F
                            </td>
                            <td className="py-3 px-4 text-right font-black font-mono text-slate-900">
                              {fm(ligne.total || (ligne.qte * (ligne.pu || 0)))} F
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              {validatedDoc.type === 'f' && (
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                  <div className="text-xs text-slate-500 max-w-sm space-y-1">
                    {validatedDoc.notes && (
                      <div>
                        <strong>Conditions / Notes :</strong> {validatedDoc.notes}
                      </div>
                    )}
                    <div className="italic text-[11px] text-slate-400">
                      Règlement par virement bancaire ou espèces. Merci de votre confiance !
                    </div>
                  </div>

                  <div className="w-full sm:w-72 bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                    {validatedDoc.montantHT !== undefined && (
                      <div className="flex justify-between text-slate-600 font-semibold">
                        <span>Montant HT :</span>
                        <span className="font-mono">{fm(validatedDoc.montantHT)} F</span>
                      </div>
                    )}
                    {Boolean(validatedDoc.remise) && (
                      <div className="flex justify-between text-rose-600 font-semibold">
                        <span>Remise ({validatedDoc.remise}%) :</span>
                        <span className="font-mono">- {fm(validatedDoc.remiseVal || 0)} F</span>
                      </div>
                    )}
                    {Boolean(validatedDoc.tva) && (
                      <div className="flex justify-between text-sky-700 font-semibold">
                        <span>TVA ({validatedDoc.tva}%) :</span>
                        <span className="font-mono">+ {fm(validatedDoc.tvaVal || 0)} F</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm sm:text-base font-black text-[#1a3050] pt-2 border-t-2 border-slate-300">
                      <span>NET À PAYER :</span>
                      <span className="text-[#c8a850] font-mono">{fm(validatedDoc.total || 0)} F CFA</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Official Stamp & Signature Block */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-6 text-xs">
                <div>
                  <span className="font-bold text-slate-500 block mb-8">
                    Le Client (Bon pour accord) :
                  </span>
                  <div className="border-b border-dashed border-slate-300 w-48"></div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="font-bold text-slate-500 block mb-2">
                    Pour le Couvoir SAMCHE (Cachet &amp; Signature) :
                  </span>
                  {/* Official Visual Stamp */}
                  <div className="w-36 h-24 border-2 border-indigo-700/80 rounded-2xl p-2 flex flex-col items-center justify-center text-center rotate-[-3deg] bg-indigo-50/30 text-indigo-900 shadow-2xs">
                    <span className="text-[10px] font-black uppercase tracking-wider">★ COUVOIR SAMCHE ★</span>
                    <span className="text-[9px] font-bold text-emerald-700">DIRECTION GÉNÉRALE</span>
                    <span className="text-[8px] text-slate-500">Bamako - Mali</span>
                    <span className="text-[8px] font-mono text-indigo-600 mt-0.5">VISA DIRECTION</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
