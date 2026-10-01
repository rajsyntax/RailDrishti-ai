import { useState, useEffect, useRef, useCallback } from 'react';
import { railApi, TrainLiveState, DEMO_TRAINS, getMockLiveState } from './railApi';

export interface UseTrainLiveUpdatesResult {
  trains: TrainLiveState[];
  selectedTrainState: TrainLiveState | null;
  connectionStatus: 'connected' | 'reconnecting' | 'offline';
  freshnessSeconds: number;
  lastUpdated: Date;
  isStale: boolean;
  refresh: () => Promise<void>;
}

export function useTrainLiveUpdates(activeTrainId: string = '12952'): UseTrainLiveUpdatesResult {
  const [trains, setTrains] = useState<TrainLiveState[]>(() =>
    DEMO_TRAINS.map(t => getMockLiveState(t.train_id))
  );
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'offline'>('reconnecting');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [freshnessSeconds, setFreshnessSeconds] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manual or periodic fetch
  const fetchAllTrains = useCallback(async () => {
    try {
      const data = await railApi.getAllTrains();
      if (Array.isArray(data) && data.length > 0) {
        setTrains(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.warn('[useTrainLiveUpdates] Error polling trains:', err);
    }
  }, []);

  // Update freshness counter every second
  useEffect(() => {
    const timer = setInterval(() => {
      setFreshnessSeconds(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // Connect WebSocket with automatic fallback & reconnect
  useEffect(() => {
    let isCancelled = false;

    function connectWs() {
      if (isCancelled) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In Vite dev, proxy /ws/live-updates to ws://127.0.0.1:8000/ws/live-updates
      const wsUrl = `${protocol}//${window.location.host}/ws/live-updates`;

      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isCancelled) return;
          setConnectionStatus('connected');
          // Clear fallback poll when ws is healthy
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        };

        socket.onmessage = (event) => {
          if (isCancelled) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'TRAIN_UPDATE' && Array.isArray(msg.data)) {
              setTrains(msg.data);
              setLastUpdated(new Date());
              setFreshnessSeconds(0);
            }
          } catch (e) {
            console.error('[WebSocket] Parse error:', e);
          }
        };

        socket.onclose = () => {
          if (isCancelled) return;
          setConnectionStatus('reconnecting');
          // Start fallback polling if not already started
          if (!pollIntervalRef.current) {
            pollIntervalRef.current = setInterval(fetchAllTrains, 4000);
          }
          // Attempt WS reconnection in 5s
          reconnectTimeoutRef.current = setTimeout(connectWs, 5000);
        };

        socket.onerror = () => {
          if (isCancelled) return;
          setConnectionStatus('offline');
          // If WS fails, ensure polling is running
          if (!pollIntervalRef.current) {
            pollIntervalRef.current = setInterval(fetchAllTrains, 4000);
          }
          try {
            socket.close();
          } catch (e) {
            // ignore
          }
        };
      } catch (err) {
        setConnectionStatus('offline');
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(fetchAllTrains, 4000);
        }
        reconnectTimeoutRef.current = setTimeout(connectWs, 6000);
      }
    }

    // Initial fetch to get immediate data
    fetchAllTrains();
    connectWs();

    return () => {
      isCancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchAllTrains]);

  const selectedTrainState = trains.find(t => t.train_id === activeTrainId) || trains[0] || null;
  const isStale = freshnessSeconds > 45;

  return {
    trains,
    selectedTrainState,
    connectionStatus,
    freshnessSeconds,
    lastUpdated,
    isStale,
    refresh: fetchAllTrains,
  };
}
