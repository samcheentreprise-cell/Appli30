import React, { useState, useEffect } from 'react';
import { OAC, Depense, Client, Facture, UserRole, SoumissionEnAttente, Vente, MouvementCaisse, CommandePoussin, Bordereau } from './types';
import { playAlertSound } from './utils/audio';
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
import { LoginScreen } from './components/LoginScreen';
import { PWAInstallBanner } from './components/PWAInstallBanner';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [currentUser, setCurrentUser] = useState<{username: string, role: UserRole} | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

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
  }, [mouvementsCaisse]);

  useEffect(() => {
    setStoredData('commandes_poussins', commandesPoussins);
  }, [commandesPoussins]);

  useEffect(() => {
    setStoredData('bordereaux', bordereaux);
  }, [bordereaux]);

  // Handlers for OAC
  const handleAddOAC = async (newOac: OAC) => {
    setOacList((prev) => [newOac, ...prev]);
    const res = await syncPushToGoogleSheets({ type: 'oac', action: 'insert', item: newOac });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateOAC = async (
    updated: OAC,
    subAction?: 'commander' | 'mirer' | 'eclore'
  ) => {
    setOacList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    const res = await syncPushToGoogleSheets({ type: 'oac', action: 'update', subAction, item: updated });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleDeleteOAC = async (id: string) => {
    setOacList((prev) => prev.filter((item) => item.id !== id));
    const res = await syncPushToGoogleSheets({ type: 'oac', action: 'delete', item: { id } });
    if (res.success) {
      handleTriggerSync();
    }
  };

  // Admin validation handlers
  const handleApproveSoumission = async (idSoumission: string, idChoisi: string, modifiedDonnees?: any) => {
    const target = soumissions.find((s) => s.idSoumission === idSoumission);
    if (!target) return;

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const d = modifiedDonnees || target.donnees || {};

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

    // 1. Marquer la soumission comme "Approuvée" localement
    setSoumissions((prev) =>
      prev.map((s) =>
        s.idSoumission === idSoumission
          ? { ...s, statut: 'Approuvé', resume: updatedResume, idChoisi }
          : s
      )
    );

    // 2. Si Commande → insérer une nouvelle OAC
    if (target.type === 'Commande') {
      const dateParts = (d.date || '').split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : todayStr;
      const cartons = Number(d.cartons) || 10;
      const casses = Number(d.casses) || 0;
      const totalRecus = cartons * 360;
      const cubes = totalRecus - casses;

      const newOrder: OAC = {
        _v: 25,
        ligne: oacList.length + 3,
        id: idChoisi || d.id || `OAC-2609-00${oacList.length + 1}`,
        date: formattedDate,
        type: d.type || 'Chairs',
        race: d.race || 'Ross 308',
        fournisseur: d.fournisseur || 'Pak tavuk',
        cartons,
        recus: totalRecus,
        nbCasses: casses,
        cubes,
        eclosion: d.eclosion || '15/10/2026',
        clairs: null,
        fertiles: cubes,
        commerciaux: null,
        pourVente: null,
        handicapes: null,
        morts: null,
      };

      setOacList((prev) => [newOrder, ...prev]);
      // ✅ AWAIT — attendre que l'écriture soit confirmée
      const res = await syncPushToGoogleSheets({ type: 'oac', action: 'insert', item: newOrder });
      console.log('[Commande] sync result:', res);
      if (res.success) await handleTriggerSync();
    }

    // 3. Si Mirage → mettre à jour l'OAC existante
    if (target.type === 'Mirage') {
      const targetId = d.id || target.donnees?.id;
      const existing = oacList.find((x) => x.id === targetId);
      if (existing) {
        const cubes = existing.cubes || ((existing.cartons || 0) * 360 - (existing.nbCasses || 0));
        const clairsNum = Number(d.clairs) || 0;
        const fertilesNum = Math.max(0, cubes - clairsNum);
        const updated: OAC = {
          ...existing,
          clairs: clairsNum,
          fertiles: fertilesNum,
        };

        // Optimistic update : on affiche tout de suite
        setOacList((prev) => prev.map((x) => (x.id === targetId ? updated : x)));

        // ✅ AWAIT le push vers GAS avec subAction explicite
        const res = await syncPushToGoogleSheets({
          type: 'oac',
          action: 'update',
          subAction: 'mirer',
          item: updated,
        });
        console.log('[Mirage] sync result:', res);

        if (res.success) {
          // ✅ Recharger SEULEMENT si l'écriture a réussi
          await handleTriggerSync();
        } else {
          // ❌ En cas d'échec, on garde au moins l'UI locale et on logge
          console.error('[Mirage] écriture échouée :', res.message);
          // Optionnel : alerte utilisateur
          // alert('Échec du mirage : ' + res.message);
        }
      }
    }

    // 4. Si Éclosion → mettre à jour l'OAC existante
    if (target.type === 'Éclosion') {
      const targetId = d.id || (target.donnees && target.donnees.id);
      const existing = oacList.find((x) => x.id === targetId);
      if (existing) {
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

        // Optimistic update
        setOacList((prev) => prev.map((x) => (x.id === targetId ? updated : x)));

        // ✅ AWAIT le push vers GAS avec subAction EXPLICITE
        const res = await syncPushToGoogleSheets({
          type: 'oac',
          action: 'update',
          subAction: 'eclore',          // ← 🔑 EXPCLICITE
          item: updated,
        });
        console.log('[Éclosion] sync result:', res);

        if (res.success) {
          // ✅ Recharger SEULEMENT après succès
          await handleTriggerSync();
        } else {
          console.error('[Éclosion] écriture échouée :', res.message);
          // Optionnel : alert('Échec de l\'éclosion : ' + res.message);
        }
      }
    }

    // 5. Mettre à jour la soumission dans la sheet
    syncPushToGoogleSheets({ type: 'en_attente', action: 'update', item: { ...target, statut: 'Approuvé', idChoisi } });
  };

  const handleRejectSoumission = (idSoumission: string, raison: string) => {
    const todayStr = new Date().toLocaleDateString('fr-FR');
    // Play rejection sound on mobile & desktop
    playAlertSound('rejection');
    setSoumissions((prev) =>
      prev.map((s) =>
        s.idSoumission === idSoumission
          ? {
              ...s,
              statut: 'Rejeté',
              validPar: currentRole === 'admin' ? 'Administrateur' : currentRole,
              dateValid: todayStr,
              raison,
            }
          : s
      )
    );
    syncPushToGoogleSheets({ 
      type: 'en_attente', 
      action: 'update', 
      item: { idSoumission, statut: 'Rejeté', validPar: 'Administrateur', dateValid: todayStr, raison } 
    });
  };

  const handleUpdateSoumission = (updated: SoumissionEnAttente) => {
    setSoumissions((prev) => prev.map((s) => (s.idSoumission === updated.idSoumission ? updated : s)));
    syncPushToGoogleSheets({ type: 'en_attente', action: 'update', item: updated });
  };

  const handleAddSoumission = (newSoumission: SoumissionEnAttente) => {
    setSoumissions((prev) => [newSoumission, ...prev]);
    syncPushToGoogleSheets({ type: 'en_attente', action: 'insert', item: newSoumission });
  };

  const handleRefreshSoumissions = () => {
    handleTriggerSync();
  };

  // Handlers for Factures & Depenses
  const handleAddFacture = async (newFacture: Facture) => {
    setFactures((prev) => [newFacture, ...prev]);
    const res = await syncPushToGoogleSheets({ type: 'factures', action: 'insert', item: newFacture });
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
    setDepenses((prev) => [newDepense, ...prev]);
    const res = await syncPushToGoogleSheets({ type: 'depenses', action: 'insert', item: newDepense });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateDepense = async (updated: Depense) => {
    setDepenses((prev) =>
      prev.map((d) => (d.ligne === updated.ligne ? updated : d))
    );
    const res = await syncPushToGoogleSheets({ type: 'depenses', action: 'update', item: updated });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleDeleteDepense = async (ligne: number) => {
    setDepenses((prev) => prev.filter((d) => d.ligne !== ligne));
    const res = await syncPushToGoogleSheets({ type: 'depenses', action: 'delete', item: { ligne } });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleAddVente = async (newVente: Vente) => {
    setVentes((prev) => [newVente, ...prev]);
    const res = await syncPushToGoogleSheets({ type: 'ventes' as any, action: 'insert', item: newVente });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateVente = async (updated: Vente) => {
    setVentes((prev) =>
      prev.map((v) => (v.ligne === updated.ligne ? updated : v))
    );
    const res = await syncPushToGoogleSheets({ type: 'ventes' as any, action: 'update', item: updated });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleDeleteVente = async (ligne: number) => {
    setVentes((prev) => prev.filter((v) => v.ligne !== ligne));
    const res = await syncPushToGoogleSheets({ type: 'ventes' as any, action: 'delete', item: { ligne } });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleAddMouvementCaisse = async (mvt: MouvementCaisse) => {
    setMouvementsCaisse((prev) => [mvt, ...prev]);
    const res = await syncPushToGoogleSheets({ type: 'caisse' as any, action: 'insert', item: mvt });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleUpdateMouvementCaisse = async (updated: MouvementCaisse) => {
    setMouvementsCaisse((prev) =>
      prev.map((m) => (m.ligne === updated.ligne ? updated : m))
    );
    const res = await syncPushToGoogleSheets({ type: 'caisse' as any, action: 'update', item: updated });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleDeleteMouvementCaisse = async (ligne: number) => {
    setMouvementsCaisse((prev) => prev.filter((m) => m.ligne !== ligne));
    const res = await syncPushToGoogleSheets({ type: 'caisse' as any, action: 'delete', item: { ligne } });
    if (res.success) {
      handleTriggerSync();
    }
  };

  const handleAddCommandePoussin = async (cmd: CommandePoussin) => {
    setCommandesPoussins((prev) => [cmd, ...prev]);
    const res = await syncPushToGoogleSheets({ type: 'commandes_poussins' as any, action: 'insert', item: cmd });
    if (!res.success) {
      console.error('[CommandePoussin] sync failed:', res.message);
      // Optional: Revert the optimistic update if sync failed
      setCommandesPoussins((prev) => prev.filter(c => c.id !== cmd.id));
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
        setDepenses(result.parsedData.depenses);
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      <PWAInstallBanner />
      {!isLoggedIn ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <>
          {/* Top Header */}
          <Header
            currentRole={currentRole}
            setCurrentRole={setCurrentRole}
            syncStatus={syncStatus}
            onTriggerSync={() => setSyncModalOpen(true)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingSoumissionsCount={soumissions.filter((s) => s.statut === 'En attente').length}
            rejectedSoumissionsCount={rejectedSoumissions.length}
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
                onAddOAC={handleAddOAC}
                onUpdateOAC={handleUpdateOAC}
                onDeleteOAC={handleDeleteOAC}
                onAddSoumission={handleAddSoumission}
                onApproveSoumission={handleApproveSoumission}
                onRejectSoumission={handleRejectSoumission}
                onUpdateSoumission={handleUpdateSoumission}
                onRefreshSoumissions={handleRefreshSoumissions}
                role={currentRole}
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
                onOpenNewOAC={() => setActiveTab('oac')}
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
