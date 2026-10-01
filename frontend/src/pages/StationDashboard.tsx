import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  railApi,
  DEMO_TRAINS,
  DynamicETAResponse
} from '../services/railApi';
import { useTrainLiveUpdates } from '../services/useTrainLiveUpdates';
import { StationHeader } from '../components/station/StationHeader';
import { StationKpiCards } from '../components/station/StationKpiCards';
import { UpcomingArrivalsTable } from '../components/station/UpcomingArrivalsTable';
import { PlatformOccupancyGantt } from '../components/station/PlatformOccupancyGantt';
import { StationActionCenter } from '../components/station/StationActionCenter';
import { TrainDetailDrawer } from '../components/station/TrainDetailDrawer';
import { PassengerBoardPreview } from '../components/station/PassengerBoardPreview';
import {
  getStationMeta,
  buildStationArrivals,
  computeStationKpis,
  generateStationActions
} from '../components/station/stationUtils';
import { StationActionCard } from '../components/station/stationTypes';

export const StationDashboard: React.FC = () => {
  // Selected Station: defaults to KOTA
  const [selectedStation, setSelectedStation] = useState<string>('KOTA');
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [platformOverrides, setPlatformOverrides] = useState<Record<string, number>>({});
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Live WebSocket + polling hook
  const {
    trains: liveTrains,
    connectionStatus,
    freshnessSeconds,
    refresh: refreshLiveTrains
  } = useTrainLiveUpdates('12952');

  // ETA predictions cache for all corridor trains
  const [trainEtas, setTrainEtas] = useState<Record<string, DynamicETAResponse>>({});
  const [actionsState, setActionsState] = useState<StationActionCard[]>([]);

  // Station Metadata
  const stationMeta = useMemo(() => getStationMeta(selectedStation), [selectedStation]);

  // Fetch ETAs for all 5 demo trains
  const loadAllEtas = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const promises = DEMO_TRAINS.map((t) => railApi.getTrainEta(t.train_id));
      const results = await Promise.all(promises);
      const etaMap: Record<string, DynamicETAResponse> = {};
      results.forEach((res) => {
        etaMap[res.train_id] = res;
      });
      setTrainEtas(etaMap);
    } catch (err) {
      console.warn('Error fetching station train ETAs:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllEtas();
    const interval = setInterval(loadAllEtas, 12000);
    return () => clearInterval(interval);
  }, [loadAllEtas]);

  // Compute live station arrivals
  const arrivals = useMemo(() => {
    return buildStationArrivals(
      selectedStation,
      liveTrains,
      trainEtas,
      platformOverrides
    );
  }, [selectedStation, liveTrains, trainEtas, platformOverrides]);

  // Compute KPIs
  const kpis = useMemo(() => computeStationKpis(arrivals), [arrivals]);

  // Generate / initialize action center directives
  useEffect(() => {
    const generated = generateStationActions(arrivals, selectedStation);
    setActionsState((prev) => {
      // Preserve existing statuses if matching ID
      return generated.map((gen) => {
        const existing = prev.find((p) => p.id === gen.id);
        if (existing) {
          return { ...gen, status: existing.status };
        }
        return gen;
      });
    });
  }, [arrivals, selectedStation]);

  // Currently selected train object for detail drawer
  const selectedTrainData = useMemo(() => {
    if (!selectedTrainId) return null;
    return arrivals.find((a) => a.train_id === selectedTrainId) || null;
  }, [selectedTrainId, arrivals]);

  // Platform Reassignment Handler
  const handleReassignPlatform = (trainId: string, newPlatform: number) => {
    setPlatformOverrides((prev) => ({
      ...prev,
      [trainId]: newPlatform,
    }));
  };

  // Action Center Handlers
  const handleExecuteAction = (actionId: string) => {
    setActionsState((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: 'COMPLETED' } : a))
    );
  };

  const handleAcknowledgeAction = (actionId: string) => {
    setActionsState((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: 'ACKNOWLEDGED' } : a))
    );
  };

  const handleManualRefresh = async () => {
    await Promise.all([refreshLiveTrains(), loadAllEtas()]);
  };

  const handleKpiFilterClick = (filterId: string) => {
    setActiveKpiFilter((prev) => (prev === filterId ? null : filterId));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* 1. Header: Station selector, live status, timestamp, prototype mode */}
      <StationHeader
        selectedStation={selectedStation}
        stationMeta={stationMeta}
        onSelectStation={(code) => {
          setSelectedStation(code);
          setPlatformOverrides({});
        }}
        connectionStatus={connectionStatus}
        freshnessSeconds={freshnessSeconds}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* 2. KPI Cards: 6 core operational metrics */}
      <StationKpiCards
        kpis={kpis}
        onFilterClick={handleKpiFilterClick}
        activeFilter={activeKpiFilter}
      />

      {/* 3. Upcoming Arrivals Table: Urgency sorted, dynamic ETAs, confidence */}
      <UpcomingArrivalsTable
        arrivals={arrivals}
        selectedTrainId={selectedTrainId}
        onSelectTrain={(trainId) => setSelectedTrainId(trainId)}
        activeFilter={activeKpiFilter}
      />

      {/* 4. Platform Occupancy View: Gantt timeline, turnaround buffers, conflicts */}
      <PlatformOccupancyGantt
        arrivals={arrivals}
        stationMeta={stationMeta}
        selectedTrainId={selectedTrainId}
        onSelectTrain={(trainId) => setSelectedTrainId(trainId)}
        onReassignPlatform={handleReassignPlatform}
      />

      {/* 5. Action Center: Stakeholder action cards & directives */}
      <StationActionCenter
        actions={actionsState}
        onExecuteAction={handleExecuteAction}
        onAcknowledgeAction={handleAcknowledgeAction}
        selectedStation={selectedStation}
      />

      {/* 7. Passenger Board Preview Panel: Public display board simulation */}
      <PassengerBoardPreview
        arrivals={arrivals}
        stationMeta={stationMeta}
        selectedTrainId={selectedTrainId}
        onSelectTrain={(trainId) => setSelectedTrainId(trainId)}
      />

      {/* 6. Train Detail Drawer: Slide-over telemetry & route progression */}
      {selectedTrainData && (
        <TrainDetailDrawer
          train={selectedTrainData}
          stationMeta={stationMeta}
          onClose={() => setSelectedTrainId(null)}
          onReassignPlatform={handleReassignPlatform}
        />
      )}

    </div>
  );
};

export default StationDashboard;
