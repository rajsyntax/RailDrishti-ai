import React from 'react';
import {
  Clock,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  CheckCircle2,
  BellRing
} from 'lucide-react';
import { StationKPIs } from './stationTypes';

interface StationKpiCardsProps {
  kpis: StationKPIs;
  onFilterClick?: (filterType: string) => void;
  activeFilter?: string | null;
}

export const StationKpiCards: React.FC<StationKpiCardsProps> = ({
  kpis,
  onFilterClick,
  activeFilter,
}) => {
  const cards = [
    {
      id: 'arrivals',
      title: 'Arrivals in Next 6 Hours',
      value: kpis.arrivalsCount.toString(),
      subtext: 'Corridor main line traffic',
      badge: '6h Window',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: Clock,
      iconColor: 'text-blue-600',
      gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
      borderColor: 'border-blue-200/80',
      accentColor: 'bg-blue-600',
    },
    {
      id: 'delayed',
      title: 'Delayed Arrivals',
      value: kpis.delayedCount.toString(),
      subtext: `${kpis.delayedPercentage}% of total arrivals late`,
      badge: kpis.delayedCount > 0 ? 'Action Needed' : 'Normal',
      badgeColor: kpis.delayedCount > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
      borderColor: 'border-amber-200/80',
      accentColor: 'bg-amber-600',
    },
    {
      id: 'high_risk',
      title: 'High-Risk Arrivals',
      value: kpis.highRiskCount.toString(),
      subtext: 'Low confidence or halt alert',
      badge: kpis.highRiskCount > 0 ? 'Critical Focus' : 'All Clear',
      badgeColor: kpis.highRiskCount > 0 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: AlertOctagon,
      iconColor: 'text-red-600',
      gradient: 'from-red-500/10 via-red-500/5 to-transparent',
      borderColor: 'border-red-200/80',
      accentColor: 'bg-red-600',
    },
    {
      id: 'conflicts',
      title: 'Platform Conflicts',
      value: kpis.platformConflictsCount.toString(),
      subtext: kpis.platformConflictsCount > 0 ? 'Short turnaround / overlap' : 'Zero track collision',
      badge: kpis.platformConflictsCount > 0 ? 'Collision Risk' : 'Clear',
      badgeColor: kpis.platformConflictsCount > 0 ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: ShieldAlert,
      iconColor: 'text-purple-600',
      gradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
      borderColor: 'border-purple-200/80',
      accentColor: 'bg-purple-600',
    },
    {
      id: 'confidence',
      title: 'Average ETA Confidence',
      value: `${kpis.avgEtaConfidenceScore}%`,
      subtext: `${kpis.avgEtaConfidenceLabel} confidence rating`,
      badge: kpis.avgEtaConfidenceLabel,
      badgeColor: kpis.avgEtaConfidenceLabel === 'HIGH' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
      borderColor: 'border-emerald-200/80',
      accentColor: 'bg-emerald-600',
    },
    {
      id: 'alerts',
      title: 'Alerts Requiring Action',
      value: kpis.alertsRequiringActionCount.toString(),
      subtext: 'Pending operational directives',
      badge: 'Action Center',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      icon: BellRing,
      iconColor: 'text-indigo-600',
      gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
      borderColor: 'border-indigo-200/80',
      accentColor: 'bg-indigo-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = activeFilter === card.id;

        return (
          <div
            key={card.id}
            onClick={() => onFilterClick && onFilterClick(card.id)}
            className={`relative overflow-hidden rounded-2xl bg-white border ${
              isSelected ? 'border-blue-600 ring-2 ring-blue-500/30' : card.borderColor
            } p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between`}
          >
            {/* Top Accent Strip */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${card.accentColor}`} />

            {/* Subtle Gradient Backdrop */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} pointer-events-none opacity-60`} />

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-500 leading-tight">
                  {card.title}
                </span>
                <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200/60 shadow-xs group-hover:scale-110 transition-transform">
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {card.value}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${card.badgeColor}`}>
                  {card.badge}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 truncate font-medium">
                {card.subtext}
              </p>
            </div>

            {/* Micro bottom progress bar indicator */}
            <div className="relative z-10 mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>View details</span>
              <span className="group-hover:translate-x-1 transition-transform font-bold text-slate-600">→</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
