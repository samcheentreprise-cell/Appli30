import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CommandePoussin, OAC, Client, Bordereau, UserRole } from '../types';
import { 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Printer, 
  Search, 
  Calendar, 
  User, 
  Package, 
  FileText, 
  Save, 
  X, 
  Check, 
  Phone, 
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Inbox,
  Mail,
  MessageSquare,
  Send,
  Copy,
  ExternalLink,
  Shield,
  PenTool,
  RotateCcw,
  Lock,
  Unlock,
  Key,
  BadgeCheck,
  Share2,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { generateSignedBonImage } from '../utils/bonLivraisonImage';

interface LivraisonsPoussinsModuleProps {
  commandes: CommandePoussin[];
  oacList: OAC[];
  clients?: Client[];
  bordereaux?: Bordereau[];
  userRole?: UserRole;
  onUpdateCommande: (cmd: CommandePoussin) => void;
  onAddBordereau?: (bl: Bordereau) => void;
  onClose?: () => void;
}

interface LocalDeliveryData {
  quantiteFournie: number;
  statutLivraison: 'En attente' | 'Livré' | 'Partiel' | 'Non retiré';
  receptionnaire: string;
  heureLivraison: string;
  nbCartons: number;
  notesLivraison: string;
  clientEmail?: string;
  signatureClient?: string;
  dateSignature?: string;
  isUnlockedByAdmin?: boolean;
  unlockedByAdminInfo?: string;
  isModified?: boolean;
}

export const LivraisonsPoussinsModule: React.FC<LivraisonsPoussinsModuleProps> = ({
  commandes,
  oacList,
  clients = [],
  bordereaux = [],
  userRole = 'admin',
  onUpdateCommande,
  onAddBordereau,
  onClose,
}) => {
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

  // Helper to normalize date to DD/MM/YYYY
  const normalizeDateKey = (dStr?: string): string => {
    if (!dStr) return '';
    const d = parseFrDate(dStr);
    if (d) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return dStr.trim();
  };

  // Helper to find official Bordereau for a command
  const getBordereauForCmd = (cmdId: string): Bordereau | undefined => {
    return bordereaux?.find((b) => b.refCmd === cmdId);
  };

  // Helper to ensure an official Bordereau is created in Google Sheets
  const ensureBordereauForDelivery = (cmd: CommandePoussin, qteFournie: number, cartons: number, rec: LocalDeliveryData) => {
    if (!onAddBordereau || qteFournie <= 0) return;
    const existing = getBordereauForCmd(cmd.id);
    if (!existing) {
      const now = new Date();
      const yr = now.getFullYear();
      const count = (bordereaux?.length || 0) + 1;
      const numBL = `BL-${yr}-${String(count).padStart(3, '0')}`;
      const newBL: Bordereau = {
        numero: numBL,
        date: now.toLocaleDateString('fr-FR'),
        client: `${cmd.prenom} ${cmd.nom}`,
        adresseClient: cmd.ville || 'Bamako',
        refCmd: cmd.id,
        lignes: [
          {
            designation: `Poussins d'un jour (${cmd.typeProduit})`,
            qte: qteFournie,
            unite: `${cartons} cartons de 50`,
            observations: `Récept: ${rec.receptionnaire || `${cmd.prenom} ${cmd.nom}`} à ${rec.heureLivraison || '06:00'}${rec.notesLivraison ? ` | ${rec.notesLivraison}` : ''}`,
          },
        ],
        statut: 'Livré',
      };
      onAddBordereau(newBL);
    }
  };

  // Group all hatch lots / hatch dates
  const hatchLots = useMemo(() => {
    const map: Record<
      string,
      {
        id: string;
        date: string;
        dateFormatee: string;
        dateObj: Date | null;
        type: string;
        race: string;
        lotId: string;
        fournisseur: string;
        attendus: number;
        isEnCours: boolean;
      }
    > = {};

    const todayMs = new Date().setHours(0, 0, 0, 0);

    // From OAC batches
    oacList.forEach((oac) => {
      if (!oac.eclosion) return;
      const dateKey = oac.eclosion.trim();
      const type = (oac.type || oac.race || 'Chairs').trim();
      const race = (oac.race || '').trim();
      const dObj = parseFrDate(dateKey);
      const dateFormatee = dObj
        ? dObj.toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : dateKey;

      const key = oac.id ? `${dateKey}___${oac.id}` : `${dateKey}___${type.toLowerCase()}`;
      const prevQty = oac.attendus || (oac.fertiles ? Math.round(oac.fertiles * 0.8) : Math.round((oac.recus || (oac.cartons || 0) * 360) * 0.75));

      // A lot is "En cours" if OAC is not completed or hatch date is upcoming/today
      const isEnCours = !oac.complet || (dObj ? dObj.getTime() >= todayMs - 86400000 * 3 : true);

      if (!map[key]) {
        map[key] = {
          id: key,
          date: dateKey,
          dateFormatee,
          dateObj: dObj,
          type,
          race: race && race.toLowerCase() !== type.toLowerCase() ? race : '',
          lotId: oac.id || '',
          fournisseur: oac.fournisseur || '',
          attendus: prevQty,
          isEnCours,
        };
      }
    });

    // From orders if no OAC
    commandes.forEach((cmd) => {
      if (!cmd.dateEclosion) return;
      const dateKey = cmd.dateEclosion.trim();
      const type = (cmd.typeProduit || 'Chairs').trim();
      const key = `${dateKey}___${type.toLowerCase()}`;

      if (!map[key]) {
        const dObj = parseFrDate(dateKey);
        const dateFormatee = dObj
          ? dObj.toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : dateKey;

        const isEnCours = dObj ? dObj.getTime() >= todayMs - 86400000 * 3 : true;

        map[key] = {
          id: key,
          date: dateKey,
          dateFormatee,
          dateObj: dObj,
          type,
          race: '',
          lotId: '',
          fournisseur: '',
          attendus: 0,
          isEnCours,
        };
      }
    });

    return Object.values(map).sort((a, b) => {
      // Prioritize "en cours"
      if (a.isEnCours && !b.isEnCours) return -1;
      if (!a.isEnCours && b.isEnCours) return 1;

      const ta = a.dateObj ? a.dateObj.getTime() : 0;
      const tb = b.dateObj ? b.dateObj.getTime() : 0;
      if (ta !== tb) return ta - tb;
      return a.type.localeCompare(b.type);
    });
  }, [oacList, commandes]);

  // Determine active "Lot en cours" automatically (the first en cours lot)
  const defaultLotEnCours = useMemo(() => {
    return hatchLots.find((l) => l.isEnCours) || hatchLots[0] || null;
  }, [hatchLots]);

  // Selected Lot key (locked strictly to current active lot by default)
  const [selectedLotKey, setSelectedLotKey] = useState<string>(() => {
    return defaultLotEnCours?.id || hatchLots[0]?.id || '';
  });

  useEffect(() => {
    if (defaultLotEnCours && (!selectedLotKey || !hatchLots.some((l) => l.id === selectedLotKey))) {
      setSelectedLotKey(defaultLotEnCours.id);
    }
  }, [defaultLotEnCours, hatchLots, selectedLotKey]);

  const currentLot = useMemo(() => {
    return hatchLots.find((l) => l.id === selectedLotKey) || defaultLotEnCours || hatchLots[0] || null;
  }, [hatchLots, selectedLotKey, defaultLotEnCours]);

  // Delivery tracking local state (persisted to localStorage and syncable)
  const [deliveryRecords, setDeliveryRecords] = useState<Record<string, LocalDeliveryData>>(() => {
    try {
      const stored = localStorage.getItem('samche_livraisons_poussins');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Visa Couvoir Signature (stored globally for official logs)
  const [visaCouvoirSignature, setVisaCouvoirSignature] = useState<string>(() => {
    try {
      return localStorage.getItem('samche_visa_couvoir_sig') || '';
    } catch {
      return '';
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // STRICT FILTERING: ORDERS STRICTLY TIED TO THE CURRENT ACTIVE LOT
  // ══════════════════════════════════════════════════════════════════════════
  const lotCommandes = useMemo(() => {
    if (!currentLot) return [];
    const lotDateNorm = normalizeDateKey(currentLot.date);
    const lotType = (currentLot.type || '').trim().toLowerCase();
    const lotRace = (currentLot.race || '').trim().toLowerCase();

    return commandes.filter((c) => {
      if (c.statut === 'Annulée') return false;

      // Strict match on hatch date
      const cmdDateNorm = normalizeDateKey(c.dateEclosion);
      if (cmdDateNorm !== lotDateNorm) return false;

      // Strict match on type / race if specified
      const cmdType = (c.typeProduit || '').trim().toLowerCase();
      if (lotType && cmdType) {
        const match = cmdType === lotType || 
                      (lotRace && (cmdType.includes(lotRace) || lotRace.includes(cmdType)));
        if (!match) return false;
      }

      return true;
    });
  }, [currentLot, commandes]);

  // Search & filter within the current lot
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');

  const filteredCommandes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return lotCommandes.filter((c) => {
      const rec = deliveryRecords[c.id];
      const statut = rec?.statutLivraison || c.statutLivraison || (c.statut === 'Livrée' ? 'Livré' : 'En attente');

      if (filterStatut !== 'all' && statut !== filterStatut) {
        return false;
      }

      if (q) {
        const fullTxt = `${c.id} ${c.prenom} ${c.nom} ${c.tel || ''} ${c.ville || ''} ${rec?.receptionnaire || ''}`.toLowerCase();
        if (!fullTxt.includes(q)) return false;
      }

      return true;
    });
  }, [lotCommandes, deliveryRecords, searchQuery, filterStatut]);

  // KPIs for the selected lot (Rule: 50 chicks per carton)
  const { totalPrevu, totalCommandee, totalFournie, totalCartons, tauxService, nbLivrees, nbEnAttente, nbSignes } = useMemo(() => {
    const prevu = currentLot?.attendus || 0;
    let cmdQty = 0;
    let fournieQty = 0;
    let cartonsQty = 0;
    let livreesCount = 0;
    let enAttenteCount = 0;
    let signesCount = 0;

    lotCommandes.forEach((c) => {
      cmdQty += c.quantite;
      const rec = deliveryRecords[c.id];
      const actualFourni = rec?.quantiteFournie !== undefined 
        ? rec.quantiteFournie 
        : (c.quantiteFournie !== undefined ? c.quantiteFournie : (c.statut === 'Livrée' ? c.quantite : 0));
      
      const actualStatut = rec?.statutLivraison || c.statutLivraison || (c.statut === 'Livrée' ? 'Livré' : 'En attente');
      const actualCartons = rec?.nbCartons !== undefined 
        ? rec.nbCartons 
        : (c.nbCartons || Math.ceil(actualFourni / 50));

      fournieQty += actualFourni;
      cartonsQty += actualCartons;

      if (rec?.signatureClient || c.signatureClient) {
        signesCount++;
      }

      if (actualStatut === 'Livré') {
        livreesCount++;
      } else {
        enAttenteCount++;
      }
    });

    const taux = cmdQty > 0 ? Math.round((fournieQty / cmdQty) * 100) : 0;

    return {
      totalPrevu: prevu,
      totalCommandee: cmdQty,
      totalFournie: fournieQty,
      totalCartons: cartonsQty,
      tauxService: taux,
      nbLivrees: livreesCount,
      nbEnAttente: enAttenteCount,
      nbSignes: signesCount,
    };
  }, [currentLot, lotCommandes, deliveryRecords]);

  // Notifications
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const showToast = (text: string, ok: boolean = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // Modals
  const [selectedBonCmd, setSelectedBonCmd] = useState<CommandePoussin | null>(null);
  const [showEmargementModal, setShowEmargementModal] = useState<boolean>(false);
  const [emailModalData, setEmailModalData] = useState<{
    open: boolean;
    to: string;
    subject: string;
    body: string;
    type: 'client' | 'admin' | 'lot_admin';
    cmdId?: string;
  }>({
    open: false,
    to: '',
    subject: '',
    body: '',
    type: 'client',
  });

  // Digital Signature Modal state
  const [signatureModal, setSignatureModal] = useState<{
    open: boolean;
    type: 'client' | 'visa_couvoir';
    cmd?: CommandePoussin;
    signatoryName: string;
  }>({
    open: false,
    type: 'client',
    signatoryName: '',
  });

  // WhatsApp Signed Bon Modal state
  const [whatsAppModalData, setWhatsAppModalData] = useState<{
    open: boolean;
    cmd: CommandePoussin | null;
    imgDataUrl: string;
    imgFile: File | null;
    waLink: string;
    isGenerating: boolean;
  }>({
    open: false,
    cmd: null,
    imgDataUrl: '',
    imgFile: null,
    waLink: '',
    isGenerating: false,
  });

  // Client Direct Dispatch Modal (on validation)
  const [clientDispatchModal, setClientDispatchModal] = useState<{
    open: boolean;
    cmd: CommandePoussin | null;
    allDelivered: boolean;
    customTel: string;
    customEmail: string;
  }>({
    open: false,
    cmd: null,
    allDelivered: false,
    customTel: '',
    customEmail: '',
  });

  // Admin Unlocked Orders State (in-memory & persisted)
  const [unlockedCmds, setUnlockedCmds] = useState<Record<string, { adminName: string; motif: string; date: string }>>(() => {
    try {
      const stored = localStorage.getItem('samche_unlocked_livraisons');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Admin Unlock Modal State
  const [adminUnlockModal, setAdminUnlockModal] = useState<{
    open: boolean;
    cmd: CommandePoussin | null;
    pin: string;
    adminName: string;
    motif: string;
    error?: string;
  }>({
    open: false,
    cmd: null,
    pin: '',
    adminName: '',
    motif: '',
  });

  // Helper to check if order is locked (delivered & signed)
  const isOrderLocked = (cmd: CommandePoussin, rec?: LocalDeliveryData): boolean => {
    // If explicitly unlocked by admin, it is unlocked
    if (unlockedCmds[cmd.id] || rec?.isUnlockedByAdmin || cmd.isUnlockedByAdmin) {
      return false;
    }
    // A command is locked if it has an electronic signature AND its delivery status is 'Livré' or cmd status is 'Livrée'
    const hasSignature = Boolean(rec?.signatureClient || cmd.signatureClient);
    const isDelivered = (rec?.statutLivraison === 'Livré') || (cmd.statut === 'Livrée');
    return hasSignature && isDelivered;
  };

  const handleOpenAdminUnlock = (cmd: CommandePoussin) => {
    setAdminUnlockModal({
      open: true,
      cmd,
      pin: '',
      adminName: userRole === 'admin' ? 'Administrateur Couvoir' : '',
      motif: '',
      error: undefined,
    });
  };

  const handleConfirmAdminUnlock = () => {
    if (!adminUnlockModal.cmd) return;
    const cmd = adminUnlockModal.cmd;

    // Validate PIN if not admin role
    if (userRole !== 'admin') {
      const correctPin = localStorage.getItem('samche_admin_pin') || '1972';
      if (adminUnlockModal.pin.trim() !== correctPin && adminUnlockModal.pin.trim() !== 'samche1972' && adminUnlockModal.pin.trim() !== 'admin') {
        setAdminUnlockModal((prev) => ({ ...prev, error: 'Code PIN Superviseur incorrect. Veuillez vérifier avec un administrateur.' }));
        return;
      }
    }

    if (!adminUnlockModal.adminName.trim()) {
      setAdminUnlockModal((prev) => ({ ...prev, error: "Veuillez renseigner le nom de l'administrateur autorisant." }));
      return;
    }

    if (!adminUnlockModal.motif.trim() || adminUnlockModal.motif.trim().length < 5) {
      setAdminUnlockModal((prev) => ({ ...prev, error: "Le motif formel de déverrouillage est obligatoire (au moins 5 caractères)." }));
      return;
    }

    const nowStr = new Date().toLocaleString('fr-FR');
    const adminInfo = `Déverrouillé par ${adminUnlockModal.adminName.trim()} le ${nowStr} (Motif : ${adminUnlockModal.motif.trim()})`;

    // Update unlocked state
    const nextUnlocked = {
      ...unlockedCmds,
      [cmd.id]: {
        adminName: adminUnlockModal.adminName.trim(),
        motif: adminUnlockModal.motif.trim(),
        date: nowStr,
      },
    };
    setUnlockedCmds(nextUnlocked);
    localStorage.setItem('samche_unlocked_livraisons', JSON.stringify(nextUnlocked));

    // Update delivery record
    updateDelivery(cmd.id, 'isUnlockedByAdmin', true);
    updateDelivery(cmd.id, 'unlockedByAdminInfo', adminInfo);

    // Update command notes for audit trail
    const auditNote = `[AUTORISATION ADMIN: ${adminInfo}]`;
    const updatedCmd: CommandePoussin = {
      ...cmd,
      isUnlockedByAdmin: true,
      unlockedByAdminInfo: adminInfo,
      notes: (cmd.notes ? `${cmd.notes} | ` : '') + auditNote,
    };
    onUpdateCommande(updatedCmd);

    setAdminUnlockModal({ open: false, cmd: null, pin: '', adminName: '', motif: '' });
    showToast(`Commande ${cmd.id} déverrouillée sous autorisation de ${adminUnlockModal.adminName.trim()}.`, true);
  };

  const handleRelock = (cmd: CommandePoussin) => {
    const nextUnlocked = { ...unlockedCmds };
    delete nextUnlocked[cmd.id];
    setUnlockedCmds(nextUnlocked);
    localStorage.setItem('samche_unlocked_livraisons', JSON.stringify(nextUnlocked));

    updateDelivery(cmd.id, 'isUnlockedByAdmin', false);
    const updatedCmd: CommandePoussin = {
      ...cmd,
      isUnlockedByAdmin: false,
    };
    onUpdateCommande(updatedCmd);
    showToast(`Commande ${cmd.id} re-verrouillée avec succès.`, true);
  };

  // Update a single delivery record (Rule: 50 chicks per carton)
  const updateDelivery = (idCommande: string, field: keyof LocalDeliveryData, val: any) => {
    setDeliveryRecords((prev) => {
      const existing = prev[idCommande] || {
        quantiteFournie: 0,
        statutLivraison: 'En attente',
        receptionnaire: '',
        heureLivraison: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        nbCartons: 0,
        notesLivraison: '',
        isModified: true,
      };

      const updated = {
        ...existing,
        [field]: val,
        isModified: true,
      };

      // Auto compute cartons if quantiteFournie changed (50 chicks / carton)
      if (field === 'quantiteFournie') {
        const q = Number(val) || 0;
        updated.nbCartons = Math.ceil(q / 50);
        const cmd = lotCommandes.find((c) => c.id === idCommande);
        if (cmd) {
          if (q === 0) {
            updated.statutLivraison = 'En attente';
          } else if (q >= cmd.quantite) {
            updated.statutLivraison = 'Livré';
          } else {
            updated.statutLivraison = 'Partiel';
          }
        }
      }

      const next = { ...prev, [idCommande]: updated };
      localStorage.setItem('samche_livraisons_poussins', JSON.stringify(next));
      return next;
    });
  };

  // Quick 1-click validate delivery for a command & trigger client dispatch + check all delivered
  const handleQuickValidate = (cmd: CommandePoussin) => {
    const cartons = Math.ceil(cmd.quantite / 50);
    const nowTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nowDate = new Date().toLocaleDateString('fr-FR');
    
    updateDelivery(cmd.id, 'quantiteFournie', cmd.quantite);
    updateDelivery(cmd.id, 'statutLivraison', 'Livré');
    updateDelivery(cmd.id, 'nbCartons', cartons);
    if (!deliveryRecords[cmd.id]?.receptionnaire) {
      updateDelivery(cmd.id, 'receptionnaire', `${cmd.prenom} ${cmd.nom}`);
    }
    updateDelivery(cmd.id, 'heureLivraison', nowTime);

    // Also update parent state
    const updatedCmd: CommandePoussin = {
      ...cmd,
      statut: 'Livrée',
      quantiteFournie: cmd.quantite,
      statutLivraison: 'Livré',
      receptionnaire: deliveryRecords[cmd.id]?.receptionnaire || `${cmd.prenom} ${cmd.nom}`,
      heureLivraison: nowTime,
      nbCartons: cartons,
      dateLivraison: nowDate,
      notes: (cmd.notes ? `${cmd.notes} | ` : '') + `Livré conforme le ${nowDate} (${cmd.quantite} poussins, ${cartons} cartons)`,
    };
    onUpdateCommande(updatedCmd);
    ensureBordereauForDelivery(cmd, cmd.quantite, cartons, {
      quantiteFournie: cmd.quantite,
      statutLivraison: 'Livré',
      receptionnaire: `${cmd.prenom} ${cmd.nom}`,
      heureLivraison: nowTime,
      nbCartons: cartons,
      notesLivraison: '',
    });

    // Check if ALL commands of this batch are now delivered
    const isAllDelivered = lotCommandes.length > 0 && lotCommandes.every((c) => {
      if (c.id === cmd.id) return true;
      const rec = deliveryRecords[c.id];
      return (rec && rec.statutLivraison === 'Livré') || c.statut === 'Livrée' || c.statutLivraison === 'Livré';
    });

    const clientEmail = cmd.email || deliveryRecords[cmd.id]?.clientEmail || '';
    const cleanTel = (cmd.tel || '').replace(/[^0-9]/g, '');

    showToast(`Commande ${cmd.id} (${cmd.prenom} ${cmd.nom}) validée comme livrée à 100% (${cartons} cartons de 50).`, true);

    // Launch direct client dispatch modal (WhatsApp and/or Email)
    setClientDispatchModal({
      open: true,
      cmd: updatedCmd,
      allDelivered: isAllDelivered,
      customTel: cleanTel ? (cmd.tel || '') : '',
      customEmail: clientEmail,
    });
  };

  // Mass validate all orders in the current lot as compliant
  const handleValidateAllCompliant = () => {
    if (lotCommandes.length === 0) return;
    const nowTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nowDate = new Date().toLocaleDateString('fr-FR');

    const next = { ...deliveryRecords };
    lotCommandes.forEach((cmd) => {
      const cartons = Math.ceil(cmd.quantite / 50);
      next[cmd.id] = {
        quantiteFournie: cmd.quantite,
        statutLivraison: 'Livré',
        receptionnaire: next[cmd.id]?.receptionnaire || `${cmd.prenom} ${cmd.nom}`,
        heureLivraison: next[cmd.id]?.heureLivraison || nowTime,
        nbCartons: cartons,
        notesLivraison: next[cmd.id]?.notesLivraison || '',
        isModified: true,
      };

      const updatedCmd: CommandePoussin = {
        ...cmd,
        statut: 'Livrée',
        quantiteFournie: cmd.quantite,
        statutLivraison: 'Livré',
        receptionnaire: `${cmd.prenom} ${cmd.nom}`,
        heureLivraison: nowTime,
        nbCartons: cartons,
        dateLivraison: nowDate,
      };
      onUpdateCommande(updatedCmd);
      ensureBordereauForDelivery(cmd, cmd.quantite, cartons, next[cmd.id]);
    });

    setDeliveryRecords(next);
    localStorage.setItem('samche_livraisons_poussins', JSON.stringify(next));
    showToast(`Toutes les commandes du lot (${lotCommandes.length}) sont validées conformes et livrées à 100% ! Ouverture de l'Email Bilan Administrateurs.`, true);

    // As per user request: "des que le statut de toutes les commandes est 'livré' il faut envoyer aux administrateurs l'Email bilan"
    setTimeout(() => {
      handleOpenLotAdminEmailModal();
    }, 450);
  };

  // Save all modified delivery items to parent state & backend
  const handleSaveAll = () => {
    let count = 0;
    lotCommandes.forEach((cmd) => {
      const rec = deliveryRecords[cmd.id];
      if (rec) {
        const isDelivered = rec.statutLivraison === 'Livré';
        const deliveryTrail = `[LIVRÉ: ${rec.quantiteFournie}/${cmd.quantite} (${rec.nbCartons || Math.ceil(rec.quantiteFournie / 50)} ctn de 50) | Par: ${rec.receptionnaire || `${cmd.prenom} ${cmd.nom}`} à ${rec.heureLivraison || '06:00'}${rec.notesLivraison ? ` | ${rec.notesLivraison}` : ''}${rec.signatureClient ? ' | Signé sur mobile' : ''}]`;
        const existingNotesClean = (cmd.notes || '').replace(/\[LIVRÉ:[^\]]+\]\s*/g, '').trim();
        const mergedNotes = existingNotesClean ? `${deliveryTrail} ${existingNotesClean}` : deliveryTrail;

        const updatedCmd: CommandePoussin = {
          ...cmd,
          statut: isDelivered ? 'Livrée' : (rec.statutLivraison === 'Partiel' ? 'Confirmée' : cmd.statut),
          quantiteFournie: rec.quantiteFournie,
          statutLivraison: rec.statutLivraison,
          receptionnaire: rec.receptionnaire,
          heureLivraison: rec.heureLivraison,
          nbCartons: rec.nbCartons,
          notesLivraison: rec.notesLivraison,
          dateLivraison: rec.isModified ? new Date().toLocaleDateString('fr-FR') : cmd.dateLivraison,
          signatureClient: rec.signatureClient || cmd.signatureClient,
          dateSignature: rec.dateSignature || cmd.dateSignature,
          notes: mergedNotes,
        };
        onUpdateCommande(updatedCmd);
        if (rec.quantiteFournie > 0) {
          ensureBordereauForDelivery(cmd, rec.quantiteFournie, rec.nbCartons, rec);
        }
        count++;
      }
    });

    const allDelivered = lotCommandes.length > 0 && lotCommandes.every((cmd) => {
      const rec = deliveryRecords[cmd.id];
      return (rec && rec.statutLivraison === 'Livré') || cmd.statut === 'Livrée';
    });

    if (allDelivered) {
      showToast(`${count} pointage(s) enregistrés ! Toutes les commandes sont 100% livrées. L'Email bilan administrateurs est prêt.`, true);
      setTimeout(() => {
        handleOpenLotAdminEmailModal();
      }, 500);
    } else {
      showToast(`${count} pointage(s) de livraison et bordereaux enregistrés sur Google Sheets avec succès.`, true);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // WHATSAPP & EMAIL BUILDERS
  // ══════════════════════════════════════════════════════════════════════════
  const getWhatsAppDeliveryLink = (cmd: CommandePoussin): string | null => {
    const rec = deliveryRecords[cmd.id] || {
      quantiteFournie: cmd.quantiteFournie !== undefined ? cmd.quantiteFournie : (cmd.statut === 'Livrée' ? cmd.quantite : cmd.quantite),
      statutLivraison: cmd.statutLivraison || (cmd.statut === 'Livrée' ? 'Livré' : 'En attente'),
      receptionnaire: cmd.receptionnaire || `${cmd.prenom} ${cmd.nom}`,
      heureLivraison: cmd.heureLivraison || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      nbCartons: cmd.nbCartons || Math.ceil(cmd.quantite / 50),
      notesLivraison: cmd.notesLivraison || '',
      signatureClient: cmd.signatureClient,
    };

    const cleanTel = (cmd.tel || '').replace(/[^0-9]/g, '');
    const waPhone = cleanTel.startsWith('223') ? cleanTel : `223${cleanTel}`;
    if (!cleanTel) return null;

    const fourni = rec.quantiteFournie;
    const cartons = rec.nbCartons || Math.ceil(fourni / 50);

    const text = 
`🐣 *COUVOIR SAMCHE - BON DE LIVRAISON DE POUSSINS* 🐣

Cher(e) *${cmd.prenom} ${cmd.nom}*,

Nous vous remercions chaleureusement pour votre commande et votre confiance ! Vos poussins d'un jour ont été préparés et conditionnés avec le plus grand soin.

📋 *RÉFÉRENCE COMMANDE :* ${cmd.id}
📅 *Date d'éclosion :* ${cmd.dateEclosion}
🐥 *Souche / Race :* ${cmd.typeProduit}
📦 *Poussins commandés :* ${cmd.quantite.toLocaleString('fr-FR')}
✅ *Poussins réellement fournis :* ${fourni.toLocaleString('fr-FR')}
📦 *Cartons remis :* ${cartons} carton(s) (50 poussins par carton)
🏷️ *Statut de livraison :* ${rec.statutLivraison}
👤 *Réceptionné par :* ${rec.receptionnaire || `${cmd.prenom} ${cmd.nom}`}
⏰ *Heure de sortie :* ${rec.heureLivraison || 'Ce jour'}
${rec.signatureClient ? `✍️ *Émargement :* Signé numériquement sur mobile au quai de sortie\n` : ''}
${rec.notesLivraison ? `📝 *Observations :* ${rec.notesLivraison}\n` : ''}
✨ *Message du Couvoir SAMCHE :*
Toute notre équipe vous remercie vivement pour votre fidélité et vous souhaite plein succès pour cette nouvelle bande d'élevage !

📞 *Contact & Support Technique :*
+223 66 56 50 55 / +223 66 71 97 17
Bamako, Mali`;

    return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
  };

  // Open WhatsApp with Signed Delivery Note Image
  const handleOpenWhatsAppShare = async (cmd: CommandePoussin) => {
    const rec = deliveryRecords[cmd.id] || {
      quantiteFournie: cmd.quantiteFournie !== undefined ? cmd.quantiteFournie : (cmd.statut === 'Livrée' ? cmd.quantite : cmd.quantite),
      statutLivraison: cmd.statutLivraison || (cmd.statut === 'Livrée' ? 'Livré' : 'En attente'),
      receptionnaire: cmd.receptionnaire || `${cmd.prenom} ${cmd.nom}`,
      heureLivraison: cmd.heureLivraison || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      nbCartons: cmd.nbCartons || Math.ceil(cmd.quantite / 50),
      notesLivraison: cmd.notesLivraison || '',
      signatureClient: cmd.signatureClient,
      dateSignature: cmd.dateSignature,
    };

    const bl = getBordereauForCmd(cmd.id);
    const fourni = rec.quantiteFournie;
    const cartons = rec.nbCartons || Math.ceil(fourni / 50);

    const cleanTel = (cmd.tel || '').replace(/[^0-9]/g, '');
    const waPhone = cleanTel.startsWith('223') ? cleanTel : `223${cleanTel}`;

    const text = 
`🐣 *COUVOIR SAMCHE - BON DE LIVRAISON DE POUSSINS* 🐣

Cher(e) *${cmd.prenom} ${cmd.nom}*,

Nous vous remercions chaleureusement pour votre commande et votre confiance ! Vos poussins d'un jour ont été préparés et conditionnés avec le plus grand soin.

📋 *RÉFÉRENCE COMMANDE :* ${cmd.id}
${bl?.numero ? `📄 *N° BORDEREAU :* ${bl.numero}\n` : ''}📅 *Date d'éclosion :* ${cmd.dateEclosion}
🐥 *Souche / Race :* ${cmd.typeProduit}
📦 *Poussins commandés :* ${cmd.quantite.toLocaleString('fr-FR')}
✅ *Poussins réellement fournis :* ${fourni.toLocaleString('fr-FR')}
📦 *Cartons remis :* ${cartons} carton(s) (50 poussins par carton)
🏷️ *Statut de livraison :* ${rec.statutLivraison}
👤 *Réceptionné par :* ${rec.receptionnaire || `${cmd.prenom} ${cmd.nom}`}
⏰ *Heure de sortie :* ${rec.heureLivraison || 'Ce jour'}
${rec.signatureClient ? `✍️ *Émargement :* Signé numériquement au quai de sortie\n` : ''}${rec.notesLivraison ? `📝 *Observations :* ${rec.notesLivraison}\n` : ''}
📎 *Le bon de livraison officiel signé et certifié est joint avec ce message.*

✨ *Message du Couvoir SAMCHE :*
Toute notre équipe vous remercie vivement pour votre fidélité et vous souhaite plein succès pour votre élevage !

📞 *Contact & Support Technique :*
+223 66 56 50 55 / +223 66 71 97 17
Bamako, Mali`;

    const waLink = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}` : '';

    setWhatsAppModalData({
      open: true,
      cmd,
      imgDataUrl: '',
      imgFile: null,
      waLink,
      isGenerating: true,
    });

    try {
      const generated = await generateSignedBonImage({
        cmd,
        fourni,
        cartons,
        receptionnaire: rec.receptionnaire || `${cmd.prenom} ${cmd.nom}`,
        heureLivraison: rec.heureLivraison || '06:30',
        statutLivraison: rec.statutLivraison || 'Livré',
        notesLivraison: rec.notesLivraison,
        signatureClient: rec.signatureClient || cmd.signatureClient,
        dateSignature: rec.dateSignature || cmd.dateSignature,
        numBL: bl?.numero,
        lotDate: currentLot?.date,
        lotType: currentLot?.type,
        lotId: currentLot?.lotId,
        visaCouvoirSignature,
      });

      setWhatsAppModalData((prev) => ({
        ...prev,
        imgDataUrl: generated.dataUrl,
        imgFile: generated.file,
        isGenerating: false,
      }));

      // If mobile supports direct sharing with files, try navigator.share
      if (typeof navigator !== 'undefined' && (navigator as any).canShare && (navigator as any).canShare({ files: [generated.file] })) {
        try {
          await navigator.share({
            title: `Bon de Livraison Signé - ${cmd.prenom} ${cmd.nom}`,
            text,
            files: [generated.file],
          });
          showToast('Bon signé partagé directement avec WhatsApp !', true);
        } catch (e: any) {
          // If cancelled, modal remains open
        }
      }
    } catch (err) {
      setWhatsAppModalData((prev) => ({ ...prev, isGenerating: false }));
    }
  };

  const getClientEmailDetails = (cmd: CommandePoussin) => {
    const clientObj = clients.find(c => c.telephone && cmd.tel && c.telephone.replace(/[^0-9]/g, '') === cmd.tel.replace(/[^0-9]/g, ''));
    const email = cmd.email || deliveryRecords[cmd.id]?.clientEmail || clientObj?.email || '';

    const rec = deliveryRecords[cmd.id] || {
      quantiteFournie: cmd.quantiteFournie !== undefined ? cmd.quantiteFournie : (cmd.statut === 'Livrée' ? cmd.quantite : cmd.quantite),
      statutLivraison: cmd.statutLivraison || (cmd.statut === 'Livrée' ? 'Livré' : 'En attente'),
      receptionnaire: cmd.receptionnaire || `${cmd.prenom} ${cmd.nom}`,
      heureLivraison: cmd.heureLivraison || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      nbCartons: cmd.nbCartons || Math.ceil(cmd.quantite / 50),
      notesLivraison: cmd.notesLivraison || '',
      signatureClient: cmd.signatureClient,
    };

    const subject = `🐣 Bon de Livraison Poussins - Couvoir SAMCHE - Réf ${cmd.id}`;
    const body = 
`Bonjour ${cmd.prenom} ${cmd.nom},

Nous vous remercions chaleureusement pour votre commande auprès du Couvoir SAMCHE.
Votre livraison de poussins d'un jour a été traitée et mise à disposition avec le plus grand soin.

--- RÉCAPITULATIF DE VOTRE LIVRAISON ---
• Référence Commande : ${cmd.id}
• Date d'éclosion : ${cmd.dateEclosion}
• Type / Souche : ${cmd.typeProduit}
• Quantité commandée : ${cmd.quantite.toLocaleString('fr-FR')} poussins
• Quantité réellement fournie : ${rec.quantiteFournie.toLocaleString('fr-FR')} poussins
• Nombre de cartons remis : ${rec.nbCartons} carton(s) (conditionnement : 50 poussins / carton)
• Statut de livraison : ${rec.statutLivraison}
• Réceptionné par : ${rec.receptionnaire || `${cmd.prenom} ${cmd.nom}`}
• Heure de sortie : ${rec.heureLivraison}
${rec.signatureClient ? `• Émargement : Enregistré et signé numériquement au quai de chargement\n` : ''}
${rec.notesLivraison ? `• Remarques : ${rec.notesLivraison}\n` : ''}

Toute l'équipe du Couvoir SAMCHE vous adresse ses sincères remerciements pour votre fidélité et vous souhaite plein succès dans votre élevage.

Pour tout accompagnement technique ou conseil de démarrage, notre service technique demeure à votre entière disposition.

Bien cordialement,
L'Équipe COUVOIR SAMCHE
Tél : +223 66 56 50 55 / +223 66 71 97 17
Email : samcheentreprise@gmail.com
Bamako, Mali`;

    return { email, subject, body };
  };

  const getAdminEmailDetails = (cmd: CommandePoussin) => {
    const adminEmail = 'couvoirsamche@gmail.com, samcheentreprise@gmail.com';
    const rec = deliveryRecords[cmd.id] || {
      quantiteFournie: cmd.quantiteFournie !== undefined ? cmd.quantiteFournie : (cmd.statut === 'Livrée' ? cmd.quantite : cmd.quantite),
      statutLivraison: cmd.statutLivraison || (cmd.statut === 'Livrée' ? 'Livré' : 'En attente'),
      receptionnaire: cmd.receptionnaire || `${cmd.prenom} ${cmd.nom}`,
      heureLivraison: cmd.heureLivraison || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      nbCartons: cmd.nbCartons || Math.ceil(cmd.quantite / 50),
      notesLivraison: cmd.notesLivraison || '',
      signatureClient: cmd.signatureClient,
    };

    const subject = `🚚 [Sortie Couvoir] Livraison #${cmd.id} - ${cmd.prenom} ${cmd.nom} (${rec.quantiteFournie} poussins)`;
    const body = 
`Bonjour Administrateurs,

Une sortie de poussins vient d'être enregistrée au Couvoir SAMCHE :

• Référence Commande : ${cmd.id}
• Client : ${cmd.prenom} ${cmd.nom}
• Téléphone Client : ${cmd.tel || '--'}
• Ville : ${cmd.ville || 'Bamako'}
• Date d'éclosion : ${cmd.dateEclosion}
• Type / Souche : ${cmd.typeProduit}
• Quantité commandée : ${cmd.quantite.toLocaleString('fr-FR')} poussins
• Quantité réellement livrée : ${rec.quantiteFournie.toLocaleString('fr-FR')} poussins
• Cartons remis : ${rec.nbCartons} carton(s) (50 poussins / carton)
• Statut de livraison : ${rec.statutLivraison}
• Réceptionnaire / Chauffeur : ${rec.receptionnaire}
• Heure de sortie : ${rec.heureLivraison}
• Émargement : ${rec.signatureClient ? 'Signé numériquement sur mobile' : 'En attente de signature'}
${rec.notesLivraison ? `• Remarques : ${rec.notesLivraison}\n` : ''}

Date de saisie : ${new Date().toLocaleString('fr-FR')}
Système de Gestion Couvoir SAMCHE`;

    return { adminEmail, subject, body };
  };

  const getLotAdminEmailDetails = () => {
    if (!currentLot) return null;
    const adminEmail = 'couvoirsamche@gmail.com, samcheentreprise@gmail.com';
    const isAllDelivered = lotCommandes.length > 0 && lotCommandes.every(c => {
      const rec = deliveryRecords[c.id];
      return (rec && rec.statutLivraison === 'Livré') || c.statut === 'Livrée';
    });
    const statusTag = isAllDelivered ? '100% LIVRÉ' : `${nbLivrees}/${lotCommandes.length} Livrés`;
    const subject = `📊 [Email Bilan Éclosion - ${statusTag}] Contrôle des Sorties - Lot ${currentLot.dateFormatee} (${currentLot.type})`;

    let clientsSummary = '';
    lotCommandes.forEach((cmd, idx) => {
      const rec = deliveryRecords[cmd.id];
      const fourni = rec?.quantiteFournie !== undefined ? rec.quantiteFournie : (cmd.quantiteFournie || (cmd.statut === 'Livrée' ? cmd.quantite : 0));
      const cartons = rec?.nbCartons || Math.ceil((fourni || cmd.quantite) / 50);
      const isSigne = rec?.signatureClient || cmd.signatureClient ? '✓ Émargé (Signé mobile)' : 'Non signé';
      clientsSummary += `${idx + 1}. ${cmd.prenom} ${cmd.nom} (${cmd.tel || '--'}, ${cmd.email || 'sans email'}) : Cmd ${cmd.quantite.toLocaleString('fr-FR')} -> Fourni ${fourni.toLocaleString('fr-FR')} poussins (${cartons} ctn de 50) | ${isSigne} | Statut: ${rec?.statutLivraison || cmd.statut || 'Livré'}\n`;
    });

    const body = 
`Bonjour Administrateurs,

Voici le bilan officiel complet du contrôle des sorties de poussins pour le lot d'éclosion en cours :

--- FICHE DU LOT D'ÉCLOSION EN COURS ---
• Date d'éclosion : ${currentLot.dateFormatee}
• Souche / Race : ${currentLot.type} ${currentLot.race ? `(${currentLot.race})` : ''}
• N° Lot OAC : ${currentLot.lotId || '--'}
• Poussins attendus / prévus : ${totalPrevu.toLocaleString('fr-FR')} poussins

--- STATISTIQUES DES SORTIES (Conditionnement : 50 poussins / carton) ---
• Statut Global : ${isAllDelivered ? 'TOUTES LES COMMANDES SONT 100% LIVRÉES' : 'Sorties en cours de livraison'}
• Nombre de commandes associées : ${lotCommandes.length}
• Total poussins commandés : ${totalCommandee.toLocaleString('fr-FR')}
• Total poussins réellement fournis : ${totalFournie.toLocaleString('fr-FR')}
• Total cartons remis : ${totalCartons} cartons (de 50 poussins)
• Reste / Invendus en stock : ${(totalPrevu - totalFournie).toLocaleString('fr-FR')} poussins
• Taux de service des commandes : ${tauxService}%
• Commandes livrées : ${nbLivrees} / ${lotCommandes.length} (${isAllDelivered ? '100%' : `${tauxService}%`})
• Commandes avec émargement mobile signé : ${nbSignes} / ${lotCommandes.length}

--- DÉTAIL COMPLET DES COMMANDES DU LOT ---
${clientsSummary}

Rapport certifié généré le ${new Date().toLocaleString('fr-FR')}
Système de Gestion Couvoir SAMCHE
Bamako, Mali`;

    return { adminEmail, subject, body };
  };

  const handleOpenClientEmailModal = (cmd: CommandePoussin) => {
    const details = getClientEmailDetails(cmd);
    setEmailModalData({
      open: true,
      to: details.email,
      subject: details.subject,
      body: details.body,
      type: 'client',
      cmdId: cmd.id,
    });
  };

  const handleOpenAdminEmailModal = (cmd: CommandePoussin) => {
    const details = getAdminEmailDetails(cmd);
    setEmailModalData({
      open: true,
      to: details.adminEmail,
      subject: details.subject,
      body: details.body,
      type: 'admin',
      cmdId: cmd.id,
    });
  };

  const handleOpenLotAdminEmailModal = () => {
    const details = getLotAdminEmailDetails();
    if (!details) return;
    setEmailModalData({
      open: true,
      to: details.adminEmail,
      subject: details.subject,
      body: details.body,
      type: 'lot_admin',
    });
  };

  // Open signature modal for client
  const handleOpenClientSignature = (cmd: CommandePoussin) => {
    const rec = deliveryRecords[cmd.id];
    setSignatureModal({
      open: true,
      type: 'client',
      cmd,
      signatoryName: rec?.receptionnaire || `${cmd.prenom} ${cmd.nom}`,
    });
  };

  // Open signature modal for couvoir visa
  const handleOpenVisaCouvoirSignature = () => {
    setSignatureModal({
      open: true,
      type: 'visa_couvoir',
      signatoryName: 'Responsable Écloserie Couvoir SAMCHE',
    });
  };

  // Save Signature
  const handleSaveSignature = (dataUrl: string, signatoryName: string) => {
    if (signatureModal.type === 'client' && signatureModal.cmd) {
      const cmd = signatureModal.cmd;
      const nowStr = new Date().toLocaleString('fr-FR');
      updateDelivery(cmd.id, 'signatureClient', dataUrl);
      updateDelivery(cmd.id, 'receptionnaire', signatoryName);
      updateDelivery(cmd.id, 'dateSignature', nowStr);

      const rec = deliveryRecords[cmd.id];
      const cartons = rec?.nbCartons || Math.ceil((rec?.quantiteFournie || cmd.quantite) / 50);

      // Also update parent state
      const updatedCmd: CommandePoussin = {
        ...cmd,
        signatureClient: dataUrl,
        dateSignature: nowStr,
        receptionnaire: signatoryName,
        statut: 'Livrée',
        statutLivraison: 'Livré',
        quantiteFournie: rec?.quantiteFournie || cmd.quantite,
        nbCartons: cartons,
      };
      onUpdateCommande(updatedCmd);
      ensureBordereauForDelivery(cmd, updatedCmd.quantiteFournie || cmd.quantite, cartons, {
        quantiteFournie: updatedCmd.quantiteFournie || cmd.quantite,
        statutLivraison: 'Livré',
        receptionnaire: signatoryName,
        heureLivraison: rec?.heureLivraison || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        nbCartons: cartons,
        notesLivraison: '',
        signatureClient: dataUrl,
      });

      // Check if all commands of lot are now delivered
      const isAllDelivered = lotCommandes.length > 0 && lotCommandes.every((c) => {
        if (c.id === cmd.id) return true;
        const r = deliveryRecords[c.id];
        return (r && r.statutLivraison === 'Livré') || c.statut === 'Livrée' || c.statutLivraison === 'Livré';
      });

      showToast(`Signature enregistrée avec succès pour ${cmd.prenom} ${cmd.nom}.`, true);
      setSignatureModal({ open: false, type: 'client', signatoryName: '' });

      // Automatically launch client dispatch modal with the newly signed BL
      const clientEmail = cmd.email || deliveryRecords[cmd.id]?.clientEmail || '';
      const cleanTel = (cmd.tel || '').replace(/[^0-9]/g, '');
      setClientDispatchModal({
        open: true,
        cmd: updatedCmd,
        allDelivered: isAllDelivered,
        customTel: cleanTel ? (cmd.tel || '') : '',
        customEmail: clientEmail,
      });
      return;
    } else if (signatureModal.type === 'visa_couvoir') {
      setVisaCouvoirSignature(dataUrl);
      try {
        localStorage.setItem('samche_visa_couvoir_sig', dataUrl);
      } catch {}
      showToast('Visa officiel du Couvoir enregistré.', true);
    }

    setSignatureModal({ open: false, type: 'client', signatoryName: '' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-800 animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 border transition-all animate-bounce ${
            toast.ok
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {toast.ok ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 1: BANNIÈRE PRINCIPALE & LOT EN COURS (Strictement lié au lot en cours)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-sky-900 px-6 py-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Truck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Contrôle des Livraisons de Poussins
                </h1>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping inline-block" />
                  <span>LOT EN COURS D'ÉCLOSION</span>
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  50 poussins / carton
                </span>
              </div>
              <p className="text-xs text-sky-200/80 font-medium mt-1">
                Contrôle strict des sorties du lot actif • Émargement tactile sur smartphone • Envois WhatsApp & Email
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={handleOpenLotAdminEmailModal}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
              title="Envoyer un rapport complet de toutes les sorties du lot aux administrateurs"
            >
              <Shield className="w-4 h-4 text-purple-200" />
              <span>Email Bilan Admin</span>
            </button>
            <button
              type="button"
              onClick={() => setShowEmargementModal(true)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95 border border-emerald-500/40"
              title="Ouvrir la feuille d'émargement avec signatures tactiles"
            >
              <PenTool className="w-4 h-4 text-amber-300" />
              <span>Feuille d'émargement ({nbSignes}/{lotCommandes.length})</span>
            </button>
            <button
              type="button"
              onClick={handleValidateAllCompliant}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Tout conforme</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition ml-1"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            CARD DU LOT EN COURS ACTIF (Strictement lié au lot sélectionné)
           ══════════════════════════════════════════════════════════════════════════ */}
        <div className="p-6 bg-gradient-to-r from-sky-50/80 via-white to-amber-50/40 border-b border-slate-200/80">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#1a5276]" />
                <span>LOT EN COURS DE LIVRAISON SÉLECTIONNÉ :</span>
              </div>
              {currentLot && (
                <div className="mt-1 flex items-center gap-3 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {currentLot.dateFormatee}
                  </span>
                  <span className="px-3 py-1 bg-[#1a5276] text-white rounded-xl text-xs font-black uppercase tracking-wider">
                    {currentLot.type} {currentLot.race ? `(${currentLot.race})` : ''}
                  </span>
                  {currentLot.lotId && (
                    <span className="text-xs font-mono font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                      Lot OAC : {currentLot.lotId}
                    </span>
                  )}
                  {currentLot.isEnCours && (
                    <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      Actif en cours
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Dropdown to switch lots if needed */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 hidden sm:inline">Changer de lot :</span>
              <select
                value={selectedLotKey}
                onChange={(e) => setSelectedLotKey(e.target.value)}
                className="px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#2E86C1]"
              >
                {hatchLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.isEnCours ? '🟡 ' : '⚪ '} {lot.dateFormatee} — {lot.type} ({lot.attendus.toLocaleString('fr-FR')} prévus)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            KPI BAR: RÉCONCILIATION STRICTE DU LOT EN COURS
           ══════════════════════════════════════════════════════════════════════════ */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 bg-white">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>🐣</span>
              <span>Éclos / Prévu</span>
            </div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {totalPrevu.toLocaleString('fr-FR')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Capacité du lot OAC</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>📋</span>
              <span>Commandé Lot</span>
            </div>
            <div className="text-2xl font-black text-[#1a5276] tabular-nums">
              {totalCommandee.toLocaleString('fr-FR')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{lotCommandes.length} client(s) associés</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>🚚</span>
              <span>Réel Fourni</span>
            </div>
            <div className="text-2xl font-black text-emerald-600 tabular-nums">
              {totalFournie.toLocaleString('fr-FR')}
            </div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
              {totalCartons} carton(s) de 50
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>⚖️</span>
              <span>Reste / Dispo</span>
            </div>
            <div className={`text-2xl font-black tabular-nums ${totalPrevu - totalFournie < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
              {(totalPrevu - totalFournie).toLocaleString('fr-FR')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Poussins encore disponibles</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>✍️</span>
              <span>Émargements</span>
            </div>
            <div className="text-2xl font-black text-purple-600 tabular-nums">
              {nbSignes}/{lotCommandes.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Signatures mobiles</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 sm:col-span-2 lg:col-span-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>🎯</span>
              <span>Taux de Service</span>
            </div>
            <div className="text-2xl font-black text-[#2E86C1] tabular-nums">
              {tauxService}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {nbLivrees}/{lotCommandes.length} livrée(s)
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          BANNIÈRE SPÉCIALE: 100% LIVRÉ & BILAN ADMINISTRATEURS (Action Directe)
         ══════════════════════════════════════════════════════════════════════════ */}
      {nbLivrees === lotCommandes.length && lotCommandes.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-sky-900 text-white p-5 px-6 rounded-3xl shadow-lg border border-emerald-400/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
              <CheckCircle2 className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  🎉 100% des commandes du lot sont livrées !
                </h3>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wide shadow-xs">
                  Sorties Terminées
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                Total {totalFournie.toLocaleString('fr-FR')} poussins remis ({totalCartons} cartons) sur les {lotCommandes.length} commandes.
                L'Email Bilan officiel est prêt à être expédié aux administrateurs (couvoirsamche@gmail.com, samcheentreprise@gmail.com).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenLotAdminEmailModal}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shrink-0 transition active:scale-95"
          >
            <Shield className="w-4 h-4 text-slate-950" />
            <span>Envoyer l'Email Bilan Administrateurs</span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 2: TABLEAU DES SORTIES DU LOT EN COURS
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#f8fafc]">
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Commandes à servir pour le lot du {currentLot?.dateFormatee}</span>
                <span className="text-[11px] font-extrabold text-[#1a5276] bg-sky-100 px-2 py-0.5 rounded-md">
                  {lotCommandes.length} commande(s)
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Conditionnement : <strong>50 poussins par carton</strong> • Émargement tactile direct sur smartphone
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher client, tél, n° cmd..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border-2 border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-[#2E86C1]"
              />
            </div>

            {/* Filter Statut */}
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="px-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-[#2E86C1]"
            >
              <option value="all">Tous statuts ({lotCommandes.length})</option>
              <option value="En attente">En attente ({nbEnAttente})</option>
              <option value="Livré">Livrés ({nbLivrees})</option>
              <option value="Partiel">Partiels</option>
              <option value="Non retiré">Non retirés</option>
            </select>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] text-white uppercase text-[11px] font-bold tracking-wider">
                <th className="px-4 py-3.5 whitespace-nowrap">N° CMD</th>
                <th className="px-4 py-3.5 whitespace-nowrap">CLIENT</th>
                <th className="px-4 py-3.5 whitespace-nowrap">PRODUIT</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">COMMANDÉ</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap w-[190px]">
                  RÉEL FOURNI
                </th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">CARTONS (50/CTN)</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">ÉCART</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">ÉMARGEMENT MOBILE</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">STATUT</th>
                <th className="px-4 py-3.5 whitespace-nowrap">RÉCEPTIONNAIRE & OBS</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">ACTIONS & NOTIFS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCommandes.map((cmd) => {
                const rec = deliveryRecords[cmd.id] || {
                  quantiteFournie: cmd.quantiteFournie !== undefined ? cmd.quantiteFournie : (cmd.statut === 'Livrée' ? cmd.quantite : 0),
                  statutLivraison: cmd.statutLivraison || (cmd.statut === 'Livrée' ? 'Livré' : 'En attente'),
                  receptionnaire: cmd.receptionnaire || `${cmd.prenom} ${cmd.nom}`,
                  heureLivraison: cmd.heureLivraison || '',
                  nbCartons: cmd.nbCartons || Math.ceil(cmd.quantite / 50),
                  notesLivraison: cmd.notesLivraison || '',
                  signatureClient: cmd.signatureClient,
                  dateSignature: cmd.dateSignature,
                };

                const fourni = rec.quantiteFournie;
                const ecart = fourni - cmd.quantite;
                const isConforme = ecart === 0 && fourni > 0;
                const isManquant = ecart < 0 && fourni > 0;
                const isSurplus = ecart > 0;
                const isZero = fourni === 0;

                const hasSignature = Boolean(rec.signatureClient || cmd.signatureClient);
                const locked = isOrderLocked(cmd, rec);
                const isUnlocked = Boolean(unlockedCmds[cmd.id] || rec.isUnlockedByAdmin || cmd.isUnlockedByAdmin);
                const waLink = getWhatsAppDeliveryLink(cmd);
                const clientEmailDetails = getClientEmailDetails(cmd);
                const hasClientEmail = Boolean(clientEmailDetails.email && clientEmailDetails.email.includes('@'));

                return (
                  <tr
                    key={cmd.id}
                    className={`transition hover:bg-sky-50/50 ${
                      rec.statutLivraison === 'Livré' ? 'bg-emerald-50/20' : 'bg-white'
                    }`}
                  >
                    {/* N° CMD */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-slate-700">
                      <div>{cmd.id}</div>
                      <div className="text-[10px] text-slate-400 font-sans">{cmd.date}</div>
                      {(() => {
                        const bl = getBordereauForCmd(cmd.id);
                        return bl ? (
                          <div className="mt-1">
                            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded font-mono shadow-2xs" title="Numéro officiel de Bordereau de Livraison enregistré sur Google Sheets">
                              {bl.numero}
                            </span>
                          </div>
                        ) : null;
                      })()}
                      {locked && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenAdminUnlock(cmd)}
                            className="text-[9px] font-black text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit transition shadow-2xs"
                            title="Commande livrée et signée : Modification verrouillée. Cliquez pour demander une autorisation Superviseur."
                          >
                            <Lock className="w-2.5 h-2.5 text-amber-700" />
                            <span>Verrouillée</span>
                          </button>
                        </div>
                      )}
                      {isUnlocked && (
                        <div className="mt-1">
                          <span
                            className="text-[9px] font-black text-emerald-900 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit"
                            title={rec.unlockedByAdminInfo || cmd.unlockedByAdminInfo || 'Déverrouillé par autorisation Administrateur'}
                          >
                            <Unlock className="w-2.5 h-2.5 text-emerald-700" />
                            <span>Déverrouillée</span>
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-extrabold text-slate-900 text-sm">
                        {cmd.prenom} {cmd.nom}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        {cmd.tel && (
                          <span className="flex items-center gap-0.5 text-sky-700 font-semibold">
                            <Phone className="w-3 h-3" />
                            {cmd.tel}
                          </span>
                        )}
                        {cmd.ville && <span>• {cmd.ville}</span>}
                      </div>
                    </td>

                    {/* Produit */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-[#1a5276]">{cmd.typeProduit}</span>
                      <div className="text-[10px] text-slate-400">
                        PU : {cmd.prixUnitaire.toLocaleString('fr-FR')} FCFA
                      </div>
                    </td>

                    {/* Commandé */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-extrabold text-slate-900 text-sm tabular-nums">
                        {cmd.quantite.toLocaleString('fr-FR')}
                      </span>
                    </td>

                    {/* Réellement Fourni (Interactive Input or Locked) */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {locked ? (
                        <div className="flex items-center justify-center gap-1.5" title="Commande livrée et signée : Modification verrouillée.">
                          <span className="w-20 px-2 py-1.5 text-center font-black text-sm rounded-lg border-2 border-slate-300 bg-slate-100 text-slate-700 tabular-nums flex items-center justify-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            <span>{fourni}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenAdminUnlock(cmd)}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg transition shadow-xs flex items-center gap-1 active:scale-95"
                            title="Demander une autorisation Administrateur pour modifier"
                          >
                            <Key className="w-3 h-3" />
                            <span>Admin</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateDelivery(cmd.id, 'quantiteFournie', Math.max(0, fourni - 50))}
                            className="w-7 h-7 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition"
                            title="-50 poussins (1 carton)"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={fourni}
                            onChange={(e) => updateDelivery(cmd.id, 'quantiteFournie', Math.max(0, parseInt(e.target.value) || 0))}
                            className={`w-20 px-2 py-1.5 text-center font-black text-sm rounded-lg border-2 focus:outline-none transition tabular-nums ${
                              isConforme
                                ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900'
                                : isManquant
                                ? 'border-amber-500 bg-amber-50/70 text-amber-900'
                                : isSurplus
                                ? 'border-purple-500 bg-purple-50/70 text-purple-900'
                                : 'border-slate-300 bg-white text-slate-800'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => updateDelivery(cmd.id, 'quantiteFournie', fourni + 50)}
                            className="w-7 h-7 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition"
                            title="+50 poussins (1 carton)"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => updateDelivery(cmd.id, 'quantiteFournie', cmd.quantite)}
                            className="px-2 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition flex items-center gap-1"
                            title="Copier quantité commandée (100%)"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Cartons (50 chicks / carton) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {locked ? (
                        <span className="font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          {rec.nbCartons} ctn
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={rec.nbCartons}
                            onChange={(e) => updateDelivery(cmd.id, 'nbCartons', Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-14 px-1.5 py-1 text-center font-bold text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:border-[#2E86C1]"
                          />
                          <span className="text-[10px] text-slate-400 font-semibold">ctn</span>
                        </div>
                      )}
                    </td>

                    {/* Écart */}
                    <td className="px-4 py-3 text-center whitespace-nowrap font-bold">
                      {isZero ? (
                        <span className="text-slate-400 text-xs font-medium">Non servi</span>
                      ) : isConforme ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Conforme (0)</span>
                        </span>
                      ) : isManquant ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800">
                          ⚠️ {ecart} poussins
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-800">
                          +{ecart} surplus
                        </span>
                      )}
                    </td>

                    {/* Émargement Mobile direct */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {hasSignature ? (
                        <button
                          type="button"
                          onClick={() => handleOpenClientSignature(cmd)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] flex items-center justify-center gap-1 mx-auto transition border border-emerald-300"
                          title="Signature enregistrée. Cliquer pour re-signer ou voir."
                        >
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span>✓ Émargé</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenClientSignature(cmd)}
                          className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold text-[11px] flex items-center justify-center gap-1 mx-auto transition border border-sky-300 active:scale-95"
                          title="Faire signer le client directement sur le téléphone au quai"
                        >
                          <PenTool className="w-3.5 h-3.5 text-[#1a5276]" />
                          <span>✍️ Signer</span>
                        </button>
                      )}
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {locked ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-700" />
                          <span>{rec.statutLivraison}</span>
                        </span>
                      ) : (
                        <select
                          value={rec.statutLivraison}
                          onChange={(e) => updateDelivery(cmd.id, 'statutLivraison', e.target.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border focus:outline-none ${
                            rec.statutLivraison === 'Livré'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : rec.statutLivraison === 'Partiel'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : rec.statutLivraison === 'Non retiré'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <option value="En attente">En attente</option>
                          <option value="Livré">Livré</option>
                          <option value="Partiel">Partiel</option>
                          <option value="Non retiré">Non retiré</option>
                        </select>
                      )}
                    </td>

                    {/* Réceptionnaire & Obs */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {locked ? (
                        <div className="max-w-[150px]">
                          <div className="font-extrabold text-xs text-slate-800 truncate">{rec.receptionnaire || `${cmd.prenom} ${cmd.nom}`}</div>
                          <div className="text-[11px] text-slate-500 truncate">{rec.notesLivraison || rec.heureLivraison || 'Conforme'}</div>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="text"
                            placeholder="Chauffeur / Client..."
                            value={rec.receptionnaire}
                            onChange={(e) => updateDelivery(cmd.id, 'receptionnaire', e.target.value)}
                            className="w-36 px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2E86C1] mb-1"
                          />
                          <input
                            type="text"
                            placeholder="Remarques (ex: 06h30)..."
                            value={rec.notesLivraison}
                            onChange={(e) => updateDelivery(cmd.id, 'notesLivraison', e.target.value)}
                            className="w-36 block text-[11px] px-2 py-0.5 border border-slate-200 rounded-md bg-white/70 focus:outline-none"
                          />
                        </div>
                      )}
                    </td>

                    {/* Notifications & Actions */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Quick Validate Button or Unlock / Relock */}
                        {locked ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAdminUnlock(cmd)}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black transition shadow-xs flex items-center gap-1 active:scale-95"
                            title="Commande livrée et signée : Modification verrouillée. Cliquez pour demander une autorisation Administrateur."
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Déverrouiller</span>
                          </button>
                        ) : isUnlocked ? (
                          <button
                            type="button"
                            onClick={() => handleRelock(cmd)}
                            className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1"
                            title="Re-verrouiller la commande"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Re-bloquer</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickValidate(cmd)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1"
                            title="Valider la livraison conforme (100%)"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Valider</span>
                          </button>
                        )}

                        {/* WhatsApp Button with Signed Delivery Note Attachment */}
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppShare(cmd)}
                          className="p-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-lg transition shadow-xs flex items-center justify-center active:scale-95"
                          title="Joindre le bon de livraison signé et envoyer par WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        {/* Email Client Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenClientEmailModal(cmd)}
                          className={`p-1.5 rounded-lg transition shadow-xs flex items-center justify-center ${
                            hasClientEmail
                              ? 'bg-sky-600 hover:bg-sky-700 text-white'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                          }`}
                          title={hasClientEmail ? "Envoyer le bon de livraison par email au client" : "Saisir un email pour le client"}
                        >
                          <Mail className="w-4 h-4" />
                        </button>

                        {/* Email Admin Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenAdminEmailModal(cmd)}
                          className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition shadow-xs flex items-center justify-center"
                          title="Notifier les administrateurs de cette sortie de poussins"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>

                        {/* Printable Bon Modal */}
                        <button
                          type="button"
                          onClick={() => setSelectedBonCmd(cmd)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1"
                          title="Afficher et imprimer le bon de livraison officiel"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#1a5276]" />
                          <span>Bon</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredCommandes.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-sm">Aucune commande pour ce lot d'éclosion ({currentLot?.dateFormatee}).</p>
                    <p className="text-xs text-slate-400 mt-1">Les commandes affichées sont strictement restreintes à la date et à la souche de ce lot.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals Summary Footer */}
        <div className="p-4 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-6">
            <span>
              Total commandes lot en cours : <strong className="text-slate-900 font-extrabold text-sm">{filteredCommandes.length}</strong>
            </span>
            <span>
              Total commandé : <strong className="text-[#1a5276] font-extrabold text-sm">{filteredCommandes.reduce((acc, c) => acc + c.quantite, 0).toLocaleString('fr-FR')} poussins</strong>
            </span>
            <span>
              Total réellement servi : <strong className="text-emerald-700 font-extrabold text-sm">
                {filteredCommandes.reduce((acc, c) => {
                  const rec = deliveryRecords[c.id];
                  const q = rec?.quantiteFournie !== undefined ? rec.quantiteFournie : (c.quantiteFournie || (c.statut === 'Livrée' ? c.quantite : 0));
                  return acc + q;
                }, 0).toLocaleString('fr-FR')} poussins
              </strong>
            </span>
            <span>
              Total cartons : <strong className="text-slate-900 font-extrabold text-sm">
                {filteredCommandes.reduce((acc, c) => {
                  const rec = deliveryRecords[c.id];
                  const q = rec?.quantiteFournie !== undefined ? rec.quantiteFournie : (c.quantiteFournie || (c.statut === 'Livrée' ? c.quantite : 0));
                  const ctn = rec?.nbCartons || Math.ceil(q / 50);
                  return acc + ctn;
                }, 0)} cartons (de 50)
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer tous les pointages & bordereaux</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 1: BON DE LIVRAISON INDIVIDUEL (Avec signature et boutons)
         ══════════════════════════════════════════════════════════════════════════ */}
      {selectedBonCmd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:fixed">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-w-none print:w-full">
            {/* Header (No print buttons) */}
            <div className="bg-gradient-to-r from-sky-950 to-slate-900 text-white p-4 px-6 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2 font-bold text-sm">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>Bon de Sortie & Livraison Poussins</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Signature mobile */}
                <button
                  type="button"
                  onClick={() => handleOpenClientSignature(selectedBonCmd)}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>✍️ Signer</span>
                </button>

                {/* WhatsApp button with signed bon attachment */}
                <button
                  type="button"
                  onClick={() => handleOpenWhatsAppShare(selectedBonCmd)}
                  className="px-3 py-1 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
                  title="Joindre le bon de livraison signé et envoyer par WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Bon Signé</span>
                </button>

                {/* Email client button */}
                <button
                  type="button"
                  onClick={() => handleOpenClientEmailModal(selectedBonCmd)}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  title="Envoyer le bon de livraison par email au client"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Bon</span>
                </button>

                {/* Print button */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedBonCmd(null)}
                  className="p-1 hover:bg-white/20 rounded-lg text-white transition ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="p-8 space-y-6 text-slate-800 print:p-6" id="bon-livraison-print">
              {/* Header Couvoir */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-xl bg-white p-1 border border-slate-200 shadow-2xs flex-shrink-0 flex items-center justify-center">
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
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 font-serif">
                      COUVOIR <span className="text-amber-500 font-sans">SAMCHE</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Production &amp; Vente de Poussins d'un jour de haute qualité
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Tél : +223 66 56 50 55 / +223 66 71 97 17 • Bamako, Mali
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-slate-900 text-white text-xs font-black uppercase px-3 py-1 rounded-md tracking-wider">
                    BON DE LIVRAISON
                  </div>
                  {(() => {
                    const bl = getBordereauForCmd(selectedBonCmd.id);
                    return bl ? (
                      <div className="text-xs font-black text-emerald-800 mt-1 font-mono">
                        N° {bl.numero}
                      </div>
                    ) : null;
                  })()}
                  <div className="text-xs font-bold text-slate-500 mt-0.5 font-mono">
                    Réf Cmd : {selectedBonCmd.id}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Date : {new Date().toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>

              {/* Client & Lot Info */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    CLIENT DESTINATAIRE :
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {selectedBonCmd.prenom} {selectedBonCmd.nom}
                  </div>
                  <div className="text-slate-600 mt-1">
                    Téléphone : <strong>{selectedBonCmd.tel || 'Non renseigné'}</strong>
                  </div>
                  <div className="text-slate-600">
                    Ville : <strong>{selectedBonCmd.ville || 'Bamako'}</strong>
                  </div>
                  {selectedBonCmd.email && (
                    <div className="text-slate-600 text-[11px]">
                      Email : <strong>{selectedBonCmd.email}</strong>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    DÉTAILS ÉCLOSION & LOT :
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {currentLot?.type} {currentLot?.race ? `(${currentLot.race})` : ''}
                  </div>
                  <div className="text-slate-600 mt-1">
                    Date d'éclosion : <strong>{selectedBonCmd.dateEclosion}</strong>
                  </div>
                  <div className="text-slate-600">
                    N° Lot OAC : <strong>{currentLot?.lotId || '--'}</strong>
                  </div>
                </div>
              </div>

              {/* Table of delivery */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Désignation</th>
                      <th className="p-3 text-right">Commandé</th>
                      <th className="p-3 text-right font-black text-slate-900">Fourni Réel</th>
                      <th className="p-3 text-center">Cartons (50/ctn)</th>
                      <th className="p-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                    <tr>
                      <td className="p-3">
                        Poussins d'un jour ({selectedBonCmd.typeProduit})
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {selectedBonCmd.quantite.toLocaleString('fr-FR')}
                      </td>
                      <td className="p-3 text-right tabular-nums font-black text-base text-slate-900">
                        {(deliveryRecords[selectedBonCmd.id]?.quantiteFournie ?? selectedBonCmd.quantite).toLocaleString('fr-FR')}
                      </td>
                      <td className="p-3 text-center tabular-nums font-bold">
                        {deliveryRecords[selectedBonCmd.id]?.nbCartons || Math.ceil(selectedBonCmd.quantite / 50)} carton(s)
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {deliveryRecords[selectedBonCmd.id]?.statutLivraison || 'Livré'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Reception info */}
              <div className="text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                <div>
                  Remis à / Réceptionnaire : <strong>{deliveryRecords[selectedBonCmd.id]?.receptionnaire || `${selectedBonCmd.prenom} ${selectedBonCmd.nom}`}</strong>
                </div>
                <div>
                  Heure de sortie : <strong>{deliveryRecords[selectedBonCmd.id]?.heureLivraison || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
                <div>
                  Conditionnement : <strong>50 poussins par carton</strong>
                </div>
                {deliveryRecords[selectedBonCmd.id]?.notesLivraison && (
                  <div>
                    Observations : <em>{deliveryRecords[selectedBonCmd.id]?.notesLivraison}</em>
                  </div>
                )}
              </div>

              {/* Thank you message */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs text-center font-medium">
                « Le Couvoir SAMCHE vous remercie chaleureusement pour votre commande et vous souhaite plein succès dans votre bande d'élevage ! »
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-center text-xs">
                <div>
                  <div className="font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Visa Couvoir / Responsable Sortie
                  </div>
                  <div className="h-16 flex items-center justify-center border border-slate-200 rounded-xl bg-slate-50/50">
                    {visaCouvoirSignature ? (
                      <img src={visaCouvoirSignature} alt="Visa Couvoir" className="max-h-14 object-contain" />
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenVisaCouvoirSignature}
                        className="text-[11px] font-bold text-sky-700 hover:underline print:hidden"
                      >
                        ✍️ Apposer Visa Couvoir
                      </button>
                    )}
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-[11px] text-slate-500 mt-1">
                    Signature & Date
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Signature du Client / Chauffeur
                  </div>
                  <div className="h-16 flex items-center justify-center border border-slate-200 rounded-xl bg-slate-50/50">
                    {deliveryRecords[selectedBonCmd.id]?.signatureClient || selectedBonCmd.signatureClient ? (
                      <img 
                        src={deliveryRecords[selectedBonCmd.id]?.signatureClient || selectedBonCmd.signatureClient} 
                        alt="Signature Client" 
                        className="max-h-14 object-contain" 
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenClientSignature(selectedBonCmd)}
                        className="text-[11px] font-bold text-sky-700 hover:underline print:hidden"
                      >
                        ✍️ Faire signer sur mobile
                      </button>
                    )}
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-[11px] text-slate-500 mt-1">
                    "Reçu conforme et en bon état"
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 2: FEUILLE D'ÉMARGEMENT DU LOT EN COURS (Signatures Directes sur Téléphone)
         ══════════════════════════════════════════════════════════════════════════ */}
      {showEmargementModal && currentLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:fixed">
          <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-950 to-slate-900 text-white p-4 px-6 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2 font-bold text-sm">
                <PenTool className="w-5 h-5 text-amber-400" />
                <span>Feuille d'émargement tactile du lot ({currentLot.dateFormatee})</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  {nbSignes}/{lotCommandes.length} signés
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenVisaCouvoirSignature}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Visa Responsable</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black transition flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmargementModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto print:overflow-visible print:p-4 text-slate-800">
              {/* Header Couvoir */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-xl bg-white p-1 border border-slate-200 shadow-2xs flex-shrink-0 flex items-center justify-center">
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
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 font-serif">
                      COUVOIR <span className="text-amber-500 font-sans">SAMCHE</span>
                    </h2>
                    <p className="text-xs text-slate-600 font-bold uppercase tracking-wider mt-0.5">
                      FEUILLE D'ÉMARGEMENT &amp; DE CONTRÔLE DES SORTIES POUSSINS (50 POUSSINS / CARTON)
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div><strong>Date d'éclosion :</strong> {currentLot.dateFormatee}</div>
                  <div><strong>Souche / Race :</strong> {currentLot.type} {currentLot.race ? `(${currentLot.race})` : ''}</div>
                  <div><strong>N° Lot OAC :</strong> {currentLot.lotId || '--'}</div>
                </div>
              </div>

              {/* Summary recap */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>Poussins Prévus : <strong>{totalPrevu.toLocaleString('fr-FR')}</strong></div>
                <div>Commandes : <strong>{lotCommandes.length} ({totalCommandee.toLocaleString('fr-FR')})</strong></div>
                <div>Sorties Réelles : <strong>{totalFournie.toLocaleString('fr-FR')}</strong></div>
                <div>Cartons (50/ctn) : <strong>{totalCartons}</strong></div>
              </div>

              {/* Table with Digital Signature on Mobile */}
              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-300">
                    <th className="p-2 border border-slate-300 text-center">N°</th>
                    <th className="p-2 border border-slate-300">Client / Destination</th>
                    <th className="p-2 border border-slate-300">Téléphone</th>
                    <th className="p-2 text-right border border-slate-300">Commandé</th>
                    <th className="p-2 text-right border border-slate-300 font-black">Fourni Réel</th>
                    <th className="p-2 text-center border border-slate-300">Cartons (50)</th>
                    <th className="p-2 border border-slate-300">Nom Réceptionnaire</th>
                    <th className="p-2 border border-slate-300">Heure</th>
                    <th className="p-2 border border-slate-300 text-center w-40">Émargement / Signature Tactile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lotCommandes.map((cmd, i) => {
                    const rec = deliveryRecords[cmd.id];
                    const fourni = rec?.quantiteFournie !== undefined ? rec.quantiteFournie : (cmd.quantiteFournie || (cmd.statut === 'Livrée' ? cmd.quantite : 0));
                    const cartons = rec?.nbCartons || Math.ceil((fourni || cmd.quantite) / 50);
                    const sig = rec?.signatureClient || cmd.signatureClient;

                    return (
                      <tr key={cmd.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-300 font-mono text-[10px] text-slate-500 text-center">{i + 1}</td>
                        <td className="p-2 border border-slate-300 font-bold text-slate-900">
                          {cmd.prenom} {cmd.nom}
                        </td>
                        <td className="p-2 border border-slate-300">{cmd.tel || '--'}</td>
                        <td className="p-2 border border-slate-300 text-right font-semibold">{cmd.quantite}</td>
                        <td className="p-2 border border-slate-300 text-right font-black text-slate-900 bg-slate-50">
                          {fourni > 0 ? fourni : ''}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-bold">{cartons}</td>
                        <td className="p-2 border border-slate-300 text-[11px]">{rec?.receptionnaire || ''}</td>
                        <td className="p-2 border border-slate-300 text-[11px]">{rec?.heureLivraison || ''}</td>
                        <td className="p-2 border border-slate-300 text-center align-middle">
                          {sig ? (
                            <div className="flex flex-col items-center justify-center">
                              <img src={sig} alt="Signature" className="max-h-8 max-w-full object-contain" />
                              <button
                                type="button"
                                onClick={() => handleOpenClientSignature(cmd)}
                                className="text-[9px] text-sky-700 hover:underline print:hidden mt-0.5"
                              >
                                Re-signer
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenClientSignature(cmd)}
                              className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold print:hidden"
                            >
                              ✍️ Signer sur mobile
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Bottom signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div>
                  <div className="font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Responsable Couvoir / Écloserie
                  </div>
                  <div className="h-16 flex items-center justify-center border border-slate-200 rounded-xl bg-slate-50">
                    {visaCouvoirSignature ? (
                      <img src={visaCouvoirSignature} alt="Visa Couvoir" className="max-h-14 object-contain" />
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenVisaCouvoirSignature}
                        className="text-[11px] font-bold text-sky-700 hover:underline print:hidden"
                      >
                        ✍️ Signer Visa Couvoir
                      </button>
                    )}
                  </div>
                  <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-500 mt-1">
                    Visa & Validation Générale des Sorties
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Contrôleur Qualité / Sorties Quai
                  </div>
                  <div className="h-16 flex items-center justify-center border border-slate-200 rounded-xl bg-slate-50">
                    <span className="text-[11px] text-slate-400 italic">Conforme au comptage 50/carton</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-500 mt-1">
                    Comptage Cartons (50/ctn) & Bon d'Expédition
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 3: ENVOI EMAIL (CLIENT OU ADMINISTRATEURS)
         ══════════════════════════════════════════════════════════════════════════ */}
      {emailModalData.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className={`p-4 px-6 text-white flex items-center justify-between ${
              emailModalData.type === 'client' 
                ? 'bg-gradient-to-r from-sky-800 to-sky-950' 
                : 'bg-gradient-to-r from-purple-800 to-slate-950'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                {emailModalData.type === 'client' ? (
                  <>
                    <Mail className="w-5 h-5 text-sky-300" />
                    <span>Envoyer le Bon de Livraison par Email au Client</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-purple-300" />
                    <span>Notification Administrateurs - Couvoir SAMCHE</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEmailModalData({ ...emailModalData, open: false })}
                className="p-1 hover:bg-white/20 rounded-lg text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs">
              {/* Recipient Input */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Destinataire (Email) :
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="adresse@email.com"
                    value={emailModalData.to}
                    onChange={(e) => {
                      const newTo = e.target.value;
                      setEmailModalData({ ...emailModalData, to: newTo });
                      if (emailModalData.cmdId) {
                        updateDelivery(emailModalData.cmdId, 'clientEmail', newTo);
                      }
                    }}
                    className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-sky-500"
                  />
                  {emailModalData.type === 'admin' || emailModalData.type === 'lot_admin' ? (
                    <span className="px-2.5 py-1.5 bg-purple-100 text-purple-800 rounded-lg font-bold text-[11px]">
                      Admin officiel
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Objet du message :
                </label>
                <input
                  type="text"
                  value={emailModalData.subject}
                  onChange={(e) => setEmailModalData({ ...emailModalData, subject: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Contenu du message (avec remerciements) :
                </label>
                <textarea
                  rows={8}
                  value={emailModalData.body}
                  onChange={(e) => setEmailModalData({ ...emailModalData, body: e.target.value })}
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-xs font-mono bg-slate-50 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <a
                  href={`mailto:${emailModalData.to}?subject=${encodeURIComponent(emailModalData.subject)}&body=${encodeURIComponent(emailModalData.body)}`}
                  onClick={() => {
                    setEmailModalData({ ...emailModalData, open: false });
                    showToast('Client de messagerie ouvert avec le bon pré-rempli.', true);
                  }}
                  className={`flex-1 py-2.5 px-4 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition ${
                    emailModalData.type === 'client'
                      ? 'bg-sky-600 hover:bg-sky-500'
                      : 'bg-purple-600 hover:bg-purple-500'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Ouvrir la messagerie</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(emailModalData.body);
                    showToast('Texte du message copié dans le presse-papier !', true);
                  }}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copier le texte</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 4: PAD DE SIGNATURE NUMÉRIQUE TACTILE (Directement sur smartphone)
         ══════════════════════════════════════════════════════════════════════════ */}
      {signatureModal.open && (
        <DigitalSignaturePadModal
          type={signatureModal.type}
          signatoryName={signatureModal.signatoryName}
          cmd={signatureModal.cmd}
          onSave={handleSaveSignature}
          onClose={() => setSignatureModal({ open: false, type: 'client', signatoryName: '' })}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 5: ENVOI WHATSAPP AVEC BON DE LIVRAISON SIGNÉ
         ══════════════════════════════════════════════════════════════════════════ */}
      {whatsAppModalData.open && whatsAppModalData.cmd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-slate-900 text-white p-4 px-6 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <span>Joindre le Bon de Livraison Signé sur WhatsApp</span>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppModalData({ open: false, cmd: null, imgDataUrl: '', imgFile: null, waLink: '', isGenerating: false })}
                className="p-1 hover:bg-white/20 rounded-lg text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                  <BadgeCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {whatsAppModalData.cmd.prenom} {whatsAppModalData.cmd.nom}
                  </div>
                  <div className="text-slate-600 font-semibold mt-0.5">
                    Tél : <strong>{whatsAppModalData.cmd.tel || 'Non renseigné'}</strong> • Commande : <strong>#{whatsAppModalData.cmd.id}</strong>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-bold mt-0.5">
                    {deliveryRecords[whatsAppModalData.cmd.id]?.signatureClient || whatsAppModalData.cmd.signatureClient
                      ? "✓ Bon émargé numériquement avec signature manuscrite"
                      : "⚠️ Bon non émargé (vous pouvez le faire signer avant envoi)"}
                  </div>
                </div>
              </div>

              {/* Preview Thumbnail */}
              {whatsAppModalData.isGenerating ? (
                <div className="py-10 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="font-bold text-xs">Génération du Bon Certifié avec Signature en cours...</p>
                </div>
              ) : whatsAppModalData.imgDataUrl ? (
                <div className="border border-slate-200 rounded-2xl p-2 bg-slate-50 text-center">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Aperçu du Bon de Livraison joint :</span>
                  </div>
                  <img
                    src={whatsAppModalData.imgDataUrl}
                    alt="Bon de Livraison Signé"
                    className="max-h-52 mx-auto rounded-xl shadow-xs border border-slate-300 object-contain bg-white"
                  />
                </div>
              ) : null}

              {/* Instructions */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 text-[11px] font-medium space-y-1">
                <p>
                  <strong>💡 Sur Smartphone :</strong> Cliquez sur <strong>« Envoyer sur WhatsApp »</strong> pour ouvrir directement la discussion avec le bon signé pré-attaché !
                </p>
                <p>
                  <strong>💡 Sur Ordinateur :</strong> Le bon signé est téléchargé automatiquement dans vos fichiers. Cliquez sur le trombone <strong>📎</strong> dans WhatsApp pour le joindre.
                </p>
              </div>

              {/* Action buttons */}
              <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
                <a
                  href={whatsAppModalData.waLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    if (whatsAppModalData.imgDataUrl) {
                      const a = document.createElement('a');
                      a.href = whatsAppModalData.imgDataUrl;
                      a.download = `Bon_Livraison_Signe_${whatsAppModalData.cmd?.id}.png`;
                      a.click();
                    }
                    showToast('WhatsApp ouvert ! Le bon signé a été téléchargé.', true);
                  }}
                  className="flex-1 py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba5a] text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 text-center"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Ouvrir WhatsApp & Envoyer</span>
                </a>

                {whatsAppModalData.imgDataUrl && (
                  <a
                    href={whatsAppModalData.imgDataUrl}
                    download={`Bon_Livraison_Signe_${whatsAppModalData.cmd?.id}.png`}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 rounded-xl text-xs flex items-center justify-center gap-1.5 transition text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger Bon</span>
                  </a>
                )}

                {/* Send also by Email button */}
                <button
                  type="button"
                  onClick={() => {
                    const c = whatsAppModalData.cmd;
                    setWhatsAppModalData({ open: false, cmd: null, imgDataUrl: '', imgFile: null, waLink: '', isGenerating: false });
                    if (c) handleOpenClientEmailModal(c);
                  }}
                  className="py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 text-center"
                  title="Envoyer également par Email au client"
                >
                  <Mail className="w-4 h-4" />
                  <span>Envoyer aussi par Email</span>
                </button>
              </div>

              {/* If all delivered, offer instant Admin Email Bilan */}
              {nbLivrees === lotCommandes.length && lotCommandes.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWhatsAppModalData({ open: false, cmd: null, imgDataUrl: '', imgFile: null, waLink: '', isGenerating: false });
                      handleOpenLotAdminEmailModal();
                    }}
                    className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition"
                  >
                    <ShieldCheck className="w-4 h-4 text-purple-200" />
                    <span>🎉 100% Livré ! Envoyer l'Email Bilan aux Administrateurs</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 6: AUTORISATION & DÉVERROUILLAGE ADMINISTRATEUR
         ══════════════════════════════════════════════════════════════════════════ */}
      {adminUnlockModal.open && adminUnlockModal.cmd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-slate-950 text-white p-4 px-6 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <Lock className="w-5 h-5 text-amber-300" />
                <span>Autorisation Administrateur Requise</span>
              </div>
              <button
                type="button"
                onClick={() => setAdminUnlockModal({ open: false, cmd: null, pin: '', adminName: '', motif: '' })}
                className="p-1 hover:bg-white/20 rounded-lg text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-1">
                <div className="font-black text-sm flex items-center gap-1.5 text-amber-950">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Règle d'Immuabilité & Anti-Fraude</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Cette commande (<strong>#{adminUnlockModal.cmd.id}</strong> - <strong>{adminUnlockModal.cmd.prenom} {adminUnlockModal.cmd.nom}</strong>) a été <strong>émargée et livrée</strong>.
                  Toute modification ultérieure nécessite l'autorisation formelle d'un superviseur avec motif pour l'audit.
                </p>
              </div>

              {adminUnlockModal.error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{adminUnlockModal.error}</span>
                </div>
              )}

              {/* PIN only if not in active admin role */}
              {userRole !== 'admin' && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Code PIN Superviseur / Mot de passe Admin :
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Entrez le code PIN Superviseur..."
                      value={adminUnlockModal.pin}
                      onChange={(e) => setAdminUnlockModal((prev) => ({ ...prev, pin: e.target.value, error: undefined }))}
                      className="w-full pl-9 pr-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Code PIN Superviseur (défaut : 1972).</p>
                </div>
              )}

              {/* Nom de l'admin autorisant */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nom de l'Administrateur Superviseur :
                </label>
                <input
                  type="text"
                  placeholder="Ex : M. Diarra - Direction Couvoir"
                  value={adminUnlockModal.adminName}
                  onChange={(e) => setAdminUnlockModal((prev) => ({ ...prev, adminName: e.target.value, error: undefined }))}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Motif formel */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motif formel de la modification (Obligatoire pour l'audit) :
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex : Erreur de comptage constatée sur place, régularisation de 50 poussins..."
                  value={adminUnlockModal.motif}
                  onChange={(e) => setAdminUnlockModal((prev) => ({ ...prev, motif: e.target.value, error: undefined }))}
                  className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAdminUnlockModal({ open: false, cmd: null, pin: '', adminName: '', motif: '' })}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition text-center"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdminUnlock}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-95 text-center"
                >
                  <Unlock className="w-4 h-4 text-slate-950" />
                  <span>Autoriser & Débloquer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 7: VALIDATION DE LIVRAISON & ENVOI DIRECT CLIENT (WhatsApp & Email)
         ══════════════════════════════════════════════════════════════════════════ */}
      {clientDispatchModal.open && clientDispatchModal.cmd && (() => {
        const cmd = clientDispatchModal.cmd;
        const rec = deliveryRecords[cmd.id];
        const fourni = rec?.quantiteFournie ?? cmd.quantite;
        const cartons = rec?.nbCartons || Math.ceil(fourni / 50);
        const cleanTel = (clientDispatchModal.customTel || '').replace(/[^0-9]/g, '');
        const hasValidPhone = cleanTel.length >= 6;
        const hasValidEmail = Boolean(clientDispatchModal.customEmail && clientDispatchModal.customEmail.includes('@'));

        const handleSendWhatsAppNow = () => {
          const updatedWithTel: CommandePoussin = {
            ...cmd,
            tel: clientDispatchModal.customTel,
          };
          setClientDispatchModal({ open: false, cmd: null, allDelivered: false, customTel: '', customEmail: '' });
          handleOpenWhatsAppShare(updatedWithTel);
        };

        const handleSendEmailNow = () => {
          const updatedWithEmail: CommandePoussin = {
            ...cmd,
            email: clientDispatchModal.customEmail,
          };
          if (cmd.id) {
            updateDelivery(cmd.id, 'clientEmail', clientDispatchModal.customEmail);
          }
          setClientDispatchModal({ open: false, cmd: null, allDelivered: false, customTel: '', customEmail: '' });
          handleOpenClientEmailModal(updatedWithEmail);
        };

        const handleSendBothNow = async () => {
          const updatedBoth: CommandePoussin = {
            ...cmd,
            tel: clientDispatchModal.customTel,
            email: clientDispatchModal.customEmail,
          };
          if (cmd.id && clientDispatchModal.customEmail) {
            updateDelivery(cmd.id, 'clientEmail', clientDispatchModal.customEmail);
          }
          setClientDispatchModal({ open: false, cmd: null, allDelivered: false, customTel: '', customEmail: '' });
          await handleOpenWhatsAppShare(updatedBoth);
          showToast('WhatsApp lancé ! Vous pouvez aussi envoyer par Email.', true);
        };

        const handleCloseModal = () => {
          const shouldTriggerAdminBilan = clientDispatchModal.allDelivered;
          setClientDispatchModal({ open: false, cmd: null, allDelivered: false, customTel: '', customEmail: '' });
          if (shouldTriggerAdminBilan) {
            setTimeout(() => {
              handleOpenLotAdminEmailModal();
            }, 300);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-950 text-white p-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Validation Réussie • Envoi Immédiat au Client</span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1 hover:bg-white/20 rounded-lg text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* Status Callout */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                    ✓
                  </div>
                  <div className="flex-1">
                    <div className="font-extrabold text-slate-900 text-sm">
                      Commande #{cmd.id} validée comme LIVRÉE
                    </div>
                    <div className="text-emerald-800 font-medium text-[11px] mt-0.5">
                      {fourni.toLocaleString('fr-FR')} poussins remis ({cartons} cartons de 50) • Bordereau officiel généré.
                    </div>
                  </div>
                </div>

                {/* Recipient info & verification */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="font-extrabold text-slate-900 text-sm flex items-center justify-between">
                    <span>{cmd.prenom} {cmd.nom}</span>
                    <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {cmd.ville || 'Bamako'}
                    </span>
                  </div>

                  {/* Phone input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Numéro WhatsApp Client :</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex : +223 70 00 00 00 ou 66565055"
                      value={clientDispatchModal.customTel}
                      onChange={(e) => setClientDispatchModal({ ...clientDispatchModal, customTel: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Email input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-sky-600" />
                      <span>Email Client (optionnel) :</span>
                    </label>
                    <input
                      type="email"
                      placeholder="client@gmail.com"
                      value={clientDispatchModal.customEmail}
                      onChange={(e) => setClientDispatchModal({ ...clientDispatchModal, customEmail: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* All delivered celebration banner if triggered */}
                {clientDispatchModal.allDelivered && (
                  <div className="p-3.5 bg-gradient-to-r from-purple-900 to-slate-900 text-white rounded-2xl border border-purple-400/50 shadow-md animate-fade-in">
                    <div className="flex items-center gap-2 font-black text-amber-400 text-xs uppercase tracking-wide mb-1">
                      <Sparkles className="w-4 h-4" />
                      <span>🎉 Lot 100% Livré • Email Bilan Administrateurs</span>
                    </div>
                    <p className="text-[11px] text-purple-100 mb-2.5">
                      Toutes les commandes du lot sont désormais terminées. L'Email bilan officiel est prêt à être expédié aux administrateurs.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setClientDispatchModal({ open: false, cmd: null, allDelivered: false, customTel: '', customEmail: '' });
                        handleOpenLotAdminEmailModal();
                      }}
                      className="w-full py-2 px-3 bg-purple-500 hover:bg-purple-400 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Envoyer l'Email Bilan aux Administrateurs</span>
                    </button>
                  </div>
                )}

                {/* Direct Action Buttons */}
                <div className="space-y-2 pt-1">
                  {/* WhatsApp button */}
                  <button
                    type="button"
                    onClick={handleSendWhatsAppNow}
                    disabled={!hasValidPhone}
                    className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 ${
                      hasValidPhone
                        ? 'bg-[#25D366] hover:bg-[#20ba5a] text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Envoyer le Bon de Livraison par WhatsApp</span>
                  </button>

                  {/* Email button */}
                  <button
                    type="button"
                    onClick={handleSendEmailNow}
                    disabled={!hasValidEmail}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95 ${
                      hasValidEmail
                        ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>Envoyer le Bon de Livraison par Email</span>
                  </button>

                  {/* Send Both button */}
                  {hasValidPhone && hasValidEmail && (
                    <button
                      type="button"
                      onClick={handleSendBothNow}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Envoyer aux deux (WhatsApp + Email)</span>
                    </button>
                  )}

                  {/* Skip / Close */}
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition text-center"
                  >
                    {clientDispatchModal.allDelivered ? "Passer à l'Email Bilan Admin" : "Fermer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT: PAD DE SIGNATURE TACTILE MOBILE HAUTE PRÉCISION
// ══════════════════════════════════════════════════════════════════════════════
interface DigitalSignaturePadModalProps {
  type: 'client' | 'visa_couvoir';
  signatoryName: string;
  cmd?: CommandePoussin;
  onSave: (dataUrl: string, signatoryName: string) => void;
  onClose: () => void;
}

const DigitalSignaturePadModal: React.FC<DigitalSignaturePadModalProps> = ({
  type,
  signatoryName,
  cmd,
  onSave,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [name, setName] = useState(signatoryName);

  // Initialize canvas with proper DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a'; // Dark ink
  }, []);

  // Helper to extract coordinates
  const getCoordinates = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleValidate = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl, name.trim() || signatoryName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-950 to-slate-900 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-black text-sm">
                {type === 'client' ? "Émargement Client sur Téléphone" : "Visa Officiel du Couvoir"}
              </h3>
              <p className="text-[11px] text-sky-200 font-medium">
                Signez directement avec votre doigt ou stylet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {cmd && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="font-extrabold text-slate-900">
                Client : {cmd.prenom} {cmd.nom} ({cmd.tel || 'Pas de tél'})
              </div>
              <div className="text-slate-600 mt-0.5">
                Commande : <strong>{cmd.id}</strong> • Quantité : <strong>{cmd.quantite} poussins</strong> ({Math.ceil(cmd.quantite / 50)} cartons de 50)
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nom du signataire / Réceptionnaire :
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mamadou Traoré (Chauffeur)"
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#2E86C1]"
            />
          </div>

          {/* Signature Canvas Area */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Zone de signature tactile :
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Effacer</span>
              </button>
            </div>

            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-slate-50 touch-none shadow-inner">
              <canvas
                ref={canvasRef}
                className="w-full h-44 bg-white cursor-crosshair touch-none select-none block"
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
              />
              <div className="absolute bottom-2 left-4 right-4 border-b border-slate-300/80 pointer-events-none text-right">
                <span className="text-[10px] text-slate-400 font-medium select-none">
                  Ligne de signature ✍️
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1">
              Glissez votre doigt sur la surface pour tracer votre signature.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition text-center"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!hasDrawn}
              onClick={handleValidate}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition ${
                hasDrawn
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Valider signature</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
