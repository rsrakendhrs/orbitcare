import type { AlertEntry, Astronaut, HealthRecord, HealthStatus, ThresholdConfig } from '../types';

export function getHealthStatus(value: number, metric: 'heartRate' | 'spO2' | 'temperature' | 'respiratoryRate' | 'bloodPressure', warnings: ThresholdConfig): HealthStatus {
  if (metric === 'spO2') {
    if (value <= warnings.spO2.critical) return 'critical';
    if (value <= warnings.spO2.warning) return 'warning';
    return 'healthy';
  }

  if (metric === 'bloodPressure') {
    if (value >= warnings.bloodPressure.critical) return 'critical';
    if (value >= warnings.bloodPressure.warning) return 'warning';
    return 'healthy';
  }

  const metricThreshold = warnings[metric];
  if (value >= metricThreshold.critical) return 'critical';
  if (value >= metricThreshold.warning) return 'warning';
  return 'healthy';
}

export function evaluateStatus(astronaut: Astronaut, thresholds: ThresholdConfig | null): HealthStatus {
  if (!thresholds) return 'unclassified';

  const statuses = [
    getHealthStatus(astronaut.heartRate, 'heartRate', thresholds),
    getHealthStatus(astronaut.spO2, 'spO2', thresholds),
    getHealthStatus(astronaut.temperature, 'temperature', thresholds),
    getHealthStatus(astronaut.respiratoryRate, 'respiratoryRate', thresholds),
    getHealthStatus(astronaut.bloodPressure.systolic, 'bloodPressure', thresholds),
  ];

  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  return 'healthy';
}

export function appendTelemetryPoint(history: Astronaut['telemetryHistory'], key: keyof Astronaut['telemetryHistory'], value: number) {
  const next = [...history[key]];
  const now = new Date();
  next.push({ time: now.toISOString(), value });
  while (next.length > 12) next.shift();
  return { ...history, [key]: next };
}

export function createConfiguredAlerts(record: HealthRecord, thresholds: ThresholdConfig): AlertEntry[] {
  const checks = [
    { key: 'heartRate', value: record.heartRate, limits: thresholds.heartRate },
    { key: 'spO2', value: record.spO2, limits: thresholds.spO2 },
    { key: 'temperature', value: record.temperature, limits: thresholds.temperature },
    { key: 'respiratoryRate', value: record.respiratoryRate, limits: thresholds.respiratoryRate },
    { key: 'bloodPressure', value: record.bloodPressure.systolic, limits: thresholds.bloodPressure },
  ] as const;
  return checks.flatMap(({ key, value, limits }) => {
    const status = getHealthStatus(value, key, thresholds);
    if (status !== 'warning' && status !== 'critical') return [];
    const threshold = status === 'critical' ? limits.critical : limits.warning;
    return [{
      id: crypto.randomUUID(),
      astronautId: record.astronautId,
      astronautName: record.astronautName,
      metric: formatMetricLabel(key),
      value,
      threshold,
      description: `${status === 'critical' ? 'Urgent' : 'Attention'} review condition from configured protocol "${thresholds.protocolName}". Protocol authorization is not verified by this demo.`,
      alertTime: record.timestamp,
      severity: status === 'critical' ? 'red' as const : 'yellow' as const,
      reviewStatus: 'open' as const,
      source: record.source,
    }];
  });
}

export function formatMetricLabel(metric: string): string {
  const labelMap: Record<string, string> = {
    heartRate: 'Heart Rate',
    spO2: 'SpO2',
    temperature: 'Temperature',
    respiratoryRate: 'Respiratory Rate',
    bloodPressure: 'Blood Pressure',
  };

  return labelMap[metric] ?? metric;
}
