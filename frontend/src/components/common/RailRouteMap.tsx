import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CORRIDOR_STATIONS, StationDetail } from '../../services/railApi';

interface RailRouteMapProps {
  trainLat: number;
  trainLng: number;
  trainId: string;
  trainName: string;
  speed: number;
  selectedStationCode?: string;
  onStationSelect?: (stationCode: string) => void;
  height?: string;
  isCompact?: boolean;
}

export const RailRouteMap: React.FC<RailRouteMapProps> = ({
  trainLat,
  trainLng,
  trainId,
  trainName,
  speed,
  selectedStationCode,
  onStationSelect,
  height = '320px',
  isCompact = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const trainMarkerRef = useRef<L.Marker | null>(null);
  const stationMarkersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Avoid double initialization
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: !isCompact,
        attributionControl: false,
        scrollWheelZoom: !isCompact,
      });

      // CartoDB Positron / OpenStreetMap subtle clean tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;

      // Draw railway route line
      const routeCoords: L.LatLngExpression[] = CORRIDOR_STATIONS.map((s) => [s.latitude, s.longitude]);
      
      // Outer track glow line
      L.polyline(routeCoords, {
        color: '#1E3A8A',
        weight: isCompact ? 4 : 5,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Inner dashed track line (railway style)
      L.polyline(routeCoords, {
        color: '#38BDF8',
        weight: isCompact ? 2 : 2.5,
        dashArray: '6, 6',
        opacity: 0.95,
      }).addTo(map);

      // Station markers
      stationMarkersRef.current = CORRIDOR_STATIONS.map((st: StationDetail) => {
        const isSelected = st.code === selectedStationCode;
        const marker = L.circleMarker([st.latitude, st.longitude], {
          radius: isSelected ? 8 : (isCompact ? 5 : 6),
          fillColor: isSelected ? '#2563EB' : '#0F172A',
          color: isSelected ? '#60A5FA' : '#FFFFFF',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map);

        marker.bindTooltip(
          `<div class="text-xs font-sans font-semibold">
            <span class="font-mono text-blue-600 font-bold">${st.code}</span> - ${st.name}
          </div>`,
          { direction: 'top', offset: [0, -6] }
        );

        marker.on('click', () => {
          if (onStationSelect) {
            onStationSelect(st.code);
          }
        });

        return marker;
      });

      // Create Custom Animated Train Icon
      const trainIcon = L.divIcon({
        className: 'custom-train-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></span>
            <div class="relative z-10 w-7 h-7 rounded-full bg-[#0B1F3A] border-2 border-teal-400 shadow-lg flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="16" height="16" x="4" y="3" rx="2"/>
                <path d="M4 11h16"/>
                <path d="M12 3v8"/>
                <path d="m8 19-2 3"/>
                <path d="m18 22-2-3"/>
                <circle cx="8" cy="15" r="1"/>
                <circle cx="16" cy="15" r="1"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const trainMarker = L.marker([trainLat, trainLng], { icon: trainIcon, zIndexOffset: 1000 }).addTo(map);
      trainMarker.bindTooltip(
        `<div class="p-1 font-sans">
          <div class="font-bold text-slate-900">${trainId} ${trainName}</div>
          <div class="text-xs text-teal-700 font-mono font-semibold">${speed} km/h • LIVE GPS</div>
        </div>`,
        { direction: 'top', offset: [0, -14], permanent: false }
      );
      trainMarkerRef.current = trainMarker;

      // Fit bounds to route
      const bounds = L.latLngBounds(routeCoords);
      map.fitBounds(bounds, { padding: isCompact ? [20, 20] : [40, 40] });
    }

    return () => {
      // Map cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        trainMarkerRef.current = null;
        stationMarkersRef.current = [];
      }
    };
  }, []);

  // Update train position smoothly when coordinates change
  useEffect(() => {
    if (trainMarkerRef.current && trainLat && trainLng) {
      trainMarkerRef.current.setLatLng([trainLat, trainLng]);
      trainMarkerRef.current.setTooltipContent(
        `<div class="p-1 font-sans">
          <div class="font-bold text-slate-900">${trainId} ${trainName}</div>
          <div class="text-xs text-teal-700 font-mono font-semibold">${speed} km/h • LIVE GPS</div>
        </div>`
      );
    }
  }, [trainLat, trainLng, trainId, trainName, speed]);

  // Update selected station styling
  useEffect(() => {
    stationMarkersRef.current.forEach((marker, index) => {
      const st = CORRIDOR_STATIONS[index];
      if (!st) return;
      const isSelected = st.code === selectedStationCode;
      marker.setStyle({
        radius: isSelected ? 9 : (isCompact ? 5 : 6),
        fillColor: isSelected ? '#2563EB' : '#0F172A',
        color: isSelected ? '#60A5FA' : '#FFFFFF',
        weight: isSelected ? 3 : 2,
      });
    });
  }, [selectedStationCode, isCompact]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm bg-slate-100">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} className="z-10" />
      
      {/* Map Legend Overlay */}
      <div className="absolute bottom-2 left-2 z-20 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-200/80 shadow-sm text-[11px] flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-blue-300"></span>
          <span className="text-slate-700 font-medium">Train</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-900"></span>
          <span className="text-slate-600">Station</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-500"></span>
          <span className="text-slate-600">Corridor</span>
        </div>
      </div>

      {isCompact && (
        <div className="absolute top-2 right-2 z-20 bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
          <span>NDLS ⇄ MMCT</span>
        </div>
      )}
    </div>
  );
};
