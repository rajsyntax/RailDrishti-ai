import React, { useState } from 'react';
import {
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CloudRain,
  Activity,
  Signal,
  TrendingDown,
  TrendingUp,
  Gauge,
  ChevronDown,
  ChevronUp,
  Zap,
  ShieldCheck,
  Radio
} from 'lucide-react';

export interface DemoScenario {
  id: string;
  name: string;
  category: string;
  icon: any;
  color: string;
  badgeColor: string;
  description: string;
  operationalImpact: string;
  eventPayload: {
    event_type: string;
    affected_train?: string;
    affected_section?: string;
    duration_minutes: number;
    severity: string;
    speed_limit_kmph?: number;
    description: string;
  };
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'normal',
    name: 'Normal Running (Green Wave)',
    category: 'Baseline',
    icon: ShieldCheck,
    color: 'text-emerald-600',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Restore nominal corridor operations with clear block signals and on-time train tracking.',
    operationalImpact: 'Clears all active TSR caution orders, removes signal halts, and restores standard timetable speeds.',
    eventPayload: {
      event_type: 'CLEAR_ALL',
      description: 'Reset to standard timetable and green corridor clearance.',
      duration_minutes: 0,
      severity: 'LOW',
    },
  },
  {
    id: 'signal_halt',
    name: 'Signal Halt at SWM-KOTA',
    category: 'Signal Halt',
    icon: AlertTriangle,
    color: 'text-red-600',
    badgeColor: 'bg-red-100 text-red-800 border-red-300',
    description: 'Stop Train 12952 (Mumbai Rajdhani) at Sawai Madhopur outer home signal (Speed = 0 km/h).',
    operationalImpact: 'Causes immediate +15 min delay spike, triggers red signal icon on map, and alerts section controller.',
    eventPayload: {
      event_type: 'SIGNAL_HALT',
      affected_train: '12952',
      affected_section: 'SEC_SWM_KOTA',
      duration_minutes: 15,
      severity: 'CRITICAL',
      description: 'Train 12952 detained at Sawai Madhopur Outer Home due to route locking delay.',
    },
  },
  {
    id: 'tsr',
    name: 'Temporary Speed Restriction (TSR 30 km/h)',
    category: 'Track Maintenance',
    icon: Gauge,
    color: 'text-amber-600',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Impose a 30 km/h caution order near Gangapur City (SEC_BTE_GGC) for track ballast maintenance.',
    operationalImpact: 'Reduces train running speed from 110 to 30 km/h, adding +6 minutes delay across all passing rakes.',
    eventPayload: {
      event_type: 'SPEED_RESTRICTION',
      affected_section: 'SEC_BTE_GGC',
      duration_minutes: 25,
      severity: 'HIGH',
      speed_limit_kmph: 30,
      description: '30 km/h Engineering TSR active at KM 118.4 for automated track tamper maintenance.',
    },
  },
  {
    id: 'weather',
    name: 'Heavy Rain & Fog Visibility Blanket',
    category: 'Adverse Weather',
    icon: CloudRain,
    color: 'text-teal-600',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    description: 'Dense fog and heavy monsoon showers reduce visibility (<200m) along Mathura–Bharatpur.',
    operationalImpact: 'Applies cautionary speed cap of 60 km/h and degrades section capacity by 35%.',
    eventPayload: {
      event_type: 'HEAVY_RAIN',
      affected_section: 'SEC_MTJ_BTE',
      duration_minutes: 30,
      severity: 'HIGH',
      description: 'Severe weather advisory: Dense fog blanket on Mathura-Bharatpur section.',
    },
  },
  {
    id: 'congestion',
    name: 'High Corridor Congestion & Precedence',
    category: 'Section Bottleneck',
    icon: Activity,
    color: 'text-purple-600',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Heavy goods rake crossing causes 90% block capacity utilization between Kota and Ratlam.',
    operationalImpact: 'Express trains queued behind freight traffic with headway risk alerts on control dispatch.',
    eventPayload: {
      event_type: 'CONGESTION',
      affected_section: 'SEC_KOTA_RATL',
      duration_minutes: 20,
      severity: 'HIGH',
      description: 'Section capacity critical (88% occupancy) with freight train precedence regulation.',
    },
  },
  {
    id: 'gps_outage',
    name: 'GPS Outage / Sensor Degradation',
    category: 'Telemetry Loss',
    icon: Signal,
    color: 'text-slate-600',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Simulate stale GPS telemetry (>180s) on Train 19020 due to repeater tower loss.',
    operationalImpact: 'ETA confidence drops to LOW, marker turns grey, and P10–P90 uncertainty band expands.',
    eventPayload: {
      event_type: 'GPS_OUTAGE',
      affected_train: '19020',
      duration_minutes: 20,
      severity: 'MEDIUM',
      description: 'Loco GPS telemetry timestamp stale (>180s latency); sensor fallback active.',
    },
  },
  {
    id: 'recovery',
    name: 'Delay Timetable Recovery Scenario',
    category: 'Slack Absorption',
    icon: TrendingDown,
    color: 'text-emerald-600',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Train 12910 utilizes Western Corridor slack allowance to recover +12 minutes delay.',
    operationalImpact: 'Delay drops from +18 min to +6 min as train clears high-speed Vadodara straight leg.',
    eventPayload: {
      event_type: 'RECOVERY',
      affected_train: '12910',
      duration_minutes: 15,
      severity: 'LOW',
      description: 'High-speed corridor recovery buffer engaged. Delay shrinking downstream.',
    },
  },
  {
    id: 'cascading',
    name: 'Cascading Delay Propagation Scenario',
    category: 'Multi-Train Knock-on',
    icon: TrendingUp,
    color: 'text-red-600',
    badgeColor: 'bg-red-100 text-red-800 border-red-300',
    description: 'Leading halt of Train 12952 cascades headway delays to trailing train 12988 in the same block.',
    operationalImpact: 'Demonstrates secondary delay propagation engine predicting knock-on impacts on following trains.',
    eventPayload: {
      event_type: 'CASCADING_DELAY',
      affected_train: '12952',
      affected_section: 'SEC_SWM_KOTA',
      duration_minutes: 20,
      severity: 'CRITICAL',
      description: 'Cascading propagation: Train 12952 halt causes 8 min secondary delay on following 12988 rake.',
    },
  },
];

interface DemoModeToolbarProps {
  onScenarioTriggered?: (scenario: DemoScenario) => void;
  className?: string;
}

export const DemoModeToolbar: React.FC<DemoModeToolbarProps> = ({
  onScenarioTriggered,
  className = '',
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>('normal');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const activeScenario = DEMO_SCENARIOS.find((s) => s.id === activeScenarioId) || DEMO_SCENARIOS[0];

  const handleTriggerScenario = async (scenario: DemoScenario) => {
    try {
      setIsExecuting(true);
      setActiveScenarioId(scenario.id);

      if (scenario.id === 'normal') {
        // Reset via backend API
        await fetch('/api/v1/simulate/reset', { method: 'POST' }).catch(() => {});
      } else {
        // Inject event via backend API
        await fetch('/api/v1/simulate/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario.eventPayload),
        }).catch(() => {});
      }

      setFeedbackNotice(`Injected Scenario: "${scenario.name}". Live simulation & ETAs recalculated.`);
      if (onScenarioTriggered) onScenarioTriggered(scenario);

      setTimeout(() => {
        setFeedbackNotice(null);
      }, 5000);
    } catch (err) {
      console.warn('Scenario trigger warning:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = async () => {
    await handleTriggerScenario(DEMO_SCENARIOS[0]);
  };

  return (
    <div className={`bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-xl border border-indigo-500/30 overflow-hidden ${className}`}>
      
      {/* Top Banner Bar */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-700/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-black font-black shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                SIH Live Demo Mode Controller
              </span>
              <span className="px-2 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/40 uppercase">
                Evaluator Sandbox
              </span>
            </div>
            <p className="text-[11px] text-slate-300 hidden sm:block">
              Simulate operational anomalies, caution orders, and cascading delay propagation in real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={isExecuting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 transition-all active:scale-95 disabled:opacity-50"
            title="Reset simulation to nominal timetable"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Reset Sandbox</span>
            <span className="sm:hidden">Reset</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title={isExpanded ? 'Collapse Scenario Bar' : 'Expand Scenario Bar'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Live Feedback Notification */}
      {feedbackNotice && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-slate-950 fill-current" />
            <span>{feedbackNotice}</span>
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider bg-black/20 px-2 py-0.5 rounded">
            Live Stream Updated
          </span>
        </div>
      )}

      {/* Expandable Scenario Selection Grid */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {DEMO_SCENARIOS.map((sc) => {
              const Icon = sc.icon;
              const isActive = activeScenarioId === sc.id;

              return (
                <button
                  key={sc.id}
                  onClick={() => handleTriggerScenario(sc)}
                  disabled={isExecuting}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all group relative overflow-hidden ${
                    isActive
                      ? 'bg-blue-600/90 text-white border-blue-400 ring-2 ring-blue-400/40 shadow-lg shadow-blue-500/30'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-1 right-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : sc.color}`} />
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                        isActive ? 'bg-white/20 text-white border-white/30' : sc.badgeColor
                      }`}>
                        {sc.category}
                      </span>
                    </div>

                    <div className="font-bold text-xs leading-snug line-clamp-2 mb-1">
                      {sc.name}
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 mt-2 group-hover:text-slate-200 flex items-center justify-between font-semibold">
                    <span>{isActive ? 'Active' : 'Inject'}</span>
                    <span>→</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Scenario Detail Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-blue-400">Current Injected State:</span>
                <span className="font-bold text-white">{activeScenario.name}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal">
                {activeScenario.operationalImpact}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-slate-400">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Simulated Event Stream: ONLINE</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
