import React, { useState, useMemo, useEffect, useRef } from 'react';
import { OAC, SoumissionEnAttente, UserRole } from '../types';
import { TYPES_OAC, RACES_OAC, FOURNISSEURS_OAC } from '../data/initialData';
import { playAlertSound } from '../utils/audio';
import { DiagnosticLogModal } from './DiagnosticLogModal';
import { getOacLogs } from '../services/googleSheet';

interface OACModuleProps {
  oacList: OAC[];
  soumissions: SoumissionEnAttente[];
  onAddOAC: (oac: OAC) => void;
  onUpdateOAC: (oac: OAC, subAction?: 'commander' | 'mirer' | 'eclore') => void;
  onDeleteOAC: (id: string) => void;
  onAddSoumission: (soumission: SoumissionEnAttente) => void;
  onApproveSoumission: (idSoumission: string, idChoisi: string, donneesModifiees?: any) => void;
  onRejectSoumission: (idSoumission: string, raison: string) => void;
  onUpdateSoumission?: (soumission: SoumissionEnAttente) => void;
  onRefreshSoumissions?: () => void;
  role: UserRole;
  onClose?: () => void;
}

export const OACModule: React.FC<OACModuleProps> = ({
  oacList,
  soumissions,
  onAddOAC,
  onUpdateOAC,
  onDeleteOAC,
  onAddSoumission,
  onApproveSoumission,
  onRejectSoumission,
  onUpdateSoumission,
  onRefreshSoumissions,
  role,
  onClose,
}) => {
  // Main two tabs: 'validation' (default) vs 'cycle' (Commandes, Mirage, Eclosions)
  const [mainTab, setMainTab] = useState<'validation' | 'cycle'>(role === 'admin' ? 'validation' : 'cycle');
  const [tabActif, setTabActif] = useState<0 | 1 | 2>(0);
  const [soumissionFilter, setSoumissionFilter] = useState<'Tous' | 'En attente' | 'Approuvé' | 'Rejeté'>('Tous');
  const [soumissionSearch, setSoumissionSearch] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Active correction mode for operator
  const [activeCorrection, setActiveCorrection] = useState<SoumissionEnAttente | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [oacLogs, setOacLogs] = useState<any[]>([]);

  const pendingCount = soumissions.filter((s) => s.statut === 'En attente').length;
  const approvedCount = soumissions.filter((s) => s.statut === 'Approuvé').length;
  const rejectedCount = soumissions.filter((s) => s.statut === 'Rejeté').length;

  // Sound alert on operator phone when a new rejection arrives
  const prevRejectedCount = useRef(rejectedCount);
  useEffect(() => {
    if (role !== 'admin' && rejectedCount > prevRejectedCount.current) {
      playAlertSound('rejection');
    }
    prevRejectedCount.current = rejectedCount;
  }, [rejectedCount, role]);

  const filteredSoumissions = useMemo(() => {
    return soumissions.filter((s) => {
      const matchFilter = soumissionFilter === 'Tous' ? true : s.statut === soumissionFilter;
      const matchSearch = soumissionSearch
        ? `${s.type} ${s.soumisPar} ${s.resume} ${s.dateSoumission}`
            .toLowerCase()
            .includes(soumissionSearch.toLowerCase().trim())
        : true;
      return matchFilter && matchSearch;
    });
  }, [soumissions, soumissionFilter, soumissionSearch]);

  // Selected IDs in tables
  const [selC, setSelC] = useState<string>('');
  const [selM, setSelM] = useState<string>('');
  const [selE, setSelE] = useState<string>('');

  // Tab 1 : Commandes form state
  const [cDt, setCDt] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [cType, setCType] = useState<string>('Chairs');
  const [cCar, setCCar] = useState<string>('');
  const [cCas, setCCas] = useState<string>('');
  const [cJ21, setCJ21] = useState<boolean>(true);
  const [cRace, setCRace] = useState<string>('Ross 308');
  const [cFourn, setCFourn] = useState<string>('Pak tavuk');
  const [cId, setCId] = useState<string>('');
  const [cLg, setCLg] = useState<number | undefined>(undefined);

  // Tab 2 : Mirage form state
  const [mId, setMId] = useState<string>('');
  const [mDateAff, setMDateAff] = useState<string>('');
  const [mCla, setMCla] = useState<string>('');
  const [mCubes, setMCubes] = useState<number>(0);
  const [mFer, setMFer] = useState<string>('');

  // Tab 3 : Éclosion form state
  const [eId, setEId] = useState<string>('');
  const [eDateAff, setEDateAff] = useState<string>('');
  const [eNes, setENes] = useState<string>('');
  const [eHan, setEHan] = useState<string>('');
  const [eMor, setEMor] = useState<string>('');

  // Admin Approval Modal state
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedSoumission, setSelectedSoumission] = useState<SoumissionEnAttente | null>(null);
  const [approveIdChoisi, setApproveIdChoisi] = useState<string>('');
  const [approveIdError, setApproveIdError] = useState(false);
  const [showRejectFormInModal, setShowRejectFormInModal] = useState(false);
  const [modalRejectRaison, setModalRejectRaison] = useState('');

  // Rejection Prompt Modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectRaison, setRejectRaison] = useState('');
  const [rejectSoumissionId, setRejectSoumissionId] = useState('');

  // Confirmation Delete Modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [deleteType, setDeleteType] = useState<'commande' | 'mirage' | 'eclosion'>('commande');

  const showNotification = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  };

  // Helper date calculation
  const calculateEclosionDate = (dateISO: string, isJ21: boolean): string => {
    if (!dateISO) return '';
    try {
      const parts = dateISO.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + (isJ21 ? 21 : 22));
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${d.getFullYear()}`;
      }
    } catch (e) {
      // fallback
    }
    return '';
  };

  // -------------------------------------------------------------
  // Load item into Form 1 (Commande)
  // -------------------------------------------------------------
  const loadC = (item: OAC) => {
    setSelC(item.id);
    setCId(item.id);
    setCLg(item.ligne);
    if (item.date) {
      const parts = item.date.split('/');
      if (parts.length === 3) {
        setCDt(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }
    setCType(item.type || 'Chairs');
    setCCar(item.cartons ? String(item.cartons) : '');
    setCCas(item.nbCasses !== undefined && item.nbCasses !== null ? String(item.nbCasses) : '');
    setCRace(item.race || '');
    setCFourn(item.fournisseur || '');
  };

  const razC = () => {
    setSelC('');
    setCId('');
    setCLg(undefined);
    const d = new Date();
    setCDt(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setCType('Chairs');
    setCCar('');
    setCCas('');
    setCRace('Ross 308');
    setCFourn('Pak tavuk');
    setCJ21(true);
  };

  // -------------------------------------------------------------
  // Load item into Form 2 (Mirage)
  // -------------------------------------------------------------
  const loadM = (item: OAC) => {
    setSelM(item.id);
    setMId(item.id);
    setMDateAff(item.eclosion || '');
    const cubes = item.cubes || ((item.cartons || 0) * 360 - (item.nbCasses || 0));
    setMCubes(cubes);
    if (item.clairs !== undefined && item.clairs !== null) {
      setMCla(String(item.clairs));
      setMFer(String(cubes - item.clairs));
    } else {
      setMCla('');
      setMFer(String(cubes));
    }
  };

  const handleClairsInput = (val: string) => {
    setMCla(val);
    if (val === '') {
      setMFer(String(mCubes));
    } else {
      const c = parseInt(val) || 0;
      setMFer(String(Math.max(0, mCubes - c)));
    }
  };

  const razM = () => {
    setSelM('');
    setMId('');
    setMDateAff('');
    setMCla('');
    setMCubes(0);
    setMFer('');
  };

  // -------------------------------------------------------------
  // Load item into Form 3 (Éclosion)
  // -------------------------------------------------------------
  const loadE = (item: OAC) => {
    setSelE(item.id);
    setEId(item.id);
    setEDateAff(item.eclosion || '');
    setENes(item.commerciaux !== undefined && item.commerciaux !== null ? String(item.commerciaux) : '');
    setEHan(item.handicapes !== undefined && item.handicapes !== null ? String(item.handicapes) : '');
    setEMor(item.morts !== undefined && item.morts !== null ? String(item.morts) : '');
  };

  const razE = () => {
    setSelE('');
    setEId('');
    setEDateAff('');
    setENes('');
    setEHan('');
    setEMor('');
  };

  // -------------------------------------------------------------
  // Save Handlers
  // -------------------------------------------------------------
  const handleSave = () => {
    if (tabActif === 0) {
      if (!cDt || !cType || !cCar) {
        showNotification('Veuillez renseigner la date, le type et le nombre de cartons.', false);
        return;
      }
      if (cCas === '') {
        showNotification("Veuillez renseigner le nombre d'OAC cassés.", false);
        return;
      }
      if (!cRace) {
        showNotification('Veuillez sélectionner une race.', false);
        return;
      }
      if (!cFourn) {
        showNotification('Veuillez sélectionner un fournisseur.', false);
        return;
      }

      const cartonsNum = parseInt(cCar) || 0;
      const cassesNum = parseInt(cCas) || 0;
      const dateParts = cDt.split('-');
      const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      const eclosionDate = calculateEclosionDate(cDt, cJ21);
      const totalRecus = cartonsNum * 360;
      const cubes = totalRecus - cassesNum;

      // Operator Role: Always send to validation before integration into database
      if (role !== 'admin') {
        const donnees = {
          date: cDt,
          type: cType,
          race: cRace,
          fournisseur: cFourn,
          cartons: cartonsNum,
          casses: cassesNum,
          eclosion: eclosionDate,
        };
        const resume = `Commande ${cType} (${cRace}) - ${cartonsNum} cartons (${cFourn})`;

        if (activeCorrection && activeCorrection.type === 'Commande') {
          const updated: SoumissionEnAttente = {
            ...activeCorrection,
            statut: 'En attente',
            dateSoumission: new Date().toLocaleDateString('fr-FR'),
            resume,
            donnees,
            raison: undefined,
          };
          if (onUpdateSoumission) {
            onUpdateSoumission(updated);
          } else {
            onAddSoumission(updated);
          }
          setActiveCorrection(null);
          playAlertSound('success');
          showNotification('📨 Commande corrigée et re-transmise pour validation administrateur.', true);
        } else {
          const newSoumission: SoumissionEnAttente = {
            ligne: soumissions.length + 1,
            idSoumission: `ATT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`,
            type: 'Commande',
            soumisPar: 'Opérateur',
            dateSoumission: new Date().toLocaleDateString('fr-FR'),
            statut: 'En attente',
            resume,
            donnees,
          };
          onAddSoumission(newSoumission);
          playAlertSound('success');
          showNotification('📨 Commande transmise à la validation administrateur avec succès. Elle sera intégrée dès son approbation.', true);
        }
        razC();
        return;
      }

      if (selC) {
        // Modification Admin
        const existing = oacList.find((x) => x.id === selC);
        if (existing) {
          const updated: OAC = {
            ...existing,
            date: formattedDate,
            type: cType,
            race: cRace,
            fournisseur: cFourn,
            cartons: cartonsNum,
            recus: totalRecus,
            nbCasses: cassesNum,
            cubes,
            eclosion: eclosionDate,
          };
          onUpdateOAC(updated, 'commander');
          showNotification('Commande modifiée avec succès.', true);
          razC();
        }
      } else {
        // Nouvelle commande Admin
        const newId = `OAC-2609-00${oacList.length + 1}`;
        const newOac: OAC = {
          _v: 25,
          ligne: oacList.length + 3,
          id: newId,
          date: formattedDate,
          type: cType,
          race: cRace,
          fournisseur: cFourn,
          cartons: cartonsNum,
          recus: totalRecus,
          nbCasses: cassesNum,
          cubes,
          eclosion: eclosionDate,
          clairs: null,
          fertiles: cubes,
          commerciaux: null,
          pourVente: null,
          handicapes: null,
          morts: null,
        };
        onAddOAC(newOac);
        showNotification('Commande enregistrée directement dans la base de données.', true);
        razC();
      }
    } else if (tabActif === 1) {
      if (!mId) {
        showNotification('Veuillez sélectionner une ligne dans la liste.', false);
        return;
      }
      if (mCla === '') {
        showNotification("Veuillez renseigner le nombre d'œufs clairs.", false);
        return;
      }
      const existing = oacList.find((x) => x.id === mId);
      if (existing) {
        const clairsNum = parseInt(mCla) || 0;
        const cubes = existing.cubes || (existing.cartons * 360 - existing.nbCasses);
        const fertiles = Math.max(0, cubes - clairsNum);

        // Operator Role: Send mirage declaration to validation
        if (role !== 'admin') {
          const donnees = {
            id: mId,
            clairs: clairsNum,
            fertiles,
          };
          const resume = `Mirage lot ${mId} : ${clairsNum} clairs, ${fertiles} fertiles`;

          if (activeCorrection && activeCorrection.type === 'Mirage') {
            const updated: SoumissionEnAttente = {
              ...activeCorrection,
              statut: 'En attente',
              dateSoumission: new Date().toLocaleDateString('fr-FR'),
              resume,
              donnees,
              raison: undefined,
            };
            if (onUpdateSoumission) {
              onUpdateSoumission(updated);
            } else {
              onAddSoumission(updated);
            }
            setActiveCorrection(null);
            playAlertSound('success');
            showNotification('📨 Mirage corrigé et re-transmis à la validation administrateur.', true);
          } else {
            const newSoumission: SoumissionEnAttente = {
              ligne: soumissions.length + 1,
              idSoumission: `ATT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`,
              type: 'Mirage',
              soumisPar: 'Opérateur',
              dateSoumission: new Date().toLocaleDateString('fr-FR'),
              statut: 'En attente',
              resume,
              donnees,
            };
            onAddSoumission(newSoumission);
            playAlertSound('success');
            showNotification('📨 Déclaration de mirage transmise à la validation administrateur.', true);
          }
          razM();
          return;
        }

        const updated: OAC = {
          ...existing,
          clairs: clairsNum,
          fertiles,
        };
        onUpdateOAC(updated, 'mirer');
        showNotification('Données de mirage enregistrées directement dans la base.', true);
        razM();
      }
    } else if (tabActif === 2) {
      if (!eId) {
        showNotification('Veuillez sélectionner une éclosion dans la liste.', false);
        return;
      }
      if (eNes === '') {
        showNotification('Veuillez renseigner le nombre de poussins commerciaux.', false);
        return;
      }
      if (eHan === '') {
        showNotification('Veuillez renseigner le nombre de poussins handicapés.', false);
        return;
      }
      if (eMor === '') {
        showNotification('Veuillez renseigner le nombre de poussins morts.', false);
        return;
      }

      const existing = oacList.find((x) => x.id === eId);
      if (existing) {
        const commNum = parseInt(eNes) || 0;
        const hanNum = parseInt(eHan) || 0;
        const morNum = parseInt(eMor) || 0;
        const bonus = Math.ceil(commNum * 0.02);
        const pourVente = commNum - bonus;

        // Operator Role: Send eclosion declaration to validation
        if (role !== 'admin') {
          const donnees = {
            id: eId,
            commerciaux: commNum,
            nes: commNum,
            handicapes: hanNum,
            morts: morNum,
            pourVente,
          };
          const resume = `Éclosion lot ${eId} : ${commNum} commerciaux, ${hanNum} handicapés, ${morNum} morts`;

          if (activeCorrection && activeCorrection.type === 'Éclosion') {
            const updated: SoumissionEnAttente = {
              ...activeCorrection,
              statut: 'En attente',
              dateSoumission: new Date().toLocaleDateString('fr-FR'),
              resume,
              donnees,
              raison: undefined,
            };
            if (onUpdateSoumission) {
              onUpdateSoumission(updated);
            } else {
              onAddSoumission(updated);
            }
            setActiveCorrection(null);
            playAlertSound('success');
            showNotification('📨 Éclosion corrigée et re-transmise à la validation administrateur.', true);
          } else {
            const newSoumission: SoumissionEnAttente = {
              ligne: soumissions.length + 1,
              idSoumission: `ATT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`,
              type: 'Éclosion',
              soumisPar: 'Opérateur',
              dateSoumission: new Date().toLocaleDateString('fr-FR'),
              statut: 'En attente',
              resume,
              donnees,
            };
            onAddSoumission(newSoumission);
            playAlertSound('success');
            showNotification('📨 Déclaration d\'éclosion transmise à la validation administrateur.', true);
          }
          razE();
          return;
        }

        const updated: OAC = {
          ...existing,
          commerciaux: commNum,
          nes: commNum,
          handicapes: hanNum,
          morts: morNum,
          pourVente,
        };
        onUpdateOAC(updated, 'eclore');
        showNotification("Données d'éclosion enregistrées directement dans la base.", true);
        razE();
      }
    }
  };

  // -------------------------------------------------------------
  // Delete Triggers
  // -------------------------------------------------------------
  const handleDeleteClick = () => {
    if (tabActif === 0) {
      if (!selC) return;
      setDeleteTargetId(selC);
      setDeleteType('commande');
      setDeleteConfirmOpen(true);
    } else if (tabActif === 1) {
      if (!selM) return;
      setDeleteTargetId(selM);
      setDeleteType('mirage');
      setDeleteConfirmOpen(true);
    } else if (tabActif === 2) {
      if (!selE) return;
      setDeleteTargetId(selE);
      setDeleteType('eclosion');
      setDeleteConfirmOpen(true);
    }
  };

  const confirmDelete = () => {
    setDeleteConfirmOpen(false);
    if (deleteType === 'commande') {
      onDeleteOAC(deleteTargetId);
      showNotification('Commande supprimée avec succès.', true);
      razC();
    } else if (deleteType === 'mirage') {
      const existing = oacList.find((x) => x.id === deleteTargetId);
      if (existing) {
        onUpdateOAC({ ...existing, clairs: 0, fertiles: existing.cubes }, 'mirer');
        showNotification('Données de mirage supprimées avec succès.', true);
        razM();
      }
    } else if (deleteType === 'eclosion') {
      const existing = oacList.find((x) => x.id === deleteTargetId);
      if (existing) {
        onUpdateOAC({
          ...existing,
          commerciaux: 0,
          nes: 0,
          handicapes: 0,
          morts: 0,
          pourVente: 0,
        }, 'eclore');
        showNotification("Données d'éclosion supprimées avec succès.", true);
        razE();
      }
    }
  };

  // -------------------------------------------------------------
  // Admin Approval Workflow & Operator Correction
  // -------------------------------------------------------------
  const [editDonnees, setEditDonnees] = useState<any>({});

  const handleOpenApprove = (soumission: SoumissionEnAttente) => {
    setSelectedSoumission(soumission);
    const initialData = JSON.parse(JSON.stringify(soumission.donnees || {}));
    setEditDonnees(initialData);
    setApproveIdChoisi(soumission.donnees?.id || `OAC-2609-00${oacList.length + 1}`);
    setApproveIdError(false);
    setShowRejectFormInModal(false);
    setModalRejectRaison('');
    setApproveModalOpen(true);
  };

  const confirmApprove = () => {
    if (!selectedSoumission) return;
    if (selectedSoumission.type === 'Commande' && !approveIdChoisi.trim()) {
      setApproveIdError(true);
      return;
    }
    const finalId = selectedSoumission.type === 'Commande'
      ? approveIdChoisi.trim()
      : (editDonnees.id || selectedSoumission.donnees?.id);

    onApproveSoumission(selectedSoumission.idSoumission, finalId, editDonnees);
    playAlertSound('success');
    showNotification(`Soumission ${selectedSoumission.type} validée et enregistrée avec succès !`, true);
    setApproveModalOpen(false);
    setSelectedSoumission(null);
    setShowRejectFormInModal(false);
  };

  const handleConfirmRejectFromModal = () => {
    if (!selectedSoumission) return;
    const raison = modalRejectRaison.trim() || 'Correction demandée par le superviseur';
    onRejectSoumission(selectedSoumission.idSoumission, raison);
    playAlertSound('rejection');
    showNotification("Soumission rejetée. L'opérateur a reçu une alerte sonore et une demande de correction sur son téléphone.", true);
    setApproveModalOpen(false);
    setSelectedSoumission(null);
    setShowRejectFormInModal(false);
    setModalRejectRaison('');
  };

  const handleRejectFromApprove = () => {
    setShowRejectFormInModal(true);
    setModalRejectRaison('');
  };

  const handleOpenReject = (soumission: SoumissionEnAttente) => {
    setRejectSoumissionId(soumission.idSoumission);
    setRejectRaison('');
    setRejectModalOpen(true);
  };

  const confirmReject = () => {
    if (rejectSoumissionId) {
      onRejectSoumission(rejectSoumissionId, rejectRaison.trim() || 'Correction demandée par le superviseur');
      playAlertSound('rejection');
      showNotification("Soumission rejetée. Une alerte sonore et une demande de correction ont été transmises à l'opérateur.", true);
      setRejectModalOpen(false);
      setRejectSoumissionId('');
    }
  };

  // Operator: Start correction flow for rejected submission
  const handleStartCorrection = (s: SoumissionEnAttente) => {
    setActiveCorrection(s);
    setMainTab('cycle');
    playAlertSound('warning');
    if (s.type === 'Commande') {
      setTabActif(0);
      if (s.donnees) {
        setCDt(s.donnees.date || '');
        setCType(s.donnees.type || 'Chairs');
        setCRace(s.donnees.race || 'Ross 308');
        setCFourn(s.donnees.fournisseur || 'Pak tavuk');
        setCCar(s.donnees.cartons != null ? String(s.donnees.cartons) : '');
        setCCas(s.donnees.casses != null ? String(s.donnees.casses) : '');
      }
    } else if (s.type === 'Mirage') {
      setTabActif(1);
      if (s.donnees?.id) {
        const item = oacList.find((x) => x.id === s.donnees.id);
        if (item) {
          loadM(item);
        } else {
          setMId(s.donnees.id);
        }
        setMCla(s.donnees.clairs != null ? String(s.donnees.clairs) : '');
      }
    } else if (s.type === 'Éclosion') {
      setTabActif(2);
      if (s.donnees?.id) {
        const item = oacList.find((x) => x.id === s.donnees.id);
        if (item) {
          loadE(item);
        } else {
          setEId(s.donnees.id);
        }
        setENes(s.donnees.commerciaux != null ? String(s.donnees.commerciaux) : '');
        setEHan(s.donnees.handicapes != null ? String(s.donnees.handicapes) : '');
        setEMor(s.donnees.morts != null ? String(s.donnees.morts) : '');
      }
    }
    showNotification(`Correction activée : ${s.resume}. Motif du rejet : « ${s.raison || 'Non précisé'} ». Modifiez les valeurs et cliquez sur Transmettre.`, true);
  };

  const isSelected = tabActif === 0 ? Boolean(selC) : tabActif === 1 ? Boolean(selM) : Boolean(selE);

  return (
    <div className="bg-slate-200/60 rounded-3xl p-3 sm:p-5 shadow-2xl border border-slate-300 max-w-5xl mx-auto space-y-4">
      {/* Top Modal Window Bar */}
      <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Gestion des OAC</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setOacLogs(getOacLogs());
              setIsLogModalOpen(true);
            }}
            className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border"
          >
            📋 Logs
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1 leading-none transition"
              title="Fermer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <DiagnosticLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        logs={oacLogs}
      />

      {/* Notification Toast */}
      {msg && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm font-bold border transition animate-fade-in ${
            msg.ok
              ? 'bg-[#d5f5e3] text-[#1e8449] border-[#c3e6cb]'
              : 'bg-[#fadbd8] text-[#c0392b] border-[#f5c6cb]'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          2 MAIN TOP-LEVEL TABS (Validation Admin / Suivi déclarations)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => setMainTab('validation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm tracking-wide transition-all shadow-sm cursor-pointer ${
            mainTab === 'validation'
              ? 'bg-gradient-to-r from-[#b8860b] to-[#f39c12] text-white shadow-md ring-2 ring-[#f39c12]/40'
              : 'bg-[#f8f9fa] text-slate-700 hover:bg-amber-50 hover:text-[#b8860b] border border-slate-200'
          }`}
        >
          <span>✅</span>
          <span>{role === 'admin' ? 'Validation admin — Soumissions' : 'Suivi de mes déclarations'}</span>
          {role === 'admin' ? (
            pendingCount > 0 ? (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  mainTab === 'validation'
                    ? 'bg-white text-[#b8860b]'
                    : 'bg-[#f39c12] text-white animate-pulse'
                }`}
              >
                {pendingCount}
              </span>
            ) : null
          ) : (
            rejectedCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse flex items-center gap-1 shadow-xs">
                <span>⚠️</span>
                <span>{rejectedCount} à corriger</span>
              </span>
            ) : pendingCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pendingCount} en attente
              </span>
            ) : null
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab('cycle')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm tracking-wide transition-all shadow-sm cursor-pointer ${
            mainTab === 'cycle'
              ? 'bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white shadow-md ring-2 ring-[#2E86C1]/40'
              : 'bg-[#f8f9fa] text-slate-700 hover:bg-sky-50 hover:text-[#1B4F72] border border-slate-200'
          }`}
        >
          <span>🥚</span>
          <span>Commandes, Mirage &amp; Éclosions</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              mainTab === 'cycle' ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {oacList.length} lots
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MAIN TAB 1: VALIDATION ADMIN / SUIVI SOUMISSIONS
         ══════════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'validation' && (
        <div className="bg-gradient-to-br from-[#fff8e1] to-[#fffde7] border-2 border-[#f39c12] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 animate-fade-in">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-[#f39c12]">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <div>
                <h2 className="text-[#b8860b] font-bold text-sm sm:text-base tracking-wide">
                  {role === 'admin' ? 'Validation admin — Soumissions en attente' : 'Suivi des déclarations — Circuit de validation'}
                </h2>
                <p className="text-[11px] text-slate-600">
                  {role === 'admin' 
                    ? 'Validez ou rejetez les déclarations saisies par les opérateurs avant intégration dans la base'
                    : 'Toutes vos saisies sont enregistrées ici et transmises à l\'administrateur avant intégration dans la base'}
                </p>
              </div>
            </div>
            {onRefreshSoumissions && (
              <button
                type="button"
                onClick={onRefreshSoumissions}
                className="bg-[#f39c12] hover:bg-[#d68910] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <span>⟳ Actualiser</span>
              </button>
            )}
          </div>

          {role !== 'admin' && (
            <div className="bg-amber-100/80 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 flex items-center gap-2.5">
              <span className="text-lg shrink-0">🛡️</span>
              <div>
                <strong>Circuit de validation opérateur actif :</strong> Vos saisies (commandes OAC, mirage, éclosion) restent en attente jusqu'à approbation par un administrateur. Une fois approuvées, elles apparaissent automatiquement dans le suivi du cycle.
              </div>
            </div>
          )}

          {/* 4 Mini KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white rounded-xl p-3 border border-amber-200 text-center shadow-xs">
              <div className="text-[10px] uppercase font-bold text-slate-500">Total</div>
              <div className="text-lg font-black text-slate-800">{soumissions.length}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-amber-300 text-center shadow-xs">
              <div className="text-[10px] uppercase font-bold text-amber-700">En attente</div>
              <div className="text-lg font-black text-amber-600">{pendingCount}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-emerald-300 text-center shadow-xs">
              <div className="text-[10px] uppercase font-bold text-emerald-700">Approuvées</div>
              <div className="text-lg font-black text-emerald-600">{approvedCount}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-rose-300 text-center shadow-xs">
              <div className="text-[10px] uppercase font-bold text-rose-700">Rejetées</div>
              <div className="text-lg font-black text-rose-600">{rejectedCount}</div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-amber-200 text-xs">
              {(['Tous', 'En attente', 'Approuvé', 'Rejeté'] as const).map((filtre) => (
                <button
                  key={filtre}
                  type="button"
                  onClick={() => setSoumissionFilter(filtre)}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    soumissionFilter === filtre
                      ? 'bg-[#f39c12] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {filtre}
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-[200px] max-w-sm">
              <input
                type="text"
                placeholder="Rechercher par type, auteur, lot..."
                value={soumissionSearch}
                onChange={(e) => setSoumissionSearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#f39c12]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto bg-white rounded-xl border border-amber-200 shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="bg-[#b8860b] text-white font-bold uppercase text-[11px] tracking-wider">
                  <th className="px-3 py-2.5">DATE</th>
                  <th className="px-3 py-2.5">TYPE</th>
                  <th className="px-3 py-2.5">SOUMIS PAR</th>
                  <th className="px-3 py-2.5">RÉSUMÉ</th>
                  <th className="px-3 py-2.5 text-center">STATUT</th>
                  <th className="px-3 py-2.5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ffe082]/60">
                {filteredSoumissions.map((s, idx) => {
                  const isPending = s.statut === 'En attente';
                  const isApproved = s.statut === 'Approuvé';
                  const isRejected = s.statut === 'Rejeté';

                  return (
                    <tr key={s.idSoumission} className="hover:bg-[#fff3cd]/80 transition">
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium">{s.dateSoumission}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-bold text-slate-900">
                        {s.type}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                        {s.soumisPar}
                      </td>
                      <td className="px-3 py-2.5 text-slate-800">{s.resume}</td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {isApproved && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#d4edda] text-[#155724] border border-[#c3e6cb]">
                            APPROUVÉ
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb]">
                            REJETÉ
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#fff3cd] text-[#856404] border border-[#ffe082]">
                            EN ATTENTE
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {role === 'admin' ? (
                          isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenApprove(s)}
                                className="bg-gradient-to-r from-[#1E8449] to-[#27AE60] hover:from-[#186A3B] hover:to-[#229954] text-white px-3 py-1 rounded-lg text-[11px] font-bold shadow-xs transition cursor-pointer"
                              >
                                ✔ Approuver
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenReject(s)}
                                className="bg-gradient-to-r from-[#922B21] to-[#E74C3C] hover:from-[#7B241C] hover:to-[#CB4335] text-white px-3 py-1 rounded-lg text-[11px] font-bold shadow-xs transition cursor-pointer"
                              >
                                ✕ Rejeter
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-medium">
                              Traité par {s.validPar || 'admin'} {s.dateValid ? `le ${s.dateValid}` : ''}
                            </span>
                          )
                        ) : (
                          isRejected ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg max-w-[200px] truncate" title={s.raison}>
                                « {s.raison || 'Correction requise'} »
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartCorrection(s)}
                                className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <span>✏️</span>
                                <span>Corriger</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-600">
                              {isPending 
                                ? '⏳ En attente de validation admin' 
                                : `✔ Validé & Intégré (par ${s.validPar || 'admin'})`}
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredSoumissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500 font-medium">
                      Aucune soumission trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MAIN TAB 2: SUIVI DU CYCLE OAC (Commandes, Mirage, Éclosions)
         ══════════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'cycle' && role !== 'comptable' && (
        <div className="space-y-4 animate-fade-in">
          {/* Operator Alert Banner for rejected submissions */}
          {role !== 'admin' && rejectedCount > 0 && (
            <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-4 shadow-sm space-y-2 mb-2 animate-pulse-subtle">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-900 font-black text-sm">
                  <span className="text-xl">🚨</span>
                  <span>{rejectedCount} déclaration(s) rejetée(s) par l'administrateur</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab('validation')}
                  className="text-xs font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer"
                >
                  Voir la liste complète →
                </button>
              </div>
              <p className="text-xs text-rose-800 font-medium">
                Des corrections ont été demandées. Cliquez sur "Corriger et renvoyer" pour réajuster vos chiffres.
              </p>
              <div className="space-y-1.5 pt-1">
                {soumissions
                  .filter((s) => s.statut === 'Rejeté')
                  .slice(0, 3)
                  .map((s) => (
                    <div
                      key={s.idSoumission}
                      className="bg-white p-2.5 rounded-xl border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shadow-2xs"
                    >
                      <div>
                        <span className="font-extrabold uppercase bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[10px] mr-2">
                          {s.type}
                        </span>
                        <span className="font-bold text-slate-800">{s.resume}</span>
                        <div className="text-rose-700 font-semibold text-[11px] mt-0.5">
                          Motif du rejet : <strong className="underline">{s.raison || 'Correction demandée'}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartCorrection(s)}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>✏️</span>
                        <span>Corriger et renvoyer</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Active Correction Floating Banner */}
          {activeCorrection && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h4 className="font-black text-amber-900 text-sm">Mode correction activé — {activeCorrection.type}</h4>
                  <p className="text-xs text-rose-700 font-bold mt-0.5">
                    Motif du superviseur : « {activeCorrection.raison || 'Correction requise'} »
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Modifiez les chiffres erronés ci-dessous puis validez pour re-soumettre à l'administrateur.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveCorrection(null);
                  if (tabActif === 0) razC();
                  if (tabActif === 1) razM();
                  if (tabActif === 2) razE();
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                ✕ Annuler la correction
              </button>
            </div>
          )}

          {/* Sub-Tabs Row (1. Commandes, 2. Mirage (J+18), 3. Eclosion (J+21)) */}
          <div className="flex border-b-[3px] border-[#2e86c1] gap-1 pt-1">
            <button
              onClick={() => {
                setTabActif(0);
              }}
              className={`px-5 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm tracking-wide transition-all ${
                tabActif === 0
                  ? 'bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white shadow-md'
                  : 'bg-[#e8eef5] text-slate-700 hover:bg-[#d6eaf8]'
              }`}
            >
              1. Commandes
            </button>
            <button
              onClick={() => {
                setTabActif(1);
              }}
              className={`px-5 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm tracking-wide transition-all ${
                tabActif === 1
                  ? 'bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white shadow-md'
                  : 'bg-[#e8eef5] text-slate-700 hover:bg-[#d6eaf8]'
              }`}
            >
              2. Mirage (J+18)
            </button>
            <button
              onClick={() => {
                setTabActif(2);
              }}
              className={`px-5 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm tracking-wide transition-all ${
                tabActif === 2
                  ? 'bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white shadow-md'
                  : 'bg-[#e8eef5] text-slate-700 hover:bg-[#d6eaf8]'
              }`}
            >
              3. Eclosion (J+21)
            </button>
          </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 1 : COMMANDE OAC (Screenshot 1)
         ══════════════════════════════════════════════════════════════════════════ */}
      {tabActif === 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-md border border-[#2e86c1]/20 overflow-hidden">
            {/* Blue Header Bar */}
            <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center gap-3 text-white">
              <span className="text-2xl">📦</span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Commande OAC</h2>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>📅</span>
                    <span>Date commande</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={cDt}
                    onChange={(e) => setCDt(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>🌱</span>
                    <span>Type OAC</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <select
                    value={cType}
                    onChange={(e) => setCType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  >
                    <option value="">--</option>
                    {TYPES_OAC.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>📦</span>
                    <span>Nbre cartons</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder=""
                    value={cCar}
                    onChange={(e) => setCCar(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>🚫</span>
                    <span>Nbre OAC casses</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder=""
                    value={cCas}
                    onChange={(e) => setCCas(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    id="c_j21"
                    checked={cJ21}
                    onChange={(e) => setCJ21(e.target.checked)}
                    className="w-4 h-4 text-[#2E86C1] rounded border-slate-300 focus:ring-[#2E86C1]"
                  />
                  <label htmlFor="c_j21" className="text-xs font-semibold text-slate-700 select-none">
                    J+21 (sinon J+22)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>🐔</span>
                    <span>Race</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <select
                    value={cRace}
                    onChange={(e) => setCRace(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  >
                    <option value="">-- Choisir --</option>
                    {RACES_OAC.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>🚚</span>
                    <span>Fournisseur</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <select
                    value={cFourn}
                    onChange={(e) => setCFourn(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  >
                    <option value="">-- Choisir --</option>
                    {FOURNISSEURS_OAC.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Operator Notice */}
              {role !== 'admin' && (
                <div className="w-full text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-base">🛡️</span>
                  <span><strong>Mode Opérateur :</strong> Cette commande sera transmise à l'administrateur pour validation avant toute intégration dans la base de données.</span>
                </div>
              )}

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: role === 'admin' 
                      ? 'linear-gradient(135deg, #1B4F72, #2E86C1)' 
                      : 'linear-gradient(135deg, #d97706, #f59e0b)',
                  }}
                >
                  <span>
                    {role === 'admin' 
                      ? '✔ ENREGISTRER DIRECTEMENT' 
                      : (activeCorrection && activeCorrection.type === 'Commande' 
                          ? '📨 ENVOYER LA COMMANDE CORRIGÉE' 
                          : '📨 SOUMETTRE POUR VALIDATION')}
                  </span>
                </button>
                {role === 'admin' && (
                  <>
                    <button
                      type="button"
                      disabled={!isSelected}
                      onClick={handleSave}
                      className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition ${
                        isSelected
                          ? 'active:scale-95 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #1E8449, #27AE60)',
                      }}
                    >
                      ✎ MODIFIER
                    </button>
                    <button
                      type="button"
                      disabled={!isSelected}
                      onClick={handleDeleteClick}
                      className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition ${
                        isSelected
                          ? 'active:scale-95 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #922B21, #E74C3C)',
                      }}
                    >
                      🗑 SUPPRIMER
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={razC}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition cursor-pointer"
                >
                  ↺ ANNULER
                </button>
                <button
                  type="button"
                  onClick={onClose || razC}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#555] hover:bg-[#333] text-white border border-[#444] transition"
                >
                  ✕ FERMER
                </button>
              </div>
            </div>
          </div>

          {/* Table: Dernieres commandes */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-[#1B4F72] border-b-2 border-[#d6eaf8] pb-1">
              Dernieres commandes
            </h3>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Race</th>
                    <th className="px-3 py-2.5">Fournisseur</th>
                    <th className="px-3 py-2.5 text-center">Cartons</th>
                    <th className="px-3 py-2.5 text-right">Recus</th>
                    <th className="px-3 py-2.5 text-right">Casses</th>
                    <th className="px-3.5 py-2.5 text-center">Date eclo.</th>
                    <th className="px-3 py-2.5 text-right">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {oacList.map((item) => {
                    const isRowSelected = selC === item.id;

                    return (
                      <tr
                        key={item.id + item.date}
                        onClick={() => loadC(item)}
                        className={`cursor-pointer transition ${
                          isRowSelected
                            ? 'bg-[#d6eaf8] font-bold shadow-inner border-l-4 border-[#2E86C1]'
                            : 'hover:bg-[#d6eaf8]/60 even:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3.5 py-2 whitespace-nowrap">{item.date}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{item.race}</td>
                        <td className="px-3 py-2">{item.fournisseur}</td>
                        <td className="px-3 py-2 text-center font-semibold">{item.cartons}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {(item.recus || item.cartons * 360).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-rose-700">
                          {item.nbCasses}
                        </td>
                        <td className="px-3.5 py-2 text-center whitespace-nowrap font-bold text-sky-950">
                          {item.eclosion}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500 text-[11px]">
                          {item.id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'cycle' && role === 'comptable' && (
        <div className="bg-rose-100 text-rose-800 p-6 rounded-2xl border border-rose-200 text-center font-bold">
          Accès refusé à la gestion des OAC.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 2 : MIRAGE J+18 (Screenshot 2)
         ══════════════════════════════════════════════════════════════════════════ */}
      {tabActif === 1 && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-md border border-[#2e86c1]/20 overflow-hidden">
            {/* Blue Header Bar */}
            <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center gap-3 text-white">
              <span className="text-2xl">🔍</span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Mirage J+18</h2>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>📅</span>
                    <span>Date eclosion</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    placeholder="Sélectionnez une ligne..."
                    value={mDateAff}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm font-bold text-[#1B4F72] select-none"
                    style={{
                      background: 'linear-gradient(135deg, #eef2f7, #e8eef5)',
                      border: '2px solid #c8d5e0',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>⚪</span>
                    <span>Nbre OAC clairs</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder=""
                    value={mCla}
                    onChange={(e) => handleClairsInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1B4F72] mb-1.5 flex items-center gap-1.5">
                    <span>🐣</span>
                    <span>Nbre OAC fertiles (auto)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={mFer}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm font-bold text-[#1B4F72] select-none"
                    style={{
                      background: 'linear-gradient(135deg, #eef2f7, #e8eef5)',
                      border: '2px solid #c8d5e0',
                    }}
                  />
                  <div className="text-[11px] text-[#2E86C1] italic mt-1">= Incubes - Clairs</div>
                </div>
              </div>

              {/* Operator Notice */}
              {role !== 'admin' && (
                <div className="w-full text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-base">🛡️</span>
                  <span><strong>Mode Opérateur :</strong> La déclaration de mirage sera transmise à l'administrateur pour validation avant mise à jour du lot.</span>
                </div>
              )}

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: role === 'admin' 
                      ? 'linear-gradient(135deg, #1B4F72, #2E86C1)' 
                      : 'linear-gradient(135deg, #d97706, #f59e0b)',
                  }}
                >
                  <span>
                    {role === 'admin' 
                      ? '✔ ENREGISTRER DIRECTEMENT' 
                      : (activeCorrection && activeCorrection.type === 'Mirage' 
                          ? '📨 ENVOYER LE MIRAGE CORRIGÉ' 
                          : '📨 SOUMETTRE LE MIRAGE POUR VALIDATION')}
                  </span>
                </button>
                {role === 'admin' && (
                  <>
                    <button
                      type="button"
                      disabled={!isSelected}
                      onClick={handleSave}
                      className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition ${
                        isSelected
                          ? 'active:scale-95 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #1E8449, #27AE60)',
                      }}
                    >
                      ✎ MODIFIER
                    </button>
                    <button
                      type="button"
                      disabled={!isSelected}
                      onClick={handleDeleteClick}
                      className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition ${
                        isSelected
                          ? 'active:scale-95 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #922B21, #E74C3C)',
                      }}
                    >
                      🗑 SUPPRIMER
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={razM}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition cursor-pointer"
                >
                  ↺ ANNULER
                </button>
                <button
                  type="button"
                  onClick={onClose || razM}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#555] hover:bg-[#333] text-white border border-[#444] transition"
                >
                  ✕ FERMER
                </button>
              </div>
            </div>
          </div>

          {/* Table: Derniers mirages */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-[#1B4F72] border-b-2 border-[#d6eaf8] pb-1">
              Derniers mirages
            </h3>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">DATE ECLOSION</th>
                    <th className="px-3 py-2.5">RACE</th>
                    <th className="px-3 py-2.5">FOURNISSEUR</th>
                    <th className="px-3 py-2.5 text-center">INCUBES</th>
                    <th className="px-3 py-2.5 text-center">CLAIRS</th>
                    <th className="px-3 py-2.5 text-center">FERTILES</th>
                    <th className="px-3 py-2.5 text-right">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {oacList.map((item, idx) => {
                    const isRowSelected = selM === item.id;
                    const incubes = item.cubes || (item.cartons * 360 - item.nbCasses);
                    const fertiles = item.fertiles !== undefined && item.fertiles !== null ? item.fertiles : incubes;

                    return (
                      <tr
                        key={item.id + item.eclosion + idx}
                        onClick={() => loadM(item)}
                        className={`cursor-pointer transition ${
                          isRowSelected
                            ? 'bg-[#d6eaf8] font-bold shadow-inner border-l-4 border-[#2E86C1]'
                            : 'hover:bg-[#d6eaf8]/60 even:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3.5 py-2 font-bold whitespace-nowrap">{item.eclosion}</td>
                        <td className="px-3 py-2 font-normal italic text-slate-700">{item.race}</td>
                        <td className="px-3 py-2">{item.fournisseur}</td>
                        <td className="px-3 py-2 text-center font-medium">
                          {incubes ? incubes.toLocaleString('fr-FR') : ''}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-amber-700">
                          {item.clairs !== null && item.clairs !== undefined ? item.clairs : ''}
                        </td>
                        <td className="px-3 py-2 text-center font-extrabold text-emerald-800">
                          {fertiles ? fertiles.toLocaleString('fr-FR') : ''}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400 text-[11px]">
                          {item.id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 3 : ÉCLOSION J+21 (Screenshot 3)
         ══════════════════════════════════════════════════════════════════════════ */}
      {tabActif === 2 && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-md border border-[#2e86c1]/20 overflow-hidden">
            {/* Blue Header Bar */}
            <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center gap-3 text-white">
              <span className="text-2xl">🐳</span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Eclosion J+21</h2>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4">
              <div className="max-w-xs">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span>📅</span>
                  <span>Date eclosion</span>
                </label>
                <input
                  type="text"
                  readOnly
                  placeholder="Sélectionnez une éclosion..."
                  value={eDateAff}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm font-bold text-[#1B4F72] select-none"
                  style={{
                    background: 'linear-gradient(135deg, #eef2f7, #e8eef5)',
                    border: '2px solid #c8d5e0',
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>🍼</span>
                    <span>Nbre poussins commerciales</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder=""
                    value={eNes}
                    onChange={(e) => setENes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>💉</span>
                    <span>Poussins Hand (handicapes)</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder=""
                    value={eHan}
                    onChange={(e) => setEHan(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span>💀</span>
                    <span>Poussins morts</span>
                    <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder=""
                    value={eMor}
                    onChange={(e) => setEMor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    style={{
                      background: 'linear-gradient(135deg, #fef9e7, #fdf6e3)',
                      border: '2px solid #f39c12',
                    }}
                  />
                </div>
              </div>

              {/* Operator Notice */}
              {role !== 'admin' && (
                <div className="w-full text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-base">🛡️</span>
                  <span><strong>Mode Opérateur :</strong> La déclaration d'éclosion sera transmise à l'administrateur pour validation avant mise à jour du lot.</span>
                </div>
              )}

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: role === 'admin' 
                      ? 'linear-gradient(135deg, #1B4F72, #2E86C1)' 
                      : 'linear-gradient(135deg, #d97706, #f59e0b)',
                  }}
                >
                  <span>
                    {role === 'admin' 
                      ? '✔ ENREGISTRER DIRECTEMENT' 
                      : (activeCorrection && activeCorrection.type === 'Éclosion' 
                          ? '📨 ENVOYER L’ÉCLOSION CORRIGÉE' 
                          : '📨 SOUMETTRE L’ÉCLOSION POUR VALIDATION')}
                  </span>
                </button>
                {role === 'admin' && (
                  <>
                    <button
                      type="button"
                      disabled={!isSelected}
                      onClick={handleSave}
                      className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition ${
                        isSelected
                          ? 'active:scale-95 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #1E8449, #27AE60)',
                      }}
                    >
                      ✎ MODIFIER
                    </button>
                    <button
                      type="button"
                      disabled={!isSelected}
                      onClick={handleDeleteClick}
                      className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase text-white shadow-sm transition ${
                        isSelected
                          ? 'active:scale-95 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #922B21, #E74C3C)',
                      }}
                    >
                      🗑 SUPPRIMER
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={razE}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] transition cursor-pointer"
                >
                  ↺ ANNULER
                </button>
                <button
                  type="button"
                  onClick={onClose || razE}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase bg-[#555] hover:bg-[#333] text-white border border-[#444] transition"
                >
                  ✕ FERMER
                </button>
              </div>

              {/* Diagnostic Log Panel */}
              {tabActif === 2 && eId && (
                <div className="mt-6 bg-slate-900 text-emerald-400 p-4 rounded-xl text-[10px] font-mono border border-slate-700">
                  <div className="font-bold text-slate-300 mb-2">DEBUG: Éclosion JSON Payload Preview</div>
                  <pre className="overflow-x-auto">
                    {JSON.stringify({
                      ...(oacList.find((x) => x.id === eId) || {}),
                      commerciaux: parseInt(eNes) || 0,
                      nes: parseInt(eNes) || 0,
                      handicapes: parseInt(eHan) || 0,
                      morts: parseInt(eMor) || 0,
                      pourVente: Math.max(0, (parseInt(eNes) || 0) - Math.ceil((parseInt(eNes) || 0) * 0.02)),
                      complet: true,
                    }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Table: Dernieres eclosions */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-[#1B4F72] border-b-2 border-[#d6eaf8] pb-1">
              Dernieres eclosions
            </h3>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">DATE ECLOSION</th>
                    <th className="px-3 py-2.5">RACE</th>
                    <th className="px-3 py-2.5">FOURNISSEUR</th>
                    <th className="px-3 py-2.5 text-center">COMMERCIAUX</th>
                    <th className="px-3 py-2.5 text-center">POUR VENTE</th>
                    <th className="px-3 py-2.5 text-center">HAND.</th>
                    <th className="px-3 py-2.5 text-center">MORTS</th>
                    <th className="px-3 py-2.5 text-right">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {oacList.map((item, idx) => {
                    const isRowSelected = selE === item.id;

                    return (
                      <tr
                        key={item.id + item.eclosion + idx}
                        onClick={() => loadE(item)}
                        className={`cursor-pointer transition ${
                          isRowSelected
                            ? 'bg-[#d6eaf8] font-bold shadow-inner border-l-4 border-[#2E86C1]'
                            : 'hover:bg-[#d6eaf8]/60 even:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3.5 py-2 font-bold whitespace-nowrap">{item.eclosion}</td>
                        <td className="px-3 py-2 font-normal italic text-slate-700">{item.race}</td>
                        <td className="px-3 py-2">{item.fournisseur}</td>
                        <td className="px-3 py-2 text-center font-bold text-sky-950">
                          {item.commerciaux ? item.commerciaux.toLocaleString('fr-FR') : ''}
                        </td>
                        <td className="px-3 py-2 text-center font-black text-emerald-700">
                          {item.pourVente ? item.pourVente.toLocaleString('fr-FR') : ''}
                        </td>
                        <td className="px-3 py-2 text-center text-rose-600">
                          {item.handicapes !== null && item.handicapes !== undefined ? item.handicapes : ''}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-700">
                          {item.morts !== null && item.morts !== undefined ? item.morts : ''}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400 text-[11px]">
                          {item.id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          APPROVE / MODIFY / REJECT MODAL (Admin Validation)
         ══════════════════════════════════════════════════════════════════════════ */}
      {approveModalOpen && selectedSoumission && (() => {
        const sType = selectedSoumission.type;
        const targetId = sType === 'Commande' 
          ? approveIdChoisi 
          : (editDonnees.id || selectedSoumission.donnees?.id);
        const batch = oacList.find((x) => x.id === targetId);
        const cubes = batch?.cubes || ((batch?.cartons || 0) * 360 - (batch?.nbCasses || 0)) || 0;
        const fertilesOrigin = batch?.fertiles || cubes;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 my-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#1E8449] to-[#27AE60] text-white px-5 sm:px-6 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">✔</span>
                  <h3 className="font-bold text-base sm:text-lg">Validation Administrateur — {sType}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setApproveModalOpen(false)}
                  className="text-white/80 hover:text-white text-xl font-bold p-1 leading-none cursor-pointer"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>

              {/* In-Modal Rejection Form */}
              {showRejectFormInModal ? (
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-black text-rose-900 text-sm">
                      <span>🚨</span>
                      <span>Refuser la soumission pour correction</span>
                    </div>
                    <p className="text-rose-700 font-medium">
                      Cette action avertira l'opérateur avec une <strong>alerte sonore</strong> sur son téléphone. Il sera invité à corriger ses données et renvoyer la déclaration pour validation.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wide mb-1.5">
                      Motif du rejet (transmis à l'opérateur) <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      autoFocus
                      placeholder="Ex: Nombre d'œufs clairs supérieur aux œufs incubés, recomptez svp..."
                      value={modalRejectRaison}
                      onChange={(e) => setModalRejectRaison(e.target.value)}
                      className="w-full px-3.5 py-2.5 border-2 border-rose-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                    />
                  </div>

                  <div className="bg-slate-50 -mx-6 -mb-6 p-4 px-6 border-t border-slate-200 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowRejectFormInModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] cursor-pointer"
                    >
                      ← Revenir aux données
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRejectFromModal}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>✕</span>
                      <span>Confirmer le rejet et notifier</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Main Approval & Editing Form */
                <div className="p-5 sm:p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
                  {/* Summary Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Type :</span>
                      <span className="font-extrabold text-slate-900 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md uppercase text-[10px]">
                        {selectedSoumission.type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Date de soumission :</span>
                      <span className="font-bold text-slate-900">{selectedSoumission.dateSoumission}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Soumis par :</span>
                      <span className="font-bold text-slate-900">{selectedSoumission.soumisPar}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 font-semibold">Saisie initiale :</span>
                      <span className="font-bold text-slate-800 text-right">{selectedSoumission.resume}</span>
                    </div>
                  </div>

                  {/* ─────────────────────────────────────────────────────────────
                      TYPE 1: MIRAGE (Pas de sélection d'ID! Modif clairs/fertiles)
                     ───────────────────────────────────────────────────────────── */}
                  {sType === 'Mirage' && (() => {
                    const clairsVal = editDonnees.clairs !== undefined && editDonnees.clairs !== null ? editDonnees.clairs : '';
                    const clairsNum = Number(clairsVal || 0);
                    const fertilesRecalc = Math.max(0, cubes - clairsNum);
                    const fertilitePct = cubes > 0 ? ((fertilesRecalc / cubes) * 100).toFixed(1) : '0';

                    return (
                      <div className="space-y-3">
                        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="text-slate-500 font-semibold">Lot concerné :</span>
                            <span className="font-black text-slate-900 ml-1.5 font-mono text-sm">{targetId}</span>
                            {batch && <span className="text-slate-600 ml-2">({batch.type} - {batch.race})</span>}
                          </div>
                          <div className="font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg">
                            Œufs incubés : {cubes.toLocaleString('fr-FR')}
                          </div>
                        </div>

                        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                              <span>🥚</span>
                              <span>Nombre d'œufs clairs (modifiable)</span>
                              <span className="text-rose-600">*</span>
                            </label>
                            <span className="text-[11px] text-slate-500">
                              Initial : <strong>{selectedSoumission.donnees?.clairs ?? 0}</strong>
                            </span>
                          </div>

                          <input
                            type="number"
                            min="0"
                            max={cubes > 0 ? cubes : undefined}
                            value={clairsVal}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                              setEditDonnees({
                                ...editDonnees,
                                clairs: val,
                                fertiles: Math.max(0, cubes - Number(val || 0)),
                              });
                            }}
                            className="w-full px-4 py-2.5 bg-emerald-50/40 border-2 border-emerald-500 rounded-xl text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                            placeholder="0"
                          />

                          {/* Live Recalculated KPIs */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 flex flex-col">
                              <span className="text-emerald-700 font-bold text-[11px]">Œufs fertiles recalculés</span>
                              <span className="text-base font-black text-emerald-900 font-mono">
                                {fertilesRecalc.toLocaleString('fr-FR')}
                              </span>
                            </div>
                            <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100 flex flex-col">
                              <span className="text-sky-700 font-bold text-[11px]">Taux de fertilité</span>
                              <span className="text-base font-black text-sky-900 font-mono">
                                {fertilitePct}%
                              </span>
                            </div>
                          </div>

                          {clairsNum > cubes && cubes > 0 && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
                              <span>⚠️</span>
                              <span>Incohérence : Le nombre d'œufs clairs ({clairsNum}) dépasse le total incubé ({cubes}). Vous devriez modifier la valeur ou rejeter pour correction.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ─────────────────────────────────────────────────────────────
                      TYPE 2: ÉCLOSION (Pas de sélection d'ID! Modif poussins)
                     ───────────────────────────────────────────────────────────── */}
                  {sType === 'Éclosion' && (() => {
                    const commVal = editDonnees.commerciaux !== undefined && editDonnees.commerciaux !== null ? editDonnees.commerciaux : '';
                    const hanVal = editDonnees.handicapes !== undefined && editDonnees.handicapes !== null ? editDonnees.handicapes : '';
                    const morVal = editDonnees.morts !== undefined && editDonnees.morts !== null ? editDonnees.morts : '';
                    
                    const cNum = Number(commVal || 0);
                    const bonus = Math.ceil(cNum * 0.02);
                    const pourVente = Math.max(0, cNum - bonus);
                    const tauxInc = cubes > 0 ? ((cNum / cubes) * 100).toFixed(1) : '0';
                    const tauxFer = fertilesOrigin > 0 ? ((cNum / fertilesOrigin) * 100).toFixed(1) : '0';

                    return (
                      <div className="space-y-3">
                        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="text-slate-500 font-semibold">Lot concerné :</span>
                            <span className="font-black text-slate-900 ml-1.5 font-mono text-sm">{targetId}</span>
                            {batch && <span className="text-slate-600 ml-2">({batch.type} - {batch.race})</span>}
                          </div>
                          <div className="font-bold text-blue-900 bg-blue-100 px-2.5 py-1 rounded-lg">
                            Fertiles : {fertilesOrigin.toLocaleString('fr-FR')} • Incubés : {cubes.toLocaleString('fr-FR')}
                          </div>
                        </div>

                        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 space-y-3">
                          <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                            🐣 Données d'éclosion modifiables par l'administrateur
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">
                                Commerciaux <span className="text-rose-600">*</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={commVal}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                                  const num = Number(val || 0);
                                  const b = Math.ceil(num * 0.02);
                                  setEditDonnees({
                                    ...editDonnees,
                                    commerciaux: val,
                                    nes: val,
                                    pourVente: Math.max(0, num - b),
                                  });
                                }}
                                className="w-full px-3 py-2 bg-emerald-50/40 border-2 border-emerald-500 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">
                                Handicapés
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={hanVal}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                                  setEditDonnees({ ...editDonnees, handicapes: val });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">
                                Morts en coquille
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={morVal}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                                  setEditDonnees({ ...editDonnees, morts: val });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                placeholder="0"
                              />
                            </div>
                          </div>

                          {/* Live Recalculated KPIs */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                            <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100 flex flex-col">
                              <span className="text-emerald-700 font-bold text-[10px]">Bonus 2%</span>
                              <span className="text-sm font-black text-emerald-900 font-mono">{bonus}</span>
                            </div>
                            <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 flex flex-col">
                              <span className="text-blue-700 font-bold text-[10px]">Pour vente</span>
                              <span className="text-sm font-black text-blue-900 font-mono">{pourVente}</span>
                            </div>
                            <div className="bg-amber-50 p-2 rounded-xl border border-amber-100 flex flex-col">
                              <span className="text-amber-700 font-bold text-[10px]">Taux / fertiles</span>
                              <span className="text-sm font-black text-amber-900 font-mono">{tauxFer}%</span>
                            </div>
                            <div className="bg-slate-100 p-2 rounded-xl border border-slate-200 flex flex-col">
                              <span className="text-slate-600 font-bold text-[10px]">Taux / incubés</span>
                              <span className="text-sm font-black text-slate-800 font-mono">{tauxInc}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ─────────────────────────────────────────────────────────────
                      TYPE 3: COMMANDE (Choix ID + Modif paramètres de commande)
                     ───────────────────────────────────────────────────────────── */}
                  {sType === 'Commande' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          ID à attribuer (obligatoire) <span className="text-rose-600">*</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={approveIdChoisi}
                            onChange={(e) => {
                              setApproveIdChoisi(e.target.value);
                              setApproveIdError(false);
                            }}
                            className={`flex-1 px-3 py-2 border rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86C1] ${
                              approveIdChoisi ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-300'
                            }`}
                          >
                            <option value="">-- Choisir un ID disponible --</option>
                            <option value={selectedSoumission.donnees?.id || `OAC-2609-00${oacList.length + 1}`}>
                              {selectedSoumission.donnees?.id || `OAC-2609-00${oacList.length + 1}`} — Suggéré
                            </option>
                            <option value="OAC-2609-003">OAC-2609-003 — Disponible (Dépenses)</option>
                            <option value="OAC-2609-004">OAC-2609-004 — Disponible (Dépenses)</option>
                            <option value="OAC-2609-005">OAC-2609-005 — Disponible (Dépenses)</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Ou code personnalisé"
                            value={approveIdChoisi}
                            onChange={(e) => {
                              setApproveIdChoisi(e.target.value);
                              setApproveIdError(false);
                            }}
                            className="w-full sm:w-48 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        {approveIdError && (
                          <p className="text-xs text-rose-600 font-semibold mt-1 bg-rose-50 p-2 rounded-lg border border-rose-200">
                            Veuillez sélectionner ou renseigner un ID.
                          </p>
                        )}
                      </div>

                      <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 space-y-3">
                        <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                          📦 Données de commande modifiables
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">Type de poussin</label>
                            <select
                              value={editDonnees.type || 'Chairs'}
                              onChange={(e) => setEditDonnees({ ...editDonnees, type: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                            >
                              {TYPES_OAC.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">Race</label>
                            <select
                              value={editDonnees.race || 'Ross 308'}
                              onChange={(e) => setEditDonnees({ ...editDonnees, race: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                            >
                              {RACES_OAC.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">Fournisseur</label>
                            <select
                              value={editDonnees.fournisseur || 'Pak tavuk'}
                              onChange={(e) => setEditDonnees({ ...editDonnees, fournisseur: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                            >
                              {FOURNISSEURS_OAC.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">Nombre de cartons</label>
                            <input
                              type="number"
                              min="1"
                              value={editDonnees.cartons ?? ''}
                              onChange={(e) => setEditDonnees({ ...editDonnees, cartons: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">Œufs cassés</label>
                            <input
                              type="number"
                              min="0"
                              value={editDonnees.casses ?? ''}
                              onChange={(e) => setEditDonnees({ ...editDonnees, casses: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">Date d'incubation</label>
                            <input
                              type="date"
                              value={editDonnees.date || ''}
                              onChange={(e) => setEditDonnees({ ...editDonnees, date: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                            />
                          </div>
                        </div>

                        {/* Recalculated total */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div className="bg-slate-100 p-2 rounded-xl flex flex-col">
                            <span className="text-slate-600 font-semibold text-[10px]">Total reçus (cartons × 360)</span>
                            <span className="text-sm font-black text-slate-900 font-mono">
                              {((Number(editDonnees.cartons) || 0) * 360).toLocaleString('fr-FR')}
                            </span>
                          </div>
                          <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100 flex flex-col">
                            <span className="text-emerald-700 font-semibold text-[10px]">Œufs incubés (cubes)</span>
                            <span className="text-sm font-black text-emerald-900 font-mono">
                              {Math.max(0, ((Number(editDonnees.cartons) || 0) * 360) - (Number(editDonnees.casses) || 0)).toLocaleString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons in Modal */}
                  <div className="bg-slate-50 -mx-6 -mb-6 p-4 px-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={handleRejectFromApprove}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>✕</span>
                      <span>Refuser / Rejeter</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setApproveModalOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={confirmApprove}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#1E8449] to-[#27AE60] hover:from-[#186A3B] hover:to-[#229954] shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>✔</span>
                        <span>Confirmer l'approbation</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════════
          REJECT PROMPT MODAL (promptModal)
         ══════════════════════════════════════════════════════════════════════════ */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-[#2c3e50] to-[#34495e] text-white px-6 py-3.5 flex items-center gap-2">
              <span className="text-lg">✎</span>
              <h3 className="font-bold text-base">Saisie requise</h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Raison du rejet :</p>
              <input
                type="text"
                autoFocus
                placeholder="Indiquez la raison..."
                value={rejectRaison}
                onChange={(e) => setRejectRaison(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmReject();
                  if (e.key === 'Escape') setRejectModalOpen(false);
                }}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
              />
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e8eef5] text-slate-700 border border-[#c8d5e0]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmReject}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#1E8449] to-[#27AE60]"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          CONFIRM DELETE MODAL
         ══════════════════════════════════════════════════════════════════════════ */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-[#922B21] to-[#E74C3C] text-white px-6 py-3.5 flex items-center gap-2">
              <span className="text-lg">⚠</span>
              <h3 className="font-bold text-base">Confirmation</h3>
            </div>
            <div className="p-6">
              <p className="text-xs sm:text-sm text-slate-800">
                {deleteType === 'commande' && `Supprimer la commande ID : ${deleteTargetId} ?`}
                {deleteType === 'mirage' && `Supprimer les données de mirage pour ID : ${deleteTargetId} ?`}
                {deleteType === 'eclosion' && `Supprimer les données d'éclosion pour ID : ${deleteTargetId} ?`}
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
