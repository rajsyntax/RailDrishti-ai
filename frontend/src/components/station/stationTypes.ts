import { DelayFactorContribution } from '../../services/railApi';

export type RoleCategory = 
  | 'ALL'
  | 'STATION_MASTER'
  | 'PLATFORM_MGR'
  | 'CLEANING_CREW'
  | 'PASSENGER_INFO'
  | 'FEEDER_TRANSPORT';

export interface StationInfo {
  code: string;
  name: string;
  zone: string;
  division: string;
  platformCount: number;
  latitude: number;
  longitude: number;
  sequence: number;
}

export interface StationArrivalData {
  train_id: string;
  train_name: string;
  category: string;
  source: string;
  destination: string;
  scheduled_arrival: string;
  scheduled_departure: string;
  halt_minutes: number;
  predicted_p10_eta: string;
  predicted_p50_eta: string;
  predicted_p90_eta: string;
  predicted_delay_minutes: number;
  confidence_label: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence_score: number;
  platform: number;
  allocated_platform: number;
  congestion: 'LOW' | 'MODERATE' | 'HIGH';
  status: 'RUNNING' | 'AT_STATION' | 'SIGNAL_HALT' | 'UNSCHEDULED_HALT' | 'COMPLETED';
  speed_kmph: number;
  current_section: string;
  distance_km: number;
  delay_trend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  urgency_score: number;
  recommended_action: string;
  role_target: RoleCategory;
  has_conflict: boolean;
  conflict_with_train_id?: string;
  conflict_reason?: string;
  turnaround_minutes: number;
  arrival_date: Date;
  departure_date: Date;
  clearance_date: Date;
  top_factors?: DelayFactorContribution[];
}

export interface PlatformTimelineSlot {
  id: string;
  platform: number;
  train_id: string;
  train_name: string;
  category: string;
  state: 'OCCUPIED' | 'PREPARATION' | 'CONFLICT' | 'AVAILABLE';
  arrival_time: Date;
  departure_time: Date;
  prep_start_time: Date;
  clearance_time: Date;
  delay_minutes: number;
  confidence_label: 'HIGH' | 'MEDIUM' | 'LOW';
  has_conflict: boolean;
  conflict_detail?: string;
}

export interface StationActionCard {
  id: string;
  title: string;
  description: string;
  impact: string;
  role: RoleCategory;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  train_id?: string;
  train_name?: string;
  platform?: number;
  suggested_action: string;
  timestamp: string;
  status: 'PENDING' | 'DISPATCHED' | 'ACKNOWLEDGED' | 'COMPLETED';
}

export interface StationKPIs {
  arrivalsCount: number;
  delayedCount: number;
  delayedPercentage: number;
  highRiskCount: number;
  platformConflictsCount: number;
  avgEtaConfidenceScore: number;
  avgEtaConfidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW';
  alertsRequiringActionCount: number;
}
