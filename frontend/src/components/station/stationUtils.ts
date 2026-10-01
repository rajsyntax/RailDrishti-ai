import {
  CORRIDOR_STATIONS,
  DEMO_TRAINS,
  TrainLiveState,
  DynamicETAResponse
} from '../../services/railApi';
import {
  StationInfo,
  StationArrivalData,
  StationActionCard,
  StationKPIs,
  RoleCategory
} from './stationTypes';

// Extended station metadata
export const EXTENDED_STATION_META: Record<string, { zone: string; division: string; platformCount: number; code: string; name: string; sequence: number }> = {
  NDLS: { code: 'NDLS', name: 'New Delhi', zone: 'NR', division: 'Delhi', platformCount: 16, sequence: 1 },
  MTJ:  { code: 'MTJ',  name: 'Mathura Junction', zone: 'NCR', division: 'Agra', platformCount: 8, sequence: 2 },
  BTE:  { code: 'BTE',  name: 'Bharatpur Junction', zone: 'WCR', division: 'Kota', platformCount: 4, sequence: 3 },
  GGC:  { code: 'GGC',  name: 'Gangapur City', zone: 'WCR', division: 'Kota', platformCount: 3, sequence: 4 },
  SWM:  { code: 'SWM',  name: 'Sawai Madhopur Junction', zone: 'WCR', division: 'Kota', platformCount: 4, sequence: 5 },
  KOTA: { code: 'KOTA', name: 'Kota Junction', zone: 'WCR', division: 'Kota', platformCount: 4, sequence: 6 },
  RATL: { code: 'RATL', name: 'Ratlam Junction', zone: 'WR', division: 'Ratlam', platformCount: 6, sequence: 7 },
  BRC:  { code: 'BRC',  name: 'Vadodara Junction', zone: 'WR', division: 'Vadodara', platformCount: 10, sequence: 8 },
  MMCT: { code: 'MMCT', name: 'Mumbai Central', zone: 'WR', division: 'Mumbai', platformCount: 8, sequence: 9 },
};

// Default platform assignment map per train at each station
export const BASE_PLATFORM_ALLOCATIONS: Record<string, Record<string, number>> = {
  KOTA: {
    '12952': 2, // Mumbai Rajdhani
    '12413': 1, // Rajdhani Express
    '19020': 3, // Dehradun Express
    '12988': 2, // Ajmer Superfast (creates conflict scenario on PF 2!)
    '12910': 4, // Gujarat Mail
  },
  NDLS: { '12952': 1, '12413': 2, '19020': 3, '12988': 4, '12910': 5 },
  MTJ:  { '12952': 2, '12413': 1, '19020': 3, '12988': 2, '12910': 4 },
  BTE:  { '12952': 1, '12413': 2, '19020': 3, '12988': 1, '12910': 4 },
  GGC:  { '12952': 2, '12413': 1, '19020': 3, '12988': 2, '12910': 3 },
  SWM:  { '12952': 1, '12413': 2, '19020': 3, '12988': 1, '12910': 4 },
  RATL: { '12952': 1, '12413': 2, '19020': 4, '12988': 3, '12910': 5 },
  BRC:  { '12952': 3, '12413': 2, '19020': 1, '12988': 4, '12910': 6 },
  MMCT: { '12952': 1, '12413': 2, '19020': 3, '12988': 4, '12910': 5 },
};

// Static scheduled times reference per station
const BASE_SCHEDULE_TIMES: Record<string, Record<string, { arr: string; dep: string; halt: number }>> = {
  '12952': {
    NDLS: { arr: '16:20', dep: '16:25', halt: 5 },
    MTJ:  { arr: '18:39', dep: '18:41', halt: 2 },
    BTE:  { arr: '19:07', dep: '19:09', halt: 2 },
    GGC:  { arr: '20:22', dep: '20:24', halt: 2 },
    SWM:  { arr: '21:03', dep: '21:05', halt: 2 },
    KOTA: { arr: '22:11', dep: '22:16', halt: 5 },
    RATL: { arr: '01:05', dep: '01:10', halt: 5 },
    BRC:  { arr: '04:37', dep: '04:40', halt: 3 },
    MMCT: { arr: '07:40', dep: '07:45', halt: 5 },
  },
  '12413': {
    NDLS: { arr: '07:25', dep: '07:30', halt: 5 },
    MTJ:  { arr: '09:48', dep: '09:50', halt: 2 },
    BTE:  { arr: '10:17', dep: '10:19', halt: 2 },
    GGC:  { arr: '11:32', dep: '11:34', halt: 2 },
    SWM:  { arr: '12:15', dep: '12:17', halt: 2 },
    KOTA: { arr: '13:25', dep: '13:30', halt: 5 },
    RATL: { arr: '16:25', dep: '16:30', halt: 5 },
    BRC:  { arr: '20:00', dep: '20:03', halt: 3 },
    MMCT: { arr: '23:05', dep: '23:10', halt: 5 },
  },
  '19020': {
    NDLS: { arr: '23:10', dep: '23:15', halt: 5 },
    MTJ:  { arr: '01:22', dep: '01:24', halt: 2 },
    BTE:  { arr: '01:51', dep: '01:53', halt: 2 },
    GGC:  { arr: '03:14', dep: '03:16', halt: 2 },
    SWM:  { arr: '04:03', dep: '04:05', halt: 2 },
    KOTA: { arr: '05:22', dep: '05:27', halt: 5 },
    RATL: { arr: '08:42', dep: '08:47', halt: 5 },
    BRC:  { arr: '12:30', dep: '12:33', halt: 3 },
    MMCT: { arr: '16:20', dep: '16:25', halt: 5 },
  },
  '12988': {
    NDLS: { arr: '06:05', dep: '06:10', halt: 5 },
    MTJ:  { arr: '08:23', dep: '08:25', halt: 2 },
    BTE:  { arr: '08:52', dep: '08:54', halt: 2 },
    GGC:  { arr: '10:08', dep: '10:10', halt: 2 },
    SWM:  { arr: '10:52', dep: '10:54', halt: 2 },
    KOTA: { arr: '12:06', dep: '12:11', halt: 5 },
    RATL: { arr: '15:16', dep: '15:21', halt: 5 },
    BRC:  { arr: '19:00', dep: '19:03', halt: 3 },
    MMCT: { arr: '22:15', dep: '22:20', halt: 5 },
  },
  '12910': {
    NDLS: { arr: '21:25', dep: '21:30', halt: 5 },
    MTJ:  { arr: '23:42', dep: '23:44', halt: 2 },
    BTE:  { arr: '00:12', dep: '00:14', halt: 2 },
    GGC:  { arr: '01:35', dep: '01:37', halt: 2 },
    SWM:  { arr: '02:22', dep: '02:24', halt: 2 },
    KOTA: { arr: '03:44', dep: '03:49', halt: 5 },
    RATL: { arr: '07:14', dep: '07:19', halt: 5 },
    BRC:  { arr: '11:10', dep: '11:13', halt: 3 },
    MMCT: { arr: '15:05', dep: '15:10', halt: 5 },
  },
};

export function getStationMeta(stationCode: string): StationInfo {
  const code = stationCode.toUpperCase();
  const meta = EXTENDED_STATION_META[code] || {
    code,
    name: `${code} Station`,
    zone: 'IR',
    division: 'Corridor',
    platformCount: 4,
    sequence: 6,
  };
  const corridorSt = CORRIDOR_STATIONS.find(s => s.code === code) || CORRIDOR_STATIONS[5];
  return {
    ...meta,
    latitude: corridorSt.latitude,
    longitude: corridorSt.longitude,
  };
}

/**
 * Calculate dynamic arrivals for the selected station across all corridor trains.
 */
export function buildStationArrivals(
  stationCode: string,
  liveTrains: TrainLiveState[],
  trainEtas: Record<string, DynamicETAResponse>,
  platformOverrides: Record<string, number> = {}
): StationArrivalData[] {
  const now = new Date();
  const stationMeta = getStationMeta(stationCode);
  const arrivals: StationArrivalData[] = [];

  DEMO_TRAINS.forEach(trainMeta => {
    const trainId = trainMeta.train_id;
    const liveState = liveTrains.find(t => t.train_id === trainId);
    const etaData = trainEtas[trainId];

    // Find upcoming station ETA if available
    const stationEta = etaData?.upcoming_stations_eta?.find(
      s => s.station_code === stationCode
    );

    const baseSched = BASE_SCHEDULE_TIMES[trainId]?.[stationCode] || {
      arr: '18:30',
      dep: '18:35',
      halt: 5
    };

    // Calculate delay and dynamic times
    const delayMin = stationEta
      ? stationEta.predicted_delay_minutes
      : (liveState?.delay_minutes ?? 5);

    const confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW' = stationEta
      ? stationEta.confidence_label
      : (delayMin < 10 ? 'HIGH' : delayMin < 25 ? 'MEDIUM' : 'LOW');

    const confidenceScore = confidenceLabel === 'HIGH' ? 0.94 : confidenceLabel === 'MEDIUM' ? 0.76 : 0.48;

    const trainIdx = DEMO_TRAINS.findIndex(t => t.train_id === trainId);
    const arrivalOffsetMins = 25 + trainIdx * 35; // Staggered: +25m, +60m, +95m, +130m, +165m
    const predictedArrivalDate = new Date(now.getTime() + (arrivalOffsetMins + delayMin) * 60000);
    const scheduledArrivalDate = new Date(now.getTime() + arrivalOffsetMins * 60000);
    const departureDate = new Date(predictedArrivalDate.getTime() + baseSched.halt * 60000);
    const clearanceDate = new Date(departureDate.getTime() + 15 * 60000); // 15m cleaning & clearance buffer

    const formatClock = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST';
    const p10Date = new Date(predictedArrivalDate.getTime() - Math.max(3, Math.round(delayMin * 0.3)) * 60000);
    const p90Date = new Date(predictedArrivalDate.getTime() + Math.max(4, Math.round(delayMin * 0.5)) * 60000);

    const baseAllocatedPlatform = BASE_PLATFORM_ALLOCATIONS[stationCode]?.[trainId] ?? ((trainIdx % stationMeta.platformCount) + 1);
    const platform = platformOverrides[trainId] ?? baseAllocatedPlatform;

    // Congestion indicator
    const congestion: 'LOW' | 'MODERATE' | 'HIGH' = 
      confidenceLabel === 'LOW' ? 'HIGH' : delayMin > 12 ? 'MODERATE' : 'LOW';

    // Status mapping
    const status = liveState?.status ?? 'RUNNING';

    // Role Target Assignment
    const role_target: RoleCategory = 
      delayMin > 15 ? 'PLATFORM_MGR' :
      confidenceLabel === 'LOW' ? 'STATION_MASTER' :
      status === 'SIGNAL_HALT' ? 'PASSENGER_INFO' :
      'CLEANING_CREW';

    arrivals.push({
      train_id: trainId,
      train_name: trainMeta.train_name,
      category: trainMeta.category,
      source: trainMeta.source_station,
      destination: trainMeta.destination_station,
      scheduled_arrival: formatClock(scheduledArrivalDate),
      scheduled_departure: formatClock(new Date(scheduledArrivalDate.getTime() + baseSched.halt * 60000)),
      halt_minutes: baseSched.halt,
      predicted_p10_eta: formatClock(p10Date),
      predicted_p50_eta: formatClock(predictedArrivalDate),
      predicted_p90_eta: formatClock(p90Date),
      predicted_delay_minutes: delayMin,
      confidence_label: confidenceLabel,
      confidence_score: confidenceScore,
      platform,
      allocated_platform: baseAllocatedPlatform,
      congestion,
      status,
      speed_kmph: liveState?.speed_kmph ?? 110,
      current_section: liveState?.current_section ?? 'SEC_SWM_KOTA',
      distance_km: liveState?.distance_to_next_station_km ?? (30 + trainIdx * 25),
      delay_trend: delayMin > 10 ? 'WORSENING' : 'STABLE',
      urgency_score: 0, // Will be computed after conflict detection
      recommended_action: '', // Will be assigned
      role_target,
      has_conflict: false,
      turnaround_minutes: 15,
      arrival_date: predictedArrivalDate,
      departure_date: departureDate,
      clearance_date: clearanceDate,
      top_factors: etaData?.top_eta_factors ?? [
        {
          factor: 'speed_restriction',
          label: 'Engineering Caution Order',
          delta_min: 4,
          description: 'Ballast packing speed restriction active in approaching block.'
        },
        {
          factor: 'congestion',
          label: 'Precedence Regulation',
          delta_min: 3,
          description: 'Line utilization moderate approaching outer junction.'
        }
      ]
    });
  });

  // Check Platform Conflicts (Overlap or < 15 min turnaround gap on the same platform)
  for (let i = 0; i < arrivals.length; i++) {
    for (let j = i + 1; j < arrivals.length; j++) {
      const a = arrivals[i];
      const b = arrivals[j];
      if (a.platform === b.platform) {
        const aStart = a.arrival_date.getTime();
        const aEnd = a.clearance_date.getTime();
        const bStart = b.arrival_date.getTime();
        const bEnd = b.clearance_date.getTime();

        const overlap = (aStart <= bEnd && bStart <= aEnd);
        const turnaroundViolation = Math.abs(a.arrival_date.getTime() - b.arrival_date.getTime()) < 25 * 60000;

        if (overlap || turnaroundViolation) {
          a.has_conflict = true;
          b.has_conflict = true;
          a.conflict_with_train_id = b.train_id;
          b.conflict_with_train_id = a.train_id;
          a.conflict_reason = `Short headway (<25 min) with ${b.train_name} (${b.train_id}) on PF ${a.platform}`;
          b.conflict_reason = `Short headway (<25 min) with ${a.train_name} (${a.train_id}) on PF ${b.platform}`;
        }
      }
    }
  }

  // Calculate Urgency Score & Recommended Actions
  arrivals.forEach(a => {
    let urgency = 0;

    // Delay factor
    urgency += Math.min(a.predicted_delay_minutes * 2.5, 40);

    // Confidence factor
    if (a.confidence_label === 'LOW') urgency += 30;
    else if (a.confidence_label === 'MEDIUM') urgency += 12;

    // Platform conflict factor
    if (a.has_conflict) urgency += 45;

    // Status factor
    if (a.status === 'SIGNAL_HALT' || a.status === 'UNSCHEDULED_HALT') urgency += 35;

    // Immediacy factor (closer to arrival = higher urgency)
    const minsUntilArrival = (a.arrival_date.getTime() - now.getTime()) / 60000;
    if (minsUntilArrival < 30) urgency += 25;
    else if (minsUntilArrival < 60) urgency += 15;

    a.urgency_score = Math.round(urgency);

    // Determine tailored operational recommendation
    if (a.has_conflict) {
      a.recommended_action = `Reassign platform or hold ${a.train_name} at outer home`;
    } else if (a.predicted_delay_minutes > 15) {
      a.recommended_action = `Prepare PF ${a.platform} +${a.predicted_delay_minutes}m later & notify cleaning crew`;
    } else if (a.confidence_label === 'LOW') {
      a.recommended_action = 'ETA confidence low — verify section status with SCOR';
    } else if (a.status === 'SIGNAL_HALT') {
      a.recommended_action = 'Broadcast delay announcement to passenger concourse';
    } else if (a.predicted_delay_minutes <= 0) {
      a.recommended_action = `Platform ${a.platform} ready for on-time arrival`;
    } else {
      a.recommended_action = `Monitor block approach (ETA ${a.predicted_p50_eta})`;
    }
  });

  // Sort by urgency descending as primary default
  arrivals.sort((a, b) => b.urgency_score - a.urgency_score);

  return arrivals;
}

/**
 * Calculate Station KPIs from arrival dataset.
 */
export function computeStationKpis(arrivals: StationArrivalData[]): StationKPIs {
  const delayed = arrivals.filter(a => a.predicted_delay_minutes > 0);
  const highRisk = arrivals.filter(a => a.confidence_label === 'LOW' || a.status === 'SIGNAL_HALT');
  const conflicts = arrivals.filter(a => a.has_conflict);
  const alertCount = arrivals.filter(a => a.urgency_score > 35 || a.has_conflict).length;

  const totalConfidence = arrivals.reduce((acc, a) => acc + a.confidence_score, 0);
  const avgConfidence = arrivals.length > 0 ? (totalConfidence / arrivals.length) * 100 : 92;
  const avgLabel = avgConfidence >= 85 ? 'HIGH' : avgConfidence >= 65 ? 'MEDIUM' : 'LOW';

  return {
    arrivalsCount: arrivals.length,
    delayedCount: delayed.length,
    delayedPercentage: arrivals.length > 0 ? Math.round((delayed.length / arrivals.length) * 100) : 0,
    highRiskCount: highRisk.length,
    platformConflictsCount: Math.ceil(conflicts.length / 2),
    avgEtaConfidenceScore: Math.round(avgConfidence),
    avgEtaConfidenceLabel: avgLabel,
    alertsRequiringActionCount: Math.max(alertCount, 3),
  };
}

/**
 * Generate Smart Operations Action Cards.
 */
export function generateStationActions(arrivals: StationArrivalData[], stationCode: string): StationActionCard[] {
  const cards: StationActionCard[] = [];
  const now = new Date();
  const formatTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  // 1. Platform Conflict Action (if any)
  const conflictTrain = arrivals.find(a => a.has_conflict);
  if (conflictTrain) {
    cards.push({
      id: `act-conflict-${conflictTrain.train_id}`,
      title: `Review platform conflict risk on PF ${conflictTrain.platform}`,
      description: `Trains ${conflictTrain.train_name} (${conflictTrain.train_id}) & ${conflictTrain.conflict_with_train_id} have overlapping arrival buffers on Platform ${conflictTrain.platform}.`,
      impact: 'Prevents platform collision and eliminates unnecessary 18-minute outer signal detentions.',
      role: 'PLATFORM_MGR',
      severity: 'CRITICAL',
      train_id: conflictTrain.train_id,
      train_name: conflictTrain.train_name,
      platform: conflictTrain.platform,
      suggested_action: `Reallocate ${conflictTrain.train_name} to Platform ${conflictTrain.platform === 2 ? 3 : 1}`,
      timestamp: formatTime(now),
      status: 'PENDING'
    });
  }

  // 2. Delayed Platform Prep Action
  const delayedTrain = arrivals.find(a => a.predicted_delay_minutes >= 10);
  if (delayedTrain) {
    cards.push({
      id: `act-prep-${delayedTrain.train_id}`,
      title: `Prepare Platform ${delayedTrain.platform} ${delayedTrain.predicted_delay_minutes} minutes later`,
      description: `${delayedTrain.train_name} is running +${delayedTrain.predicted_delay_minutes}m late. Release PF ${delayedTrain.platform} for through freight or short-turnaround local service.`,
      impact: 'Frees platform slot capacity for 14 minutes and prevents passenger crowding on platform.',
      role: 'STATION_MASTER',
      severity: 'HIGH',
      train_id: delayedTrain.train_id,
      train_name: delayedTrain.train_name,
      platform: delayedTrain.platform,
      suggested_action: 'Shift platform clearance window and hold ground crew staging',
      timestamp: formatTime(now),
      status: 'PENDING'
    });
  }

  // 3. Passenger Display Board Update
  const pidsTrain = arrivals.find(a => a.predicted_delay_minutes > 5 || a.confidence_label === 'LOW') || arrivals[0];
  if (pidsTrain) {
    cards.push({
      id: `act-pids-${pidsTrain.train_id}`,
      title: 'Update passenger display board & auto-announcer',
      description: `Dynamic ETA for ${pidsTrain.train_name} shifted to ${pidsTrain.predicted_p50_eta} (Range: ${pidsTrain.predicted_p10_eta} – ${pidsTrain.predicted_p90_eta}). Broadcast updated ETA to concourse displays.`,
      impact: 'Ensures 100% passenger transparency and minimizes inquiry booth congestion.',
      role: 'PASSENGER_INFO',
      severity: 'MEDIUM',
      train_id: pidsTrain.train_id,
      train_name: pidsTrain.train_name,
      platform: pidsTrain.platform,
      suggested_action: 'Sync PIDS & trigger automatic multilingual station audio chime',
      timestamp: formatTime(now),
      status: 'PENDING'
    });
  }

  // 4. Cleaning Crew Coordination
  const cleanTrain = arrivals.find(a => a.category.includes('Express') || a.category.includes('Rajdhani')) || arrivals[1];
  if (cleanTrain) {
    cards.push({
      id: `act-clean-${cleanTrain.train_id}`,
      title: `Notify cleaning team for PF ${cleanTrain.platform} quick-turnaround`,
      description: `${cleanTrain.train_name} (${cleanTrain.train_id}) scheduled for ${cleanTrain.halt_minutes}m halt. Pre-stage 8 on-board housekeeping staff at coach markers A1-B4.`,
      impact: 'Ensures water filling & sanitation completion within scheduled halt without dispatch delay.',
      role: 'CLEANING_CREW',
      severity: 'MEDIUM',
      train_id: cleanTrain.train_id,
      train_name: cleanTrain.train_name,
      platform: cleanTrain.platform,
      suggested_action: 'Dispatch WhatsApp/SMS alert to Cleaning Supervisor on Duty',
      timestamp: formatTime(now),
      status: 'PENDING'
    });
  }

  // 5. Feeder Transport Coordination
  const feederTrain = arrivals[0];
  if (feederTrain) {
    cards.push({
      id: `act-feeder-${feederTrain.train_id}`,
      title: `Alert feeder transport operator (${stationCode} City Bus & Taxi Stand)`,
      description: `Expected arrival of ${feederTrain.train_name} with ~850 deboarding passengers at ${feederTrain.predicted_p50_eta}. Notify city transport hub to stage feeder buses and EV autos at Gate 1 & 2.`,
      impact: 'Reduces station exit congestion by 40% and provides seamless last-mile connectivity.',
      role: 'FEEDER_TRANSPORT',
      severity: 'LOW',
      train_id: feederTrain.train_id,
      train_name: feederTrain.train_name,
      platform: feederTrain.platform,
      suggested_action: 'Send automated batch notification to Kota Municipal Transport Dispatch',
      timestamp: formatTime(now),
      status: 'PENDING'
    });
  }

  // 6. ETA Low Confidence Verification
  const lowConfTrain = arrivals.find(a => a.confidence_label === 'LOW') || arrivals[2];
  if (lowConfTrain) {
    cards.push({
      id: `act-lowconf-${lowConfTrain.train_id}`,
      title: 'ETA confidence low — verify train status with section controller',
      description: `Prediction model uncertainty is elevated due to temporary caution orders and signal halts on section ${lowConfTrain.current_section}. Confirm track clearance with Division SCOR.`,
      impact: 'Validates line clear before platform locking and avoids route holding.',
      role: 'STATION_MASTER',
      severity: 'HIGH',
      train_id: lowConfTrain.train_id,
      train_name: lowConfTrain.train_name,
      platform: lowConfTrain.platform,
      suggested_action: 'Initiate hot-line call to Divisional Railway Control Room (SCOR)',
      timestamp: formatTime(now),
      status: 'PENDING'
    });
  }

  return cards;
}

/**
 * Play authentic Indian Railways 4-tone station chime followed by speech announcement.
 */
export function playRailwayAudioAnnouncement(
  trainNumber: string,
  trainName: string,
  platform: number,
  etaTime: string,
  delayMin: number,
  _stationName?: string
) {
  try {
    // 1. Play chime via Web Audio API
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const chimeFrequencies = [523.25, 659.25, 783.99, 1046.50]; // C5 - E5 - G5 - C6 chime
      let startTime = ctx.currentTime + 0.05;

      chimeFrequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime + idx * 0.22);

        gain.gain.setValueAtTime(0.001, startTime + idx * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.28, startTime + idx * 0.22 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.22 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime + idx * 0.22);
        osc.stop(startTime + idx * 0.22 + 0.36);
      });
    }

    // 2. Play voice announcement using Web Speech API after chime
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const delayText = delayMin > 0 ? `is running late by approximately ${delayMin} minutes and is expected at ${etaTime}` : `is arriving on time at ${etaTime}`;
      const announcementText = `Attention please. Train number ${trainNumber.split('').join(' ')}, ${trainName}, is arriving on Platform number ${platform}. The train ${delayText}. RailDrishti AI wishes you a safe journey.`;

      const utterance = new SpeechSynthesisUtterance(announcementText);
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      const voices = window.speechSynthesis.getVoices();
      const indianOrUkVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en-GB') || v.name.includes('India'));
      if (indianOrUkVoice) {
        utterance.voice = indianOrUkVoice;
      }

      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 1100);
    }
  } catch (err) {
    console.warn('[Station Audio] Speech/Audio playback error:', err);
  }
}
