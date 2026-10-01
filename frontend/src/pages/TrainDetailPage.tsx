import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Clock, Sparkles, ShieldCheck, Activity, RefreshCw,
  Info, Layers, Loader2
} from 'lucide-react';
import {
  railApi, DEMO_TRAINS, CORRIDOR_STATIONS, DynamicETAResponse,
  ExplainResponse, TrainLiveState, Section, normalizeTrainId
} from '../services/railApi';
import { RailRouteMap } from '../components/common/RailRouteMap';
import { PrototypeBadge } from '../components/common/PrototypeBadge';

export const TrainDetailPage: React.FC = () => {
  const { trainId: paramTrainId } = useParams<{ trainId: string }>();
  const trainId = normalizeTrainId(paramTrainId || '12952');

  const [liveState, setLiveState] = useState<TrainLiveState | null>(null);
  const [etaData, setEtaData] = useState<DynamicETAResponse | null>(null);
  const [explainData, setExplainData] = useState<ExplainResponse | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedStationCode, setSelectedStationCode] = useState<string>('KOTA');
  const [freshnessSec, setFreshnessSec] = useState<number>(0);
  const [lastFetched, setLastFetched] = useState<Date>(new Date());

  // Train metadata
  const meta = useMemo(() => {
    return DEMO_TRAINS.find((t) => t.train_id === trainId) || {
      train_id: trainId,
      train_name: 'Western Superfast Express',
      category: 'Express',
      priority: 2,
      source_station: 'NDLS',
      destination_station: 'MMCT'
    };
  }, [trainId]);

  // Load all telemetry & explainability data
  const loadData = async () => {
    try {
      const [live, eta, explain, allSecs] = await Promise.all([
        railApi.getTrainLive(trainId),
        railApi.getTrainEta(trainId),
        railApi.getTrainExplain(trainId),
        railApi.getSections(),
      ]);

      setLiveState(live);
      setEtaData(eta);
      setExplainData(explain);
      setSections(allSecs);
      setLastFetched(new Date());
      setFreshnessSec(0);

      if (eta.upcoming_stations_eta && eta.upcoming_stations_eta.length > 0) {
        setSelectedStationCode(eta.upcoming_stations_eta[0].station_code);
      }
    } catch (err) {
      console.warn('[TrainDetailPage] Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadData();

    // Auto-refresh every 5 seconds to sync with kinematic simulation
    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, [trainId]);

  // Freshness counter
  useEffect(() => {
    const timer = setInterval(() => {
      setFreshnessSec(Math.floor((Date.now() - lastFetched.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastFetched]);

  // Synthetic realistic event history timeline
  const eventHistory = useMemo(() => {
    const events = [];
    const speed = liveState?.speed_kmph ?? 110;
    const currentSection = liveState?.current_section || 'SEC_SWM_KOTA';

    events.push({
      time: 'Just now',
      title: 'Real-time GPS Telemetry Received',
      description: `Kinematic speed recorded at ${speed} km/h in section ${currentSection}. Automatic block signaling active.`,
      type: 'telemetry'
    });

    if (liveState?.status === 'SIGNAL_HALT') {
      events.push({
        time: '3 mins ago',
        title: 'Signal Caution / Hold',
        description: 'Automatic intermediate block signal held red due to downstream section clearing buffer.',
        type: 'warning'
      });
    }

    events.push({
      time: '12 mins ago',
      title: 'Entered Corridor Section',
      description: `Transitioned into ${currentSection} under automatic train protection monitoring.`,
      type: 'operational'
    });

    events.push({
      time: '34 mins ago',
      title: 'Previous Station Clearance',
      description: `Cleared ${liveState?.current_station || 'SWM'} station perimeter with line clear token.`,
      type: 'station'
    });

    events.push({
      time: '58 mins ago',
      title: 'Timetable Slack Calibration',
      description: 'AI dynamic model adjusted P10/P50/P90 interval based on prevailing weather and section headways.',
      type: 'ai'
    });

    return events;
  }, [liveState]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Top Breadcrumb & Live Refresh Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          to="/passenger"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Passenger Live Tracking</span>
        </Link>

        {/* Data Freshness Indicator */}
        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Updating Telemetry...</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs shadow-sm font-mono">
            <span className={`w-2 h-2 rounded-full ${freshnessSec < 15 ? 'bg-teal-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-slate-600">Freshness: <strong className="text-slate-900">{freshnessSec}s ago</strong></span>
          </div>

          <button
            onClick={() => loadData()}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm"
            title="Force refresh live data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Train Header Banner */}
      <div className="bg-gradient-to-r from-[#071324] via-[#0B1F3A] to-[#1E3A8A] text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-blue-900/60 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-md bg-blue-600 text-white font-mono font-black text-sm tracking-wider shadow-sm">
              {meta.train_id}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-teal-300 border border-white/10 font-bold">
              {meta.category}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">
              Priority Tier {meta.priority}
            </span>
            <PrototypeBadge />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {meta.train_name}
          </h1>

          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 flex-wrap">
            <span>Route: <strong className="text-white">{meta.source_station} (New Delhi)</strong></span>
            <span className="text-teal-400">⟶</span>
            <span><strong className="text-white">{meta.destination_station} (Mumbai Central)</strong></span>
            <span>• Corridor Distance: 1,386 km</span>
          </div>
        </div>

        {/* Live Operational Metric Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-4 rounded-xl border border-white/10 self-start lg:self-auto min-w-[320px]">
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Current Speed</div>
            <div className="text-xl sm:text-2xl font-black font-mono text-teal-400">
              {liveState?.speed_kmph ?? 110} km/h
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Current Delay</div>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
              +{(liveState?.delay_minutes ?? 0)} mins
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Confidence</div>
            <div className="text-xl sm:text-2xl font-black font-mono text-teal-300">
              {etaData?.confidence_label || 'HIGH'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Recovery Prob</div>
            <div className="text-xl sm:text-2xl font-black font-mono text-blue-400">
              {Math.round(((etaData?.recovery_probability ?? 0.82)) * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Full Route Map & Station Progression */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Full Route Map (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Full Corridor Route Radar & Section Telemetry</span>
              </h2>
              <span className="text-xs font-mono text-slate-500">9 Corridor Stations</span>
            </div>

            <RailRouteMap
              trainLat={liveState?.latitude ?? 25.2138}
              trainLng={liveState?.longitude ?? 75.8648}
              trainId={meta.train_id}
              trainName={meta.train_name}
              speed={liveState?.speed_kmph ?? 110}
              selectedStationCode={selectedStationCode}
              onStationSelect={(st) => setSelectedStationCode(st)}
              height="420px"
              isCompact={false}
            />

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Click on any station marker to cross-examine scheduled vs predicted P50 ETA.</span>
              <span className="font-mono text-blue-600 font-bold">Western Railway Golden Corridor</span>
            </div>
          </div>

          {/* Explanation Contribution Panel (NO raw ML jargon / NO raw SHAP) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Explainable AI Factor Contribution Panel</span>
              </div>
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                Transparent Attribution
              </span>
            </div>

            {/* Plain English summary */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-1">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Operational Delay Summary</span>
              </div>
              <p className="text-slate-700 leading-relaxed font-medium">
                {explainData?.summary_explanation ||
                  `ETA projected with +${etaData?.predicted_delay || 0} minutes delay based on current track progression, caution orders, and timetable recovery headroom.`}
              </p>
            </div>

            {/* Factor Cards with Signed Minutes */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Contributing Delay & Recovery Factors
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(explainData?.factor_contributions && explainData.factor_contributions.length > 0
                  ? explainData.factor_contributions
                  : etaData?.top_eta_factors || []
                ).map((factor, idx) => {
                  const isPositiveDelay = factor.delta_min > 0;
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isPositiveDelay
                          ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                          : 'bg-teal-50/60 border-teal-200 text-teal-950'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs mb-1">
                        <span className="truncate">{factor.label}</span>
                        <span className={`font-mono text-xs px-2 py-0.5 rounded font-black ${
                          isPositiveDelay ? 'bg-amber-200 text-amber-900' : 'bg-teal-200 text-teal-900'
                        }`}>
                          {factor.delta_min > 0 ? `+${factor.delta_min} min` : `${factor.delta_min} min`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        {factor.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actionable Insight Box */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-teal-300">
                <ShieldCheck className="w-4 h-4" />
                <span>Operational Guidance for Controllers & Passengers</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {explainData?.actionable_insight ||
                  'Train expected to recover 2–3 minutes over the Kota-Ratlam section due to generous timetable buffer.'}
              </p>
            </div>

          </div>

        </div>

        {/* Right Column: Station-by-Station Table & Recovery / Events (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Station-by-Station ETA Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Station-by-Station ETA Table</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-500">P10 / P50 / P90</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold text-[10px] uppercase">
                    <th className="pb-2">Station</th>
                    <th className="pb-2">Scheduled</th>
                    <th className="pb-2 text-blue-600">P50 ETA</th>
                    <th className="pb-2">P10 – P90</th>
                    <th className="pb-2 text-right">Delay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CORRIDOR_STATIONS.map((station) => {
                    const upcomingInfo = etaData?.upcoming_stations_eta?.find(
                      (u) => u.station_code === station.code
                    );
                    const currentStn = liveState?.current_station || 'SWM';
                    const isSelected = station.code === selectedStationCode;

                    return (
                      <tr
                        key={station.code}
                        onClick={() => setSelectedStationCode(station.code)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/80 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[10px] px-1 py-0.2 rounded bg-slate-100">
                              {station.code}
                            </span>
                            <span className="truncate max-w-[90px]">{station.name}</span>
                            {station.code === currentStn && (
                              <span className="px-1.5 py-0.2 rounded bg-teal-500 text-white font-extrabold text-[9px] animate-pulse">
                                GPS
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 font-mono text-slate-400 text-[11px]">
                          {upcomingInfo?.scheduled_arrival || '—'}
                        </td>

                        <td className="py-2.5 font-mono font-bold text-blue-700 text-xs">
                          {upcomingInfo?.predicted_p50_eta || (station.code === 'NDLS' ? 'Dep 16:55' : '—')}
                        </td>

                        <td className="py-2.5 font-mono text-slate-500 text-[10px]">
                          {upcomingInfo ? `${upcomingInfo.predicted_p10_eta} - ${upcomingInfo.predicted_p90_eta}` : '—'}
                        </td>

                        <td className="py-2.5 text-right font-mono font-bold">
                          {upcomingInfo ? (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              upcomingInfo.predicted_delay > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
                            }`}>
                              {upcomingInfo.predicted_delay > 0 ? `+${upcomingInfo.predicted_delay}m` : 'RT'}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Pass</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-500 leading-snug">
              P50 denotes median arrival expectation. P10 is earliest feasible arrival and P90 is conservative worst-case threshold under track traffic.
            </div>
          </div>

          {/* Congestion Information for Upcoming Sections */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>Upcoming Section Congestion Matrix</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-500">Live Block Capacity</span>
            </div>

            <div className="space-y-2">
              {sections.slice(3, 7).map((sec) => {
                const isCurrentSec = liveState?.current_section === sec.section_id;
                const capacityPct = Math.round(sec.capacity_score * 100);

                return (
                  <div
                    key={sec.section_id}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isCurrentSec
                        ? 'border-blue-400 bg-blue-50/60 shadow-sm'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-800 text-[11px]">
                          {sec.from_station} ⇄ {sec.to_station}
                        </span>
                        {isCurrentSec && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold text-[9px]">
                            CURRENT
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        sec.capacity_score > 0.85
                          ? 'bg-green-100 text-green-800'
                          : sec.capacity_score > 0.75
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {capacityPct}% Capacity
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Normal Speed: <strong>{sec.normal_speed_kmph} km/h</strong></span>
                      <span>Distance: <strong>{sec.distance_km} km</strong></span>
                      <span>Median Run: <strong>{sec.historical_median_time_min}m</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event History Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Operational Event History</span>
              </h2>
              <span className="text-[10px] font-mono text-teal-700">Chronological Stream</span>
            </div>

            <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 py-1">
              {eventHistory.map((ev, index) => (
                <div key={index} className="relative pl-5 text-xs">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white ring-2 ring-blue-200" />
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-slate-800">{ev.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{ev.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {ev.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
