import React from 'react';

// Tableau du coût par poussin, sans amortissement des équipements.
// Reçoit les lots au format du module Coût & Rentabilité.
export interface LigneCoutPoussin {
  id: string;
  coutDirect: number;        // achat œufs + transport + dédouanement
  coutIndirect: number;      // frais de fonctionnement (sans amortissement)
  coutParPoussin: number;    // FCFA par poussin vendable
  pourVente: number;         // poussins vendables
  poussinsVendus?: number;   // après bonus client 2 %
  valeurVente: number;       // chiffre d'affaires
  margeNette: number;
  pctMarge: number;
}

interface Props {
  lots: LigneCoutPoussin[];
  fmtN: (n: number | undefined | null) => string;
  fmtFCFA: (n: number | undefined | null) => string;
}

export const TableauCoutPoussin: React.FC<Props> = ({ lots, fmtN, fmtFCFA }) => {
  if (lots.length === 0) return null;

  const tot = lots.reduce(
    (a, l) => ({
      direct: a.direct + l.coutDirect,
      indirect: a.indirect + l.coutIndirect,
      vendables: a.vendables + l.pourVente,
      vendus: a.vendus + (l.poussinsVendus ?? l.pourVente),
      ca: a.ca + l.valeurVente,
      marge: a.marge + l.margeNette,
    }),
    { direct: 0, indirect: 0, vendables: 0, vendus: 0, ca: 0, marge: 0 }
  );
  const coutTotal = tot.direct + tot.indirect;
  const coutUnitaireMoyen = tot.vendables > 0 ? Math.round(coutTotal / tot.vendables) : 0;
  const pctTotal = tot.ca > 0 ? Math.round((tot.marge / tot.ca) * 1000) / 10 : 0;

  return (
    <div className="bg-[#1a1f36] rounded-xl p-4 sm:p-5 shadow-lg border border-white/5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/5">
        <div className="w-[3px] h-[18px] bg-[#38bdf8] rounded" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">
          Coût du poussin par lot (sans amortissement)
        </h2>
      </div>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left text-xs text-[#E2E8F0]">
          <thead className="text-[10px] text-[#94A3B8] uppercase">
            <tr>
              <th className="py-2 px-2">Lot</th>
              <th className="py-2 px-2 text-right">Œufs + transport</th>
              <th className="py-2 px-2 text-right">Frais</th>
              <th className="py-2 px-2 text-right">Coût / poussin</th>
              <th className="py-2 px-2 text-right">Vendables</th>
              <th className="py-2 px-2 text-right">Vendus (−2 %)</th>
              <th className="py-2 px-2 text-right">Chiffre d'affaires</th>
              <th className="py-2 px-2 text-right">Marge nette</th>
              <th className="py-2 px-2 text-right">Taux</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l) => (
              <tr key={l.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="py-2 px-2 font-mono">{l.id}</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmtN(l.coutDirect)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmtN(l.coutIndirect)}</td>
                <td className="py-2 px-2 text-right tabular-nums font-bold text-sky-300">
                  {l.coutDirect > 0 ? fmtFCFA(l.coutParPoussin) : '--'}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{fmtN(l.pourVente)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmtN(l.poussinsVendus ?? l.pourVente)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmtFCFA(l.valeurVente)}</td>
                <td className={`py-2 px-2 text-right tabular-nums font-bold ${l.margeNette >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {fmtFCFA(l.margeNette)}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{l.pctMarge.toFixed(1)} %</td>
              </tr>
            ))}
            <tr className="border-t-2 border-white/20 font-bold bg-white/[0.02]">
              <td className="py-2 px-2">Total</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtN(tot.direct)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtN(tot.indirect)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-sky-300">{fmtFCFA(coutUnitaireMoyen)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtN(tot.vendables)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtN(tot.vendus)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtFCFA(tot.ca)}</td>
              <td className={`py-2 px-2 text-right tabular-nums ${tot.marge >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtFCFA(tot.marge)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{pctTotal.toFixed(1)} %</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
