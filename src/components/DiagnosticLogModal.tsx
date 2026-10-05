import React from 'react';

interface DiagnosticLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: any[];
}

export const DiagnosticLogModal: React.FC<DiagnosticLogModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg">Dernières requêtes OAC</h3>
          <button onClick={onClose} className="text-white hover:text-slate-200 font-bold">✕</button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto font-mono text-xs text-slate-700 bg-slate-50">
          {logs.length === 0 && <p className="text-center italic">Aucun log disponible.</p>}
          {logs.map((log, i) => (
            <div key={i} className="mb-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
              <p className="font-bold mb-1 text-slate-500 border-b pb-1">{log.timestamp}</p>
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(log, null, 2)}</pre>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-slate-100 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-xs hover:bg-slate-700">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
