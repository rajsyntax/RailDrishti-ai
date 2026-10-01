import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Radio, Activity, AlertTriangle, Clock, RefreshCw,
  Train, Shield, TrendingUp, ChevronRight,
  X, Zap, MapPin, BarChart2, Eye, Signal, AlertOctagon, Info,
  ThumbsUp, Gauge, Navigation
} from 'lucide-react';
import {
  DEMO_TRAINS, CORRIDOR_STATIONS, MOCK_SECTIONS, railApi,
  TrainLiveState, SectionCongestion, getMockLiveState
} from '../services/railApi';
import { useTrainLiveUpdates } from '../services/useTrainLiveUpdates';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RiskAlert {
  id: string;
  type: 'SIGNAL_HALT' | 'HIGH_CONGESTION' | 'ETA_CHANGED' | 'DELAY_PROPAGATION' | 'GPS_STALE' | 'SPEED_RESTRICTION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  trainId?: string;
  trainName?: string;
  sectionId?: string;
  message: string;
  detail: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface SidePanelTrain {
  trainId: string;
  trainName: string;
  state: TrainLiveState;
  eta?: string;
  delay: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function trainRiskColor(state: TrainLiveState): 'green' | 'amber' | 'red' | 'grey' {
  if (state.status === 'SIGNAL_HALT' || state.status === 'UNSCHEDULED_HALT') return 'red';
  if (state.delay_minutes >= 30) return 'red';
  if (state.delay_minutes >= 15) return 'amber';
  const age = Date.now() - new Date(state.timestamp).getTime();
  if (age > 120000) return 'grey';
  return 'green';
}

function makeTrainIcon(color: 'green' | 'amber' | 'red' | 'grey', pulse = false): L.DivIcon {
  const colors: Record<string, string> = {
    green: '#22c55e',
    amber: '#f59e0b',
    red: '#ef4444',
    grey: '#94a3b8',
  };
  const hex = colors[color];
  const ring = pulse
    ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${hex};animation:ctrl-pulse-ring 1.4s ease-in-out infinite;opacity:0.6;"></div>`
    : '';
  return L.divIcon({
    html: `<div style="position:relative;width:20px;height:20px;">
      ${ring}
      <div style="width:20px;height:20px;border-radius:50%;background:${hex};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M4 11v8l4 1 4-1 4 1 4-1v-8l-2-7H6L4 11zm6 6H7v-2h3v2zm4 0h-3v-2h3v2zm4 0h-3v-2h3v2z"/></svg>
      </div>
    </div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function stationDotIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:8px;height:8px;border-radius:50%;background:#1e40af;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    className: '',
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

function severityBadgeStyle(sev: RiskAlert['severity']) {
  if (sev === 'CRITICAL') return 'bg-red-100 text-red-800 border-red-300';
  if (sev === 'HIGH') return 'bg-orange-100 text-orange-800 border-orange-300';
  if (sev === 'MEDIUM') return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function alertIconEl(type: RiskAlert['type']) {
  switch (type) {
    case 'SIGNAL_HALT': return <AlertOctagon className="w-4 h-4 text-red-500" />;
    case 'HIGH_CONGESTION': return <Activity className="w-4 h-4 text-orange-500" />;
    case 'ETA_CHANGED': return <Clock className="w-4 h-4 text-amber-500" />;
    case 'DELAY_PROPAGATION': return <TrendingUp className="w-4 h-4 text-amber-600" />;
    case 'GPS_STALE': return <Signal className="w-4 h-4 text-slate-400" />;
    case 'SPEED_RESTRICTION': return <Gauge className="w-4 h-4 text-blue-500" />;
    default: return <AlertTriangle className="w-4 h-4 text-slate-500" />;
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Alert Generator ──────────────────────────────────────────────────────────
function generateAlerts(trains: TrainLiveState[], congestions: Map<string, SectionCongestion>): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const now = new Date();
  trains.forEach(t => {
    if (t.status === 'SIGNAL_HALT') {
      alerts.push({
        id: `signal_${t.train_id}`,
        type: 'SIGNAL_HALT', severity: 'CRITICAL',
        trainId: t.train_id, trainName: t.train_name,
        sectionId: t.current_section ?? undefined,
        message: `${t.train_name} at signal halt`,
        detail: `Train #${t.train_id} stopped at signal in ${t.current_section ?? '—'}. Awaiting TLC clearance.`,
        timestamp: new Date(now.getTime() - 3 * 60000), acknowledged: false,
      });
    }
    if (t.delay_minutes >= 15) {
      alerts.push({
        id: `delay_${t.train_id}`,
        type: 'DELAY_PROPAGATION', severity: t.delay_minutes >= 25 ? 'HIGH' : 'MEDIUM',
        trainId: t.train_id, trainName: t.train_name,
        message: `${t.train_name} running ${t.delay_minutes} min late`,
        detail: `Delay propagation risk: Train #${t.train_id} is ${t.delay_minutes} min behind schedule. Downstream connections affected.`,
        timestamp: new Date(now.getTime() - 7 * 60000), acknowledged: false,
      });
    }
  });
  congestions.forEach((cong, secId) => {
    if (cong.label === 'HIGH') {
      const sec = MOCK_SECTIONS.find(s => s.section_id === secId);
      alerts.push({
        id: `cong_${secId}`, type: 'HIGH_CONGESTION', severity: 'HIGH',
        sectionId: secId,
        message: `High congestion: ${sec?.from_station_name ?? secId}`,
        detail: `${sec?.from_station_name ?? ''}–${sec?.to_station_name ?? ''} at ${Math.round(cong.score * 100)}% capacity. Multiple trains queued.`,
        timestamp: new Date(now.getTime() - 11 * 60000), acknowledged: false,
      });
    }
  });
  alerts.push({
    id: 'eta_change_12952', type: 'ETA_CHANGED', severity: 'MEDIUM',
    trainId: '12952', trainName: 'Mumbai Rajdhani',
    message: 'ETA revised +8 min — TSR near GGC',
    detail: 'Engineering caution order (30 km/h) near Gangapur City loop added 8 min to Mumbai Rajdhani ETA.',
    timestamp: new Date(now.getTime() - 2 * 60000), acknowledged: false,
  });
  alerts.push({
    id: 'speed_rest_kota', type: 'SPEED_RESTRICTION', severity: 'LOW',
    sectionId: 'SEC_SWM_KOTA',
    message: 'TSR 45 km/h: SWM–KOTA',
    detail: 'Temp speed restriction of 45 km/h for ballast work. ETA impact ~3 min.',
    timestamp: new Date(now.getTime() - 18 * 60000), acknowledged: true,
  });
  alerts.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    const sev = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    return sev.indexOf(a.severity) - sev.indexOf(b.severity);
  });
  return alerts;
}

// ─── Map Fit ──────────────────────────────────────────────────────────────────
function MapFitBounds() {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = CORRIDOR_STATIONS.map(s => [s.latitude, s.longitude]);
    if (coords.length > 1) map.fitBounds(L.latLngBounds(coords), { padding: [36, 36] });
  }, [map]);
  return null;
}

// ─── Section lines ────────────────────────────────────────────────────────────
function SectionLines({ congestions }: { congestions: Map<string, SectionCongestion> }) {
  return (
    <>
      {MOCK_SECTIONS.map(sec => {
        const fromSt = CORRIDOR_STATIONS.find(s => s.code === sec.from_station);
        const toSt = CORRIDOR_STATIONS.find(s => s.code === sec.to_station);
        if (!fromSt || !toSt) return null;
        const cong = congestions.get(sec.section_id);
        const color = cong ? (cong.label === 'HIGH' ? '#ef4444' : cong.label === 'MODERATE' ? '#f59e0b' : '#22c55e') : '#3b82f6';
        const weight = cong?.label === 'HIGH' ? 5 : 3.5;
        return (
          <Polyline key={sec.section_id}
            positions={[[fromSt.latitude, fromSt.longitude], [toSt.latitude, toSt.longitude]]}
            pathOptions={{ color, weight, opacity: 0.85 }}
          >
            <Popup>
              <div style={{ fontSize: 11, fontFamily: 'monospace', lineHeight: 1.6 }}>
                <strong>{sec.from_station_name} → {sec.to_station_name}</strong><br />
                Distance: {sec.distance_km} km · Speed: {sec.normal_speed_kmph} km/h<br />
                Congestion: <span style={{ color }}><strong>{cong?.label ?? 'N/A'}</strong></span>
                {cong && ` (${Math.round(cong.score * 100)}%)`}
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
}

// ─── ControlPage ──────────────────────────────────────────────────────────────
export const ControlPage: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidePanelTrain, setSidePanelTrain] = useState<SidePanelTrain | null>(null);
  const [congestions, setCongestions] = useState<Map<string, SectionCongestion>>(new Map());
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [isLoadingCong, setIsLoadingCong] = useState(true);

  const { trains, connectionStatus, freshnessSeconds, refresh } = useTrainLiveUpdates('12952');

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadCongestion = useCallback(async () => {
    setIsLoadingCong(true);
    const map = new Map<string, SectionCongestion>();
    await Promise.all(
      MOCK_SECTIONS.map(async sec => {
        const cong = await railApi.getSectionCongestion(sec.section_id);
        map.set(sec.section_id, cong);
      })
    );
    setCongestions(map);
    setIsLoadingCong(false);
  }, []);

  useEffect(() => {
    loadCongestion();
    const iv = setInterval(loadCongestion, 12000);
    return () => clearInterval(iv);
  }, [loadCongestion]);

  useEffect(() => {
    if (trains.length > 0) setAlerts(generateAlerts(trains, congestions));
  }, [trains, congestions]);

  const kpis = useMemo(() => {
    const active = trains.filter(t => t.status !== 'COMPLETED').length;
    const delayed = trains.filter(t => t.delay_minutes >= 5).length;
    const highRisk = trains.filter(t =>
      t.status === 'SIGNAL_HALT' || t.status === 'UNSCHEDULED_HALT' || t.delay_minutes >= 20
    ).length;
    const highCong = [...congestions.values()].filter(c => c.label === 'HIGH').length;
    const staleGps = trains.filter(t => Date.now() - new Date(t.timestamp).getTime() > 120000).length;
    const avgConf = trains.length > 0
      ? trains.reduce((s, t) => s + (t.delay_minutes < 10 ? 0.9 : t.delay_minutes < 25 ? 0.65 : 0.4), 0) / trains.length
      : 0;
    return { active, delayed, highRisk, highCong, staleGps, avgConf };
  }, [trains, congestions]);

  const networkHealth = Math.max(0, Math.min(100,
    100 - kpis.delayed * 5 - kpis.highRisk * 10 - kpis.highCong * 7
  ));

  const handleTrainClick = useCallback(async (trainId: string) => {
    const state = trains.find(t => t.train_id === trainId) || getMockLiveState(trainId);
    setSidePanelTrain({
      trainId, trainName: state.train_name, state,
      delay: state.delay_minutes,
      confidence: state.delay_minutes < 10 ? 'HIGH' : state.delay_minutes < 25 ? 'MEDIUM' : 'LOW',
    });
    try {
      const eta = await railApi.getTrainEta(trainId);
      setSidePanelTrain(prev => prev?.trainId === trainId ? { ...prev, eta: eta.predicted_p50_eta, confidence: eta.confidence_label } : prev);
    } catch { /* keep existing */ }
  }, [trains]);

  const ackAlert = (id: string) =>
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));

  const visibleAlerts = alerts.filter(a => alertFilter === 'ALL' || a.severity === alertFilter);
  const unackCount = alerts.filter(a => !a.acknowledged).length;

  const dotColors = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444', grey: '#94a3b8' };

  return (
    <div className="space-y-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes ctrl-pulse-ring {
          0% { transform:scale(0.9); opacity:0.7; }
          60% { transform:scale(2.4); opacity:0; }
          100% { transform:scale(2.4); opacity:0; }
        }
        @keyframes ctrl-slide-in {
          from { transform:translateX(110%); opacity:0; }
          to   { transform:translateX(0);   opacity:1; }
        }
        .ctrl-slide-in { animation: ctrl-slide-in 0.3s cubic-bezier(.22,.68,0,1.18); }
        .leaflet-container { border-radius: 0 0 16px 16px !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-[#071324] text-white rounded-2xl border border-blue-900/40 shadow-xl overflow-hidden">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Radio className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold tracking-tight">RailDrishti AI Command Center</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">Prototype</span>
              </div>
              <p className="text-xs text-slate-400">NDLS–MMCT Corridor · Northern / Western Railway</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Network Health */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-center">
              <div className="text-[10px] text-slate-400 uppercase font-mono mb-0.5">Network Health</div>
              <div className={`text-lg font-bold font-mono tabular-nums ${networkHealth >= 80 ? 'text-emerald-400' : networkHealth >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {networkHealth.toFixed(0)}%
              </div>
            </div>
            {/* Live indicator */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : connectionStatus === 'reconnecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Data Feed</div>
                <div className={`text-xs font-semibold ${connectionStatus === 'connected' ? 'text-emerald-300' : connectionStatus === 'reconnecting' ? 'text-amber-300' : 'text-red-300'}`}>
                  {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'reconnecting' ? 'Reconnecting…' : 'Offline'}
                </div>
              </div>
            </div>
            {/* Clock */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-center">
              <div className="text-[10px] text-slate-400 uppercase font-mono mb-0.5">IST</div>
              <div className="text-lg font-bold font-mono text-sky-300 tabular-nums">{formatTime(currentTime)}</div>
            </div>
            <button onClick={refresh} className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Freshness bar */}
        <div className="h-0.5 bg-slate-800">
          <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.max(0, 100 - (freshnessSeconds / 30) * 100)}%` }} />
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { label: 'Active Trains',    value: kpis.active,                              icon: Train,          tcolor: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-200',     sub: 'Corridor trains' },
          { label: 'Delayed',          value: kpis.delayed,                             icon: Clock,          tcolor: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   sub: '≥ 5 min late' },
          { label: 'High Risk',        value: kpis.highRisk,                            icon: AlertTriangle,  tcolor: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     sub: 'Halts / big delay' },
          { label: 'High Congestion',  value: kpis.highCong,                            icon: Activity,       tcolor: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200',  sub: 'Sections > 70%' },
          { label: 'Stale GPS',        value: kpis.staleGps,                            icon: Signal,         tcolor: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200',   sub: 'Feed > 2 min' },
          { label: 'Avg Confidence',   value: `${Math.round(kpis.avgConf * 100)}%`,     icon: Shield,
            tcolor: kpis.avgConf > 0.75 ? 'text-emerald-600' : kpis.avgConf > 0.55 ? 'text-amber-600' : 'text-red-600',
            bg: kpis.avgConf > 0.75 ? 'bg-emerald-50' : kpis.avgConf > 0.55 ? 'bg-amber-50' : 'bg-red-50',
            border: kpis.avgConf > 0.75 ? 'border-emerald-200' : kpis.avgConf > 0.55 ? 'border-amber-200' : 'border-red-200',
            sub: 'ETA accuracy' },
        ] as { label: string; value: string | number; icon: React.FC<{ className?: string }>; tcolor: string; bg: string; border: string; sub: string }[]).map(({ label, value, icon: Icon, tcolor, bg, border, sub }) => (
          <div key={label} className={`${bg} ${border} border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-2">
              <Icon className={`w-4 h-4 ${tcolor}`} />
              <span className="text-[9px] uppercase font-mono text-slate-400 text-right leading-tight">{sub}</span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${tcolor}`}>{value}</div>
            <div className="text-xs font-medium text-slate-600 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Map + Alerts ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Leaflet Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-blue-600" />
              Live Corridor Map
              <span className="text-[10px] font-mono text-slate-400 uppercase ml-1">NDLS → MMCT</span>
            </h2>
            <div className="flex items-center gap-3">
              {isLoadingCong && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-500">
                <span className="w-2.5 h-1.5 rounded-sm inline-block" style={{ background: '#22c55e' }} /> OK
                <span className="w-2.5 h-1.5 rounded-sm inline-block ml-1" style={{ background: '#f59e0b' }} /> Slow
                <span className="w-2.5 h-1.5 rounded-sm inline-block ml-1" style={{ background: '#ef4444' }} /> Halt
                <span className="w-2.5 h-1.5 rounded-sm inline-block ml-1" style={{ background: '#94a3b8' }} /> Stale
              </div>
            </div>
          </div>

          <div style={{ height: 440 }}>
            <MapContainer center={[24.5, 75.5]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <MapFitBounds />
              <SectionLines congestions={congestions} />

              {/* Station markers */}
              {CORRIDOR_STATIONS.map(st => (
                <Marker key={st.code} position={[st.latitude, st.longitude]} icon={stationDotIcon()}>
                  <Popup>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      <strong>{st.name}</strong> ({st.code})
                    </span>
                  </Popup>
                </Marker>
              ))}

              {/* Train markers */}
              {trains.map(t => {
                const color = trainRiskColor(t);
                const pulse = t.status === 'SIGNAL_HALT' || t.status === 'UNSCHEDULED_HALT';
                return (
                  <Marker
                    key={t.train_id}
                    position={[t.latitude, t.longitude]}
                    icon={makeTrainIcon(color, pulse)}
                    eventHandlers={{ click: () => handleTrainClick(t.train_id) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'system-ui', fontSize: 12, minWidth: 170, lineHeight: 1.6 }}>
                        <strong style={{ fontSize: 13 }}>{t.train_name}</strong><br />
                        <span style={{ color: '#64748b' }}>#{t.train_id}</span><br />
                        Status: <strong style={{ color: dotColors[color] }}>{t.status}</strong><br />
                        Speed: <strong>{t.speed_kmph} km/h</strong> · Delay: <strong style={{ color: t.delay_minutes > 0 ? '#dc2626' : '#16a34a' }}>
                          {t.delay_minutes > 0 ? `+${t.delay_minutes} min` : 'On time'}
                        </strong>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Quick select strip */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 overflow-x-auto">
            <span className="text-[10px] uppercase font-mono text-slate-400 flex-shrink-0 pr-1">Quick view:</span>
            {trains.map(t => {
              const color = trainRiskColor(t);
              const dotCls = { green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500', grey: 'bg-slate-400' };
              const isActive = sidePanelTrain?.trainId === t.train_id;
              return (
                <button key={t.train_id} onClick={() => handleTrainClick(t.train_id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotCls[color]}`} />
                  {t.train_name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Alerts + Section congestion */}
        <div className="space-y-4">
          {/* Risk Alerts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Risk Alerts
                {unackCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">{unackCount}</span>
                )}
              </h2>
              <div className="flex gap-1">
                {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(f => (
                  <button key={f} onClick={() => setAlertFilter(f)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase transition-colors ${alertFilter === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >{f}</button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-slate-50 max-h-[340px] overflow-y-auto">
              {visibleAlerts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <ThumbsUp className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  All clear
                </div>
              ) : visibleAlerts.map(alert => (
                <div key={alert.id} className={`p-3 transition-opacity ${alert.acknowledged ? 'opacity-50' : ''}`}>
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex-shrink-0">{alertIconEl(alert.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${severityBadgeStyle(alert.severity)}`}>{alert.severity}</span>
                        {alert.trainName && <span className="text-[10px] font-mono text-slate-500">{alert.trainName}</span>}
                        <span className="text-[9px] text-slate-400 ml-auto">{timeAgo(alert.timestamp)}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 leading-snug">{alert.message}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{alert.detail}</p>
                    </div>
                    {!alert.acknowledged && (
                      <button onClick={() => ackAlert(alert.id)}
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 hover:bg-green-100 hover:text-green-700 text-slate-400 flex items-center justify-center transition-colors"
                        title="Acknowledge">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section Congestion */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <BarChart2 className="w-4 h-4 text-blue-600" />
                Section Congestion
              </h2>
              <span className="text-[10px] font-mono text-slate-400">12s refresh</span>
            </div>
            <div className="divide-y divide-slate-50 max-h-[240px] overflow-y-auto">
              {MOCK_SECTIONS.map(sec => {
                const cong = congestions.get(sec.section_id);
                const label = cong?.label ?? 'LOW';
                const score = cong ? Math.round(cong.score * 100) : 35;
                const barColor = label === 'HIGH' ? 'bg-red-500' : label === 'MODERATE' ? 'bg-amber-400' : 'bg-emerald-500';
                const textColor = label === 'HIGH' ? 'text-red-600' : label === 'MODERATE' ? 'text-amber-600' : 'text-emerald-600';
                return (
                  <div key={sec.section_id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700 truncate">{sec.from_station} → {sec.to_station}</span>
                      <span className={`text-[10px] font-bold ${textColor} ml-2 flex-shrink-0`}>{label} {score}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Train Side Panel ───────────────────────────────────────────── */}
      {sidePanelTrain && (
        <div className="fixed top-20 right-4 z-50 w-80 ctrl-slide-in" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          <div className="bg-[#0B1F3A] text-white rounded-2xl shadow-2xl border border-blue-900/50 overflow-hidden">
            <div className="flex items-start justify-between px-5 py-4 border-b border-blue-900/40">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Train className="w-4 h-4 text-sky-400" />
                  <span className="font-bold">{sidePanelTrain.trainName}</span>
                </div>
                <div className="text-xs text-slate-400 font-mono">#{sidePanelTrain.trainId}</div>
              </div>
              <button onClick={() => setSidePanelTrain(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                  sidePanelTrain.state.status === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                  sidePanelTrain.state.status === 'SIGNAL_HALT' ? 'bg-red-500/20 text-red-300 border-red-500/30 animate-pulse' :
                  'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>{sidePanelTrain.state.status.replace('_', ' ')}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                  sidePanelTrain.confidence === 'HIGH' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                  sidePanelTrain.confidence === 'MEDIUM' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                  'bg-red-500/15 text-red-300 border-red-500/30'
                }`}>{sidePanelTrain.confidence} Conf.</span>
              </div>
              {/* Speed + Delay */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Speed', val: sidePanelTrain.state.speed_kmph, unit: 'km/h', cls: 'text-sky-300' },
                  { label: 'Delay', val: sidePanelTrain.delay > 0 ? `+${sidePanelTrain.delay}` : '0', unit: 'min', cls: sidePanelTrain.delay > 0 ? 'text-red-400' : 'text-emerald-400' },
                ].map(({ label, val, unit, cls }) => (
                  <div key={label} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
                    <div className="text-[10px] uppercase font-mono text-slate-400 mb-1">{label}</div>
                    <div className={`text-xl font-bold tabular-nums ${cls}`}>{val}</div>
                    <div className="text-[10px] text-slate-400">{unit}</div>
                  </div>
                ))}
              </div>
              {/* Location */}
              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/50 space-y-1.5">
                {[
                  ['Section', sidePanelTrain.state.current_section ?? '—', 'text-white font-mono'],
                  ['Next station', sidePanelTrain.state.next_station ?? '—', 'text-sky-300 font-mono'],
                  ['Dist. to next', `${sidePanelTrain.state.distance_to_next_station_km.toFixed(1)} km`, 'text-white font-mono'],
                  ...(sidePanelTrain.eta ? [['ETA (P50)', sidePanelTrain.eta, 'text-emerald-300 font-mono font-bold']] : []),
                ].map(([k, v, cls]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-slate-400">{k}</span>
                    <span className={cls}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                <Navigation className="w-3 h-3" />
                {sidePanelTrain.state.latitude.toFixed(4)}°N, {sidePanelTrain.state.longitude.toFixed(4)}°E · Hdg {sidePanelTrain.state.heading}°
              </div>
              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a href={`/train/${sidePanelTrain.trainId}`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors">
                  <Eye className="w-3.5 h-3.5" /> Full Detail
                </a>
                <button
                  onClick={() => {
                    const a = alerts.find(al => al.trainId === sidePanelTrain.trainId && !al.acknowledged);
                    if (a) ackAlert(a.id);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors border border-slate-700">
                  <ThumbsUp className="w-3.5 h-3.5" /> Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Live Train Table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-blue-600" />
            Live Train Board
          </h2>
          <span className="text-[10px] font-mono text-slate-400">Updated {freshnessSeconds}s ago</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px]">
                {['Train', 'Status', 'Speed', 'Delay', 'Section', 'Next Stn', 'Risk', ''].map(h => (
                  <th key={h} className={`px-4 py-2.5 font-semibold ${['Speed','Delay'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {trains.map(t => {
                const color = trainRiskColor(t);
                const dotCls = { green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500 animate-pulse', grey: 'bg-slate-400' };
                const riskLabel = { green: 'Low', amber: 'Medium', red: 'High', grey: 'Stale' };
                const riskCls = { green: 'bg-green-50 text-green-700 border-green-200', amber: 'bg-amber-50 text-amber-700 border-amber-200', red: 'bg-red-50 text-red-700 border-red-200', grey: 'bg-slate-50 text-slate-500 border-slate-200' };
                return (
                  <tr key={t.train_id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleTrainClick(t.train_id)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{t.train_name}</div>
                      <div className="text-slate-400 font-mono text-[10px]">#{t.train_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotCls[color]}`} />
                        <span className="text-slate-700">{t.status.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 tabular-nums">{t.speed_kmph} km/h</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold tabular-nums ${t.delay_minutes > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {t.delay_minutes > 0 ? `+${t.delay_minutes}` : '0'} min
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">{t.current_section ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded font-mono font-semibold text-[10px]">{t.next_station ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${riskCls[color]}`}>{riskLabel[color]}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 inline" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom Row: AI Advisory + Telemetry ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm mb-3">
            <Zap className="w-4 h-4 text-purple-600" />
            AI Precedence Arbitrator
          </h3>
          <div className="space-y-3">
            {([
              { icon: ThumbsUp, cls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', title: 'Conflict Resolved', body: 'Mumbai Rajdhani (#12952) given green-wave priority over freight #G-994 at Kota outer. Delay savings: 18 min system-wide.', meta: '2m ago' },
              { icon: Info,     cls: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200',       title: 'Weather Factor Applied', body: 'Low-pressure system over Ratlam: ETA P90 inflated +3 min for SEC_KOTA_RATL trains.', meta: '8m ago' },
              { icon: Activity, cls: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     title: 'TSR Propagated', body: '45 km/h caution order near GGC–SWM propagated to all 5 corridor train ETAs.', meta: '14m ago' },
            ] as { icon: React.FC<{ className?: string }>; cls: string; bg: string; title: string; body: string; meta: string }[]).map(({ icon: Icon, cls, bg, title, body, meta }) => (
              <div key={title} className={`${bg} border rounded-xl p-3 flex gap-3`}>
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cls}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">{title}</span>
                    <span className="text-[9px] text-slate-400 flex-shrink-0">{meta}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#071324] text-white rounded-2xl border border-blue-900/40 shadow-sm p-5">
          <h3 className="font-bold flex items-center gap-2 text-sm mb-3">
            <Signal className="w-4 h-4 text-teal-400" />
            Simulator Telemetry
          </h3>
          <div className="space-y-0 font-mono text-xs divide-y divide-slate-800/60">
            {([
              ['WebSocket Feed',  connectionStatus === 'connected' ? '● LIVE' : '⚠ Reconnecting', connectionStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'],
              ['Data Freshness',  `${freshnessSeconds}s ago`, freshnessSeconds < 10 ? 'text-emerald-400' : 'text-amber-400'],
              ['Active Trains',   `${kpis.active} / ${DEMO_TRAINS.length}`, 'text-sky-300'],
              ['Corridor Segs',   `${MOCK_SECTIONS.length} sections`, 'text-sky-300'],
              ['Alerts',          `${alerts.length} total · ${unackCount} unacked`, unackCount > 0 ? 'text-amber-400' : 'text-emerald-400'],
              ['Network Health',  `${networkHealth.toFixed(0)}%`, networkHealth >= 80 ? 'text-emerald-400' : networkHealth >= 60 ? 'text-amber-400' : 'text-red-400'],
              ['ETA Engine',      'Probabilistic v2', 'text-purple-300'],
              ['WS Latency',      '< 14 ms', 'text-teal-300'],
            ] as [string, string, string][]).map(([label, val, cls]) => (
              <div key={label} className="flex justify-between items-center py-2">
                <span className="text-slate-400">{label}</span>
                <span className={cls}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
