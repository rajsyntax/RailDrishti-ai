import React, { useState, useEffect } from 'react';
import {
  Building2,
  Clock,
  RefreshCw,
  Volume2,
  Sparkles,
  ChevronDown,
  Layers
} from 'lucide-react';
import { CORRIDOR_STATIONS } from '../../services/railApi';
import { StationInfo } from './stationTypes';
import { EXTENDED_STATION_META, playRailwayAudioAnnouncement } from './stationUtils';

interface StationHeaderProps {
  selectedStation: string;
  stationMeta: StationInfo;
  onSelectStation: (code: string) => void;
  connectionStatus: 'connected' | 'reconnecting' | 'offline';
  freshnessSeconds: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const StationHeader: React.FC<StationHeaderProps> = ({
  selectedStation,
  stationMeta,
  onSelectStation,
  connectionStatus,
  freshnessSeconds,
  onRefresh,
  isRefreshing = false,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Live ticking clock in IST
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const formattedDate = currentTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handleTestAudio = () => {
    playRailwayAudioAnnouncement(
      '12952',
      'Mumbai Rajdhani Express',
      2,
      '22:11 IST',
      8,
      stationMeta.name
    );
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 sm:p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Station Identity & Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Station Operations
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Hub Console
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Prototype Mode
              </span>
            </div>

            {/* Station dropdown switcher */}
            <div className="relative mt-1.5 inline-block">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Selected Station:</span>
                <div className="relative">
                  <select
                    value={selectedStation}
                    onChange={(e) => onSelectStation(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-300/80 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer shadow-sm transition-all"
                  >
                    {CORRIDOR_STATIONS.map((st) => {
                      const ext = EXTENDED_STATION_META[st.code];
                      return (
                        <option key={st.code} value={st.code} className="text-slate-900 py-1">
                          {st.name} ({st.code}) • {ext?.platformCount ?? 4} Platforms • {ext?.zone ?? 'IR'}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-[11px] font-medium text-slate-600 border border-slate-200">
                  <Layers className="w-3 h-3 text-indigo-600" />
                  <span>{stationMeta.platformCount} Platforms</span>
                  <span className="text-slate-300">•</span>
                  <span>Zone {stationMeta.zone} ({stationMeta.division})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Telemetry, Clock & Operational Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Live Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white shadow-inner border border-slate-800">
            <div className="relative flex items-center justify-center">
              <span className={`w-2.5 h-2.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
              <span className={`absolute w-3.5 h-3.5 rounded-full animate-ping opacity-75 ${
                connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                {connectionStatus === 'connected' ? 'Live Telemetry' : 'Syncing'}
              </span>
              <span className="text-[9px] text-slate-400">
                Fresh: {freshnessSeconds}s ago
              </span>
            </div>
          </div>

          {/* Current Live Timestamp */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-800 shadow-sm">
            <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
            <div className="flex flex-col text-left font-mono">
              <span className="text-xs font-extrabold tracking-tight text-slate-900">
                {formattedTime} <span className="text-[10px] font-semibold text-slate-500">IST</span>
              </span>
              <span className="text-[9px] font-medium text-slate-500">
                {formattedDate}
              </span>
            </div>
          </div>

          {/* PA Audio Announcement Trigger */}
          <button
            onClick={handleTestAudio}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-all shadow-sm active:scale-95"
            title="Simulate station audio chime & bilingual passenger announcement"
          >
            <Volume2 className="w-4 h-4 text-indigo-600" />
            <span className="hidden md:inline">Play Station PA Chime</span>
            <span className="md:hidden">PA Chime</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all active:scale-95 disabled:opacity-50"
            title="Refresh Station Real-Time Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

      </div>
    </div>
  );
};
