import React, { useState, useMemo } from 'react';
import {
  Train,
  Clock,
  ArrowUpDown,
  Search,
  ChevronRight,
  Sparkles,
  Zap,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { StationArrivalData } from './stationTypes';

interface UpcomingArrivalsTableProps {
  arrivals: StationArrivalData[];
  selectedTrainId: string | null;
  onSelectTrain: (trainId: string) => void;
  activeFilter?: string | null;
}

type SortField = 'urgency' | 'eta' | 'scheduled' | 'delay' | 'platform' | 'confidence';

export const UpcomingArrivalsTable: React.FC<UpcomingArrivalsTableProps> = ({
  arrivals,
  selectedTrainId,
  onSelectTrain,
  activeFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('urgency');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Filter and sort arrivals
  const filteredArrivals = useMemo(() => {
    return arrivals.filter((a) => {
      // Search filter
      const matchesSearch =
        a.train_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.train_id.includes(searchTerm) ||
        `platform ${a.platform}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.recommended_action.toLowerCase().includes(searchTerm.toLowerCase());

      // Quick tab/KPI filter
      if (activeFilter === 'delayed' && a.predicted_delay_minutes <= 0) return false;
      if (activeFilter === 'high_risk' && a.confidence_label !== 'LOW' && a.status !== 'SIGNAL_HALT') return false;
      if (activeFilter === 'conflicts' && !a.has_conflict) return false;

      // Status pill filter
      if (statusFilter === 'DELAYED' && a.predicted_delay_minutes <= 0) return false;
      if (statusFilter === 'ON_TIME' && a.predicted_delay_minutes > 0) return false;
      if (statusFilter === 'CONFLICT' && !a.has_conflict) return false;
      if (statusFilter === 'HIGH_RISK' && a.confidence_label !== 'LOW') return false;

      return matchesSearch;
    });
  }, [arrivals, searchTerm, activeFilter, statusFilter]);

  const sortedArrivals = useMemo(() => {
    const list = [...filteredArrivals];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'urgency') {
        comparison = b.urgency_score - a.urgency_score;
      } else if (sortBy === 'delay') {
        comparison = b.predicted_delay_minutes - a.predicted_delay_minutes;
      } else if (sortBy === 'platform') {
        comparison = a.platform - b.platform;
      } else if (sortBy === 'confidence') {
        comparison = b.confidence_score - a.confidence_score;
      } else if (sortBy === 'eta') {
        comparison = a.arrival_date.getTime() - b.arrival_date.getTime();
      } else if (sortBy === 'scheduled') {
        comparison = a.scheduled_arrival.localeCompare(b.scheduled_arrival);
      }
      return sortAsc ? -comparison : comparison;
    });
    return list;
  }, [filteredArrivals, sortBy, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(field === 'eta' || field === 'scheduled' || field === 'platform');
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden mb-6">
      
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200/70 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Upcoming Arrivals
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">
                {sortedArrivals.length} Trains
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                Sorted by Urgency
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Dynamic multi-factor urgency ranking prioritizing delay severity, turnaround safety, and model uncertainty.
            </p>
          </div>

          {/* Search and Quick Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search train, PF, or status..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs">
              {(['ALL', 'DELAYED', 'CONFLICT', 'HIGH_RISK'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    statusFilter === filter
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {filter === 'ALL' ? 'All' : filter === 'DELAYED' ? 'Delayed' : filter === 'CONFLICT' ? 'Conflicts' : 'At Risk'}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4">
                <button
                  onClick={() => handleSort('urgency')}
                  className="flex items-center gap-1 hover:text-slate-900 font-bold"
                >
                  <span>Train No. & Name</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('scheduled')}
                  className="flex items-center gap-1 hover:text-slate-900 font-bold"
                >
                  <span>Scheduled</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('eta')}
                  className="flex items-center gap-1 hover:text-slate-900 font-bold"
                >
                  <span>Dynamic ETA</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">P10–P90 Range</th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('delay')}
                  className="flex items-center gap-1 hover:text-slate-900 font-bold"
                >
                  <span>Delay</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('confidence')}
                  className="flex items-center gap-1 hover:text-slate-900 font-bold"
                >
                  <span>Confidence</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('platform')}
                  className="flex items-center gap-1 hover:text-slate-900 font-bold"
                >
                  <span>Platform</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">Congestion</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-4 text-right">Recommended Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-xs">
            {sortedArrivals.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <Train className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                  <p className="font-semibold">No upcoming train arrivals match your filter criteria.</p>
                  <button
                    onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }}
                    className="mt-2 text-xs font-bold text-blue-600 hover:underline"
                  >
                    Reset all filters
                  </button>
                </td>
              </tr>
            ) : (
              sortedArrivals.map((train) => {
                const isSelected = selectedTrainId === train.train_id;

                return (
                  <tr
                    key={train.train_id}
                    onClick={() => onSelectTrain(train.train_id)}
                    className={`hover:bg-blue-50/60 transition-colors cursor-pointer group ${
                      isSelected ? 'bg-blue-50/90 font-medium' : ''
                    } ${train.has_conflict ? 'bg-purple-50/40' : ''}`}
                  >
                    
                    {/* 1. Train Number & Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                          train.has_conflict
                            ? 'bg-purple-100 text-purple-700 border border-purple-300'
                            : train.predicted_delay_minutes > 15
                            ? 'bg-amber-100 text-amber-700 border border-amber-300'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          <Train className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {train.train_name}
                            </span>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              #{train.train_id}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-normal">
                            <span>{train.source} → {train.destination}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-medium">{train.category}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Scheduled Arrival */}
                    <td className="py-3.5 px-3 font-mono text-slate-600 font-medium whitespace-nowrap">
                      {train.scheduled_arrival}
                    </td>

                    {/* 3. Dynamic ETA */}
                    <td className="py-3.5 px-3 font-mono font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`${
                          train.predicted_delay_minutes > 15
                            ? 'text-amber-700 font-extrabold'
                            : train.predicted_delay_minutes > 0
                            ? 'text-blue-800'
                            : 'text-emerald-700'
                        }`}>
                          {train.predicted_p50_eta}
                        </span>
                        {train.predicted_delay_minutes <= 0 && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                        )}
                      </div>
                    </td>

                    {/* 4. P10–P90 Range */}
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200/80 font-medium">
                        {train.predicted_p10_eta.split(' ')[0]} – {train.predicted_p90_eta.split(' ')[0]}
                      </span>
                    </td>

                    {/* 5. Delay */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {train.predicted_delay_minutes <= 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          On Time
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          train.predicted_delay_minutes > 15
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          <Clock className="w-3 h-3" />
                          +{train.predicted_delay_minutes} min
                        </span>
                      )}
                    </td>

                    {/* 6. Confidence */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border w-fit ${
                          train.confidence_label === 'HIGH'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : train.confidence_label === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                        }`}>
                          {train.confidence_label} ({Math.round(train.confidence_score * 100)}%)
                        </span>
                      </div>
                    </td>

                    {/* 7. Platform */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black border shadow-xs ${
                          train.has_conflict
                            ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-400/40 animate-pulse'
                            : 'bg-slate-900 text-white border-slate-800'
                        }`}>
                          PF {train.platform}
                        </span>
                        {train.has_conflict && (
                          <span title="Platform Headway Conflict!" className="text-purple-600">
                            <ShieldAlert className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 8. Congestion Level */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                        train.congestion === 'LOW'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : train.congestion === 'MODERATE'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {train.congestion}
                      </span>
                    </td>

                    {/* 9. Status */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${
                        train.status === 'RUNNING'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : train.status === 'SIGNAL_HALT'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {train.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* 10. Recommended Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200/80 transition-all">
                        <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate max-w-[220px]" title={train.recommended_action}>
                          {train.recommended_action}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
