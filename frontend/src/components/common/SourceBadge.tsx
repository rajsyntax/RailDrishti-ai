import React from 'react';
import { Radio, AlertTriangle, Cloud, ShieldCheck } from 'lucide-react';

interface SourceBadgeProps {
  mode?: string;
  source?: string;
  compact?: boolean;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ mode, source, compact = false }) => {
  const getBadgeConfig = () => {
    if (mode === 'LIVE_API' || source === 'THIRD_PARTY_API') {
      return {
        icon: Cloud,
        label: compact ? 'Live API' : 'Live Third-Party Train Status',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }
    if (mode === 'HYBRID') {
      return {
        icon: Radio,
        label: compact ? 'Hybrid' : 'Hybrid API + Simulator',
        className: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    }
    if (mode === 'PRODUCTION_AUTHORIZED') {
      return {
        icon: ShieldCheck,
        label: compact ? 'Authorized' : 'Authorized Railway Feed',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    return {
      icon: AlertTriangle,
      label: compact ? 'Simulated' : 'Prototype Simulation Data',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${config.className}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
    </div>
  );
};
