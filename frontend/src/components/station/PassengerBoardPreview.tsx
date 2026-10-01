import React, { useState, useEffect } from 'react';
import {
  Tv,
  Volume2,
  Languages
} from 'lucide-react';
import { StationArrivalData, StationInfo } from './stationTypes';
import { playRailwayAudioAnnouncement } from './stationUtils';

interface PassengerBoardPreviewProps {
  arrivals: StationArrivalData[];
  stationMeta: StationInfo;
  selectedTrainId: string | null;
  onSelectTrain: (trainId: string) => void;
}

export const PassengerBoardPreview: React.FC<PassengerBoardPreviewProps> = ({
  arrivals,
  stationMeta,
  selectedTrainId,
  onSelectTrain,
}) => {
  const [boardTime, setBoardTime] = useState<string>('');
  const [tickerIndex, setTickerIndex] = useState<number>(0);
  const [langMode, setLangMode] = useState<'EN' | 'HI'>('EN');

  useEffect(() => {
    const updateTime = () => {
      setBoardTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cycle public board ticker message
  const tickerMessages = [
    `WELCOME TO ${stationMeta.name.toUpperCase()} (${stationMeta.code}) • LIVE ARRIVAL INFORMATION POWERED BY RAILDRISHTI AI`,
    `PASSENGERS ARE REQUESTED TO VERIFY PLATFORM ASSIGNMENTS BEFORE BOARDING`,
    `FOR WHEELCHAIR & BATTERY CAR ASSISTANCE, CONTACT STATION MANAGER DESK AT PF 1`,
    `DYNAMIC ETA PREDICTIONS REFRESH AUTOMATICALLY AS TRAIN SENSOR TELEMETRY UPDATES`,
  ];

  useEffect(() => {
    const tickerTimer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerMessages.length);
    }, 6000);
    return () => clearInterval(tickerTimer);
  }, [tickerMessages.length]);

  const handleAnnounceTopTrain = (train: StationArrivalData) => {
    playRailwayAudioAnnouncement(
      train.train_id,
      train.train_name,
      train.platform,
      train.predicted_p50_eta,
      train.predicted_delay_minutes,
      stationMeta.name
    );
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden mb-6">
      
      {/* Panel Top Title */}
      <div className="p-4 sm:p-5 border-b border-slate-200/70 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Tv className="w-5 h-5 text-indigo-600" />
                <span>Passenger Information Board Preview (PIDS)</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200">
                Public Concourse Display
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Simulates high-visibility electronic passenger information display boards across station platforms and concourses. Updates automatically when ETA changes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLangMode((prev) => (prev === 'EN' ? 'HI' : 'EN'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
              title="Toggle English / Hindi Header"
            >
              <Languages className="w-3.5 h-3.5 text-blue-600" />
              <span>{langMode === 'EN' ? 'English' : 'हिन्दी'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Simulated LED Station Display Chassis */}
      <div className="p-4 sm:p-6 bg-slate-950">
        <div className="rounded-2xl border-4 border-slate-800 bg-black text-amber-400 p-4 sm:p-5 font-mono shadow-2xl relative overflow-hidden">
          
          {/* Subtle LED Scanline Effect */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-40" />

          {/* Electronic Header Banner */}
          <div className="border-b-2 border-amber-500/40 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-cyan-300">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-extrabold text-sm sm:text-base tracking-wider text-amber-300">
                {langMode === 'EN' ? stationMeta.name.toUpperCase() : 'कोटा जंक्शन'} ({stationMeta.code}) • {langMode === 'EN' ? 'INDIAN RAILWAYS' : 'भारतीय रेल'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-cyan-400">
              <span>{boardTime} IST</span>
              <span className="text-amber-400/60">•</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-[11px] text-cyan-300 font-bold uppercase">
                PIDS Live Sync
              </span>
            </div>
          </div>

          {/* LED Display Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-amber-500/30 text-amber-300 uppercase tracking-wider text-[11px] sm:text-xs">
                  <th className="py-2.5 px-2">Train No.</th>
                  <th className="py-2.5 px-3">Train Name</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3 text-center">Platform</th>
                  <th className="py-2.5 px-3">Expected Arrival</th>
                  <th className="py-2.5 px-3">Delay</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-2 text-right">PA Audio</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {arrivals.map((train) => {
                  const isLate = train.predicted_delay_minutes > 0;
                  const isConflict = train.has_conflict;

                  return (
                    <tr
                      key={train.train_id}
                      onClick={() => onSelectTrain(train.train_id)}
                      className={`hover:bg-slate-900/80 transition-colors cursor-pointer ${
                        selectedTrainId === train.train_id ? 'bg-slate-900 ring-1 ring-amber-400/40' : ''
                      }`}
                    >
                      {/* Train Number */}
                      <td className="py-3 px-2 font-bold text-amber-300 whitespace-nowrap">
                        {train.train_id}
                      </td>

                      {/* Train Name */}
                      <td className="py-3 px-3 font-semibold text-amber-200 whitespace-nowrap">
                        {train.train_name}
                      </td>

                      {/* Destination */}
                      <td className="py-3 px-3 text-cyan-300 whitespace-nowrap">
                        {train.destination}
                      </td>

                      {/* Platform */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded text-xs font-black inline-block ${
                          isConflict
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-amber-400 text-black'
                        }`}>
                          PF {train.platform}
                        </span>
                      </td>

                      {/* Expected Arrival */}
                      <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                        {train.predicted_p50_eta.split(' ')[0]}
                      </td>

                      {/* Delay */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isLate ? (
                          <span className="text-amber-400 font-bold">
                            +{train.predicted_delay_minutes} min
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold">
                            RIGHT TIME
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          isConflict
                            ? 'bg-purple-950 text-purple-300 border border-purple-700'
                            : train.status === 'SIGNAL_HALT'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : isLate
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}>
                          {isConflict
                            ? 'PLATFORM CHANGED'
                            : train.status === 'SIGNAL_HALT'
                            ? 'HALTED AT SIGNAL'
                            : isLate
                            ? 'RUNNING LATE'
                            : 'ON TIME / ON ROUTE'}
                        </span>
                      </td>

                      {/* PA Audio Play Button */}
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAnnounceTopTrain(train);
                          }}
                          className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-[10px] font-bold border border-amber-500/40 inline-flex items-center gap-1 transition-all"
                          title="Simulate PA Voice Announcement"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Announce</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Scrolling Bottom Electronic Ticker */}
          <div className="mt-4 pt-3 border-t border-amber-500/30 flex items-center justify-between text-[11px] text-amber-300/90 font-mono">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-black font-extrabold text-[10px] shrink-0">
                NOTICE
              </span>
              <span className="truncate animate-fade-in font-semibold">
                {tickerMessages[tickerIndex]}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-cyan-400 text-[10px] shrink-0 font-bold">
              <span>POWERED BY RAILDRISHTI AI</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
