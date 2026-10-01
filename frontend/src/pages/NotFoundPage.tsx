import React from 'react';
import { Link } from 'react-router-dom';
import { Train, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
        <Train className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-[#0B1F3A]">Station Not Found (404)</h1>
      <p className="text-sm text-slate-500 max-w-md">
        The track or route you requested doesn't exist in our current network topology.
      </p>
      <Link
        to="/passenger"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rail-navy text-white text-xs font-semibold hover:bg-blue-900 transition-colors shadow-md"
      >
        <Home className="w-4 h-4" />
        <span>Return to Passenger Portal</span>
      </Link>
    </div>
  );
};
