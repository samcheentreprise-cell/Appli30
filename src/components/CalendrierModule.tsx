import React, { useMemo } from 'react';
import { OAC } from '../types';

interface CalendrierModuleProps {
  oacList: OAC[];
}

export const CalendrierModule: React.FC<CalendrierModuleProps> = ({ oacList }) => {
  const lotsEnCours = useMemo(() => {
    return oacList.map(item => ({
        date: item.date,
        desc: `${item.type} ${item.race} - ${item.id} - ${item.cartons} cartons`,
        detail: `Eclosion: ${item.eclosion}`,
        btnText: 'Gérer',
        dotColor: 'bg-amber-500',
        btnColor: 'bg-amber-600',
    }));
  }, [oacList]);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📅</div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Calendrier Opérationnel des Échéances (Mirage & Éclosion)</h2>
            <p className="text-xs text-slate-500">Suivi chronologique des lots : dates de mirage (J+18) et d'éclosion (J+21). Alerte sonore active à J-1.</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg text-xs font-bold border border-amber-200">⚠️ Alerte J-1 active</button>
            <button className="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-bold">Gérer OAC ❯</button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 uppercase font-bold text-slate-500">
                <tr>
                    <th className="px-4 py-3">LOT ID</th>
                    <th className="px-4 py-3">FOURNISSEUR & RACE</th>
                    <th className="px-4 py-3">CARTONS / ŒUFS</th>
                    <th className="px-4 py-3">DATE DE RÉCEPTION</th>
                    <th className="px-4 py-3">MIRAGE J+18 (PRÉVU)</th>
                    <th className="px-4 py-3">ÉCLOSION J+21 (PRÉVU)</th>
                    <th className="px-4 py-3">STATUT ACTUEL</th>
                </tr>
            </thead>
            <tbody>
                {oacList.length === 0 && (
                    <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 font-medium">Aucun lot enregistré dans le système.</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};
