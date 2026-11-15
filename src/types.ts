export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unclassified';
export type Severity = 'green' | 'yellow' | 'red';
export type ReviewStatus = 'open' | 'reviewed' | 'escalated';
export type MissionStatus = 'prelaunch' | 'active' | 'returning' | 'completed';
export type Role = 'ADMIN' | 'MEDICAL TEAM' | 'MISSION CONTROL' | 'ASTRONAUT';

export interface TelemetryPoint {
  time: string;
  value: number;
}

export interface Mission {
  id: string;
  name: string;
  missionType: string;
  launchDate: string;
  returnDate: string;
  status: MissionStatus;
  spacecraft: string;
  location: string;
  assignedAstronautIds: string[];
}

export interface Astronaut {
  id: string;
  name: string;
  avatar: string;
  missionId: string;
  role: string;
  status: MissionStatus;
  bloodPressure: { systolic: number; diastolic: number };
  heartRate: number;
  spO2: number;
  temperature: number;
  respiratoryRate: number;
  lastHealthUpdate: string;
  healthStatus: HealthStatus;
  location: { latitude: number; longitude: number; altitude: number; velocity: number };
  telemetryHistory: {
    bloodPressure: TelemetryPoint[];
    heartRate: TelemetryPoint[];
    spO2: TelemetryPoint[];
    temperature: TelemetryPoint[];
    respiratoryRate: TelemetryPoint[];
  };
}

export interface HealthRecord {
  id: string;
  astronautId: string;
  astronautName: string;
  timestamp: string;
  bloodPressure: { systolic: number; diastolic: number };
  heartRate: number;
  spO2: number;
  temperature: number;
  respiratoryRate: number;
  source: 'SIMULATED DEMO' | 'AUTHORIZED TELEMETRY' | 'MANUAL ENTRY';
  bloodSugar?: number;
  sleepHours?: number;
  mood?: string;
  hydrationLiters?: number;
  nutrition?: string;
  exerciseMinutes?: number;
}

export interface AlertEntry {
  id: string;
  astronautId: string;
  astronautName: string;
  metric: string;
  value?: number;
  threshold?: number;
  description?: string;
  alertTime: string;
  severity: Severity;
  reviewStatus: ReviewStatus;
  source: 'SIMULATED DEMO' | 'AUTHORIZED TELEMETRY' | 'MANUAL ENTRY';
}

export interface ThresholdConfig {
  protocolName: string;
  approvedBy: string;
  heartRate: { warning: number; critical: number };
  spO2: { warning: number; critical: number };
  temperature: { warning: number; critical: number };
  respiratoryRate: { warning: number; critical: number };
  bloodPressure: { warning: number; critical: number };
}

export interface SystemLog {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}
