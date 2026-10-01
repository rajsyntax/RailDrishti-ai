import React, { useState, useMemo } from 'react';
import {
  Layers,
  ShieldAlert
} from 'lucide-react';
import { StationArrivalData, StationInfo } from './stationTypes';

interface PlatformOccupancyGanttProps {
  arrivals: StationArrivalData[];
  stationMeta: StationInfo;
  selectedTrainId: string | null;
  onSelectTrain: (trainId: string) => void;
  onReassignPlatform?: (trainId: string, newPlatform: number) => void;
}

export const PlatformOccupancyGantt: React.FC<PlatformOccupancyGanttProps> = ({
  arrivals,
  stationMeta,
  selectedTrainId,
  onSelectTrain,
  onReassignPlatform,
}) => {
  const [reassignModalTrain, setReassignModalTrain] = useState<StationArrivalData | null>(null);
  const [selectedTargetPlatform, setSelectedTargetPlatform] = useState<number>(1);

  // Time window: 6 hours from now
  const now = useMemo(() => new Date(), []);
  const windowDurationMs = 6 * 60 * 60 * 1000; // 6 hours
  const windowStart = now.getTime();

  // Platform count (at least 4, or stationMeta.platformCount)
  const platforms = useMemo(() => {
    const count = Math.max(stationMeta.platformCount || 4, 4);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [stationMeta]);

  // Hourly markers for timeline axis
  const hourMarkers = useMemo(() => {
    const markers: { timeLabel: string; offsetPct: number }[] = [];
    for (let i = 0; i <= 6; i++) {
      const markerTime = new Date(windowStart + i * 60 * 60 * 1000);
      const label = markerTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      markers.push({
        timeLabel: label,
        offsetPct: (i / 6) * 100,
      });
    }
    return markers;
  }, [windowStart]);

  // Group trains by assigned platform
  const trainsByPlatform = useMemo(() => {
    const map: Record<number, StationArrivalData[]> = {};
    platforms.forEach((p) => {
      map[p] = arrivals.filter((a) => a.platform === p);
    });
    return map;
  }, [platforms, arrivals]);

  // Platform occupancy metrics
  const platformStats = useMemo(() => {
    let totalOccupied = 0;
    let conflictsCount = 0;
    platforms.forEach((p) => {
      const list = trainsByPlatform[p] || [];
      if (list.length > 0) totalOccupied++;
      if (list.some((t) => t.has_conflict)) conflictsCount++;
    });
    return {
      activePlatforms: totalOccupied,
      utilizationRate: Math.round((totalOccupied / platforms.length) * 100),
      conflictsCount,
    };
  }, [platforms, trainsByPlatform]);

  const handleOpenReassign = (train: StationArrivalData, e: React.MouseEvent) => {
    e.stopPropagation();
    setReassignModalTrain(train);
    // Suggest first empty or non-conflicting platform
    const alternative = platforms.find((p) => p !== train.platform) || 1;
    setSelectedTargetPlatform(alternative);
  };

  const handleConfirmReassign = () => {
    if (reassignModalTrain && onReassignPlatform) {
      onReassignPlatform(reassignModalTrain.train_id, selectedTargetPlatform);
      setReassignModalTrain(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden mb-6">
      
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/70 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>Platform Occupancy & Clearance Timeline</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                {stationMeta.name} ({platforms.length} Tracks)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Real-time platform scheduling, turnaround cleaning buffers, and headway conflict detection for the next 6 hours.
            </p>
          </div>

          {/* Timeline State Badges */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
              <span>Occupied / Arriving</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
              <span>Prep / Cleaning Buffer</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-600 inline-block animate-pulse" />
              <span>Headway Conflict</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Timeline View */}
      <div className="p-4 sm:p-5 overflow-x-auto">
        <div className="min-w-[760px]">
          
          {/* Time Scale Header Axis */}
          <div className="relative h-8 border-b border-slate-200 mb-3 flex items-center">
            <div className="w-24 shrink-0 text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">
              Platform
            </div>
            <div className="relative flex-1 h-full">
              {hourMarkers.map((marker, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 flex flex-col items-center"
                  style={{ left: `${marker.offsetPct}%`, transform: 'translateX(-50%)' }}
                >
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-1">
                    {marker.timeLabel}
                  </span>
                  <div className="w-px flex-1 bg-slate-200 mt-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Platform Rows */}
          <div className="space-y-3">
            {platforms.map((platformNum) => {
              const platformTrains = trainsByPlatform[platformNum] || [];
              const hasConflict = platformTrains.some((t) => t.has_conflict);

              return (
                <div
                  key={platformNum}
                  className={`flex items-center rounded-xl p-2 transition-colors border ${
                    hasConflict
                      ? 'bg-purple-50/40 border-purple-200'
                      : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-50'
                  }`}
                >
                  
                  {/* Platform Label */}
                  <div className="w-24 shrink-0 flex items-center gap-2 pl-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shadow-xs ${
                      hasConflict
                        ? 'bg-purple-600 text-white animate-pulse'
                        : 'bg-slate-900 text-white'
                    }`}>
                      {platformNum}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">
                        PF {platformNum}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {platformTrains.length > 0 ? `${platformTrains.length} arrival` : 'Available'}
                      </span>
                    </div>
                  </div>

                  {/* Gantt Track Area */}
                  <div className="relative flex-1 h-12 bg-white/80 rounded-lg border border-slate-200/80 overflow-hidden shadow-inner">
                    
                    {/* Background grid vertical guidelines */}
                    {hourMarkers.map((m, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-slate-100 pointer-events-none"
                        style={{ left: `${m.offsetPct}%` }}
                      />
                    ))}

                    {/* NOW red line marker at 0% */}
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-500 z-20 shadow-sm" title="Current Time (Now)" />

                    {/* Train Blocks on this platform */}
                    {platformTrains.map((train) => {
                      const arrivalTime = train.arrival_date.getTime();
                      const departureTime = train.departure_date.getTime();
                      const clearanceTime = train.clearance_date.getTime();

                      // Calculate percentages within the 6-hour window
                      const leftPct = Math.max(0, Math.min(95, ((arrivalTime - windowStart) / windowDurationMs) * 100));
                      const haltWidthPct = Math.max(4, Math.min(100 - leftPct, ((departureTime - arrivalTime) / windowDurationMs) * 100));
                      const bufferWidthPct = Math.max(3, Math.min(100 - leftPct - haltWidthPct, ((clearanceTime - departureTime) / windowDurationMs) * 100));
                      const totalWidthPct = haltWidthPct + bufferWidthPct;

                      const isSelected = selectedTrainId === train.train_id;

                      return (
                        <div
                          key={train.train_id}
                          onClick={() => onSelectTrain(train.train_id)}
                          style={{
                            left: `${leftPct}%`,
                            width: `${Math.max(totalWidthPct, 12)}%`,
                          }}
                          className={`absolute top-1.5 bottom-1.5 rounded-lg flex items-center justify-between px-2 cursor-pointer shadow-sm transition-all group z-10 ${
                            isSelected ? 'ring-2 ring-blue-500 scale-[1.02]' : 'hover:scale-[1.01]'
                          } ${
                            train.has_conflict
                              ? 'bg-gradient-to-r from-purple-600 via-red-600 to-amber-500 text-white border border-purple-700 shadow-purple-500/20'
                              : train.predicted_delay_minutes > 15
                              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white border border-amber-600'
                              : 'bg-gradient-to-r from-blue-700 to-indigo-600 text-white border border-blue-800'
                          }`}
                          title={`${train.train_name} (${train.train_id})\nETA: ${train.predicted_p50_eta}\nHalt: ${train.halt_minutes}m\nPlatform: ${train.platform}\n${train.has_conflict ? 'CONFLICT: ' + train.conflict_reason : 'Clear track'}`}
                        >
                          {/* Left: Train ID and ETA */}
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="font-extrabold text-[11px] font-mono tracking-tight shrink-0">
                              {train.train_id}
                            </span>
                            <span className="text-[10px] font-medium truncate opacity-90 hidden sm:inline">
                              {train.train_name}
                            </span>
                          </div>

                          {/* Right: ETA & Action Pill */}
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            <span className="text-[10px] font-mono font-bold bg-black/25 px-1.5 py-0.2 rounded">
                              {train.predicted_p50_eta.split(' ')[0]}
                            </span>
                            {train.has_conflict && (
                              <button
                                onClick={(e) => handleOpenReassign(train, e)}
                                className="p-0.5 rounded bg-white/20 hover:bg-white/40 text-white text-[9px] font-bold"
                                title="Reassign Platform"
                              >
                                Shift PF
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {platformTrains.length === 0 && (
                      <div className="h-full flex items-center justify-center text-[11px] font-medium text-slate-400 italic">
                        Track clear • Ready for assignment
                      </div>
                    )}

                  </div>

                </div>
              );
            })}
          </div>

          {/* Timeline Summary & Legend */}
          <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-4">
              <span><strong>Active Tracks:</strong> {platformStats.activePlatforms}/{platforms.length} ({platformStats.utilizationRate}% Capacity)</span>
              <span>•</span>
              <span className={platformStats.conflictsCount > 0 ? 'text-purple-700 font-bold' : 'text-emerald-700 font-semibold'}>
                <strong>Conflicts:</strong> {platformStats.conflictsCount} Headway Alerts
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              * Red line denotes current live timestamp (T+0). Click any train block to inspect live telemetry.
            </div>
          </div>

        </div>
      </div>

      {/* Platform Reassignment Modal */}
      {reassignModalTrain && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Reassign Platform Track</h3>
                  <p className="text-xs text-slate-500">Resolve platform conflict at {stationMeta.name}</p>
                </div>
              </div>
              <button
                onClick={() => setReassignModalTrain(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-5 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Train:</span>
                  <span className="font-bold text-slate-900">{reassignModalTrain.train_name} ({reassignModalTrain.train_id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Dynamic ETA:</span>
                  <span className="font-mono font-bold text-blue-700">{reassignModalTrain.predicted_p50_eta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Current Assigned PF:</span>
                  <span className="font-bold text-purple-700">Platform {reassignModalTrain.platform}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Select Target Platform for Reassignment:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {platforms.map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedTargetPlatform(p)}
                      className={`py-2 px-3 rounded-xl font-extrabold text-sm border transition-all ${
                        selectedTargetPlatform === p
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                      }`}
                    >
                      PF {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setReassignModalTrain(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReassign}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all"
              >
                Apply Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
