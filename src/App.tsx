import React, { useState, useEffect, useMemo } from 'react';
import { OAC, Depense, Client, Facture, UserRole, SoumissionEnAttente, Vente, MouvementCaisse, CommandePoussin, Bordereau, AdminNotification } from './types';
import { playAlertSound } from './utils/audio';
// ✅ ANOMALIE CORRIGÉE — Plus de cache local pour les notifications.
// Les notifications affichées dans le menu 🔔 sont désormais DÉRIVÉES
// des soumissions synchronisées depuis Google Sheets (online uniquement).
import { addAdminNotification } from './utils/notifications';
import {
  INITIAL_OAC,
  INITIAL_DEPENSES,
  INITIAL_CLIENTS,
  INITIAL_FACTURES,
  INITIAL_SOUMISSIONS,
  INITIAL_VENTES,
  INITIAL_CAISSE,
  INITIAL_COMMANDES_POUSSINS,
  INITIAL_BORDEREAUX,
  getStoredData,
  setStoredData,
  clearAllAppCache,
} from './data/initialData';
import { fetchGoogleSheetsData, syncPushToGoogleSheets, SyncResult } from './services/googleSheet';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { OACModule } from './components/OACModule';
import { CalendrierModule } from './components/CalendrierModule';
import { CommandesPoussinsModule } from './components/CommandesPoussinsModule';
import { LivraisonsPoussinsModule } from './components/LivraisonsPoussinsModule';
import { VentesModule } from './components/VentesModule';
import { FacturesModule } from './components/FacturesModule';
import { DepensesModule } from './components/DepensesModule';
import { ClientsModule } from './components/ClientsModule';
import { CaisseModule } from './components/CaisseModule';
import { RechercheModule } from './components/RechercheModule';
import { ParametresModule } from './components/ParametresModule';
import { SyncModal } from './components/SyncModal';
import { CoutRentabiliteModule } from './components/CoutRentabiliteModule'; // ✅ v1.3.14
import { LoginScreen } from './components/LoginScreen';
import { PWAInstallBanner } from './components/PWAInstallBanner';

// ✅ PATCH RÈGLES DE GESTION — Import du helper oacRules
// Permet de stocker/lire l'utilisateur dans le localStorage pour que le
// wrapper callOacApi() injecte automatiquement username + role dans les
// appels OAC mutants (oac.commander, oac.modifier, oac.mirer, oac.eclore,
// oac.supprimer, oac.valider, oac.deverrouiller).
import { setCurrentUser as setStoredUser, oacErrorMessage } from './lib/oacRules';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [currentUser, setCurrentUser] = useState<{username: string, role: UserRole} | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  // ✅ ANOMALIE CORRIGÉE — Plus de cache local pour les notifications.
  // adminNotifications est maintenant DÉRIVÉ des soumissions (voir useMemo plus bas).
  // Tout vient de Google Sheets via handleTriggerSync().

  // Update tab when role changes
  useEffect(() => {
    const stored = localStorage.getItem('samche_user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setCurrentUser(user);
        setIsLoggedIn(true);
        setStoredUser({ username: user.username, role: user.role as any });
      } catch (e) {
        console.error('Failed to parse stored user on init', e);
      }
    }
  }, []);

  // Update tab when role changes
  useEffect(() => {
    if (currentRole === 'utilisateur') {
      setActiveTab('calendrier');
    } else {
      setActiveTab('dashboard');
    }
  }, [currentRole]);

  const handleLogin = (user: {username: string, role: UserRole}) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    setIsLoggedIn(true);
    // ✅ PATCH RÈGLES DE GESTION — synchroniser le localStorage
    // pour que oacRules.tsx puisse lire l'utilisateur courant
    setStoredUser({ username: user.username, role: user.role as any });
    localStorage.setItem('samche_user', JSON.stringify(user));
  };

  // Application Data States with Persistence
  const [oacList, setOacList] = useState<OAC[]>(() =>
    getStoredData('oac', INITIAL_OAC)
  );
  const [soumissions, setSoumissions] = useState<SoumissionEnAttente[]>(() =>
    getStoredData('soumissions', INITIAL_SOUMISSIONS)
  );
  const [depenses, setDepenses] = useState<Depense[]>(() =>
    getStoredData('depenses', INITIAL_DEPENSES)
  );
  const [clients, setClients] = useState<Client[]>(() =>
    getStoredData('clients', INITIAL_CLIENTS)
  );
  const [factures, setFactures] = useState<Facture[]>(() =>
    getStoredData('factures', INITIAL_FACTURES)
  );
  const [ventes, setVentes] = useState<Vente[]>(() =>
    getStoredData('ventes', INITIAL_VENTES)
  );
  // ✅ CORRECTION BUG SYNTAXE (était: `const ouvementsCaisse, ...`)
  const [mouvementsCaisse, setMouvementsCaisse] = useState<MouvementCaisse[]>(() =>
    getStoredData('caisse', INITIAL_CAISSE)
  );
  const [commandesPoussins, setCommandesPoussins] = useState<CommandePoussin[]>(() =>
    getStoredData('commandes_poussins', INITIAL_COMMANDES_POUSSINS)
  );
  const [bordereaux, setBordereaux] = useState<Bordereau[]>(() =>
    getStoredData('bordereaux', INITIAL_BORDEREAUX)
  );

  // Sync state
  const [syncStatus, setSyncStatus] = useState<{
    syncing: boolean;
    lastSync: string;
    error?: string;
  }>({
    syncing: false,
    lastSync: new Date().toLocaleTimeString('fr-FR'),
  });
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Quick action modal triggers for other modules
  const [isFactureModalOpen, setIsFactureModalOpen] = useState(false);
  const [isDepenseModalOpen, setIsDepenseModalOpen] = useState(false);

  // Persist data locally on change
  useEffect(() => {
    setStoredData('oac', oacList);
  }, [oacList]);

  useEffect(() => {
    setStoredData('soumissions', soumissions);
  }, [soumissions]);

  useEffect(() => {
    setStoredData('depenses', depenses);
  }, [depenses]);

  useEffect(() => {
    setStoredData('clients', clients);
  }, [clients]);

  useEffect(() => {
    setStoredData('factures', factures);
  }, [factures]);

  useEffect(() => {
    setStoredData('ventes', ventes);
  }, [ventes]);

  useEffect(() => {
    setStoredData('caisse', mouvementsCaisse);
    // ✅ CORRECTION BUG SYNTAXE (était: `}, ouvementsCaisse]);`)
  }, [mouvementsCaisse]);

  useEffect(() => {
    setStoredData('commandes_poussins', commandesPoussins);
  }, [commandesPoussins]);

  useEffect(() => {
    setStoredData('bordereaux', bordereaux);
  }, [bordereaux]);

  // ============================================================================
  // ✅ PATCH RÈGLES DE GESTION — Helper pour vérifier le verrouillage OAC
  // ============================================================================
  //  Avant toute mutation (ajout/modif/mirage/éclosion/suppression), on vérifie
  //  côté frontend si l'OAC est marquée verrouillée. Le backend re-vérifiera
  //  également (sécurité finale), mais cette vérif évite un aller-retour réseau
  //  inutile et donne un feedback immédiat à l'utilisateur.
  //
  //  Le champ `verrouillee` est désormais renvoyé par le backend (Patch_Regles_Gestion.gs)
  //  dans chaque OAC. Si l'OAC a été chargée avant le déploiement du patch, le
  //  champ sera absent (undefined) → on laisse passer (comportement legacy).
  const assertOacUnlocked = (oac: OAC | undefined, action: string): boolean => {
    if (!oac) return true;
    if ((oac as any).verrouillee) {
      const validePar = (oac as any).validePar || 'un administrateur';
      alert(
        `🔒 Action "${action}" impossible.\n\n` +
        `Cette commande OAC (${oac.id}) a été verrouillée par ${validePar}.\n` +
        `Pour la modifier, faites-la déverrouiller par un administrateur.`
      );
      return false;
    }
    return true;
  };

  // ============================================================================
  // ✅ PATCH RÈGLES DE GESTION — Helper pour injecter l'utilisateur courant
  // ============================================================================
  //  Toutes les actions mutantes OAC du backend attendent maintenant
  //  `username` (+ optionnellement `role`) dans le payload.
  //  On les ajoute systématiquement avant l'envoi.
  const withCurrentUser = <T extends Record<string, any>>(item: T): T & { username?: string; role?: string } => {
    let user = currentUser;
    if (!user) {
      const stored = localStorage.getItem('samche_user');
      if (stored) {
        try {
          user = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse stored user', e);
        }
      }
    }
    if (!user) return item;
    return {
      ...item,
      username: user.username,
      role: user.role,
    };
  };

  // ✅ PATCH : Wrapper pour injecter automatiquement username + role
  const syncWithUser = (payload: { type: string, action: string, item: any, subAction?: string }) => {
    const itemWithUser = withCurrentUser(payload.item);
    return syncPushToGoogleSheets({ ...payload, item: itemWithUser });
  };

  // Handlers for OAC
  const handleAddOAC = async (newOac: OAC) => {
    setOacList((prev) => [newOac, ...prev]);
    // ✅ PATCH : injecter username + role pour le backend
    const itemWithUser = withCurrentUser(newOac as any);
    const res = await syncPushToGoogleSheets({ type: 'oac', action: 'insert', item: itemWithUser });
    console.log('[App] Réponse push OAC:', res);
    if (res.success) {
      console.log('[App] ✅ OAC enregistrée:', newOac.id);
    } else {
      console.error('[App] ❌ Push OAC échoué:', res);
      setOacList((prev) => prev.filter((o) => o.id !== newOac.id));
      // ✅ PATCH : message d'erreur friendly si COMMANDE_VERROUILLEE
      const msg = res.code ? oacErrorMessage(res.code, res.message) : res.message;
      alert(`Échec de l'enregistrement de l'OAC:\n${msg}\n\nL'OAC a été retirée.`);
    }
  };

  const handleUpdateOAC = async (
    updated: OAC,
    subAction?: 'commander' | 'mirer' | 'eclore'
  ) => {
    // ✅ PATCH : vérifier le verrouillage côté frontend (sauf pour une nouvelle commande)
    if (subAction !== 'commander') {
      const existing = oacList.find((o) => o.id === updated.id);
      if (!assertOacUnlocked(existing, subAction || 'modification')) {
        return; // bloqué : OAC verrouillée
      }
    }

    const previous = oacList.find((o) => o.id === updated.id);
    setOacList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    // ✅ PATCH : injecter username + role pour le backend
    const itemWithUser = withCurrentUser(updated as any);
    const res = await syncPushToGoogleSheets({ type: 'oac', action: 'update', subAction, item: itemWithUser });
    console.log('[App] Réponse push OAC update:', res);
    if (res.success) {
      console.log('[App] ✅ OAC modifiée:', updated.id);
    } else {
      console.error('[App] ❌ Push OAC update échoué:', res);
      if (previous) {
        setOacList((prev) => prev.map((item) => (item.id === updated.id ? previous : item)));
      }
      // ✅ PATCH : message d'erreur friendly
      const msg = res.code ? oacErrorMessage(res.code, res.message) : res.message;
      alert(`Échec de la modification:\n${msg}`);
    }
  };

  const handleDeleteOAC = async (id: string) => {
    // ✅ PATCH : vérifier le verrouillage côté frontend
    const target = oacList.find((o) => o.id === id);
    if (!assertOacUnlocked(target, 'suppression')) {
      return; // bloqué : OAC verrouillée
    }

    const deleted = oacList.find((o) => o.id === id);
    setOacList((prev) => prev.filter((item) => item.id !== id));
    // ✅ PATCH : injecter username + role pour le backend
    const itemWithUser = withCurrentUser({ id } as any);
    const res = await syncPushToGoogleSheets({ type: 'oac', action: 'delete', item: itemWithUser });
    console.log('[App] Réponse push OAC delete:', res);
    if (res.success) {
      console.log('[App] ✅ OAC supprimée:', id);
    } else {
      console.error('[App] ❌ Push OAC delete échoué:', res);
      if (deleted) {
        setOacList((prev) => [deleted, ...prev]);
      }
      // ✅ PATCH : message d'erreur friendly
      const msg = res.code ? oacErrorMessage(res.code, res.message) : res.message;
      alert(`Échec de la suppression:\n${msg}`);
    }
  };

  // ============================================================
  // ✅ ANOMALIE CORRIGÉE — Validation admin → enregistrement base
  // -------------------------------------------------------------
  // Avant : la soumission était marquée "Approuvée" dans l'UI
  // AVANT que l'OAC ne soit effectivement écrite dans Google Sheets.
  // Si l'écriture échouait (réseau, verrouillage, données invalides),
  // la soumission restait marquée approuvée mais aucune donnée n'était
  // enregistrée en base — silencieusement.
  //
  // Maintenant :
  //  1. On pousse l'OAC vers GAS en PREMIER (await)
  //  2. On vérifie res.success avant toute mise à jour d'UI
  //  3. En cas d'échec : alerte + retour anticipé (la soumission
  //     reste "En attente")
  //  4. Si succès : on marque la soumission approuvée localement ET
  //     côté GAS (await), puis on rafraîchit les données
  // ============================================================
  // Admin validation handlers
  const handleApproveSoumission = async (idSoumission: string, idChoisi: string, modifiedDonnees?: any) => {
    const target = soumissions.find((s) => s.idSoumission === idSoumission);
    if (!target) {
      console.error('[Approuver] Soumission introuvable:', idSoumission);
      return;
    }

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const d = modifiedDonnees || target.donnees || {};

    // ── Calcul du resume mis à jour ──
    let updatedResume = target.resume;
    if (target.type === 'Mirage') {
      const targetId = d.id || target.donnees?.id;
      const clairsNum = Number(d.clairs) || 0;
      const existing = oacList.find((x) => x.id === targetId);
      const cubes = existing?.cubes || ((existing?.cartons || 0) * 360 - (existing?.nbCasses || 0)) || 0;
      const fertilesNum = Math.max(0, cubes - clairsNum);
      updatedResume = `Mirage lot ${targetId} : ${clairsNum} clairs, ${fertilesNum} fertiles`;
    } else if (target.type === 'Éclosion') {
      const targetId = d.id || target.donnees?.id;
      const commNum = Number(d.commerciaux) || 0;
      const hanNum = Number(d.handicapes) || 0;
      const morNum = Number(d.morts) || 0;
      updatedResume = `Éclosion lot ${targetId} : ${commNum} commerciaux, ${hanNum} handicapés, ${morNum} morts`;
    } else if (target.type === 'Commande') {
      updatedResume = `Commande ${d.type || 'Chairs'} (${d.race || 'Ross 308'}) - ${d.cartons || 0} cartons (${d.fournisseur || ''})`;
    }

    // ── Vérifier le verrouillage avant d'approuver un Mirage/Éclosion ──
    if (target.type === 'Mirage' || target.type === 'Éclosion') {
      const targetId = d.id || target.donnees?.id;
      const existing = oacList.find((x) => x.id === targetId);
      if (!assertOacUnlocked(existing, target.type.toLowerCase())) {
        return; // bloqué : OAC verrouillée
      }
    }

    // ============================================================
    // ÉTAPE 1 — Enregistrer l'OAC dans Google Sheets EN PREMIER
    // ============================================================
    let oacSyncRes: SyncResult;
    let newOrderForList: OAC | null = null;

    if (target.type === 'Commande') {
      const dateParts = (d.date || '').split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : todayStr;
      const cartons = Number(d.cartons) || 10;
      const casses = Number(d.casses) || 0;
      const totalRecus = cartons * 360;
      const cubes = totalRecus - casses;

      // ✅ CORRECTION v1.2.7 (fix "ID est obligatoire") :
      //    On calcule un ID de fallback robuste basé sur l'année/mois courants
      //    (au lieu du "OAC-2609-..." codé en dur qui pouvait collisionner).
      //    Si `idChoisi` est fourni (cas normal via le modal d'approbation),
      //    on l'utilise. Sinon, on tombe sur `d.id`, puis sur l'auto-généré.
      //    On garantit ainsi que `id` et `idCommande` ne sont JAMAIS vides.
      const _now = new Date();
      const _yy = String(_now.getFullYear()).slice(-2);
      const _mm = String(_now.getMonth() + 1).padStart(2, '0');
      const fallbackId = `OAC-${_yy}${_mm}-${String(oacList.length + 1).padStart(3, '0')}`;
      const safeId = (idChoisi && String(idChoisi).trim())
        || (d.id && String(d.id).trim())
        || fallbackId;

      // ✅ v1.3.9 : Si la soumission n'a ni dateIncubation ni eclosion (cas ancien),
      //    on calcule une date d'éclosion par défaut = aujourd'hui + 21 jours.
      //    Cela évite que l'approbation échoue à cause d'une date d'éclosion passée.
      const _todayPlus21 = new Date();
      _todayPlus21.setDate(_todayPlus21.getDate() + 21);
      const _defaultEclo = `${String(_todayPlus21.getDate()).padStart(2, '0')}/${String(_todayPlus21.getMonth() + 1).padStart(2, '0')}/${_todayPlus21.getFullYear()}`;
      const _defaultIncub = `${String(_now.getDate()).padStart(2, '0')}/${String(_now.getMonth() + 1).padStart(2, '0')}/${_now.getFullYear()}`;

      const newOrder: OAC = {
        _v: 25,
        // ✅ CORRECTION v1.2.8 : Ne PAS définir `ligne` pour une nouvelle commande.
        //    Le backend `enregistrerCommande` (v1.2.8+) calcule lui-même la prochaine
        //    ligne disponible via `_getDerniereLigneDonnees(ws) + 1`.
        //    Forcer `ligne = oacList.length + 3` causait des bugs :
        //      - si la ligne pointait hors de la plage → "Ligne inexistante"
        //      - si la ligne correspondait à un autre ID → "ID deja utilise"
        //    On laisse le backend décider.
        ligne: 0,
        id: safeId,
        idCommande: safeId,
        date: formattedDate,
        type: d.type || 'Chairs',
        race: d.race || 'Ross 308',
        fournisseur: d.fournisseur || 'Pak tavuk',
        cartons,
        recus: totalRecus,
        nbCasses: casses,
        cubes,
        // ✅ v1.3.9 : On transmet `dateIncubation` au backend (nouveau flux v1.3.8)
        //   - Si la soumission a dateIncubation → on l'utilise
        //   - Sinon, on calcule dateIncubation = eclosion - 21j (rétrocompat)
        //   - En dernier recours, on utilise aujourd'hui comme date d'incubation
        dateIncubation: (d as any).dateIncubation
          || (d.eclosion ? (() => {
              const _p = (d.eclosion as string).split('/');
              if (_p.length === 3) {
                const _e = new Date(Number(_p[2]), Number(_p[1]) - 1, Number(_p[0]));
                _e.setDate(_e.getDate() - 21);
                return `${String(_e.getDate()).padStart(2, '0')}/${String(_e.getMonth() + 1).padStart(2, '0')}/${_e.getFullYear()}`;
              }
              return _defaultIncub;
            })() : _defaultIncub),
        eclosion: d.eclosion || _defaultEclo,
        clairs: null,
        fertiles: cubes,
        commerciaux: null,
        pourVente: null,
        handicapes: null,
        morts: null,
      } as any;

      // ✅ Safety net : si jamais safeId est vide (cas théorique impossible),
      //    on bloque AVANT d'envoyer à GAS pour avoir un message clair.
      if (!newOrder.id || !newOrder.idCommande) {
        const errMsg = 'ID commande manquant après calcul (safeId vide). Valeurs reçues : idChoisi="' + idChoisi + '", d.id="' + d.id + '"';
        console.error('[Approuver][Commande]', errMsg);
        alert(`ÉCHEC : ${errMsg}\n\nVeuillez sélectionner un ID dans le modal d'approbation.`);
        return;
      }

      const itemWithUser = withCurrentUser(newOrder as any);
      // ✅ v1.3.9 : Log détaillé des données envoyées au backend (pour diagnostic)
      console.log('[Approuver][Commande] v1.3.9 - Données envoyées à GAS :', {
        id: newOrder.id,
        date: newOrder.date,
        dateIncubation: (newOrder as any).dateIncubation,
        eclosion: newOrder.eclosion,
        cartons: newOrder.cartons,
        casses: newOrder.nbCasses,
        type: newOrder.type,
        race: newOrder.race,
        fournisseur: newOrder.fournisseur,
      });
      oacSyncRes = await syncPushToGoogleSheets({ type: 'oac', action: 'insert', item: itemWithUser });
      console.log('[Approuver][Commande] sync OAC →', oacSyncRes, '— ID envoyé :', safeId);

      if (!oacSyncRes.success) {
        const msg = oacSyncRes.code ? oacErrorMessage(oacSyncRes.code, oacSyncRes.message) : oacSyncRes.message;
        console.error('[Approuver][Commande] ÉCHEC écriture OAC:', oacSyncRes);
        // ✅ v1.3.9 : Afficher aussi le code d'erreur pour diagnostic précis
        alert(
          `ÉCHEC : la commande n'a pas pu être enregistrée dans la base.\n\n` +
          `Code erreur : ${oacSyncRes.code || 'AUCUN'}\n` +
          `Détail : ${msg}\n\n` +
          `La soumission reste « En attente ». Corrigez les données et réessayez.`
        );
        return; // ⛔ Ne PAS marquer comme approuvée
      }
      newOrderForList = newOrder;
      console.log('[Approuver][Commande] ✅ OAC enregistrée dans Google Sheets');

    } else if (target.type === 'Mirage') {
      const targetId = d.id || target.donnees?.id;
      const existing = oacList.find((x) => x.id === targetId);
      if (!existing) {
        alert(`ÉCHEC : OAC introuvable pour le mirage (ID: ${targetId}). Impossible de valider.`);
        return;
      }
      const cubes = existing.cubes || ((existing.cartons || 0) * 360 - (existing.nbCasses || 0));
      const clairsNum = Number(d.clairs) || 0;
      const fertilesNum = Math.max(0, cubes - clairsNum);
      const updated: OAC = { ...existing, clairs: clairsNum, fertiles: fertilesNum };

      const itemWithUser = withCurrentUser(updated as any);
      oacSyncRes = await syncPushToGoogleSheets({
        type: 'oac', action: 'update', subAction: 'mirer', item: itemWithUser,
      });
      console.log('[Approuver][Mirage] sync OAC →', oacSyncRes);

      if (!oacSyncRes.success) {
        if (oacSyncRes.code === 'COMMANDE_VERROUILLEE') {
          alert(oacErrorMessage(oacSyncRes.code, oacSyncRes.message));
        } else {
          console.error('[Approuver][Mirage] ÉCHEC écriture OAC:', oacSyncRes);
          alert(
            `ÉCHEC : le mirage n'a pas pu être enregistré dans la base.\n\n` +
            `Détail : ${oacSyncRes.message}\n\n` +
            `La soumission reste « En attente ». Réessayez.`
          );
        }
        return; // ⛔ Ne PAS marquer comme approuvée
      }
      // ✅ Succès — mettre à jour l'UI locale
      setOacList((prev) => prev.map((x) => (x.id === targetId ? updated : x)));
      console.log('[Approuver][Mirage] ✅ Mirage enregistré dans Google Sheets');

    } else if (target.type === 'Éclosion') {
      const targetId = d.id || (target.donnees && target.donnees.id);
      const existing = oacList.find((x) => x.id === targetId);
      if (!existing) {
        alert(`ÉCHEC : OAC introuvable pour l'éclosion (ID: ${targetId}). Impossible de valider.`);
        return;
      }
      const commNum = Number(d.commerciaux) || 0;
      const hanNum = Number(d.handicapes) || 0;
      const morNum = Number(d.morts) || 0;
      const pourVenteNum = Number(d.pourVente) || commNum;

      const updated: OAC = {
        ...existing,
        commerciaux: commNum,
        nes: commNum,
        handicapes: hanNum,
        morts: morNum,
        pourVente: pourVenteNum,
        complet: true,
      };

      const itemWithUser = withCurrentUser(updated as any);
      oacSyncRes = await syncPushToGoogleSheets({
        type: 'oac', action: 'update', subAction: 'eclore', item: itemWithUser,
      });
      console.log('[Approuver][Éclosion] sync OAC →', oacSyncRes);

      if (!oacSyncRes.success) {
        if (oacSyncRes.code === 'COMMANDE_VERROUILLEE') {
          alert(oacErrorMessage(oacSyncRes.code, oacSyncRes.message));
        } else {
          console.error('[Approuver][Éclosion] ÉCHEC écriture OAC:', oacSyncRes);
          alert(
            `ÉCHEC : l'éclosion n'a pas pu être enregistrée dans la base.\n\n` +
            `Détail : ${oacSyncRes.message}\n\n` +
            `La soumission reste « En attente ». Réessayez.`
          );
        }
        return; // ⛔ Ne PAS marquer comme approuvée
      }
      // ✅ Succès — mettre à jour l'UI locale
      setOacList((prev) => prev.map((x) => (x.id === targetId ? updated : x)));
      console.log('[Approuver][Éclosion] ✅ Éclosion enregistrée dans Google Sheets');

    } else {
      console.error('[Approuver] Type de soumission non supporté:', target.type);
      return;
    }

    // ============================================================
    // ÉTAPE 2 — L'OAC est bien en base : on marque la soumission
    //            « Approuvée » localement et côté GAS (await)
    // ============================================================
    setSoumissions((prev) =>
      prev.map((s) =>
        s.idSoumission === idSoumission
          ? {
              ...s,
              statut: 'Approuvé',
              resume: updatedResume,
              idChoisi,
              validPar: currentUser?.username || 'Administrateur',
              dateValid: todayStr,
            }
          : s
      )
    );

    // Pour une nouvelle commande, ajouter l'OAC dans la liste locale
    if (newOrderForList) {
      setOacList((prev) => [newOrderForList as OAC, ...prev]);
    }

    // ✅ AWAIT la mise à jour du statut de la soumission dans GAS
    const soumRes = await syncPushToGoogleSheets({
      type: 'en_attente',
      action: 'update',
      item: {
        idSoumission,
        statut: 'Approuvé',
        resume: updatedResume,
        idChoisi,
        validPar: currentUser?.username || 'Administrateur',
        dateValid: todayStr,
      },
    });
    if (!soumRes.success) {
      // ⚠️ CORRECTION ANOMALIE : si la mise à jour du statut échoue,
      //    on NE PAS APPELLE PAS handleTriggerSync() — sinon le refresh
      //    rechargerait les soumissions depuis GAS avec le statut "En attente"
      //    (puisque l'update a échoué), et l'UI reviendrait à "En attente"
      //    malgré que l'OAC a bien été enregistrée.
      //    On alerte l'utilisateur à la place, en gardant l'UI local "Approuvé".
      console.error('[Approuver] ⚠ OAC enregistrée mais mise à jour du statut soumission a échoué:', soumRes);
      playAlertSound('error');
      alert(
        `⚠️ Attention : l'OAC a bien été enregistrée dans la base, ` +
        `mais la mise à jour du statut de la soumission a échoué.\n\n` +
        `Détail : ${soumRes.message}\n\n` +
        `La soumission reste marquée "Approuvée" dans l'interface, ` +
        `mais elle pourrait réapparaître en "En attente" après le prochain refresh.\n\n` +
        `Re-cliquez sur "Valider" pour réessayer.`
      );
      return;
    }
    console.log('[Approuver] ✅ Soumission marquée « Approuvée » dans Google Sheets');

    // ============================================================
    // ✅ SOLUTION DÉFINITIVE — On NE rappelle PAS handleTriggerSync()
    // ------------------------------------------------------------
    // Pourquoi : la lecture GAS juste après une écriture peut retourner
    // des données légèrement "stale" (consistance eventuelle de GAS).
    // En pratique, ça donnait lieu au bug suivant :
    //   1. setSoumissions() met à jour l'UI local en "Approuvé"
    //   2. syncPushToGoogleSheets() met à jour GAS en "Approuvé"
    //   3. handleTriggerSync() relit les soumissions depuis GAS
    //      → GAS retourne encore "En attente" (données stales)
    //      → setSoumissions() remet l'UI à "En attente" ❌
    //
    // Solution définitive : le state local EST la source de vérité
    // après une opération réussie. On ne rafraîchit pas depuis GAS
    // parce qu'on sait déjà ce qu'on vient d'écrire.
    //
    // L'utilisateur peut toujours cliquer sur le bouton « Synchroniser »
    // (en haut à droite) pour forcer un refresh complet depuis GAS.
    //
    // Note : pour une nouvelle Commande, l'OAC a déjà été ajoutée
    // localement via setOacList(). Pour un Mirage/Éclosion, l'OAC
    // existante a déjà été mise à jour via setOacList(). Donc l'UI
    // est cohérente sans avoir besoin de refresh.
    // ============================================================
    console.log('[Approuver] ✅ Validation terminée. UI local reste sur "Approuvé" (pas de refresh automatique pour éviter la stale read).');
  };

  // ============================================================
  // ✅ ANOMALIE CORRIGÉE — handleAddSoumission async + vérification
  //    Avant : la soumission était ajoutée à l'UI mais l'écriture
  //    vers GAS était fire-and-forget. Si GAS échouait, l'opérateur
  //    pensait que sa saisie était partie, mais aucune ligne n'était
  //    en base → l'admin ne voyait jamais la soumission à valider.
  //    Maintenant : on AWAIT l'écriture et on alerte en cas d'échec.
  // ============================================================
  const handleAddSoumission = async (newSoumission: SoumissionEnAttente) => {
    // Ajout optimiste dans l'UI
    setSoumissions((prev) => [newSoumission, ...prev]);

    // ✅ AWAIT l'enregistrement côté GAS
    const res = await syncWithUser({
      type: 'en_attente',
      action: 'insert',
      item: newSoumission,
    });

    if (!res.success) {
      console.error('[handleAddSoumission] ÉCHEC écriture soumission:', res);
      // Rollback UI : retirer la soumission qu'on vient d'ajouter
      setSoumissions((prev) => prev.filter((s) => s.idSoumission !== newSoumission.idSoumission));
      alert(
        `ÉCHEC : la soumission n'a pas pu être enregistrée dans la base.\n\n` +
        `Détail : ${res.message}\n\n` +
        `Vérifiez votre connexion puis réessayez.`
      );
      return;
    }
    console.log('[handleAddSoumission] ✅ Soumission enregistrée dans Google Sheets:', newSoumission.idSoumission);
  };

  const handleUpdateSoumission = async (updated: SoumissionEnAttente) => {
    // Mise à jour optimiste
    const previous = soumissions.find((s) => s.idSoumission === updated.idSoumission);
    setSoumissions((prev) => prev.map((s) => (s.idSoumission === updated.idSoumission ? updated : s)));

    // ✅ AWAIT la mise à jour côté GAS
    const res = await syncWithUser({ type: 'en_attente', action: 'update', item: updated });
    if (!res.success) {
      console.error('[handleUpdateSoumission] ÉCHEC mise à jour:', res);
      // Rollback
      if (previous) {
        setSoumissions((prev) => prev.map((s) => (s.idSoumission === updated.idSoumission ? previous : s)));
      }
      alert(`ÉCHEC : la mise à jour de la soumission a échoué.\n\nDétail : ${res.message}`);
    } else {
      console.log('[handleUpdateSoumission] ✅ Soumission mise à jour dans Google Sheets:', updated.idSoumission);
    }
  };

  const handleRejectSoumission = async (idSoumission: string, raison: string) => {
    const todayStr = new Date().toLocaleDateString('fr-FR');
    // Play rejection sound on mobile & desktop
    playAlertSound('rejection');
    const validPar = currentUser?.username || 'Administrateur';

    // Mise à jour optimiste
    const previous = soumissions.find((s) => s.idSoumission === idSoumission);
    setSoumissions((prev) =>
      prev.map((s) =>
        s.idSoumission === idSoumission
          ? { ...s, statut: 'Rejeté' as const, validPar, dateValid: todayStr, raison }
          : s
      )
    );

    // ✅ AWAIT la mise à jour côté GAS
    const res = await syncWithUser({
      type: 'en_attente',
      action: 'update',
      item: { idSoumission, statut: 'Rejeté', validPar, dateValid: todayStr, raison }
    });

    if (!res.success) {
      console.error('[handleRejectSoumission] ÉCHEC mise à jour:', res);
      // Rollback
      if (previous) {
        setSoumissions((prev) => prev.map((s) => (s.idSoumission === idSoumission ? previous : s)));
      }
      alert(`ÉCHEC : le rejet n'a pas pu être enregistré dans la base.\n\nDétail : ${res.message}`);
    } else {
      console.log('[handleRejectSoumission] ✅ Soumission marquée « Rejeté » dans Google Sheets:', idSoumission);
    }
  };

  const handleDeleteSoumission = async (idSoumission: string) => {
    // Suppression optimiste
    const previous = soumissions.find((s) => s.idSoumission === idSoumission);
    setSoumissions((prev) => prev.filter((s) => s.idSoumission !== idSoumission));

    // ✅ AWAIT la suppression côté GAS
    const res = await syncWithUser({
      type: 'en_attente',
      action: 'delete',
      item: { idSoumission }
    });

    if (!res.success) {
      console.error('[handleDeleteSoumission] ÉCHEC suppression:', res);
      // Rollback
      if (previous) {
        setSoumissions((prev) => [previous, ...prev.filter((s) => s.idSoumission !== idSoumission)]);
      }
      alert(`ÉCHEC : la suppression de la soumission a échoué.\n\nDétail : ${res.message}`);
    } else {
      console.log('[handleDeleteSoumission] ✅ Soumission supprimée de Google Sheets:', idSoumission);
    }
  };

  const handleRefreshSoumissions = () => {
    handleTriggerSync();
  };

  // Handlers for Factures & Depenses
  const handleAddFacture = async (newFacture: Facture) => {
    setFactures((prev) => [newFacture, ...prev]);
    const res = await syncWithUser({ type: 'factures', action: 'insert', item: newFacture });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateFactureStatut = (numero: string, statut: 'Payée' | 'Emise') => {
    setFactures((prev) =>
      prev.map((f) =>
        f.numero === numero
          ? {
              ...f,
              statut,
              datePaiement: statut === 'Payée' ? new Date().toLocaleDateString('fr-FR') : '',
            }
          : f
      )
    );
  };

  const handleAddDepense = async (newDepense: Depense) => {
    setDepenses((prev) => [...prev, newDepense].sort((a, b) => {
      const [dA, mA, yA] = a.date.split('/').map(Number);
      const [dB, mB, yB] = b.date.split('/').map(Number);
      return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
    }));
    const res = await syncWithUser({ type: 'depenses', action: 'insert', item: newDepense });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateDepense = async (updated: Depense) => {
    setDepenses((prev) =>
      prev.map((d) => (d.ligne === updated.ligne ? updated : d)).sort((a, b) => {
        const [dA, mA, yA] = a.date.split('/').map(Number);
        const [dB, mB, yB] = b.date.split('/').map(Number);
        return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
      })
    );
    const res = await syncWithUser({ type: 'depenses', action: 'update', item: updated });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleDeleteDepense = async (ligne: number) => {
    setDepenses((prev) => prev.filter((d) => d.ligne !== ligne));
    const res = await syncWithUser({ type: 'depenses', action: 'delete', item: { ligne } });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleAddVente = async (newVente: Vente) => {
    setVentes((prev) => [newVente, ...prev]);
    const res = await syncWithUser({ type: 'ventes' as any, action: 'insert', item: newVente });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateVente = async (updated: Vente) => {
    setVentes((prev) =>
      prev.map((v) => (v.ligne === updated.ligne ? updated : v))
    );
    const res = await syncWithUser({ type: 'ventes' as any, action: 'update', item: updated });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleDeleteVente = async (ligne: number) => {
    setVentes((prev) => prev.filter((v) => v.ligne !== ligne));
    const res = await syncWithUser({ type: 'ventes' as any, action: 'delete', item: { ligne } });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleAddMouvementCaisse = async (mvt: MouvementCaisse) => {
    // ✅ CORRECTION BUG SYNTAXE (était: `setMouvementsCaisse((prev) => vt, ...prev]);`)
    setMouvementsCaisse((prev) => [mvt, ...prev]);
    const res = await syncWithUser({ type: 'caisse' as any, action: 'insert', item: mvt });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateMouvementCaisse = async (updated: MouvementCaisse) => {
    setMouvementsCaisse((prev) =>
      prev.map((m) => (m.ligne === updated.ligne ? updated : m))
    );
    const res = await syncWithUser({ type: 'caisse' as any, action: 'update', item: updated });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleDeleteMouvementCaisse = async (ligne: number) => {
    setMouvementsCaisse((prev) => prev.filter((m) => m.ligne !== ligne));
    const res = await syncWithUser({ type: 'caisse' as any, action: 'delete', item: { ligne } });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleAddCommandePoussin = async (cmd: CommandePoussin) => {
  setCommandesPoussins((prev) => [cmd, ...prev]);

  const res = await syncPushToGoogleSheets({
    type: 'commandes_poussins' as any,
    action: 'insert',
    item: {
      dateEclosion: cmd.dateEclosion,
      prenom: cmd.prenom,
      nom: cmd.nom,
      ville: cmd.ville || '',
      tel: cmd.tel || '',
      email: cmd.email || '',
      quantite: cmd.quantite,
      prix: cmd.prixUnitaire,
      notes: cmd.notes || '',
      typeProduit: cmd.typeProduit,
    },
  });

  if (res.success) {
    // ✅ NE PAS appeler handleTriggerSync() — évite la race condition
    console.log('[App] ✅ Commande enregistrée:', cmd.id);
  } else {
    console.error('[App] ❌ Push commande échoué:', res);
    setCommandesPoussins((prev) => prev.filter((c) => c.id !== cmd.id));
    alert(`Échec de l'enregistrement:\n${res.message}\n\nLa commande a été retirée.`);
  }
};

  const handleUpdateCommandePoussin = async (updated: CommandePoussin) => {
    setCommandesPoussins((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    const res = await syncPushToGoogleSheets({ type: 'commandes_poussins' as any, action: 'update', item: updated });
    if (!res.success) {
      console.error('[CommandePoussin] update sync failed:', res.message);
      // Optional: Revert optimistic update here if needed
    }
  };

  const handleDeleteCommandePoussin = async (id: string) => {
    const target = commandesPoussins.find((c) => c.id === id);
    setCommandesPoussins((prev) => prev.filter((c) => c.id !== id));
    const res = await syncPushToGoogleSheets({
      type: 'commandes_poussins' as any,
      action: 'delete',
      item: { id, rowIndex: (target as any)?.rowIndex || 2 }
    });
    if (!res.success) {
      console.error('[CommandePoussin] delete sync failed:', res.message);
      // Optional: Revert optimistic deletion if sync failed
      if (target) setCommandesPoussins((prev) => [target, ...prev]);
    }
  };

  const handleAddClient = async (newClient: Client) => {
    setClients((prev) => [newClient, ...prev]);
    const res = await syncPushToGoogleSheets({ type: 'clients', action: 'insert', item: newClient });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateClient = async (updated: Client) => {
    setClients((prev) => prev.map((c) => (c.index === updated.index ? updated : c)));
    const res = await syncPushToGoogleSheets({ type: 'clients', action: 'update' as any, item: updated });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleDeleteClient = async (index: number) => {
    setClients((prev) => prev.filter((c) => c.index !== index));
    const res = await syncPushToGoogleSheets({ type: 'clients', action: 'delete' as any, item: { index } });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateFacture = async (updated: Facture) => {
    setFactures((prev) => prev.map((f) => (f.ligne === updated.ligne ? updated : f)));
    const res = await syncPushToGoogleSheets({ type: 'factures' as any, action: 'update', item: updated });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleDeleteFacture = async (ligne: number) => {
    setFactures((prev) => prev.filter((f) => f.ligne !== ligne));
    const res = await syncPushToGoogleSheets({ type: 'factures' as any, action: 'delete', item: { ligne } });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleAddBordereau = async (bl: Bordereau) => {
    setBordereaux((prev) => [bl, ...prev]);
    const res = await syncPushToGoogleSheets({ type: 'bordereaux', action: 'insert', item: bl });
    if (res.success) {
      handleTriggerSync();
    }
  };

  // Reset all local cache and restore initial seed data in React state
  const handleResetAllLocalData = (keepGsheetUrl: boolean = true) => {
    clearAllAppCache(keepGsheetUrl);
    setOacList(INITIAL_OAC);
    setSoumissions(INITIAL_SOUMISSIONS);
    setDepenses(INITIAL_DEPENSES);
    setClients(INITIAL_CLIENTS);
    setFactures(INITIAL_FACTURES);
    setVentes(INITIAL_VENTES);
    setMouvementsCaisse(INITIAL_CAISSE);
    setCommandesPoussins(INITIAL_COMMANDES_POUSSINS);
    setBordereaux(INITIAL_BORDEREAUX);
  };

  // Trigger Google Sheets Sync
  const handleTriggerSync = async () => {
    setSyncStatus((prev) => ({ ...prev, syncing: true }));
    const result = await fetchGoogleSheetsData();
    setLastSyncResult(result);
    setSyncStatus({
      syncing: false,
      lastSync: result.timestamp,
      error: result.success ? undefined : result.message,
    });

    // Automatically update all in-memory and local data strictly from Google Sheets
    if (result.success && result.parsedData) {
      if (result.parsedData.oacList !== undefined) {
        setOacList(result.parsedData.oacList);
      }
      if (result.parsedData.commandesPoussins !== undefined) {
        setCommandesPoussins(result.parsedData.commandesPoussins);
      }
      if (result.parsedData.ventes !== undefined) {
        setVentes(result.parsedData.ventes);
      }
      if (result.parsedData.depenses !== undefined) {
        setDepenses(result.parsedData.depenses.sort((a, b) => {
          const [dA, mA, yA] = a.date.split('/').map(Number);
          const [dB, mB, yB] = b.date.split('/').map(Number);
          return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
        }));
      }
      if (result.parsedData.mouvementsCaisse !== undefined) {
        setMouvementsCaisse(result.parsedData.mouvementsCaisse);
      }
      if (result.parsedData.clients !== undefined && result.parsedData.clients.length > 0) {
        setClients(result.parsedData.clients);
      }
      if (result.parsedData.factures !== undefined) {
        setFactures(result.parsedData.factures);
      }
      if (result.parsedData.bordereaux !== undefined) {
        setBordereaux(result.parsedData.bordereaux);
      }
      if (result.parsedData.soumissions !== undefined && result.parsedData.soumissions.length > 0) {
        setSoumissions(result.parsedData.soumissions);
      }
    }
  };

  // Auto-sync on startup to ensure only real Google Sheet data is displayed
  useEffect(() => {
    handleTriggerSync();
  }, []);

  // Automatically trigger sync when Google Sheets URL is changed anywhere in the app
  useEffect(() => {
    const handleUrlChanged = () => {
      console.log('Detected Google Sheets URL modification. Launching automatic sync...');
      handleTriggerSync();
    };
    window.addEventListener('gsheet_url_changed', handleUrlChanged);
    return () => {
      window.removeEventListener('gsheet_url_changed', handleUrlChanged);
    };
  }, []);

  // Monitor rejected declarations to play loud alert sound and phone vibration on operator device
  const rejectedSoumissions = soumissions.filter((s) => s.statut === 'Rejeté');
  const prevRejectedCountRef = React.useRef(rejectedSoumissions.length);

  useEffect(() => {
    if (currentRole === 'utilisateur' && rejectedSoumissions.length > prevRejectedCountRef.current) {
      playAlertSound('rejection');
    }
    prevRejectedCountRef.current = rejectedSoumissions.length;
  }, [rejectedSoumissions.length, currentRole]);

  // Monitor pending declarations to play alert sound for admins
  const pendingSoumissionsCount = soumissions.filter((s) => s.statut === 'En attente').length;
  const prevPendingCountRef = React.useRef(pendingSoumissionsCount);

  useEffect(() => {
    if (currentRole === 'admin' && pendingSoumissionsCount > prevPendingCountRef.current) {
      // ✅ Son 'notification' distinctif (style messenger) quand une nouvelle soumission arrive
      playAlertSound('notification');
    }
    prevPendingCountRef.current = pendingSoumissionsCount;
  }, [pendingSoumissionsCount, currentRole]);

  // ✅ Quand un opérateur reçoit un rejet, on joue le son 'rejection' (déjà en place)
  // ✅ Quand un admin approuve, on joue le son 'approve' (géré dans confirmApprove de OACModule)
  // ✅ Quand un admin rejette, on joue le son 'reject' (géré dans confirmReject de OACModule)

  // ============================================================
  // ✅ ANOMALIE CORRIGÉE — Notifications DÉRIVÉES des soumissions.
  // -------------------------------------------------------------
  // Plus aucun cache local. Les notifications affichées dans le
  // menu 🔔 du Header sont calculées à partir de l'état `soumissions`
  // qui est synchronisé depuis Google Sheets via handleTriggerSync().
  //
  // Règles de dérivation :
  //   - Soumission "En attente" → notification NON LUE (lue=false)
  //   - Soumission "Rejeté"     → notification LUE (lue=true)
  //   - Soumission "Approuvé"   → non affichée (plus pertinente)
  //
  // Avantages :
  //   1. Aucune persistance localStorage → pas de désynchronisation
  //      entre postes (un admin sur son téléphone voit la même
  //      liste qu'un admin sur l'ordinateur).
  //   2. Lorsque l'admin valide/rejette une soumission côté serveur,
  //      la notification disparaît automatiquement après le refresh.
  //   3. Lorsqu'un opérateur soumet une nouvelle commande, elle
  //      apparaît instantanément chez tous les admins après refresh.
  // ============================================================
  const adminNotifications: AdminNotification[] = useMemo(() => {
    return soumissions
      .filter((s) => s.statut === 'En attente' || s.statut === 'Rejeté')
      .map((s) => {
        const isPending = s.statut === 'En attente';
        const type: AdminNotification['type'] =
          s.type === 'Commande' ? 'Commande' :
          s.type === 'Mirage' ? 'Mirage' :
          s.type === 'Éclosion' ? 'Éclosion' :
          'Info';

        const titre = isPending
          ? `Nouvelle ${s.type} en attente de validation`
          : `${s.type} rejetée`;

        const message = isPending
          ? `${s.resume} — Soumis par ${s.soumisPar}`
          : `${s.resume} — Rejetée par ${s.validPar || 'admin'}${s.raison ? ` : ${s.raison}` : ''}`;

        return {
          id: s.idSoumission,
          date: s.dateSoumission,
          heure: '',
          type,
          titre,
          message,
          auteur: s.soumisPar,
          role: 'utilisateur' as UserRole,
          idSoumission: s.idSoumission,
          idLot: s.donnees?.id,
          lue: !isPending, // "En attente" = non lue ; "Rejeté" = lue
          statut: isPending ? 'nouveau' : 'lu',
          emailEnvoye: true, // L'email a été envoyé lors de la soumission
        } as AdminNotification;
      })
      .sort((a, b) => {
        // Tri : "En attente" (non lues) d'abord, puis par date
        if (a.lue !== b.lue) return a.lue ? 1 : -1;
        return b.date.localeCompare(a.date);
      });
  }, [soumissions]);

  const unreadNotificationsCount = adminNotifications.filter((n) => !n.lue).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      <PWAInstallBanner />
      {!isLoggedIn ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <>
          {/* Top Header */}
          <Header
            currentUser={currentUser}
            onLogout={() => {
              setIsLoggedIn(false);
              setCurrentUser(null);
              // ✅ PATCH RÈGLES DE GESTION — effacer l'utilisateur du localStorage
              setStoredUser(null);
            }}
            currentRole={currentRole}
            syncStatus={syncStatus}
            onTriggerSync={() => setSyncModalOpen(true)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingSoumissionsCount={soumissions.filter((s) => s.statut === 'En attente').length}
            rejectedSoumissionsCount={rejectedSoumissions.length}
            adminNotifications={adminNotifications}
            unreadNotificationsCount={unreadNotificationsCount}
            // ✅ ANOMALIE CORRIGÉE — Les notifications sont DÉRIVÉES des soumissions
            //    (online via GAS). Plus aucun localStorage.
            //    - "Marquer comme lu" → force un refresh (les soumissions sont
            //      re-téléchargées depuis Google Sheets).
            //    - "Tout lire" → idem.
            //    - "Supprimer" → redirige vers l'onglet OAC où l'admin peut
            //      valider/rejeter la soumission (seule façon de la faire
            //      disparaître — la source de vérité est GAS, pas le cache).
            onMarkNotificationRead={() => {
              handleTriggerSync();
            }}
            onMarkAllNotificationsRead={() => {
              handleTriggerSync();
            }}
            onDeleteNotification={() => {
              // Redirige vers l'onglet OAC (validation admin)
              setActiveTab('oac');
            }}
          />

          {/* Operator Alert Banner for rejected submissions across all tabs */}
          {currentRole === 'utilisateur' && rejectedSoumissions.length > 0 && (
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-3 shadow-md border-b-2 border-red-800 animate-fade-in sticky top-[108px] z-30">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl animate-bounce">🚨</span>
                  <div>
                    <p className="font-extrabold tracking-wide">
                      {rejectedSoumissions.length === 1
                        ? 'Déclaration rejetée par l’administrateur avec demande de correction !'
                        : `${rejectedSoumissions.length} déclarations rejetées par l’administrateur !`}
                    </p>
                    <p className="text-rose-100 text-xs mt-0.5">
                      Motif : « {rejectedSoumissions[0]?.raison || 'Correction demandée par le superviseur'} » — Veuillez réajuster les données et renvoyer.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('oac')}
                  className="px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 font-black rounded-xl text-xs shadow-md transition whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                >
                  <span>✏️</span>
                  <span>Corriger et renvoyer maintenant</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Container */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {activeTab === 'oac' && (
              <OACModule
                oacList={oacList}
                soumissions={soumissions}
                depenses={depenses}
                onAddOAC={handleAddOAC}
                onUpdateOAC={handleUpdateOAC}
                onDeleteOAC={handleDeleteOAC}
                onAddSoumission={handleAddSoumission}
                onApproveSoumission={handleApproveSoumission}
                onRejectSoumission={handleRejectSoumission}
                onUpdateSoumission={handleUpdateSoumission}
                onDeleteSoumission={handleDeleteSoumission}
                onRefreshSoumissions={handleRefreshSoumissions}
                role={currentRole}
                currentUser={currentUser}
                onClose={() => setActiveTab(currentRole === 'utilisateur' ? 'calendrier' : 'dashboard')}
              />
            )}

            {activeTab === 'calendrier' && (
              <CalendrierModule
                oacList={oacList}
                soumissions={soumissions}
                onNavigate={(tab) => setActiveTab(tab)}
                onClose={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'dashboard' && currentRole !== 'utilisateur' && (
              <Dashboard
                oacList={oacList}
                depenses={depenses}
                clients={clients}
                factures={factures}
                ventes={ventes}
                role={currentRole}
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenNewOAC={currentRole !== 'comptable' ? () => setActiveTab('oac') : undefined}
                onOpenNewFacture={() => {
                  setActiveTab('factures');
                  setIsFactureModalOpen(true);
                }}
                onOpenNewDepense={() => {
                  setActiveTab('depenses');
                  setIsDepenseModalOpen(true);
                }}
              />
            )}

            {/* ✅ v1.3.14 — Nouvel onglet Coûts & Rentabilité */}
            {activeTab === 'couts_rentabilite' && currentRole !== 'utilisateur' && (
              <CoutRentabiliteModule
                oacList={oacList}
                depenses={depenses}
                ventes={ventes}
                onClose={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'commandes_poussins' && (
              <CommandesPoussinsModule
                commandes={commandesPoussins}
                clients={clients}
                oacList={oacList}
                currentUser={currentUser}
                onAddCommande={handleAddCommandePoussin}
                onUpdateCommande={handleUpdateCommandePoussin}
                onDeleteCommande={handleDeleteCommandePoussin}
                onAddClient={handleAddClient}
                onNavigateToLivraisons={() => setActiveTab('livraisons')}
                onClose={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'livraisons' && (
              <LivraisonsPoussinsModule
                commandes={commandesPoussins}
                oacList={oacList}
                clients={clients}
                bordereaux={bordereaux}
                userRole={currentRole}
                onUpdateCommande={handleUpdateCommandePoussin}
                onAddBordereau={handleAddBordereau}
                onClose={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'ventes' && (
              <VentesModule
                ventes={ventes}
                clients={clients}
                oacList={oacList}
                onAddVente={handleAddVente}
                onUpdateVente={handleUpdateVente}
                onDeleteVente={handleDeleteVente}
                onAddClient={handleAddClient}
                onClose={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'factures' && (
              <FacturesModule
                factures={factures}
                clients={clients}
                bordereaux={bordereaux}
                onAddFacture={handleAddFacture}
                onUpdateFacture={handleUpdateFacture}
                onDeleteFacture={handleDeleteFacture}
                onAddBordereau={handleAddBordereau}
                onAddClient={handleAddClient}
                onUpdateClient={handleUpdateClient}
                onDeleteClient={handleDeleteClient}
                onClose={() => setActiveTab('dashboard')}
                role={currentRole}
              />
            )}

            {activeTab === 'depenses' && (
              <DepensesModule
                depenses={depenses}
                oacList={oacList}
                onAddDepense={handleAddDepense}
                onUpdateDepense={handleUpdateDepense}
                onDeleteDepense={handleDeleteDepense}
                onClose={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'caisse' && (
              <CaisseModule
                mouvements={mouvementsCaisse}
                onAddMouvement={handleAddMouvementCaisse}
                onUpdateMouvement={handleUpdateMouvementCaisse}
                onDeleteMouvement={handleDeleteMouvementCaisse}
                onClose={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'clients' && (
              <ClientsModule
                clients={clients}
                onAddClient={handleAddClient}
                onUpdateClient={handleUpdateClient}
              />
            )}

            {activeTab === 'recherche' && (
              <RechercheModule
                depenses={depenses}
                ventes={ventes}
                clients={clients}
                onClose={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'parametres' && (
              <ParametresModule
                syncStatus={syncStatus}
                onTriggerSync={() => setSyncModalOpen(true)}
                onResetAllData={handleResetAllLocalData}
                onClose={() => setActiveTab('dashboard')}
              />
            )}
          </main>

          {/* Sync Status / Config Modal */}
          <SyncModal
            isOpen={syncModalOpen}
            onClose={() => setSyncModalOpen(false)}
            syncStatus={syncStatus}
            onTriggerSync={handleTriggerSync}
            lastResult={lastSyncResult}
          />

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>
                © {new Date().getFullYear()} <strong>Couvoir SAMCHE</strong> — Écloserie Moderne & Distribution Avicole (Bamako, Mali)
              </span>
              <span className="text-[11px] text-slate-400">
                Version PWA • Synchronisation Google Sheets & Firebase
              </span>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
