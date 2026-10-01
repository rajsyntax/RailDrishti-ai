import React from 'react';
import { Activity } from 'lucide-react';

export const LiveStatusBadge: React.FC = () => {
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-700 text-xs font-semibold">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
      </span>
      <span className="flex items-center gap-1 font-mono uppercase tracking-wider text-[11px]">
        <Activity className="w-3 h-3 text-teal-600 hidden sm:inline" />
        LIVE SIMULATOR
      </span>
    </div>
  );
};
