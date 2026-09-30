import React, { useState, useEffect } from 'react';
import { OAC, Depense, Client, Facture, UserRole, SoumissionEnAttente, Vente, MouvementCaisse, CommandePoussin, Bordereau } from './types';
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
} from './data/initialData';
import { fetchGoogleSheetsData, syncPushToGoogleSheets, SyncResult } from './services/googleSheet';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { OACModule } from './components/OACModule';
import { CommandesPoussinsModule } from './components/CommandesPoussinsModule';
import { VentesModule } from './components/VentesModule';
import { FacturesModule } from './components/FacturesModule';
import { DepensesModule } from './components/DepensesModule';
import { ClientsModule } from './components/ClientsModule';
import { CaisseModule } from './components/CaisseModule';
import { SyncModal } from './components/SyncModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('oac'); // Default to OAC as requested by user
  const [currentRole, setCurrentRole] = useState<UserRole>('Administrateur');

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
  const handleAddOAC = (newOac: OAC) => {
    setOacList((prev) => [newOac, ...prev]);
    syncPushToGoogleSheets({ type: 'oac', action: 'insert', item: newOac });
  };

  const handleUpdateOAC = (updated: OAC) => {
    setOacList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    syncPushToGoogleSheets({ type: 'oac', action: 'update', item: updated });
  };

  const handleDeleteOAC = (id: string) => {
    setOacList((prev) => prev.filter((item) => item.id !== id));
    syncPushToGoogleSheets({ type: 'oac', action: 'delete', item: { id } });
  };

  // Admin validation handlers
  const handleApproveSoumission = (idSoumission: string, idChoisi: string) => {
    const target = soumissions.find((s) => s.idSoumission === idSoumission);
    if (!target) return;

    const todayStr = new Date().toLocaleDateString('fr-FR');
    setSoumissions((prev) =>
      prev.map((s) =>
        s.idSoumission === idSoumission
          ? {
              ...s,
              statut: 'Approuvé',
              validPar: currentRole === 'Administrateur' ? 'admin' : currentRole,
              dateValid: todayStr,
            }
          : s
      )
    );

    // If it's a Commande, insert it into real OAC list!
    if (target.type === 'Commande' && target.donnees) {
      const d = target.donnees;
      const dateParts = (d.date || '').split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : todayStr;
      const cartons = Number(d.cartons) || 10;
      const casses = Number(d.casses) || 0;
      const totalRecus = cartons * 360;
      const cubes = totalRecus - casses;

      const newOrder: OAC = {
        _v: 25,
        ligne: oacList.length + 3,
        id: idChoisi,
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
    }
  };

  const handleRejectSoumission = (idSoumission: string, raison: string) => {
    const todayStr = new Date().toLocaleDateString('fr-FR');
    setSoumissions((prev) =>
      prev.map((s) =>
        s.idSoumission === idSoumission
          ? {
              ...s,
              statut: 'Rejeté',
              validPar: currentRole === 'Administrateur' ? 'admin' : currentRole,
              dateValid: todayStr,
              raison,
            }
          : s
      )
    );
  };

  const handleRefreshSoumissions = () => {
    handleTriggerSync();
  };

  // Handlers for Factures & Depenses
  const handleAddFacture = (newFacture: Facture) => {
    setFactures((prev) => [newFacture, ...prev]);
    syncPushToGoogleSheets({ type: 'factures', action: 'insert', item: newFacture });
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

  const handleAddDepense = (newDepense: Depense) => {
    setDepenses((prev) => [newDepense, ...prev]);
    syncPushToGoogleSheets({ type: 'depenses', action: 'insert', item: newDepense });
  };

  const handleUpdateDepense = (updated: Depense) => {
    setDepenses((prev) =>
      prev.map((d) => (d.ligne === updated.ligne ? updated : d))
    );
    syncPushToGoogleSheets({ type: 'depenses', action: 'update', item: updated });
  };

  const handleDeleteDepense = (ligne: number) => {
    setDepenses((prev) => prev.filter((d) => d.ligne !== ligne));
    syncPushToGoogleSheets({ type: 'depenses', action: 'delete', item: { ligne } });
  };

  const handleAddVente = (newVente: Vente) => {
    setVentes((prev) => [newVente, ...prev]);
    syncPushToGoogleSheets({ type: 'ventes' as any, action: 'insert', item: newVente });
  };

  const handleUpdateVente = (updated: Vente) => {
    setVentes((prev) =>
      prev.map((v) => (v.ligne === updated.ligne ? updated : v))
    );
    syncPushToGoogleSheets({ type: 'ventes' as any, action: 'update', item: updated });
  };

  const handleDeleteVente = (ligne: number) => {
    setVentes((prev) => prev.filter((v) => v.ligne !== ligne));
    syncPushToGoogleSheets({ type: 'ventes' as any, action: 'delete', item: { ligne } });
  };

  const handleAddMouvementCaisse = (mvt: MouvementCaisse) => {
    setMouvementsCaisse((prev) => [mvt, ...prev]);
    syncPushToGoogleSheets({ type: 'caisse' as any, action: 'insert', item: mvt });
  };

  const handleUpdateMouvementCaisse = (updated: MouvementCaisse) => {
    setMouvementsCaisse((prev) =>
      prev.map((m) => (m.ligne === updated.ligne ? updated : m))
    );
    syncPushToGoogleSheets({ type: 'caisse' as any, action: 'update', item: updated });
  };

  const handleDeleteMouvementCaisse = (ligne: number) => {
    setMouvementsCaisse((prev) => prev.filter((m) => m.ligne !== ligne));
    syncPushToGoogleSheets({ type: 'caisse' as any, action: 'delete', item: { ligne } });
  };

  const handleAddCommandePoussin = (cmd: CommandePoussin) => {
    setCommandesPoussins((prev) => [cmd, ...prev]);
    syncPushToGoogleSheets({ type: 'commandes_poussins' as any, action: 'insert', item: cmd });
  };

  const handleUpdateCommandePoussin = (updated: CommandePoussin) => {
    setCommandesPoussins((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    syncPushToGoogleSheets({ type: 'commandes_poussins' as any, action: 'update', item: updated });
  };

  const handleDeleteCommandePoussin = (id: string) => {
    setCommandesPoussins((prev) => prev.filter((c) => c.id !== id));
    syncPushToGoogleSheets({ type: 'commandes_poussins' as any, action: 'delete', item: { id } });
  };

  const handleAddClient = (newClient: Client) => {
    setClients((prev) => [newClient, ...prev]);
    syncPushToGoogleSheets({ type: 'clients', action: 'insert', item: newClient });
  };

  const handleUpdateClient = (updated: Client) => {
    setClients((prev) => prev.map((c) => (c.index === updated.index ? updated : c)));
    syncPushToGoogleSheets({ type: 'clients', action: 'update' as any, item: updated });
  };

  const handleDeleteClient = (index: number) => {
    setClients((prev) => prev.filter((c) => c.index !== index));
    syncPushToGoogleSheets({ type: 'clients', action: 'delete' as any, item: { index } });
  };

  const handleUpdateFacture = (updated: Facture) => {
    setFactures((prev) => prev.map((f) => (f.ligne === updated.ligne ? updated : f)));
    syncPushToGoogleSheets({ type: 'factures' as any, action: 'update', item: updated });
  };

  const handleDeleteFacture = (ligne: number) => {
    setFactures((prev) => prev.filter((f) => f.ligne !== ligne));
    syncPushToGoogleSheets({ type: 'factures' as any, action: 'delete', item: { ligne } });
  };

  const handleAddBordereau = (bl: Bordereau) => {
    setBordereaux((prev) => [bl, ...prev]);
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
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Header */}
      <Header
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        syncStatus={syncStatus}
        onTriggerSync={() => setSyncModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'oac' && (
          <OACModule
            oacList={oacList}
            soumissions={soumissions}
            onAddOAC={handleAddOAC}
            onUpdateOAC={handleUpdateOAC}
            onDeleteOAC={handleDeleteOAC}
            onApproveSoumission={handleApproveSoumission}
            onRejectSoumission={handleRejectSoumission}
            onRefreshSoumissions={handleRefreshSoumissions}
            role={currentRole}
            onClose={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            oacList={oacList}
            depenses={depenses}
            clients={clients}
            factures={factures}
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
            onAddCommande={handleAddCommandePoussin}
            onUpdateCommande={handleUpdateCommandePoussin}
            onDeleteCommande={handleDeleteCommandePoussin}
            onAddClient={handleAddClient}
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
    </div>
  );
}
