import React from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Train,
  Clock,
  MapPin,
  ExternalLink,
  Zap,
  Activity,
  Volume2,
  Layers
} from 'lucide-react';
import { StationArrivalData, StationInfo } from './stationTypes';
import { CORRIDOR_STATIONS } from '../../services/railApi';
import { playRailwayAudioAnnouncement } from './stationUtils';

interface TrainDetailDrawerProps {
  train: StationArrivalData | null;
  stationMeta: StationInfo;
  onClose: () => void;
  onReassignPlatform?: (trainId: string, newPlatform: number) => void;
}

export const TrainDetailDrawer: React.FC<TrainDetailDrawerProps> = ({
  train,
  stationMeta,
  onClose,
}) => {
  if (!train) return null;

  const handlePlayAnnouncement = () => {
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-y-auto">
        
        {/* Drawer Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white sticky top-0 z-10 shadow-md">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
                <Train className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white">
                  {train.train_name}
                </h2>
                <span className="font-mono text-xs font-bold text-blue-300">
                  Train #{train.train_id} • {train.category}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-700/60 font-medium">
            <span>Route: {train.source} → {train.destination}</span>
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 font-bold">
              Approaching {stationMeta.name} (PF {train.platform})
            </span>
          </div>
        </div>

        {/* Drawer Body Content */}
        <div className="p-5 space-y-5 flex-1">
          
          {/* Quick Announcement and Full Page Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePlayAnnouncement}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 shadow-xs transition-all active:scale-95"
            >
              <Volume2 className="w-4 h-4 text-indigo-600" />
              <span>Broadcast PA Announcement</span>
            </button>

            <Link
              to={`/train/${train.train_id}`}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all"
            >
              <span>Full Analysis</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </Link>
          </div>

          {/* 1. Live Telemetry & GPS Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Live Location & Telemetry</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-medium block mb-0.5">Current Speed</span>
                <span className="font-extrabold text-slate-900 text-base font-mono">{train.speed_kmph} km/h</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-medium block mb-0.5">Distance to Station</span>
                <span className="font-extrabold text-slate-900 text-base font-mono">{train.distance_km.toFixed(1)} km</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-medium block mb-0.5">Active Section</span>
                <span className="font-extrabold text-slate-800 font-mono text-xs truncate block">{train.current_section}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-medium block mb-0.5">Operational Status</span>
                <span className="font-bold text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 inline-block uppercase">
                  {train.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Dynamic ETA & Uncertainty Band */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200">
            <h3 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Station Arrival Forecast</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                train.confidence_label === 'HIGH' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {train.confidence_label} CONFIDENCE ({Math.round(train.confidence_score * 100)}%)
              </span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-blue-100">
                <span className="text-slate-600 font-medium">Scheduled Arrival:</span>
                <span className="font-mono font-bold text-slate-800">{train.scheduled_arrival}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-blue-100">
                <span className="text-blue-900 font-bold">Dynamic ETA (P50):</span>
                <span className="font-mono font-black text-blue-700 text-sm">{train.predicted_p50_eta}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-blue-100">
                <span className="text-slate-600 font-medium">P10–P90 Uncertainty Interval:</span>
                <span className="font-mono font-bold text-slate-700 bg-white/80 px-2 py-0.5 rounded border border-blue-200">
                  {train.predicted_p10_eta.split(' ')[0]} – {train.predicted_p90_eta.split(' ')[0]}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-600 font-medium">Predicted Delay:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${
                  train.predicted_delay_minutes > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {train.predicted_delay_minutes > 0 ? `+${train.predicted_delay_minutes} min late` : 'On Time'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Delay Reasons & Factors */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-600" />
              <span>Delay Attribution & Root Factors</span>
            </h3>

            <div className="space-y-2">
              {train.top_factors && train.top_factors.length > 0 ? (
                train.top_factors.map((f, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{f.label}</span>
                      <span className={`font-mono font-bold text-[11px] px-1.5 py-0.2 rounded ${
                        f.delta_min > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {f.delta_min > 0 ? `+${f.delta_min}m` : `${f.delta_min}m`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-normal leading-relaxed">{f.description}</p>
                  </div>
                ))
              ) : (
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 italic">
                  Train operating under nominal timetable conditions with normal recovery margins.
                </div>
              )}
            </div>
          </div>

          {/* 4. Station Operational Guide & Action */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200">
            <h3 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              <span>Station Operations Recommendation</span>
            </h3>
            <p className="text-xs font-bold text-indigo-950 mb-2">
              {train.recommended_action}
            </p>
            <div className="text-[11px] text-slate-600 space-y-1">
              <div>• Platform {train.platform} scheduled for {train.halt_minutes} min passenger halt.</div>
              <div>• Platform clearance buffer: 15 minutes before next scheduled movement.</div>
              {train.has_conflict && (
                <div className="text-purple-700 font-bold">• Caution: Short headway conflict detected with train {train.conflict_with_train_id}.</div>
              )}
            </div>
          </div>

          {/* 5. Corridor Stations Progression */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Corridor Route Stations</span>
            </h3>

            <div className="space-y-2 text-xs">
              {CORRIDOR_STATIONS.map((st) => {
                const isCurrentStation = st.code === stationMeta.code;
                return (
                  <div
                    key={st.code}
                    className={`flex items-center justify-between p-2 rounded-xl border ${
                      isCurrentStation
                        ? 'bg-blue-600 text-white font-bold border-blue-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isCurrentStation ? 'bg-white' : 'bg-slate-400'}`} />
                      <span>{st.name} ({st.code})</span>
                    </div>
                    <span className="font-mono text-[11px] opacity-90">
                      {isCurrentStation ? `ETA ${train.predicted_p50_eta.split(' ')[0]}` : `Stop #${st.sequence}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
