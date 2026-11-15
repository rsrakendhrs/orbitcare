import { createClient } from '@supabase/supabase-js';
import type { AlertEntry, Astronaut, HealthRecord, Mission, Role, TelemetryPoint } from '../types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && anonKey && !url.includes('your-project') && !anonKey.includes('your-anon-key')
  ? createClient(url, anonKey)
  : null;

export async function getUserRole(userId: string): Promise<Role> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data || !['ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL', 'ASTRONAUT'].includes(data.role)) {
    throw new Error('No authorized ORBITCARE role is assigned to this account.');
  }
  return data.role as Role;
}

export async function loadAuthorizedData(): Promise<{
  astronauts: Astronaut[];
  missions: Mission[];
  healthRecords: HealthRecord[];
  alerts: AlertEntry[];
}> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const [missionResult, astronautResult, recordResult, alertResult] = await Promise.all([
    supabase.from('missions').select('*').order('launch_date', { ascending: false }),
    supabase.from('astronauts').select('*').order('full_name'),
    supabase.from('health_records').select('*').order('recorded_at', { ascending: false }),
    supabase.from('alerts').select('*').order('alert_time', { ascending: false }),
  ]);
  if (missionResult.error) throw missionResult.error;
  if (astronautResult.error) throw astronautResult.error;
  if (recordResult.error) throw recordResult.error;
  if (alertResult.error) throw alertResult.error;

  const missions: Mission[] = missionResult.data.map((mission) => ({
    id: mission.id,
    name: mission.mission_name,
    missionType: mission.mission_type,
    launchDate: mission.launch_date ?? '',
    returnDate: mission.expected_return_date ?? '',
    status: mission.mission_status,
    spacecraft: mission.spacecraft_info ?? 'Not recorded',
    location: mission.mission_location ?? 'Not recorded',
    assignedAstronautIds: [],
  }));
  const missionByName = new Map(missions.map((mission) => [mission.name, mission.id]));
  const telemetryByAstronaut = new Map<string, { bloodPressure: TelemetryPoint[]; heartRate: TelemetryPoint[]; spO2: TelemetryPoint[]; temperature: TelemetryPoint[]; respiratoryRate: TelemetryPoint[] }>();
  const healthRecords: HealthRecord[] = recordResult.data.map((record) => ({
    id: record.id,
    astronautId: record.astronaut_id,
    astronautName: '',
    timestamp: record.recorded_at,
    bloodPressure: { systolic: record.blood_pressure_sys, diastolic: record.blood_pressure_dia },
    heartRate: record.heart_rate,
    spO2: record.sp_o2,
    temperature: Number(record.body_temperature),
    respiratoryRate: record.respiratory_rate,
    bloodSugar: record.blood_sugar === null ? undefined : Number(record.blood_sugar),
    sleepHours: record.sleep_hours === null ? undefined : Number(record.sleep_hours),
    mood: record.mood ?? undefined,
    hydrationLiters: record.hydration_liters === null ? undefined : Number(record.hydration_liters),
    nutrition: record.nutrition ?? undefined,
    exerciseMinutes: record.exercise_minutes ?? undefined,
    source: record.data_source,
  }));
  const astronautNames = new Map<string, string>();
  for (const astronaut of astronautResult.data) astronautNames.set(astronaut.id, astronaut.full_name);
  const namedRecords = healthRecords.map((record) => ({ ...record, astronautName: astronautNames.get(record.astronautId) ?? 'Unknown crew member' }));
  for (const record of namedRecords) {
    const history = telemetryByAstronaut.get(record.astronautId) ?? { bloodPressure: [], heartRate: [], spO2: [], temperature: [], respiratoryRate: [] };
    history.bloodPressure.push({ time: record.timestamp, value: record.bloodPressure.systolic });
    history.heartRate.push({ time: record.timestamp, value: record.heartRate });
    history.spO2.push({ time: record.timestamp, value: record.spO2 });
    history.temperature.push({ time: record.timestamp, value: record.temperature });
    history.respiratoryRate.push({ time: record.timestamp, value: record.respiratoryRate });
    telemetryByAstronaut.set(record.astronautId, history);
  }
  const astronauts: Astronaut[] = astronautResult.data.map((astronaut) => {
    const history = telemetryByAstronaut.get(astronaut.id) ?? { bloodPressure: [], heartRate: [], spO2: [], temperature: [], respiratoryRate: [] };
    return {
      id: astronaut.id,
      name: astronaut.full_name,
      avatar: astronaut.full_name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
      missionId: missionByName.get(astronaut.mission_name ?? '') ?? '',
      role: astronaut.mission_role ?? 'Crew member',
      status: astronaut.mission_status,
      bloodPressure: { systolic: astronaut.blood_pressure_sys ?? 0, diastolic: astronaut.blood_pressure_dia ?? 0 },
      heartRate: astronaut.heart_rate ?? 0,
      spO2: astronaut.sp_o2 ?? 0,
      temperature: Number(astronaut.body_temperature ?? 0),
      respiratoryRate: astronaut.respiratory_rate ?? 0,
      lastHealthUpdate: astronaut.last_health_update ?? '',
      healthStatus: 'unclassified',
      location: { latitude: 0, longitude: 0, altitude: 0, velocity: 0 },
      telemetryHistory: history,
    };
  });
  for (const mission of missions) mission.assignedAstronautIds = astronauts.filter((astronaut) => astronaut.missionId === mission.id).map((astronaut) => astronaut.id);
  const nameByAstronaut = new Map(astronauts.map((astronaut) => [astronaut.id, astronaut.name]));
  const alerts: AlertEntry[] = alertResult.data.map((alert) => ({
    id: alert.id,
    astronautId: alert.astronaut_id,
    astronautName: nameByAstronaut.get(alert.astronaut_id) ?? 'Unknown crew member',
    metric: alert.health_parameter,
    value: alert.value === null ? undefined : Number(alert.value),
    threshold: alert.threshold === null ? undefined : Number(alert.threshold),
    description: alert.description ?? undefined,
    alertTime: alert.alert_time,
    severity: alert.severity,
    reviewStatus: alert.review_status,
    source: alert.source,
  }));
  return { astronauts, missions, healthRecords: namedRecords, alerts };
}

export async function syncManualHealthRecords(records: HealthRecordPayload[]): Promise<void> {
  if (!supabase) throw new Error('Supabase URL and anon key are not configured.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('Sign in with an authorized Supabase account before synchronizing health records.');
  if (records.length === 0) return;

  const astronautIds = new Map<string, string>();
  for (const record of records) {
    if (astronautIds.has(record.astronautId)) continue;
    const { data, error } = await supabase.from('astronauts').select('id').eq('full_name', record.astronautName).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Astronaut "${record.astronautName}" was not found in the authorized Supabase roster; record remains queued.`);
    astronautIds.set(record.astronautId, data.id);
  }

  const rows = records.map((record) => {
    const astronautId = astronautIds.get(record.astronautId);
    if (!astronautId) throw new Error(`Missing database roster mapping for "${record.astronautName}".`);
    return {
      id: record.id,
      astronaut_id: astronautId,
      recorded_at: record.timestamp,
      blood_pressure_sys: record.bloodPressure.systolic,
      blood_pressure_dia: record.bloodPressure.diastolic,
      heart_rate: record.heartRate,
      sp_o2: record.spO2,
      body_temperature: record.temperature,
      respiratory_rate: record.respiratoryRate,
      blood_sugar: record.bloodSugar ?? null,
      sleep_hours: record.sleepHours ?? null,
      mood: record.mood ?? null,
      hydration_liters: record.hydrationLiters ?? null,
      nutrition: record.nutrition ?? null,
      exercise_minutes: record.exerciseMinutes ?? null,
      data_source: 'MANUAL ENTRY',
    };
  });
  const { error } = await supabase.from('health_records').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function syncManualAlerts(alerts: AlertEntry[]): Promise<void> {
  if (!supabase) throw new Error('Supabase URL and anon key are not configured.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('Sign in with an authorized Supabase account before synchronizing alerts.');
  if (alerts.length === 0) return;

  const astronautIds = new Map<string, string>();
  for (const alert of alerts) {
    if (astronautIds.has(alert.astronautId)) continue;
    const { data, error } = await supabase.from('astronauts').select('id').eq('full_name', alert.astronautName).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Astronaut "${alert.astronautName}" was not found in the authorized Supabase roster; alert remains queued.`);
    astronautIds.set(alert.astronautId, data.id);
  }
  const rows = alerts.map((alert) => {
    const astronautId = astronautIds.get(alert.astronautId);
    if (!astronautId) throw new Error(`Missing database roster mapping for "${alert.astronautName}".`);
    return {
      id: alert.id,
      astronaut_id: astronautId,
      health_parameter: alert.metric,
      value: alert.value ?? null,
      threshold: alert.threshold ?? null,
      description: alert.description ?? null,
      severity: alert.severity,
      review_status: alert.reviewStatus,
      alert_time: alert.alertTime,
      source: 'MANUAL ENTRY',
    };
  });
  const { error } = await supabase.from('alerts').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

type HealthRecordPayload = import('../types').HealthRecord;
