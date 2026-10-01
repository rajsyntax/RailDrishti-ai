import React, { useState } from 'react';
import {
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Users,
  Building2,
  Sparkles,
  Send,
  Volume2,
  Layers
} from 'lucide-react';
import { StationActionCard, RoleCategory } from './stationTypes';

interface StationActionCenterProps {
  actions: StationActionCard[];
  onExecuteAction: (actionId: string) => void;
  onAcknowledgeAction: (actionId: string) => void;
  selectedStation: string;
}

const ROLE_TABS: { key: RoleCategory; label: string; icon: any }[] = [
  { key: 'ALL', label: 'All Stakeholders', icon: Users },
  { key: 'STATION_MASTER', label: 'Station Master', icon: Building2 },
  { key: 'PLATFORM_MGR', label: 'Platform Manager', icon: Layers },
  { key: 'CLEANING_CREW', label: 'Cleaning Team', icon: Sparkles },
  { key: 'PASSENGER_INFO', label: 'Passenger Info (PIDS)', icon: Volume2 },
  { key: 'FEEDER_TRANSPORT', label: 'Feeder Transport', icon: Zap },
];

export const StationActionCenter: React.FC<StationActionCenterProps> = ({
  actions,
  onExecuteAction,
  onAcknowledgeAction,
}) => {
  const [selectedRole, setSelectedRole] = useState<RoleCategory>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredActions = actions.filter((act) => {
    if (selectedRole === 'ALL') return true;
    return act.role === selectedRole;
  });

  const handleActionClick = (act: StationActionCard) => {
    onExecuteAction(act.id);
    setToastMessage(`Action Executed: "${act.title}" — Dispatched to ${act.role.replace('_', ' ')}.`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleAckClick = (act: StationActionCard, e: React.MouseEvent) => {
    e.stopPropagation();
    onAcknowledgeAction(act.id);
    setToastMessage(`Directive Acknowledged: "${act.title}"`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const getSeverityStyle = (sev: StationActionCard['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return {
          border: 'border-l-4 border-l-red-600 border-red-200/80',
          badge: 'bg-red-100 text-red-800 border-red-200',
          icon: AlertOctagon,
          iconColor: 'text-red-600',
          bg: 'bg-red-50/20',
        };
      case 'HIGH':
        return {
          border: 'border-l-4 border-l-amber-500 border-amber-200/80',
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: AlertTriangle,
          iconColor: 'text-amber-600',
          bg: 'bg-amber-50/20',
        };
      case 'MEDIUM':
        return {
          border: 'border-l-4 border-l-blue-500 border-blue-200/80',
          badge: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Clock,
          iconColor: 'text-blue-600',
          bg: 'bg-blue-50/10',
        };
      default:
        return {
          border: 'border-l-4 border-l-emerald-500 border-slate-200/80',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600',
          bg: 'bg-emerald-50/10',
        };
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden mb-6">
      
      {/* Toast feedback */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200/70 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <span>Station Action Center</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                {actions.length} Generated Directives
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Explainable AI recommendations for station staff, cleaning teams, platform coordinators, and passenger info operators.
            </p>
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {ROLE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = selectedRole === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedRole(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 opacity-80" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Cards Grid */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActions.map((act) => {
            const style = getSeverityStyle(act.severity);
            const isCompleted = act.status === 'COMPLETED';
            const isAcknowledged = act.status === 'ACKNOWLEDGED';

            return (
              <div
                key={act.id}
                className={`rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${style.border} ${style.bg} ${
                  isCompleted ? 'opacity-70 bg-slate-50' : 'bg-white'
                }`}
              >
                <div>
                  {/* Top Meta Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider ${style.badge}`}>
                      {act.severity} PRIORITY
                    </span>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{act.timestamp}</span>
                    </div>
                  </div>

                  {/* Title & Target Role */}
                  <h3 className="font-extrabold text-slate-900 text-sm leading-snug mb-1">
                    {act.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-2.5">
                    <span className="px-2 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                      Role: {act.role.replace('_', ' ')}
                    </span>
                    {act.platform && (
                      <span className="px-2 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                        PF {act.platform}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 leading-relaxed mb-3 font-normal">
                    {act.description}
                  </p>

                  {/* Operational Impact Box */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600 mb-3 flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800">Operational Value: </span>
                      <span>{act.impact}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Interactive Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-400">
                    Status: <span className={isCompleted ? 'text-emerald-600' : isAcknowledged ? 'text-blue-600' : 'text-amber-600'}>{act.status}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleAckClick(act, e)}
                      disabled={isCompleted || isAcknowledged}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-40"
                      title="Acknowledge directive"
                    >
                      {isAcknowledged ? 'Acked' : 'Acknowledge'}
                    </button>

                    <button
                      onClick={() => handleActionClick(act)}
                      disabled={isCompleted}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-40"
                    >
                      <span>{isCompleted ? 'Executed' : 'Execute'}</span>
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
