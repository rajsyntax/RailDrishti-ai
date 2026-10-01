import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#0B1F3A] text-slate-400 text-xs border-t border-slate-800 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">RailDrishti AI</span>
            <span>•</span>
            <span>Smart India Hackathon Innovation</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-teal-400">
              <Cpu className="w-3.5 h-3.5" />
              <span>LightGBM + Explainable AI Active</span>
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>PostGIS Spatial Simulation</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-500 text-center md:text-right">
            Prototype mode — Simulated Railway Data
          </div>

        </div>
      </div>
    </footer>
  );
};
