import React, { useState } from 'react';
import { AlertCircle, Info, X } from 'lucide-react';

export const PrototypeBadge: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div 
        onClick={() => setShowModal(true)}
        className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all duration-150"
        title="Click to view SIH data simulation disclaimer"
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="hidden sm:inline">Prototype Mode (Simulated Data)</span>
        <span className="sm:hidden">Prototype</span>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-600 font-semibold text-lg">
                <Info className="w-5 h-5" />
                <span>Smart India Hackathon Prototype</span>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mt-4 text-sm text-slate-600 leading-relaxed bg-amber-50/70 p-3.5 rounded-lg border border-amber-200/60">
              <p className="font-medium text-amber-900 mb-1">Notice to Evaluators & Users:</p>
              <p className="italic">
                “Prototype mode — using simulated railway operational data. Production integration requires authorized Railway feeds.”
              </p>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              This system demonstrates dynamic machine-learning ETA prediction and explainability using synthetic track geometries, simulated GPS beacons, and realistic section congestion models.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-rail-navy text-white text-xs font-semibold rounded-lg hover:bg-blue-900 transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
