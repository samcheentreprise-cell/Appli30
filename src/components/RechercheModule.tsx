import React, { useState, useMemo } from 'react';
import { Depense, Vente, Client } from '../types';
import { PRODUITS_PRIX } from '../data/initialData';

interface RechercheModuleProps {
  depenses: Depense[];
  ventes: Vente[];
  clients: Client[];
  onClose?: () => void;
}

export const RechercheModule: React.FC<RechercheModuleProps> = ({
  depenses,
  ventes,
  clients,
  onClose,
}) => {
  // Active Tab: 'depenses' | 'ventes'
  const [activeTab, setActiveTab] = useState<'depenses' | 'ventes'>('depenses');

  // Notification message
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ══════════════════════════════════════════════════════════════════════════
  // DÉPENSES FILTERS
  // ══════════════════════════════════════════════════════════════════════════
  const [dDateDebut, setDDateDebut] = useState('');
  const [dDateFin, setDDateFin] = useState('');
  const [dCategorie, setDCategorie] = useState('');
  const [dSousCategorie, setDSousCategorie] = useState('');
  const [dSource, setDSource] = useState('');
  const [dRechercheLibre, setDRechercheLibre] = useState('');

  // ══════════════════════════════════════════════════════════════════════════
  // VENTES FILTERS
  // ══════════════════════════════════════════════════════════════════════════
  const [vDateDebut, setVDateDebut] = useState('');
  const [vDateFin, setVDateFin] = useState('');
  const [vClient, setVClient] = useState('');
  const [vProduit, setVProduit] = useState('');
  const [vTypeVente, setVTypeVente] = useState('');
  const [vStatutPaiement, setVStatutPaiement] = useState('');

  // Search execution trigger state (null if not yet searched)
  const [hasSearched, setHasSearched] = useState(false);
  const [resultsDepenses, setResultsDepenses] = useState<Depense[]>([]);
  const [resultsVentes, setResultsVentes] = useState<Vente[]>([]);

  // Toast message helper
  const showToast = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  // Format currency helper
  const fmt = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n)) return '--';
    return Number(n).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Helper date parsing (DD/MM/YYYY)
  const parseDateFR = (str: string | undefined): Date | null => {
    if (!str) return null;
    const p = str.split('/');
    if (p.length !== 3) return null;
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  };

  const dateInRange = (dateStr: string, du: string, au: string) => {
    if (!du && !au) return true;
    const d = parseDateFR(dateStr);
    if (!d) return false;
    if (du) {
      const dd = new Date(du);
      dd.setHours(0, 0, 0, 0);
      if (d < dd) return false;
    }
    if (au) {
      const df = new Date(au);
      df.setHours(23, 59, 59, 999);
      if (d > df) return false;
    }
    return true;
  };

  // Dynamic filter reference lists
  const categoriesList = useMemo(() => {
    const s = new Set<string>();
    depenses.forEach((d) => {
      if (d.categorie) s.add(d.categorie);
    });
    return Array.from(s);
  }, [depenses]);

  const sousCategoriesList = useMemo(() => {
    const s = new Set<string>();
    depenses.forEach((d) => {
      if (!dCategorie || d.categorie === dCategorie) {
        if (d.sousCategorie) s.add(d.sousCategorie);
      }
    });
    return Array.from(s);
  }, [depenses, dCategorie]);

  const sourcesList = useMemo(() => {
    const s = new Set<string>();
    depenses.forEach((d) => {
      if (d.sourcePaiement) s.add(d.sourcePaiement);
    });
    return Array.from(s);
  }, [depenses]);

  const clientsList = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => {
      if (c.label) s.add(c.label);
    });
    ventes.forEach((v) => {
      if (v.client) s.add(v.client);
    });
    return Array.from(s);
  }, [clients, ventes]);

  const produitsList = useMemo(() => {
    const s = new Set<string>();
    PRODUITS_PRIX.forEach((p) => s.add(p.nom));
    ventes.forEach((v) => {
      if (v.produit) s.add(v.produit);
    });
    return Array.from(s);
  }, [ventes]);

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════════════════════
  const handleRechercher = () => {
    setHasSearched(true);

    if (activeTab === 'depenses') {
      const filtered = depenses.filter((r) => {
        if (!dateInRange(r.date, dDateDebut, dDateFin)) return false;
        if (dCategorie && r.categorie !== dCategorie) return false;
        if (dSousCategorie && r.sousCategorie !== dSousCategorie) return false;
        if (dSource && r.sourcePaiement !== dSource) return false;
        if (dRechercheLibre) {
          const txt = [
            r.libelle,
            r.numPiece,
            r.idCommande,
            r.categorie,
            r.sousCategorie,
            r.sourcePaiement,
          ]
            .join(' ')
            .toLowerCase();
          if (!txt.includes(dRechercheLibre.toLowerCase().trim())) return false;
        }
        return true;
      });
      setResultsDepenses(filtered);
      showToast(`${filtered.length} dépense(s) trouvée(s)`, true);
    } else {
      const filtered = ventes.filter((r) => {
        if (!dateInRange(r.date, vDateDebut, vDateFin)) return false;
        if (vClient && r.client !== vClient) return false;
        if (vProduit && r.produit !== vProduit) return false;
        if (vTypeVente && r.typeVente !== vTypeVente) return false;
        if (vStatutPaiement && r.statutPaiement !== vStatutPaiement) return false;
        return true;
      });
      setResultsVentes(filtered);
      showToast(`${filtered.length} vente(s) trouvée(s)`, true);
    }
  };

  const handleReinitialiser = () => {
    setDDateDebut('');
    setDDateFin('');
    setDCategorie('');
    setDSousCategorie('');
    setDSource('');
    setDRechercheLibre('');

    setVDateDebut('');
    setVDateFin('');
    setVClient('');
    setVProduit('');
    setVTypeVente('');
    setVStatutPaiement('');

    setHasSearched(false);
    setResultsDepenses([]);
    setResultsVentes([]);
  };

  // Switch tabs
  const handleSwitchTab = (tab: 'depenses' | 'ventes') => {
    setActiveTab(tab);
    setHasSearched(false);
  };

  // Current active result list
  const currentResults = activeTab === 'depenses' ? resultsDepenses : resultsVentes;

  // KPI Calculations
  const kpis = useMemo(() => {
    if (!hasSearched) {
      return { count: 0, total: 0, moyen: 0, max: 0 };
    }

    const count = currentResults.length;
    let total = 0;
    let max = 0;

    currentResults.forEach((item: any) => {
      const m = item.montant || 0;
      total += m;
      if (m > max) max = m;
    });

    const moyen = count > 0 ? Math.round(total / count) : 0;

    return { count, total, moyen, max };
  }, [hasSearched, currentResults]);

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (!hasSearched || currentResults.length === 0) {
      showToast('Aucune donnée à exporter.', false);
      return;
    }

    let csvContent = '\uFEFF'; // BOM for UTF-8 in Excel

    if (activeTab === 'depenses') {
      csvContent += 'N°;Date;Catégorie;Sous-catégorie;Montant;Source;Libellé;N° Pièce;ID Commande\n';
      resultsDepenses.forEach((d, idx) => {
        csvContent += `${idx + 1};${d.date};${d.categorie};${d.sousCategorie};${d.montant};${d.sourcePaiement};${d.libelle};${d.numPiece || ''};${d.idCommande || ''}\n`;
      });
    } else {
      csvContent += 'N°;Date;Client;Produit;Quantité;P.U.;Montant;Statut;Avance;Reliquat;Type\n';
      resultsVentes.forEach((v, idx) => {
        csvContent += `${idx + 1};${v.date};${v.client};${v.produit};${v.quantite};${v.prixUnitaire};${v.montant};${v.statutPaiement};${v.avance};${v.reliquat};${v.typeVente}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Rapport_SAMCHE_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Fichier exporté avec succès !', true);
  };

  // Export to PDF / Print
  const handleExportPDF = () => {
    if (!hasSearched || currentResults.length === 0) {
      showToast('Aucune donnée à exporter.', false);
      return;
    }
    window.print();
  };

  return (
    <div className="bg-[#eef2f7] min-h-[85vh] rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col font-sans animate-fade-in text-xs sm:text-sm">
      {/* ══════════════════════════════════════════════════════════════════════════
          HEADER BAR (Screenshot 1 & 2)
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-[#1B4F72] via-[#21618C] to-[#2E86C1] px-6 py-4 flex items-center justify-between text-white flex-shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔍</span>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">Recherche &amp; Rapports</h1>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center text-white hover:bg-white/20 transition font-bold leading-none"
            title="Fermer la boîte de dialogue"
          >
            ✕
          </button>
        )}
      </div>

      {/* Toast Alert */}
      {msg && (
        <div
          className={`py-2 px-4 text-center font-bold text-xs shadow-sm transition ${
            msg.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {msg.ok ? '✅ ' : '⚠️ '}
          {msg.text}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MAIN BODY CONTAINER
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
        {/* Tabs: Dépenses / Ventes */}
        <div className="flex border-b-[3px] border-[#2E86C1] gap-1">
          <button
            type="button"
            onClick={() => handleSwitchTab('depenses')}
            className={`px-6 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm tracking-wide transition flex items-center gap-2 ${
              activeTab === 'depenses'
                ? 'bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white shadow-md -mb-[3px]'
                : 'bg-[#e8eef5] text-slate-700 hover:bg-[#d6eaf8]'
            }`}
          >
            <span>💰</span>
            <span>Dépenses</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('ventes')}
            className={`px-6 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm tracking-wide transition flex items-center gap-2 ${
              activeTab === 'ventes'
                ? 'bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white shadow-md -mb-[3px]'
                : 'bg-[#e8eef5] text-slate-700 hover:bg-[#d6eaf8]'
            }`}
          >
            <span>🛒</span>
            <span>Ventes</span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            CARD: CRITÈRES DE RECHERCHE
           ══════════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="border-b-2 border-[#d6eaf8] pb-2">
            <h2 className="text-[#1B4F72] font-bold text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2">
              <span>⚙</span>
              <span>Critères de recherche</span>
            </h2>
          </div>

          {/* Form Fields: Dépenses */}
          {activeTab === 'depenses' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  DATE DÉBUT
                </label>
                <input
                  type="date"
                  value={dDateDebut}
                  onChange={(e) => setDDateDebut(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  DATE FIN
                </label>
                <input
                  type="date"
                  value={dDateFin}
                  onChange={(e) => setDDateFin(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  CATÉGORIE
                </label>
                <select
                  value={dCategorie}
                  onChange={(e) => {
                    setDCategorie(e.target.value);
                    setDSousCategorie('');
                  }}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                >
                  <option value="">-- Toutes --</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  SOUS-CATÉGORIE
                </label>
                <select
                  value={dSousCategorie}
                  onChange={(e) => setDSousCategorie(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                >
                  <option value="">-- Toutes --</option>
                  {sousCategoriesList.map((sc) => (
                    <option key={sc} value={sc}>
                      {sc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  SOURCE DE PAIEMENT
                </label>
                <select
                  value={dSource}
                  onChange={(e) => setDSource(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                >
                  <option value="">-- Toutes --</option>
                  {sourcesList.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  RECHERCHE LIBRE
                </label>
                <input
                  type="text"
                  placeholder="Libellé, N° pièce, ID..."
                  value={dRechercheLibre}
                  onChange={(e) => setDRechercheLibre(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* Form Fields: Ventes */}
          {activeTab === 'ventes' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  DATE DÉBUT
                </label>
                <input
                  type="date"
                  value={vDateDebut}
                  onChange={(e) => setVDateDebut(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  DATE FIN
                </label>
                <input
                  type="date"
                  value={vDateFin}
                  onChange={(e) => setVDateFin(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  CLIENT
                </label>
                <select
                  value={vClient}
                  onChange={(e) => setVClient(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                >
                  <option value="">-- Tous --</option>
                  {clientsList.map((cl) => (
                    <option key={cl} value={cl}>
                      {cl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  PRODUIT
                </label>
                <select
                  value={vProduit}
                  onChange={(e) => setVProduit(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                >
                  <option value="">-- Tous --</option>
                  {produitsList.map((pr) => (
                    <option key={pr} value={pr}>
                      {pr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  TYPE DE VENTE
                </label>
                <select
                  value={vTypeVente}
                  onChange={(e) => setVTypeVente(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                >
                  <option value="">-- Tous --</option>
                  <option value="Poussins couvoir">Poussins couvoir</option>
                  <option value="Autre produit">Autre produit</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  STATUT PAIEMENT
                </label>
                <select
                  value={vStatutPaiement}
                  onChange={(e) => setVStatutPaiement(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs bg-[#fafbfc] focus:outline-none focus:border-[#2E86C1] focus:bg-white"
                >
                  <option value="">-- Tous --</option>
                  <option value="Payee">Payée</option>
                  <option value="Avance">Avance</option>
                  <option value="Non payee">Non payée</option>
                </select>
              </div>
            </div>
          )}

          {/* Action Buttons Row (Screenshots 1 & 2) */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleRechercher}
              className="px-5 py-2.5 bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] hover:from-[#154360] hover:to-[#2471A3] text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition active:scale-95"
            >
              <span>🔍</span>
              <span>Rechercher</span>
            </button>

            <button
              type="button"
              onClick={handleReinitialiser}
              className="px-5 py-2.5 bg-[#e8eef5] hover:bg-[#d5dde8] text-[#2c3e50] border border-[#c8d5e0] rounded-lg font-bold text-xs uppercase tracking-wider transition active:scale-95 flex items-center gap-1.5"
            >
              <span>↺</span>
              <span>Réinitialiser</span>
            </button>

            <div className="flex-1 hidden sm:block" />

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!hasSearched || currentResults.length === 0}
              className="px-4 py-2.5 bg-gradient-to-r from-[#1E8449] to-[#27AE60] hover:from-[#186A3B] hover:to-[#229954] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition active:scale-95"
            >
              <span>📊</span>
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={!hasSearched || currentResults.length === 0}
              className="px-4 py-2.5 bg-gradient-to-r from-[#6C3483] to-[#8E44AD] hover:from-[#5B2C6F] hover:to-[#7D3C98] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition active:scale-95"
            >
              <span>📄</span>
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose || handleReinitialiser}
              className="px-4 py-2.5 bg-[#555] hover:bg-[#333] text-white border border-[#444] rounded-lg font-bold text-xs uppercase tracking-wider transition active:scale-95 flex items-center gap-1.5"
            >
              <span>✕</span>
              <span>Fermer</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            4 KPI CARDS (Enregistrements, Montant total, Montant moyen, Montant max)
           ══════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-[#f8fafb] to-[#eef2f7] border border-[#d5dde5] rounded-xl p-3.5 text-center shadow-xs">
            <div className="text-xl sm:text-2xl font-black text-[#1B4F72] tabular-nums">
              {kpis.count}
            </div>
            <div className="text-[10px] uppercase font-bold text-[#7f8c8d] tracking-wider mt-0.5">
              ENREGISTREMENTS
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#f8fafb] to-[#eef2f7] border border-[#d5dde5] rounded-xl p-3.5 text-center shadow-xs">
            <div className="text-xl sm:text-2xl font-black text-[#1B4F72] tabular-nums">
              {fmt(kpis.total)}
            </div>
            <div className="text-[10px] uppercase font-bold text-[#7f8c8d] tracking-wider mt-0.5">
              MONTANT TOTAL
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#f8fafb] to-[#eef2f7] border border-[#d5dde5] rounded-xl p-3.5 text-center shadow-xs">
            <div className="text-xl sm:text-2xl font-black text-[#1B4F72] tabular-nums">
              {fmt(kpis.moyen)}
            </div>
            <div className="text-[10px] uppercase font-bold text-[#7f8c8d] tracking-wider mt-0.5">
              MONTANT MOYEN
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#f8fafb] to-[#eef2f7] border border-[#d5dde5] rounded-xl p-3.5 text-center shadow-xs">
            <div className="text-xl sm:text-2xl font-black text-[#1B4F72] tabular-nums">
              {fmt(kpis.max)}
            </div>
            <div className="text-[10px] uppercase font-bold text-[#7f8c8d] tracking-wider mt-0.5">
              MONTANT MAX
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            CARD: RÉSULTATS
           ══════════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-3">
          <div className="border-b-2 border-[#d6eaf8] pb-2">
            <h2 className="text-[#1B4F72] font-bold text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2">
              <span>📋</span>
              <span>Résultats</span>
            </h2>
          </div>

          {!hasSearched ? (
            <div className="py-8 text-center text-xs text-slate-400 font-medium italic">
              Aucune donnée chargée
            </div>
          ) : currentResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-medium">
              Aucun résultat ne correspond à vos critères de recherche.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto max-h-[350px] border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] text-white text-[11px] font-semibold uppercase tracking-wider">
                      {activeTab === 'depenses' ? (
                        <>
                          <th className="py-2.5 px-3 text-center w-10">N°</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Catégorie</th>
                          <th className="py-2.5 px-3">Sous-catégorie</th>
                          <th className="py-2.5 px-3 text-right">Montant</th>
                          <th className="py-2.5 px-3">Source</th>
                          <th className="py-2.5 px-3">Libellé</th>
                          <th className="py-2.5 px-3">N° Pièce</th>
                          <th className="py-2.5 px-3">ID Commande</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2.5 px-3 text-center w-10">N°</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Client</th>
                          <th className="py-2.5 px-3">Produit</th>
                          <th className="py-2.5 px-3 text-right">Quantité</th>
                          <th className="py-2.5 px-3 text-right">P.U.</th>
                          <th className="py-2.5 px-3 text-right">Montant</th>
                          <th className="py-2.5 px-3 text-center">Statut</th>
                          <th className="py-2.5 px-3 text-right">Avance</th>
                          <th className="py-2.5 px-3 text-right">Reliquat</th>
                          <th className="py-2.5 px-3">Type</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeTab === 'depenses'
                      ? resultsDepenses.map((d, i) => (
                          <tr key={i} className="hover:bg-[#d6eaf8]/40 transition">
                            <td className="py-2 px-3 text-center text-slate-400 font-bold">
                              {i + 1}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">
                              {d.date}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d6eaf8] text-[#1B4F72]">
                                {d.categorie}
                              </span>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-slate-700">
                              {d.sousCategorie}
                            </td>
                            <td className="py-2 px-3 text-right font-extrabold text-[#1B4F72] tabular-nums whitespace-nowrap">
                              {fmt(d.montant)} F
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d6eaf8] text-[#1B4F72]">
                                {d.sourcePaiement}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-800 max-w-xs truncate">
                              {d.libelle}
                            </td>
                            <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                              {d.numPiece || '--'}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {d.idCommande || '--'}
                            </td>
                          </tr>
                        ))
                      : resultsVentes.map((v, i) => (
                          <tr key={i} className="hover:bg-[#d6eaf8]/40 transition">
                            <td className="py-2 px-3 text-center text-slate-400 font-bold">
                              {i + 1}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">
                              {v.date}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-900">
                              {v.client}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-slate-700">
                              {v.produit}
                            </td>
                            <td className="py-2 px-3 text-right font-medium tabular-nums">
                              {fmt(v.quantite)}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                              {fmt(v.prixUnitaire)}
                            </td>
                            <td className="py-2 px-3 text-right font-extrabold text-[#1B4F72] tabular-nums whitespace-nowrap">
                              {fmt(v.montant)} F
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  v.statutPaiement === 'Payee'
                                    ? 'bg-[#d5f5e3] text-[#1e8449]'
                                    : v.statutPaiement === 'Avance'
                                    ? 'bg-[#fdebd0] text-[#b9770e]'
                                    : 'bg-[#fadbd8] text-[#c0392b]'
                                }`}
                              >
                                {v.statutPaiement === 'Payee'
                                  ? 'Payée'
                                  : v.statutPaiement === 'Avance'
                                  ? 'Avance'
                                  : 'Non payée'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-700 tabular-nums font-semibold">
                              {fmt(v.avance)}
                            </td>
                            <td className="py-2 px-3 text-right text-rose-700 tabular-nums font-semibold">
                              {fmt(v.reliquat)}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  v.typeVente === 'Poussins couvoir'
                                    ? 'bg-[#d5f5e3] text-[#1e8449]'
                                    : 'bg-[#d6eaf8] text-[#1B4F72]'
                                }`}
                              >
                                {v.typeVente === 'Poussins couvoir' ? 'Poussins' : 'Autre'}
                              </span>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-slate-500 italic pt-1">
                {activeTab === 'depenses'
                  ? `${resultsDepenses.length} dépense(s) trouvée(s)`
                  : `${resultsVentes.length} vente(s) trouvée(s)`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
