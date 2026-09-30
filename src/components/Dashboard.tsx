import React from 'react';
import { OAC, Depense, Client, Facture, UserRole } from '../types';
import { Egg, TrendingUp, TrendingDown, DollarSign, Calendar, AlertTriangle, Users, FileText, PlusCircle } from 'lucide-react';

interface DashboardProps {
  oacList: OAC[];
  depenses: Depense[];
  clients: Client[];
  factures: Facture[];
  role: UserRole;
  onNavigate: (tab: string) => void;
  onOpenNewOAC: () => void;
  onOpenNewVente?: () => void;
  onOpenNewFacture: () => void;
  onOpenNewDepense: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  oacList,
  depenses,
  clients,
  factures,
  role,
  onNavigate,
  onOpenNewOAC,
  onOpenNewVente,
  onOpenNewFacture,
  onOpenNewDepense,
}) => {
  // Calculations
  const totalOeufsRecus = oacList.reduce((acc, curr) => acc + (curr.recus || 0), 0);
  const totalCasses = oacList.reduce((acc, curr) => acc + (curr.nbCasses || 0), 0);
  const totalOeufsIncubes = totalOeufsRecus - totalCasses;

  const totalFacture = factures.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalEncaisse = factures
    .filter((f) => f.statut === 'Payée')
    .reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalCreances = totalFacture - totalEncaisse;

  const totalDepenses = depenses.reduce((acc, curr) => acc + (curr.montant || 0), 0);
  const soldeTresorerie = totalEncaisse - totalDepenses;

  // Format money in FCFA
  const fmtMoney = (val: number) => {
    return new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';
  };

  // Imminent hatches
  const lotsEnIncubation = oacList.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-br from-slate-900 to-sky-950 rounded-3xl p-6 text-white shadow-xl border border-sky-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wider uppercase">
            <span>🚀 Espace de pilotage</span>
            <span>•</span>
            <span>Rôle : {role}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Tableau de Bord Écloserie
          </h2>
          <p className="text-sky-200/80 text-sm mt-1 max-w-xl">
            Suivi en direct des approvisionnements en OAC, incubations, commandes clients, factures et balance financière.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onOpenNewOAC}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-md hover:shadow-amber-500/20 text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouveau Lot OAC</span>
          </button>
          <button
            onClick={onOpenNewVente || (() => onNavigate('ventes'))}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-[#1B4F72] hover:bg-[#21618C] text-white font-bold px-4 py-2.5 rounded-xl transition shadow-md text-sm border border-sky-400/30"
          >
            <DollarSign className="w-4 h-4 text-amber-300" />
            <span>Nouvelle Vente</span>
          </button>
          <button
            onClick={onOpenNewFacture}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2.5 rounded-xl transition shadow-md text-sm"
          >
            <FileText className="w-4 h-4" />
            <span>Facture</span>
          </button>
          <button
            onClick={onOpenNewDepense}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 font-bold px-4 py-2.5 rounded-xl transition text-sm"
          >
            <TrendingDown className="w-4 h-4" />
            <span>+ Dépense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: OAC en incubation */}
        <div 
          onClick={() => onNavigate('oac')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Œufs à Couver (OAC)</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition">
              <Egg className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {totalOeufsIncubes.toLocaleString('fr-FR')} <span className="text-sm font-semibold text-slate-500">œufs</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="text-emerald-600 font-semibold">{oacList.length} lots enregistrés</span>
            <span>•</span>
            <span className="text-rose-500">{totalCasses} casses ({((totalCasses / (totalOeufsRecus || 1)) * 100).toFixed(1)}%)</span>
          </div>
        </div>

        {/* Card 2: CA Facturé & Encaissé */}
        <div 
          onClick={() => onNavigate('ventes')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Chiffre d'Affaires</span>
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 group-hover:scale-110 transition">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 truncate">
            {fmtMoney(totalFacture)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-medium">
            <span className="text-emerald-600 font-semibold">Encaissé: {fmtMoney(totalEncaisse)}</span>
            <span className="text-amber-600">Dû: {fmtMoney(totalCreances)}</span>
          </div>
        </div>

        {/* Card 3: Dépenses Totales */}
        <div 
          onClick={() => onNavigate('depenses')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Dépenses</span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 group-hover:scale-110 transition">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 truncate">
            {fmtMoney(totalDepenses)}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Approvisionnements & Charges ({depenses.length} opérations)
          </div>
        </div>

        {/* Card 4: Clients & Partenaires */}
        <div 
          onClick={() => onNavigate('clients')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Portefeuille Clients</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {clients.length} <span className="text-sm font-semibold text-slate-500">éleveurs</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Régions: Bamako, Koutiala, Sikasso, Yanfoila
          </div>
        </div>
      </div>

      {/* Two Column Layout: Imminent Hatches & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Hatches (Éclosions programmées) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Lots OAC & Éclosions Programmées</h3>
            </div>
            <button
              onClick={() => onNavigate('oac')}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700"
            >
              Voir tous les lots ({oacList.length}) →
            </button>
          </div>

          <div className="space-y-3">
            {lotsEnIncubation.map((oac) => (
              <div
                key={oac.id}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 font-black text-xs flex items-center justify-center">
                    {oac.cartons} ctn
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{oac.id}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold">
                        {oac.race}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Fournisseur: <strong className="text-slate-700">{oac.fournisseur}</strong> • Reçus: {(oac.recus || 0).toLocaleString()} œufs
                    </div>
                  </div>
                </div>

                <div className="text-right w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between">
                  <div className="text-xs text-slate-500">Éclosion prévue :</div>
                  <div className="text-sm font-extrabold text-sky-900 bg-sky-100/70 px-2.5 py-0.5 rounded-md">
                    {oac.eclosion}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Invoices & Balances */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Factures Récentes & Ventes</h3>
            </div>
            <button
              onClick={() => onNavigate('factures')}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700"
            >
              Gérer factures ({factures.length}) →
            </button>
          </div>

          <div className="space-y-3">
            {factures.slice(0, 4).map((f) => (
              <div
                key={f.numero}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition border border-slate-200/80 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{f.numero}</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        f.statut === 'Payée'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {f.statut}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Client: <strong className="text-slate-800">{f.client}</strong> ({f.ville || 'Mali'})
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-slate-900 text-sm">
                    {fmtMoney(f.total)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {f.date ? `Date: ${f.date.slice(0, 10)}` : 'Non datée'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
