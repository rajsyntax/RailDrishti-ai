import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Train, MapPin, Compass, AlertTriangle, CheckCircle2, ChevronRight,
  Sparkles, ArrowRight, Bell, ShieldCheck, Clock, RefreshCw, Radio,
  TrendingDown, TrendingUp, Minus, Info, Check, Loader2
} from 'lucide-react';
import {
  DEMO_TRAINS, CORRIDOR_STATIONS, railApi, DynamicETAResponse,
  ETAPerStation
} from '../services/railApi';
import { useTrainLiveUpdates } from '../services/useTrainLiveUpdates';
import { RailRouteMap } from '../components/common/RailRouteMap';
import { NotifyModal } from '../components/common/NotifyModal';
import { PrototypeBadge } from '../components/common/PrototypeBadge';

export const PassengerPage: React.FC = () => {
  const navigate = useNavigate();

  // Selected Active Train (defaults to 12952 Mumbai Rajdhani)
  const [selectedTrainId, setSelectedTrainId] = useState<string>('12952');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStationCode, setSelectedStationCode] = useState<string>('KOTA');
  const [lang, setLang] = useState<'EN' | 'HI'>('EN');

  // Modal and Toast state
  const [isNotifyOpen, setIsNotifyOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live WebSocket state from backend
  const {
    trains,
    selectedTrainState,
    connectionStatus,
    freshnessSeconds,
    isStale,
    refresh
  } = useTrainLiveUpdates(selectedTrainId);

  // Dynamic ETA state for active train
  const [etaData, setEtaData] = useState<DynamicETAResponse | null>(null);
  const [isLoadingEta, setIsLoadingEta] = useState<boolean>(true);
  const [etaError, setEtaError] = useState<string | null>(null);

  // Fetch full Dynamic ETA intelligence whenever selected train changes
  useEffect(() => {
    let isCancelled = false;
    async function loadEta() {
      setIsLoadingEta(true);
      setEtaError(null);
      try {
        const data = await railApi.getTrainEta(selectedTrainId);
        if (!isCancelled) {
          setEtaData(data);
          // Default selected station to next station or destination if not set or invalid
          if (data.upcoming_stations_eta && data.upcoming_stations_eta.length > 0) {
            const hasCurrentSelected = data.upcoming_stations_eta.some(s => s.station_code === selectedStationCode);
            if (!hasCurrentSelected) {
              setSelectedStationCode(data.upcoming_stations_eta[0].station_code);
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setEtaError('Unable to load real-time ETA engine. Using offline fallback.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingEta(false);
        }
      }
    }

    loadEta();
    return () => {
      isCancelled = true;
    };
  }, [selectedTrainId]);

  // Periodic ETA refresh sync with live simulation
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const data = await railApi.getTrainEta(selectedTrainId);
        setEtaData(data);
      } catch (e) {
        // silent
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [selectedTrainId]);

  // Filtered trains for search bar
  const filteredTrains = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return DEMO_TRAINS;
    return DEMO_TRAINS.filter(
      (t) =>
        t.train_id.includes(query) ||
        t.train_name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.source_station.toLowerCase().includes(query) ||
        t.destination_station.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Active train metadata
  const activeMeta = useMemo(() => {
    return DEMO_TRAINS.find((t) => t.train_id === selectedTrainId) || DEMO_TRAINS[0];
  }, [selectedTrainId]);

  // Live state for active train
  const liveState = useMemo(() => {
    return trains.find((t) => t.train_id === selectedTrainId) || selectedTrainState || etaData?.current_live_state;
  }, [trains, selectedTrainId, selectedTrainState, etaData]);

  // Selected station ETA details from the upcoming list
  const targetStationETA: ETAPerStation | null = useMemo(() => {
    if (!etaData || !etaData.upcoming_stations_eta) return null;
    const found = etaData.upcoming_stations_eta.find((s) => s.station_code === selectedStationCode);
    return found || etaData.upcoming_stations_eta[0] || null;
  }, [etaData, selectedStationCode]);

  // Station name lookup
  const targetStationName = useMemo(() => {
    const st = CORRIDOR_STATIONS.find((s) => s.code === selectedStationCode);
    return st ? `${st.name} (${st.code})` : selectedStationCode;
  }, [selectedStationCode]);

  // Bilingual strings
  const t = {
    EN: {
      heroBadge: 'Dynamic AI-Powered ETA Engine',
      heroTitle: 'Indian Railways Dynamic ETA & Journey Radar',
      heroDesc: 'Know with surgical precision where your train is, when it will arrive at your station, and why delays occur across the NDLS-MMCT Golden Corridor.',
      searchPlaceholder: 'Search by train number or name (e.g. 12952, Rajdhani, Gujarat Mail)...',
      q1Title: 'Where is my train?',
      q2Title: 'When will it arrive?',
      q3Title: 'How confident is the estimate?',
      q4Title: 'Why has the ETA changed?',
      selectTrain: 'Demo Corridor Trains',
      liveSection: 'Current Section',
      liveSpeed: 'Current Speed',
      liveDelay: 'Active Delay',
      onTime: 'On Schedule (Right Time)',
      delayed: 'Delayed',
      targetStation: 'Arriving At Station',
      scheduledArrival: 'Scheduled Arrival',
      expectedArrival: 'Expected Arrival (P50)',
      arrivalWindow: 'Confidence Range (P10 – P90)',
      confidenceHigh: 'High Confidence',
      confidenceMed: 'Moderate Confidence',
      confidenceLow: 'Low Confidence / Wide Spread',
      confidenceDesc: 'Based on sectional runtime distributions and live block occupancy',
      updated: 'Updated',
      secondsAgo: 's ago',
      delayTrend: 'Delay Trend',
      improving: 'Improving (-2 min recovery)',
      stable: 'Stable Schedule',
      worsening: 'Worsening (+delay ahead)',
      topReasons: 'Primary Factors Influencing ETA',
      recoveryTitle: 'Schedule Recovery Probability',
      recoveryDesc: 'Likelihood of absorbing delay using timetable slack before destination',
      routeProgression: 'Route Station Progression',
      compactMapTitle: 'Corridor Satellite Radar',
      notifyButton: 'Notify Me of Delay Changes',
      viewDetails: 'Full Technical Breakdown & Congestion Matrix',
      emptySearch: 'No trains matched your search query',
      emptySearchDesc: 'Try searching with 12952, 12413, Rajdhani, or Gujarat Mail.',
      staleWarning: 'Telemetry stale: live connection interrupted (>45s ago). Displaying cached estimates.',
      completed: 'Departed',
      current: 'Live Position',
      upcoming: 'Upcoming',
      loadingEta: 'Calculating dynamic arrival probabilities...',
      offlineNotice: 'Operating on simulated corridor telemetry',
    },
    HI: {
      heroBadge: 'एआई-संचालित गतिशील आगमन समय (ETA) इंजन',
      heroTitle: 'भारतीय रेल लाइव ट्रेन आगमन समय एवं रडार',
      heroDesc: 'जानें आपकी ट्रेन वर्तमान में कहाँ है, आपके स्टेशन पर कब पहुँचेगी और मार्ग में देरी के वास्तविक कारण क्या हैं।',
      searchPlaceholder: 'ट्रेन नंबर या नाम खोजें (उदा. 12952, राजधानी, गुजरात मेल)...',
      q1Title: 'मेरी ट्रेन कहाँ है?',
      q2Title: 'यह स्टेशन पर कब पहुँचेगी?',
      q3Title: 'अनुमान कितना सटीक है?',
      q4Title: 'समय में बदलाव का क्या कारण है?',
      selectTrain: 'कॉरिडोर डेमो ट्रेनें',
      liveSection: 'वर्तमान रेल खंड',
      liveSpeed: 'वर्तमान गति',
      liveDelay: 'वर्तमान विलंब',
      onTime: 'सही समय पर (राइट टाइम)',
      delayed: 'विलंबित',
      targetStation: 'गंतव्य/आगमन स्टेशन',
      scheduledArrival: 'निर्धारित समय',
      expectedArrival: 'अनुमानित आगमन (P50)',
      arrivalWindow: 'संभावित समय विंडो (P10 – P90)',
      confidenceHigh: 'उच्च विश्वसनीयता',
      confidenceMed: 'मध्यम विश्वसनीयता',
      confidenceLow: 'निम्न विश्वसनीयता / व्यापक अंतराल',
      confidenceDesc: 'अनुभागीय इतिहास एवं लाइव ट्रैक ट्रैफिक के आधार पर',
      updated: 'अद्यतन',
      secondsAgo: 'सेकंड पूर्व',
      delayTrend: 'विलंब प्रवृत्ति',
      improving: 'सुधर रहा है',
      stable: 'स्थिर समय',
      worsening: 'विलंब बढ़ रहा है',
      topReasons: 'आगमन समय प्रभावित करने वाले कारक',
      recoveryTitle: 'समय भरपाई की संभावना',
      recoveryDesc: 'गंतव्य से पूर्व समय सुधार की अनुमानित संभावना',
      routeProgression: 'स्टेशन मार्ग प्रगति',
      compactMapTitle: 'लाइव ट्रैक रडार मैप',
      notifyButton: 'आगमन एवं विलंब अलर्ट प्राप्त करें',
      viewDetails: 'विस्तृत परिचालन एवं कंजेशन विवरण देखें',
      emptySearch: 'कोई ट्रेन नहीं मिली',
      emptySearchDesc: 'कृपया 12952, राजधानी या गुजरात मेल से खोजें।',
      staleWarning: 'चेतावनी: डेटा 45 सेकंड से अधिक पुराना है।',
      completed: 'प्रस्थान कर चुकी',
      current: 'वर्तमान स्थिति',
      upcoming: 'आगामी',
      loadingEta: 'गतिशील आगमन संभावनाओं की गणना की जा रही है...',
      offlineNotice: 'सिम्युलेटेड कॉरिडोर टेलीमेट्री पर कार्यरत',
    }
  }[lang];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-teal-500/40 flex items-start gap-3 animate-slide-up">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <div className="font-bold text-teal-300 mb-0.5">Alert Registered</div>
            <p className="text-slate-300 leading-relaxed">{toastMessage}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stale Data Warning Banner */}
      {isStale && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{t.staleWarning}</span>
          </div>
          <button
            onClick={refresh}
            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Top Banner / Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071324] via-[#0B1F3A] to-[#1E3A8A] text-white p-6 sm:p-8 shadow-xl border border-blue-900/60">
        <div className="absolute -right-8 -bottom-10 opacity-10 pointer-events-none">
          <Train className="w-72 h-72 text-teal-300" />
        </div>

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>{t.heroBadge}</span>
            </div>

            {/* Language & Live Indicator */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-teal-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-slate-300">{connectionStatus === 'connected' ? 'WebSocket Live' : 'Polling Sync'}</span>
              </div>
              
              <button
                onClick={() => setLang(l => l === 'EN' ? 'HI' : 'EN')}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold transition-colors"
                title="Switch Language / भाषा बदलें"
              >
                {lang === 'EN' ? 'हिन्दी' : 'English'}
              </button>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {t.heroTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            {t.heroDesc}
          </p>

          {isLoadingEta && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-400/20 text-teal-200 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t.loadingEta}</span>
            </div>
          )}

          {etaError && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t.offlineNotice}</span>
            </div>
          )}

          {/* Search Bar */}
          <div className="pt-2 relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-11 pr-10 py-3 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400 shadow-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Train Selection Chips (5 Demo Trains) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#0B1F3A] uppercase tracking-wider flex items-center gap-1.5">
            <Train className="w-3.5 h-3.5 text-blue-600" />
            <span>{t.selectTrain}</span>
          </span>
          <span className="text-slate-500 font-medium">Click to inspect active journey</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {DEMO_TRAINS.map((train) => {
            const isSelected = train.train_id === selectedTrainId;
            const liveInfo = trains.find((t) => t.train_id === train.train_id);
            const delay = liveInfo?.delay_minutes ?? 0;
            const isDelayed = delay > 0;

            return (
              <button
                key={train.train_id}
                onClick={() => setSelectedTrainId(train.train_id)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${
                  isSelected
                    ? 'bg-[#0B1F3A] border-blue-600 text-white shadow-md ring-2 ring-blue-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono font-black text-xs px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'
                  }`}>
                    {train.train_id}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isDelayed
                      ? isSelected ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                      : isSelected ? 'bg-teal-500/20 text-teal-300' : 'bg-green-100 text-green-700'
                  }`}>
                    {isDelayed ? `+${delay}m` : 'RT'}
                  </span>
                </div>
                <div className="font-bold text-xs truncate mb-0.5" title={train.train_name}>
                  {train.train_name}
                </div>
                <div className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                  {train.source_station} → {train.destination_station}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State when Search has no matches */}
      {filteredTrains.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-800">{t.emptySearch}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">{t.emptySearchDesc}</p>
          <button
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
          >
            Clear Search Filter
          </button>
        </div>
      )}

      {/* 4-Question Hero Architecture & Large Main ETA Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Primary 3-Second ETA Hero Card */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md overflow-hidden transition-all">
            
            {/* Top Header of Main Card */}
            <div className="bg-gradient-to-r from-[#0B1F3A] to-[#102A4E] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded bg-blue-600 font-mono font-black text-sm tracking-wider">
                    {activeMeta.train_id}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-teal-300 border border-white/10 font-medium">
                    {activeMeta.category}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    liveState?.status === 'RUNNING'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : liveState?.status === 'SIGNAL_HALT'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                    <span>{liveState?.status || 'RUNNING'}</span>
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {activeMeta.train_name}
                </h2>

                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="font-semibold text-white">{activeMeta.source_station} (New Delhi)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                  <span className="font-semibold text-white">{activeMeta.destination_station} (Mumbai Central)</span>
                  <span className="text-slate-400">• Corridor: 1,386 km</span>
                </div>
              </div>

              {/* Freshness & Notify Actions */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10">
                <div className="text-[11px] text-slate-300 flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>{t.updated} {freshnessSeconds}{t.secondsAgo}</span>
                </div>

                <button
                  onClick={() => setIsNotifyOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-teal-500/20 transition-all hover:scale-102"
                >
                  <Bell className="w-3.5 h-3.5 fill-current" />
                  <span>{t.notifyButton}</span>
                </button>
              </div>
            </div>

            {/* 3-Second Answers Grid */}
            <div className="p-5 sm:p-6 space-y-6">

              {/* 4 Essential Passenger Answers Banner */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. WHERE IS MY TRAIN? */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>1. {t.q1Title}</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      LIVE TELEMETRY
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-extrabold text-slate-900">
                      {liveState?.current_section || 'SEC_SWM_KOTA (Sawai Madhopur - Kota)'}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-mono font-semibold text-teal-700">
                        <Compass className="w-3.5 h-3.5" />
                        <span>{liveState?.speed_kmph ?? 110} km/h</span>
                      </span>
                      <span>•</span>
                      <span>Next: <strong className="text-slate-800">{liveState?.next_station || 'KOTA'}</strong> ({liveState?.distance_to_next_station_km ?? 18} km)</span>
                    </div>
                  </div>
                </div>

                {/* 3. HOW CONFIDENT IS THE ESTIMATE? */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                      <span>3. {t.q3Title}</span>
                    </span>
                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      (targetStationETA?.confidence_label || etaData?.confidence_label) === 'HIGH'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : (targetStationETA?.confidence_label || etaData?.confidence_label) === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-200 text-slate-800'
                    }`}>
                      {(targetStationETA?.confidence_label || etaData?.confidence_label || 'HIGH')} CONFIDENCE
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {((targetStationETA?.confidence_label || etaData?.confidence_label) === 'HIGH')
                          ? 'Narrow ETA Spread (±4 mins)'
                          : 'Operational Variance Buffered (±8 mins)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {t.confidenceDesc}
                    </p>
                  </div>
                </div>

              </div>

              {/* 2. WHEN WILL IT ARRIVE AT MY STATION? (THE VISUAL HERO) */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1F3A] via-[#102A4E] to-[#1E3A8A] text-white p-6 shadow-xl border border-blue-900">
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-4">
                  
                  {/* Station Selector Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] uppercase tracking-wider text-teal-300 font-bold block">
                          2. {t.q2Title}
                        </span>
                        <span className="text-xs text-slate-300">
                          Select your destination station along the route:
                        </span>
                      </div>
                    </div>

                    {/* Dropdown Selector */}
                    <div className="relative min-w-[200px]">
                      <select
                        value={selectedStationCode}
                        onChange={(e) => setSelectedStationCode(e.target.value)}
                        className="w-full bg-[#071324] text-white border border-teal-400/40 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-400"
                      >
                        {(etaData?.upcoming_stations_eta && etaData.upcoming_stations_eta.length > 0
                          ? etaData.upcoming_stations_eta
                          : CORRIDOR_STATIONS.slice(1)
                        ).map((st: any) => (
                          <option key={st.station_code || st.code} value={st.station_code || st.code}>
                            {st.station_name || st.name} ({st.station_code || st.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Main Hero Metrics Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                    
                    {/* Primary Hero: Expected Arrival (P50) */}
                    <div className="sm:col-span-2 space-y-1">
                      <div className="text-xs font-semibold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-teal-400" />
                        <span>{t.expectedArrival}</span>
                      </div>
                      
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono">
                          {targetStationETA?.predicted_p50_eta || etaData?.predicted_p50_eta || '15:05 IST'}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400 line-through">
                            Sch: {targetStationETA?.scheduled_arrival || etaData?.scheduled_arrival || '15:14 IST'}
                          </span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            (targetStationETA?.predicted_delay ?? 0) > 0
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                              : 'bg-teal-400/20 text-teal-300 border border-teal-400/30'
                          }`}>
                            {(targetStationETA?.predicted_delay ?? 0) > 0
                              ? `+${targetStationETA?.predicted_delay}m Delay`
                              : 'On Time'}
                          </span>
                        </div>
                      </div>

                      {/* Probabilistic Window P10 - P90 */}
                      <div className="pt-2 flex items-center gap-2 text-xs text-slate-300">
                        <span className="font-semibold text-slate-400">{t.arrivalWindow}:</span>
                        <span className="font-mono font-bold text-teal-200 bg-white/10 px-2 py-0.5 rounded border border-white/10">
                          {targetStationETA?.predicted_p10_eta || '14:58'} – {targetStationETA?.predicted_p90_eta || '15:20'}
                        </span>
                      </div>
                    </div>

                    {/* Delay Trend Badge & Stats */}
                    <div className="bg-[#071324]/80 p-4 rounded-xl border border-white/10 flex flex-col justify-between space-y-2">
                      <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                        {t.delayTrend}
                      </div>

                      <div className="flex items-center gap-2">
                        {targetStationETA?.delay_trend === 'IMPROVING' || etaData?.delay_trend === 'IMPROVING' ? (
                          <div className="flex items-center gap-1.5 text-teal-400 font-extrabold text-sm">
                            <TrendingDown className="w-5 h-5" />
                            <span>{t.improving}</span>
                          </div>
                        ) : targetStationETA?.delay_trend === 'WORSENING' || etaData?.delay_trend === 'WORSENING' ? (
                          <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-sm">
                            <TrendingUp className="w-5 h-5" />
                            <span>{t.worsening}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-blue-300 font-extrabold text-sm">
                            <Minus className="w-5 h-5" />
                            <span>{t.stable}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400">
                        Target Station: <strong className="text-white">{targetStationName}</strong>
                      </div>
                    </div>

                  </div>

                </div>
              </div>

              {/* 4. WHY HAS THE ETA CHANGED? (PLAIN-LANGUAGE EXPLANATION) */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>4. {t.q4Title}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Plain-Language Factors (No ML Jargon)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(targetStationETA?.top_eta_factors && targetStationETA.top_eta_factors.length > 0
                    ? targetStationETA.top_eta_factors
                    : etaData?.top_eta_factors || []
                  ).slice(0, 3).map((factor, idx) => {
                    const isPositiveDelay = factor.delta_min > 0;
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isPositiveDelay
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : 'bg-teal-50/70 border-teal-200 text-teal-950'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs mb-1">
                          <span className="truncate">{factor.label}</span>
                          <span className={`font-mono text-xs px-1.5 py-0.2 rounded font-black ${
                            isPositiveDelay ? 'bg-amber-200/80 text-amber-900' : 'bg-teal-200/80 text-teal-900'
                          }`}>
                            {factor.delta_min > 0 ? `+${factor.delta_min}m` : `${factor.delta_min}m`}
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

              {/* Recovery Probability Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-teal-50/60 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    <span>{t.recoveryTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 max-w-lg">
                    {t.recoveryDesc}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xl font-black font-mono text-blue-900">
                      {Math.round(((targetStationETA?.recovery_probability ?? etaData?.recovery_probability ?? 0.82)) * 100)}%
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold">High Recovery Headroom</div>
                  </div>
                  <div className="w-16 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-600 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(((targetStationETA?.recovery_probability ?? etaData?.recovery_probability ?? 0.82)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Actions Link to Detailed Train Page */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-500 font-medium">
                Want station-by-station tables, live block signals, and congestion matrix?
              </span>
              <button
                onClick={() => navigate(`/train/${activeMeta.train_id}`)}
                className="px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <span>{t.viewDetails}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* Route Timeline with Completed, Current, and Future Stations */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>{t.routeProgression}</span>
              </h3>
              <span className="text-xs text-slate-500">
                Click any upcoming station to inspect its arrival time
              </span>
            </div>

            <div className="relative border-l-2 border-slate-200 ml-4 sm:ml-6 space-y-5 py-2">
              {CORRIDOR_STATIONS.map((station, idx) => {
                const currentStnCode = liveState?.current_station || 'SWM';
                const nextStnCode = liveState?.next_station || 'KOTA';
                const currentIdx = CORRIDOR_STATIONS.findIndex(s => s.code === currentStnCode);
                const isCompleted = idx < currentIdx;
                const isCurrent = station.code === currentStnCode || station.code === nextStnCode;
                const isSelected = station.code === selectedStationCode;

                const stationEta = etaData?.upcoming_stations_eta?.find(s => s.station_code === station.code);

                return (
                  <div
                    key={station.code}
                    onClick={() => {
                      if (!isCompleted) {
                        setSelectedStationCode(station.code);
                      }
                    }}
                    className={`relative pl-6 cursor-pointer group ${
                      isCompleted ? 'opacity-70' : 'opacity-100'
                    }`}
                  >
                    {/* Circle Node */}
                    <div
                      className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 ring-4 ring-blue-300'
                          : isCurrent
                          ? 'border-teal-500 bg-white ring-4 ring-teal-400/40 animate-pulse'
                          : isCompleted
                          ? 'border-slate-400 bg-slate-400'
                          : 'border-slate-300 bg-white group-hover:border-blue-400'
                      }`}
                    />

                    <div
                      className={`p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-300 shadow-sm'
                          : isCurrent
                          ? 'bg-teal-50/50 border-teal-200'
                          : 'bg-slate-50/40 border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                            {station.code}
                          </span>
                          <span className="font-bold text-sm text-slate-900">{station.name}</span>
                          
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-teal-500 text-white font-extrabold text-[10px] animate-pulse">
                              LIVE TRAIN PROXIMITY
                            </span>
                          )}

                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px]">
                              SELECTED TARGET
                            </span>
                          )}
                        </div>

                        {/* Station ETA info */}
                        <div className="flex items-center gap-4 text-xs font-mono">
                          {isCompleted ? (
                            <span className="text-slate-400 text-xs font-sans">Departed</span>
                          ) : stationEta ? (
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 line-through text-[11px]">
                                {stationEta.scheduled_arrival}
                              </span>
                              <span className="font-bold text-blue-700 font-mono text-sm">
                                {stationEta.predicted_p50_eta}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                stationEta.predicted_delay > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
                              }`}>
                                {stationEta.predicted_delay > 0 ? `+${stationEta.predicted_delay}m` : 'RT'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-sans">Upcoming Stop</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column (4 cols): Compact Live Radar Map & Quick Info */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Live Compact Route Map */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                <span>{t.compactMapTitle}</span>
              </h3>
              <span className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                LIVE GPS FEED
              </span>
            </div>

            <RailRouteMap
              trainLat={liveState?.latitude ?? 25.2138}
              trainLng={liveState?.longitude ?? 75.8648}
              trainId={activeMeta.train_id}
              trainName={activeMeta.train_name}
              speed={liveState?.speed_kmph ?? 110}
              selectedStationCode={selectedStationCode}
              onStationSelect={(stCode) => setSelectedStationCode(stCode)}
              height="300px"
              isCompact={true}
            />

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Selected Destination:</span>
                <span className="text-blue-600 font-mono">{selectedStationCode}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Live position updates every 5 seconds via background kinematic simulator.
              </p>
            </div>
          </div>

          {/* Quick Stats Summary Card */}
          <div className="bg-[#0B1F3A] text-white rounded-2xl p-5 shadow-md space-y-4 border border-blue-900/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                Corridor Telemetry
              </span>
              <PrototypeBadge />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Current Block</div>
                <div className="font-bold text-sm text-white truncate mt-0.5">
                  {liveState?.current_section?.replace('SEC_', '') || 'SWM-KOTA'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Instant Speed</div>
                <div className="font-mono font-black text-sm text-teal-400 mt-0.5">
                  {liveState?.speed_kmph ?? 110} km/h
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Current Delay</div>
                <div className="font-mono font-black text-sm text-amber-400 mt-0.5">
                  +{(liveState?.delay_minutes ?? 0)} mins
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Recovery Prob</div>
                <div className="font-mono font-black text-sm text-teal-300 mt-0.5">
                  {Math.round(((targetStationETA?.recovery_probability ?? etaData?.recovery_probability ?? 0.82)) * 100)}%
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 leading-snug">
              Indian Railway Western Dedicated Freight Corridor (WDFC) synchronization active. Precedence arbitration prioritized for Rajdhani category rakes.
            </div>
          </div>

        </div>

      </div>

      {/* Notify Me Modal */}
      <NotifyModal
        isOpen={isNotifyOpen}
        onClose={() => setIsNotifyOpen(false)}
        trainId={activeMeta.train_id}
        trainName={activeMeta.train_name}
        stationName={targetStationName}
        onNotifySuccess={(msg) => setToastMessage(msg)}
      />

    </div>
  );
};
