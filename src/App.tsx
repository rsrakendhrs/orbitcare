import { useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import Globe from 'react-globe.gl';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Bell,
  Brain,
  ClipboardCheck,
  Database,
  HeartPulse,
  Info,
  LayoutDashboard,
  LogOut,
  MoonStar,
  Navigation,
  Radar,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { demoAstronauts, demoHealthRecords, demoMissions, initialAlerts, spacecraftData, thresholdConfig } from './data/demoData';
import { createConfiguredAlerts, evaluateStatus, formatMetricLabel } from './services/demoSimulation';
import { getUserRole, loadAuthorizedData, supabase, syncManualAlerts, syncManualHealthRecords } from './services/supabaseClient';
import type { AlertEntry, Astronaut, HealthRecord, Mission, Role, ThresholdConfig } from './types';
import {
  AdvancedAnalyticsPage,
  DailyRoutinePage,
  EarthMissionControlPage,
  HazardsPage,
  HealthAssessmentPage,
  HealthIntelligencePage,
  HumanBodyMapPage,
  TutorialsPage,
} from './modules/HealthModules';

const navItems = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/mission-control', label: 'Mission Control', icon: Radar },
  { to: '/astronauts', label: 'Astronaut Profiles', icon: Users },
  { to: '/health', label: 'Astronaut Health', icon: HeartPulse },
  { to: '/assessment', label: 'Health Assessment', icon: ClipboardCheck },
  { to: '/hazards', label: 'Spaceflight Hazards', icon: ShieldCheck },
  { to: '/intelligence', label: 'AI Health Intelligence', icon: Brain },
  { to: '/tracking', label: 'Astronaut Tracking', icon: Navigation },
  { to: '/body-map', label: 'Human Body Map', icon: UserRound },
  { to: '/routine', label: 'Daily Routine', icon: ClipboardCheck },
  { to: '/analytics', label: 'Health Analytics', icon: Activity },
  { to: '/alerts', label: 'Emergency Alerts', icon: AlertTriangle },
  { to: '/history', label: 'Historical Records', icon: Database },
  { to: '/missions', label: 'Mission Management', icon: MoonStar },
  { to: '/tutorials', label: 'Measurement Tutorials', icon: Info },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function readStored<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(`orbitcare:${key}:v1`);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch (error) {
    console.error(`Unable to load saved ${key} data.`, error);
    return fallback;
  }
}

function formatValue(dateValue: string) {
  return format(new Date(dateValue), 'MMM dd, HH:mm');
}

function getStatusClass(status: string) {
  if (status === 'healthy') return 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30';
  if (status === 'warning') return 'bg-yellow-500/15 text-yellow-300 border border-yellow-400/30';
  if (status === 'critical') return 'bg-red-500/15 text-red-300 border border-red-400/30';
  return 'bg-slate-500/15 text-slate-300 border border-slate-400/30';
}

function getSeverityClass(severity: string) {
  if (severity === 'green') return 'bg-emerald-500/10 text-emerald-300';
  if (severity === 'yellow') return 'bg-yellow-500/10 text-yellow-300';
  return 'bg-red-500/10 text-red-300';
}

function App() {
  const demoMode = import.meta.env.VITE_DEMO_MODE !== 'false';
  const [thresholds, setThresholds] = useState<ThresholdConfig | null>(() => demoMode ? readStored('thresholds', thresholdConfig) : null);
  const [astronauts, setAstronauts] = useState<Astronaut[]>(() => (demoMode ? readStored<Astronaut[]>('astronauts', demoAstronauts) : []).map((astronaut) => ({
    ...astronaut,
    healthStatus: evaluateStatus(astronaut, thresholds),
  })));
  const [missions, setMissions] = useState<Mission[]>(() => demoMode ? readStored('missions', demoMissions) : []);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>(() => demoMode ? readStored('health-records', demoHealthRecords) : []);
  const [alerts, setAlerts] = useState<AlertEntry[]>(() => demoMode ? readStored('alerts', initialAlerts) : []);
  const [isAuthenticated, setIsAuthenticated] = useState(demoMode);
  const [authLoading, setAuthLoading] = useState(!demoMode && Boolean(supabase));
  const [authError, setAuthError] = useState(!demoMode && !supabase ? 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or enable demo mode explicitly.' : '');
  const [role, setRole] = useState<Role>('ADMIN');
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [syncedIds, setSyncedIds] = useState<string[]>(() => demoMode ? readStored('synced-record-ids', []) : []);
  const [lastSync, setLastSync] = useState<string | null>(() => demoMode ? readStored('last-sync', null) : null);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [syncMessage, setSyncMessage] = useState('Local demo storage');
  const [persistenceError, setPersistenceError] = useState('');

  useEffect(() => {
    if (demoMode || !supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setSessionUserId(null);
        setAstronauts([]);
        setMissions([]);
        setHealthRecords([]);
        setAlerts([]);
        setThresholds(null);
        setSyncedIds([]);
        setLastSync(null);
      }
    });
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) throw error;
      if (data.session) {
        const userRole = await getUserRole(data.session.user.id);
        const remote = await loadAuthorizedData();
        const pending = readStored<HealthRecord[]>(`pending-health-records:${data.session.user.id}`, []);
        const pendingAlerts = readStored<AlertEntry[]>(`pending-alerts:${data.session.user.id}`, []);
        if (active) {
          setRole(userRole);
          setSessionUserId(data.session.user.id);
          setAstronauts(remote.astronauts.map((astronaut) => ({ ...astronaut, healthStatus: evaluateStatus(astronaut, null) })));
          setMissions(remote.missions);
          setHealthRecords([...pending.filter((record) => !remote.healthRecords.some((saved) => saved.id === record.id)), ...remote.healthRecords]);
          setAlerts([...pendingAlerts.filter((alert) => !remote.alerts.some((saved) => saved.id === alert.id)), ...remote.alerts]);
          setSyncedIds(readStored<string[]>(`synced-record-ids:${data.session.user.id}`, []));
          setLastSync(readStored<string | null>(`last-sync:${data.session.user.id}`, null));
          setIsAuthenticated(true);
        }
      }
    }).catch((error: unknown) => {
      console.error('Unable to restore the Supabase session.', error);
      if (active) setAuthError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (active) setAuthLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [demoMode]);

  useEffect(() => {
    const values: Record<string, unknown> = demoMode
      ? { astronauts, missions, 'health-records': healthRecords, alerts, thresholds, 'synced-record-ids': syncedIds, 'last-sync': lastSync }
      : sessionUserId ? {
          [`pending-health-records:${sessionUserId}`]: healthRecords.filter((record) => record.source === 'MANUAL ENTRY' && !syncedIds.includes(record.id)),
          [`pending-alerts:${sessionUserId}`]: alerts.filter((alert) => alert.source === 'MANUAL ENTRY' && !syncedIds.includes(alert.id)),
          [`synced-record-ids:${sessionUserId}`]: syncedIds,
          [`last-sync:${sessionUserId}`]: lastSync,
        } : {};
    let failed = false;
    Object.entries(values).forEach(([key, value]) => {
      try {
        localStorage.setItem(`orbitcare:${key}:v1`, JSON.stringify(value));
      } catch (error) {
        failed = true;
        console.error(`Unable to persist ${key} data.`, error);
      }
    });
    setPersistenceError(failed ? 'Browser storage failed. Recent changes may not survive closing this page; export unsynchronized records.' : '');
  }, [astronauts, missions, healthRecords, alerts, thresholds, syncedIds, lastSync, demoMode, sessionUserId]);

  useEffect(() => {
    const synchronize = async () => {
      const pendingRecords = healthRecords.filter((record) => record.source === 'MANUAL ENTRY' && !syncedIds.includes(record.id));
      const pendingAlerts = alerts.filter((alert) => alert.source === 'MANUAL ENTRY' && !syncedIds.includes(alert.id));
      const pendingCount = pendingRecords.length + pendingAlerts.length;
      if (pendingCount === 0) {
        setSyncMessage(lastSync ? `All records synchronized · ${new Date(lastSync).toLocaleString()}` : 'No pending manual records');
        return;
      }
      if (!navigator.onLine) {
        setSyncMessage(`${pendingCount} item(s) queued locally · offline`);
        return;
      }
      if (demoMode) {
        setSyncMessage(`${pendingCount} item(s) queued locally · demo mode has no remote sync`);
        return;
      }
      if (!isAuthenticated) {
        setSyncMessage(`${pendingCount} item(s) queued locally · sign in to synchronize`);
        return;
      }
      try {
        await Promise.all([syncManualHealthRecords(pendingRecords), syncManualAlerts(pendingAlerts)]);
        const completedAt = new Date().toISOString();
        setSyncedIds((current) => [...new Set([...current, ...pendingRecords.map((record) => record.id), ...pendingAlerts.map((alert) => alert.id)])]);
        setLastSync(completedAt);
        setSyncMessage(`Synchronized ${pendingCount} item(s) · ${new Date(completedAt).toLocaleString()}`);
      } catch (error) {
        console.error('Health record synchronization failed; queued records were retained locally.', error);
        setSyncMessage(`Sync pending · ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    void synchronize();
    window.addEventListener('online', synchronize);
    window.addEventListener('offline', synchronize);
    return () => {
      window.removeEventListener('online', synchronize);
      window.removeEventListener('offline', synchronize);
    };
  }, [healthRecords, alerts, syncedIds, lastSync, demoMode, isAuthenticated, syncAttempt]);

  const saveAssessment = (record: HealthRecord) => {
    setHealthRecords((current) => [record, ...current]);
    if (thresholds) {
      const newAlerts = createConfiguredAlerts(record, thresholds);
      if (newAlerts.length > 0) setAlerts((current) => [...newAlerts, ...current]);
    }
    setAstronauts((current) => current.map((astronaut) => astronaut.id === record.astronautId ? {
      ...astronaut,
      bloodPressure: record.bloodPressure,
      heartRate: record.heartRate,
      respiratoryRate: record.respiratoryRate,
      spO2: record.spO2,
      temperature: record.temperature,
      lastHealthUpdate: record.timestamp,
      healthStatus: evaluateStatus({ ...astronaut, bloodPressure: record.bloodPressure, heartRate: record.heartRate, respiratoryRate: record.respiratoryRate, spO2: record.spO2, temperature: record.temperature }, thresholds),
      telemetryHistory: {
        bloodPressure: [...astronaut.telemetryHistory.bloodPressure, { time: record.timestamp, value: record.bloodPressure.systolic }].slice(-30),
        heartRate: [...astronaut.telemetryHistory.heartRate, { time: record.timestamp, value: record.heartRate }].slice(-30),
        spO2: [...astronaut.telemetryHistory.spO2, { time: record.timestamp, value: record.spO2 }].slice(-30),
        temperature: [...astronaut.telemetryHistory.temperature, { time: record.timestamp, value: record.temperature }].slice(-30),
        respiratoryRate: [...astronaut.telemetryHistory.respiratoryRate, { time: record.timestamp, value: record.respiratoryRate }].slice(-30),
      },
    } : astronaut));
  };

  const applyThresholds = (next: ThresholdConfig | null) => {
    setThresholds(next);
    setAstronauts((crew) => crew.map((astronaut) => ({ ...astronaut, healthStatus: evaluateStatus(astronaut, next) })));
  };

  const handleLogin = async (userRole: Role) => {
    if (!demoMode && supabase) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) throw new Error('Supabase session was not found after sign-in.');
      const remote = await loadAuthorizedData();
      const pending = readStored<HealthRecord[]>(`pending-health-records:${user.id}`, []);
      const pendingAlerts = readStored<AlertEntry[]>(`pending-alerts:${user.id}`, []);
      setSessionUserId(user.id);
      setAstronauts(remote.astronauts.map((astronaut) => ({ ...astronaut, healthStatus: evaluateStatus(astronaut, null) })));
      setMissions(remote.missions);
      setHealthRecords([...pending.filter((record) => !remote.healthRecords.some((saved) => saved.id === record.id)), ...remote.healthRecords]);
      setAlerts([...pendingAlerts.filter((alert) => !remote.alerts.some((saved) => saved.id === alert.id)), ...remote.alerts]);
      setSyncedIds(readStored<string[]>(`synced-record-ids:${user.id}`, []));
      setLastSync(readStored<string | null>(`last-sync:${user.id}`, null));
    }
    setRole(userRole);
    setIsAuthenticated(true);
    setAuthError('');
  };

  const handleLogout = async () => {
    if (!demoMode && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(error.message);
        return;
      }
      setSessionUserId(null);
      setAstronauts([]);
      setMissions([]);
      setHealthRecords([]);
      setAlerts([]);
      setSyncedIds([]);
      setLastSync(null);
      setThresholds(null);
    }
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      {authLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-[#050d18] text-slate-200">Restoring secure session…</div>
      ) : isAuthenticated ? (
        <AppShell
          astronauts={astronauts}
          missions={missions}
          healthRecords={healthRecords}
          alerts={alerts}
          thresholds={thresholds}
          role={role}
          setAlerts={setAlerts}
          setAstronauts={setAstronauts}
          setMissions={setMissions}
          setThresholds={applyThresholds}
          onSaveAssessment={saveAssessment}
          onLogout={handleLogout}
          demoMode={demoMode}
          syncMessage={syncMessage}
          lastSync={lastSync}
          persistenceError={persistenceError}
          pendingCount={healthRecords.filter((record) => record.source === 'MANUAL ENTRY' && !syncedIds.includes(record.id)).length + alerts.filter((alert) => alert.source === 'MANUAL ENTRY' && !syncedIds.includes(alert.id)).length}
          onRetrySync={() => setSyncAttempt((current) => current + 1)}
        />
      ) : (
        <Routes>
          <Route path="*" element={<LoginPage onLogin={handleLogin} demoMode={demoMode} authError={authError} />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

function AppShell({
  astronauts,
  missions,
  healthRecords,
  alerts,
  thresholds,
  role,
  setAlerts,
  setAstronauts,
  setMissions,
  setThresholds,
  onSaveAssessment,
  onLogout,
  demoMode,
  syncMessage,
  lastSync,
  persistenceError,
  pendingCount,
  onRetrySync,
}: {
  astronauts: Astronaut[];
  missions: Mission[];
  healthRecords: HealthRecord[];
  alerts: AlertEntry[];
  thresholds: ThresholdConfig | null;
  role: Role;
  setAlerts: React.Dispatch<React.SetStateAction<AlertEntry[]>>;
  setAstronauts: React.Dispatch<React.SetStateAction<Astronaut[]>>;
  setMissions: React.Dispatch<React.SetStateAction<Mission[]>>;
  setThresholds: (thresholds: ThresholdConfig | null) => void;
  onSaveAssessment: (record: HealthRecord) => void;
  onLogout: () => void | Promise<void>;
  demoMode: boolean;
  syncMessage: string;
  lastSync: string | null;
  persistenceError: string;
  pendingCount: number;
  onRetrySync: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const healthyCount = astronauts.filter((astronaut) => astronaut.healthStatus === 'healthy').length;
  const warningCount = astronauts.filter((astronaut) => astronaut.healthStatus === 'warning').length;
  const criticalCount = astronauts.filter((astronaut) => astronaut.healthStatus === 'critical').length;
  const unclassifiedCount = astronauts.filter((astronaut) => astronaut.healthStatus === 'unclassified').length;

  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/overview');
    }
  }, [location.pathname, navigate]);

  const recentAlerts = alerts.slice(0, 4);
  const visibleNavItems = role === 'ASTRONAUT'
    ? navItems.filter(({ to }) => !['/mission-control', '/astronauts', '/missions', '/settings'].includes(to))
    : navItems;

  return (
    <div className="min-h-screen bg-[#050d18] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="glass-card hidden w-72 flex-col border-r border-cyan-500/20 bg-slate-950/70 p-5 lg:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-xl font-bold text-cyan-300">O</div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-300/70">Mission Control</p>
              <h1 className="text-xl font-semibold text-white">ORBITCARE</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {visibleNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActive ? 'bg-cyan-500/15 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.2)]' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
              <span>{demoMode ? 'Demo' : 'Secure session'}</span>
              <ShieldCheck size={15} className="text-emerald-400" />
            </div>
            <p className="text-sm text-slate-300">{demoMode ? 'SIMULATED DATA — NOT REAL ASTRONAUT TELEMETRY' : 'Authenticated session · verify every source label'}</p>
          </div>

          <div className="mt-auto rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Access</p>
            <p className="mt-2 font-medium text-white">{role}</p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-500/60 hover:text-cyan-200"
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <header className="border-b border-slate-800 bg-slate-950/70 px-4 py-4 backdrop-blur-sm md:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-300 lg:hidden">
                  <Navigation size={18} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Orbital Health</p>
                  <p className="text-lg font-semibold text-white">Mission Status Console</p>
                </div>
              </div>

              <div className="flex max-w-[72vw] flex-wrap items-center justify-end gap-2 sm:max-w-none sm:gap-3">
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  {healthyCount} Healthy
                </div>
                <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-300">
                  {warningCount} Warning
                </div>
                <div className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
                  {criticalCount} Critical
                </div>
                <div className="hidden rounded-full border border-slate-500/30 bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-300 sm:block">
                  {unclassifiedCount} Unclassified
                </div>
                <Link to="/alerts" aria-label="Open medical alerts" className="relative rounded-xl border border-slate-700 bg-slate-900/70 p-2.5 text-slate-300 hover:text-cyan-200">
                  <Bell size={18} />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[9px] font-bold text-slate-950">
                    {recentAlerts.length}
                  </span>
                </Link>
                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 font-semibold text-cyan-200">{role === 'ASTRONAUT' ? 'AS' : 'MC'}</div>
                  <div className="hidden sm:block">
                    <p className="font-medium text-white">{role === 'ASTRONAUT' ? 'Flight Crew' : 'Mission Control'}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{role}</p>
                  </div>
                </div>
                <button type="button" onClick={() => { void onLogout(); }} aria-label="Sign out" className="rounded-xl border border-slate-700 bg-slate-900/70 p-2.5 text-slate-300 hover:text-cyan-200 lg:hidden">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
            <nav aria-label="Mobile navigation" className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {visibleNavItems.map(({ to, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `whitespace-nowrap rounded-lg border px-3 py-2 text-xs ${isActive ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100' : 'border-slate-800 text-slate-400'}`}>
                  {label}
                </NavLink>
              ))}
            </nav>
          </header>

          <main className="p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
              <span>Data sync: {syncMessage}</span>
              <div className="flex items-center gap-3"><span>{lastSync ? `Last successful sync: ${new Date(lastSync).toLocaleString()}` : 'Remote sync not confirmed'}</span>{pendingCount > 0 && !demoMode && <button type="button" onClick={onRetrySync} className="rounded border border-cyan-400/30 px-2 py-1 text-cyan-200">Retry sync ({pendingCount})</button>}</div>
            </div>
            {persistenceError && <p role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">{persistenceError}</p>}
            <Routes>
              <Route path="/overview" element={<OverviewPage astronauts={astronauts} missions={missions} alerts={alerts} healthRecords={healthRecords} demoMode={demoMode} />} />
              <Route path="/mission-control" element={role === 'ASTRONAUT' ? <Navigate to="/overview" replace /> : <EarthMissionControlPage astronauts={astronauts} missions={missions} records={healthRecords} alerts={alerts} />} />
              <Route path="/astronauts" element={role === 'ASTRONAUT' ? <Navigate to="/overview" replace /> : <AstronautsPage astronauts={astronauts} missions={missions} setAstronauts={setAstronauts} demoMode={demoMode} />} />
              <Route path="/astronauts/:id" element={role === 'ASTRONAUT' ? <Navigate to="/overview" replace /> : <AstronautDetailPage key={location.pathname} astronauts={astronauts} setAstronauts={setAstronauts} demoMode={demoMode} />} />
              <Route path="/health" element={<LiveHealthPage astronauts={astronauts} thresholds={thresholds} />} />
              <Route path="/assessment" element={<HealthAssessmentPage astronauts={astronauts} records={healthRecords} onSave={onSaveAssessment} />} />
              <Route path="/hazards" element={<HazardsPage />} />
              <Route path="/intelligence" element={<HealthIntelligencePage astronauts={astronauts} records={healthRecords} />} />
              <Route path="/tracking" element={<TrackingPage astronauts={astronauts} demoMode={demoMode} />} />
              <Route path="/body-map" element={<HumanBodyMapPage records={healthRecords} />} />
              <Route path="/routine" element={<DailyRoutinePage />} />
              <Route path="/analytics" element={<AdvancedAnalyticsPage astronauts={astronauts} records={healthRecords} />} />
              <Route path="/alerts" element={<AlertsPage alerts={alerts} astronauts={astronauts} setAlerts={setAlerts} />} />
              <Route path="/history" element={<HistoryPage records={healthRecords} astronauts={astronauts} />} />
              <Route path="/missions" element={role === 'ASTRONAUT' ? <Navigate to="/overview" replace /> : <MissionPage missions={missions} setMissions={setMissions} demoMode={demoMode} />} />
              <Route path="/tutorials" element={<TutorialsPage />} />
              <Route path="/settings" element={role === 'ASTRONAUT' ? <Navigate to="/overview" replace /> : <SettingsPage thresholds={thresholds} setThresholds={setThresholds} />} />
              <Route path="/login" element={<Navigate to="/overview" replace />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

function OverviewPage({ astronauts, missions, alerts, healthRecords, demoMode }: { astronauts: Astronaut[]; missions: Mission[]; alerts: AlertEntry[]; healthRecords: HealthRecord[]; demoMode: boolean }) {
  const healthyAstronauts = astronauts.filter((astronaut) => astronaut.healthStatus === 'healthy').length;
  const warningAlerts = alerts.filter((alert) => alert.severity === 'yellow').length;
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'red').length;
  const latestUpdate = healthRecords[0]?.timestamp;
  const sourceLabel = healthRecords.length === 0 ? 'NO READINGS' : [...new Set(healthRecords.map((record) => record.source))].join(' / ');

  const chartData = astronauts.map((astronaut) => {
    const record = healthRecords.find((entry) => entry.astronautId === astronaut.id);
    return {
      name: astronaut.name.split(' ')[0],
      heartRate: record?.heartRate ?? astronaut.heartRate,
      spO2: record?.spO2 ?? astronaut.spO2,
      respiratoryRate: record?.respiratoryRate ?? astronaut.respiratoryRate,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Overview</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Orbital Health Overview</h2>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
          Latest recorded assessment: {latestUpdate ? formatValue(latestUpdate) : 'No records'}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total Astronauts" value={String(astronauts.length)} accent="cyan" icon={<Users size={16} />} />
        <KpiCard label="Active Missions" value={String(missions.filter((mission) => mission.status === 'active').length)} accent="emerald" icon={<MoonStar size={16} />} />
        <KpiCard label="Healthy Astronauts" value={String(healthyAstronauts)} accent="green" icon={<ShieldCheck size={16} />} />
        <KpiCard label="Warning Alerts" value={String(warningAlerts)} accent="yellow" icon={<AlertTriangle size={16} />} />
        <KpiCard label="Critical Alerts" value={String(criticalAlerts)} accent="red" icon={<AlertTriangle size={16} />} />
        <KpiCard label="Latest record" value={latestUpdate ? formatValue(latestUpdate) : 'No records'} accent="sky" icon={<Info size={16} />} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recorded health</p>
              <h3 className="text-xl font-semibold text-white">Crew health snapshot</h3>
            </div>
            <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200">{demoMode && sourceLabel === 'NO READINGS' ? 'SIMULATED' : sourceLabel}</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="heartFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="heartRate" stroke="#22d3ee" fill="url(#heartFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Mission status</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</span>
            </div>
            <div className="space-y-3">
              {missions.map((mission) => (
                <div key={mission.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-white">{mission.name}</p>
                    <span className={getStatusClass(mission.status === 'active' ? 'healthy' : 'warning')}>{mission.status}</span>
                  </div>
                  <p className="text-sm text-slate-300">{mission.missionType}</p>
                  <p className="mt-2 text-xs text-slate-400">{mission.location}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Recent medical alerts</h3>
              <Link to="/alerts" className="text-xs text-cyan-300 hover:text-cyan-200">View all</Link>
            </div>
            <div className="space-y-3">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{alert.astronautName}</p>
                      <p className="text-sm text-slate-300">{alert.metric}: {alert.value}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${getSeverityClass(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Spacecraft location preview</h3>
            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200">SIMULATED</span>
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
            {spacecraftData.map((craft) => (
              <div key={craft.id} className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-b-0 last:pb-0">
                <div>
                  <p className="font-medium text-white">{craft.label}</p>
                  <p className="text-xs text-slate-400">LAT {craft.latitude}° / LON {craft.longitude}°</p>
                </div>
                <div className="text-right">
                  <p>ALT {craft.altitude.toLocaleString()} m</p>
                  <p className="text-xs text-slate-400">VEL {craft.velocity} km/s</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">System activity timeline</h3>
            <Zap size={16} className="text-cyan-300" />
          </div>
          <div className="space-y-4">
            {[
              'No medical sensor feeds are connected in this demonstration.',
              demoMode ? 'Demo crew and mission records are stored in this browser.' : 'Crew and mission roster loaded from the authorized Supabase session.',
              'Medical classifications remain unclassified without configured protocol limits.',
              'Spacecraft coordinates are illustrative and not live tracking.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                <div>
                  <p className="text-sm text-slate-200">{item}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">Integration status</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AstronautsPage({ astronauts, missions, setAstronauts, demoMode }: { astronauts: Astronaut[]; missions: Mission[]; setAstronauts: React.Dispatch<React.SetStateAction<Astronaut[]>>; demoMode: boolean }) {
  const [search, setSearch] = useState('');
  const [missionFilter, setMissionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = astronauts.filter((astronaut) => {
    const matchesMission = missionFilter === 'all' || astronaut.missionId === missionFilter;
    const matchesStatus = statusFilter === 'all' || astronaut.healthStatus === statusFilter;
    const term = search.toLowerCase();
    const matchesText = astronaut.name.toLowerCase().includes(term) || astronaut.role.toLowerCase().includes(term);
    return matchesMission && matchesStatus && matchesText;
  });

  const addDemoAstronaut = () => {
    const missionId = missions[0]?.id ?? 'mission-aurora';
    const next = {
      id: `astronaut-${Date.now()}`,
      name: 'Aster Quinn',
      avatar: 'AQ',
      missionId,
      role: 'Biomedical Systems Lead',
      status: 'active' as const,
      bloodPressure: { systolic: 120, diastolic: 78 },
      heartRate: 71,
      spO2: 97,
      temperature: 36.9,
      respiratoryRate: 17,
      lastHealthUpdate: new Date().toISOString(),
      healthStatus: 'healthy' as const,
      location: { latitude: 21.4, longitude: -92.2, altitude: 385000, velocity: 7.9 },
      telemetryHistory: {
        bloodPressure: [{ time: '00:00', value: 120 }, { time: '01:00', value: 118 }],
        heartRate: [{ time: '00:00', value: 70 }, { time: '01:00', value: 71 }],
        spO2: [{ time: '00:00', value: 97 }, { time: '01:00', value: 98 }],
        temperature: [{ time: '00:00', value: 36.8 }, { time: '01:00', value: 36.9 }],
        respiratoryRate: [{ time: '00:00', value: 16 }, { time: '01:00', value: 17 }],
      },
    };

    setAstronauts((current) => [next, ...current]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Astronaut Profiles</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Mission crew management</h2>
        </div>
        {demoMode && <button type="button" onClick={addDemoAstronaut} className="rounded-xl bg-cyan-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-cyan-400">Add demo astronaut</button>}
      </div>
      {!demoMode && <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400">Roster is read-only in this interface. Profile administration must be performed through an authorized provisioning workflow.</p>}

      <div className="glass-card p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search astronauts" className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500" />
          <select value={missionFilter} onChange={(event) => setMissionFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white">
            <option value="all">All missions</option>
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>{mission.name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white">
            <option value="all">All health states</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map((astronaut) => (
          <motion.div key={astronaut.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/12 font-semibold text-cyan-200">{astronaut.avatar}</div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{astronaut.name}</h3>
                  <p className="text-sm text-slate-400">{astronaut.role}</p>
                </div>
              </div>
              <span className={getStatusClass(astronaut.healthStatus)}>{astronaut.healthStatus}</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoCell label="Mission" value={missions.find((mission) => mission.id === astronaut.missionId)?.name ?? 'Unassigned'} />
              <InfoCell label="Status" value={astronaut.status} />
              <InfoCell label="Heart rate" value={`${astronaut.heartRate} BPM`} />
              <InfoCell label="SpO2" value={`${astronaut.spO2}%`} />
              <InfoCell label="Blood pressure" value={`${astronaut.bloodPressure.systolic}/${astronaut.bloodPressure.diastolic}`} />
              <InfoCell label="Last update" value={formatValue(astronaut.lastHealthUpdate)} />
            </div>

            <div className="mt-5 flex gap-3">
              <Link to={`/astronauts/${astronaut.id}`} className="flex-1 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-center text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20">
                View details
              </Link>
              {demoMode && <Link to={`/astronauts/${astronaut.id}?edit=true`} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">Edit profile</Link>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AstronautDetailPage({ astronauts, setAstronauts, demoMode }: { astronauts: Astronaut[]; setAstronauts: React.Dispatch<React.SetStateAction<Astronaut[]>>; demoMode: boolean }) {
  const { id } = useParams();
  const location = useLocation();
  const astronaut = astronauts.find((entry) => entry.id === id);

  const [editing, setEditing] = useState(() => demoMode && new URLSearchParams(location.search).get('edit') === 'true');
  const [formState, setFormState] = useState({
    name: astronaut?.name ?? '',
    role: astronaut?.role ?? '',
  });

  if (!astronaut) {
    return <div className="glass-card p-8 text-slate-200">Astronaut profile not found.</div>;
  }

  const saveChanges = () => {
    if (!formState.name.trim() || !formState.role.trim()) return;
    setAstronauts((current) => current.map((entry) => (entry.id === astronaut.id ? { ...entry, name: formState.name.trim(), role: formState.role.trim() } : entry)));
    setEditing(false);
  };

  const chartData = astronaut.telemetryHistory.heartRate.map((point, index) => ({
    time: point.time.slice(11, 16),
    heartRate: point.value,
    spO2: astronaut.telemetryHistory.spO2[index]?.value ?? point.value,
    temperature: astronaut.telemetryHistory.temperature[index]?.value ?? point.value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Individual Astronaut</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{astronaut.name}</h2>
        </div>
        {demoMode && <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-200">{editing ? 'Cancel' : 'Edit profile'}</button>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Telemetry History</p>
              <h3 className="text-xl font-semibold text-white">Vital trend</h3>
            </div>
            <span className={getStatusClass(astronaut.healthStatus)}>{astronaut.healthStatus}</span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="heartRate" stroke="#22d3ee" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="spO2" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-lg font-semibold text-cyan-200">{astronaut.avatar}</div>
            <div>
              <p className="text-sm text-slate-400">Mission role</p>
              <p className="font-medium text-white">{astronaut.role}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <InfoCell label="Astronaut ID" value={astronaut.id} />
            <InfoCell label="Mission Name" value={astronaut.missionId} />
            <InfoCell label="Mission status" value={astronaut.status} />
            <InfoCell label="Blood pressure" value={`${astronaut.bloodPressure.systolic}/${astronaut.bloodPressure.diastolic}`} />
            <InfoCell label="Heart rate" value={`${astronaut.heartRate} BPM`} />
            <InfoCell label="SpO2" value={`${astronaut.spO2}%`} />
            <InfoCell label="Temperature" value={`${astronaut.temperature} °C`} />
            <InfoCell label="Respiratory rate" value={`${astronaut.respiratoryRate}/min`} />
          </div>
        </div>
      </div>

      {editing && (
        <div className="glass-card p-5">
          <h3 className="text-xl font-semibold text-white">Edit profile</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" placeholder="Name" />
            <input value={formState.role} onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" placeholder="Role" />
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={saveChanges} className="rounded-xl bg-cyan-500 px-4 py-2.5 font-medium text-slate-950">Save changes</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveHealthPage({ astronauts, thresholds }: { astronauts: Astronaut[]; thresholds: ThresholdConfig | null }) {
  const [timeWindow, setTimeWindow] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const astronaut = astronauts[0];

  const metricCards = [
    { key: 'bloodPressure', label: 'Blood Pressure', value: astronaut ? `${astronaut.bloodPressure.systolic}/${astronaut.bloodPressure.diastolic} mmHg` : 'No data' },
    { key: 'heartRate', label: 'Heart Rate', value: astronaut ? `${astronaut.heartRate} BPM` : 'No data' },
    { key: 'spO2', label: 'Oxygen Saturation', value: astronaut ? `${astronaut.spO2}%` : 'No data' },
    { key: 'temperature', label: 'Body Temperature', value: astronaut ? `${astronaut.temperature} °C` : 'No data' },
    { key: 'respiratoryRate', label: 'Respiratory Rate', value: astronaut ? `${astronaut.respiratoryRate}/min` : 'No data' },
  ];

  const chartSeries = (['heartRate', 'bloodPressure', 'spO2', 'temperature', 'respiratoryRate'] as const).map((metric) => {
    const telemetry = astronaut?.telemetryHistory[metric] ?? [];
    const visibleCount = timeWindow === '1h' ? 1 : timeWindow === '6h' ? 2 : telemetry.length;
    return {
      metric,
      data: telemetry.slice(-visibleCount).map((point, index) => ({
        time: `T-${index}`,
        value: point.value,
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Astronaut Health</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Crew health snapshot</h2>
        </div>
        <div className="flex gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-1">
          {['1h', '6h', '24h', '7d'].map((range) => (
            <button key={range} type="button" onClick={() => setTimeWindow(range as '1h' | '6h' | '24h' | '7d')} className={`rounded-lg px-3 py-2 text-sm ${timeWindow === range ? 'bg-cyan-500 text-slate-950' : 'text-slate-200'}`}>
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-amber-100">
        SIMULATED DEMONSTRATION DATA · No medical sensors are connected. These sample history windows are illustrative, not live telemetry.
        {thresholds ? ` Local protocol: ${thresholds.protocolName} (approval is not verified by this demo).` : ' Health classifications are unclassified because no thresholds have been configured.'}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((card) => (
          <div key={card.label} className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{card.label}</span>
              <span className={getStatusClass(astronaut?.healthStatus ?? 'unclassified')}>{astronaut?.healthStatus ?? 'unclassified'}</span>
            </div>
            <p className="text-2xl font-semibold text-white">{card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{thresholds ? `Protocol: ${thresholds.protocolName}` : 'No configured medical protocol'}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {chartSeries.map((series) => (
          <div key={series.metric} className="glass-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{formatMetricLabel(series.metric)}</h3>
              <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">{timeWindow}</span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series.data}>
                  <defs>
                    <linearGradient id={`${series.metric}-gradient`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#38bdf8" fill={`url(#${series.metric}-gradient)`} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackingPage({ astronauts, demoMode }: { astronauts: Astronaut[]; demoMode: boolean }) {
  const [selectedCraft, setSelectedCraft] = useState(spacecraftData[0]);
  const [globeWidth, setGlobeWidth] = useState(() => typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.75, 800) : 800);

  useEffect(() => {
    const resize = () => setGlobeWidth(Math.min(window.innerWidth * 0.75, 800));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const arcs = demoMode ? astronauts.map((astronaut, index) => ({
    startLat: astronaut.location.latitude,
    startLng: astronaut.location.longitude,
    endLat: selectedCraft.latitude,
    endLng: selectedCraft.longitude,
    color: ['#22d3ee', '#34d399', '#f59e0b'][index % 3],
  })) : [];

  const points = demoMode ? spacecraftData.map((craft) => ({
    lat: craft.latitude,
    lng: craft.longitude,
    size: 0.18,
    color: '#22d3ee',
    altitude: 0.15,
    label: craft.label,
  })) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Space Tracking</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Orbital location tracking</h2>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
          {demoMode ? 'SPACECRAFT POSITION: SIMULATED' : 'NO AUTHORIZED TRACKING FEED CONNECTED'}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="glass-card overflow-hidden p-4">
          <div className="h-[520px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#020915]">
            <Globe
              width={globeWidth}
              height={520}
              backgroundColor="rgba(2,9,21,0)"
              showAtmosphere
              atmosphereColor="#67e8f9"
              atmosphereAltitude={0.18}
              pointsData={points}
              pointResolution={24}
              pointLabel={(point: any) => point.label}
              pointLat={(point: any) => point.lat}
              pointLng={(point: any) => point.lng}
              pointAltitude={(point: any) => point.altitude}
              pointRadius={(point: any) => point.size}
              pointColor={(point: any) => point.color}
              arcsData={arcs}
              arcColor={(arc: any) => arc.color}
              arcDashLength={0.4}
              arcDashGap={0.18}
              arcDashAnimateTime={3000}
              arcAltitudeAutoScale={0.6}
            />
          </div>
        </div>

        <div className="space-y-6">
          {demoMode ? <div className="glass-card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Selected craft</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{selectedCraft.label}</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <InfoCell label="Latitude" value={`${selectedCraft.latitude}°`} />
              <InfoCell label="Longitude" value={`${selectedCraft.longitude}°`} />
              <InfoCell label="Altitude" value={`${selectedCraft.altitude.toLocaleString()} m`} />
              <InfoCell label="Velocity" value={`${selectedCraft.velocity} km/s`} />
            </div>
          </div> : <div className="glass-card p-5"><p className="text-sm leading-6 text-slate-300">Mission trajectory and astronaut location are unavailable because no authorized tracking data source is connected. Coordinates are not inferred.</p></div>}

          {demoMode && <div className="glass-card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Location history</p>
            <div className="mt-3 space-y-3">
              {astronauts.map((astronaut) => (
                <button key={astronaut.id} type="button" onClick={() => setSelectedCraft({ id: astronaut.id, label: astronaut.name, latitude: astronaut.location.latitude, longitude: astronaut.location.longitude, altitude: astronaut.location.altitude, velocity: astronaut.location.velocity })} className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{astronaut.name}</p>
                    <span className={getStatusClass(astronaut.healthStatus)}>{astronaut.healthStatus}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{astronaut.location.latitude.toFixed(2)}°, {astronaut.location.longitude.toFixed(2)}°</p>
                </button>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

function AlertsPage({ alerts, astronauts, setAlerts }: { alerts: AlertEntry[]; astronauts: Astronaut[]; setAlerts: React.Dispatch<React.SetStateAction<AlertEntry[]>> }) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [astronautFilter, setAstronautFilter] = useState('all');
  const [astronautId, setAstronautId] = useState(astronauts[0]?.id ?? '');
  const [severity, setSeverity] = useState<'yellow' | 'red'>('yellow');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const filtered = alerts.filter((alert) => {
    const severityMatch = severityFilter === 'all' || alert.severity === severityFilter;
    const astronautMatch = astronautFilter === 'all' || alert.astronautName === astronautFilter;
    return severityMatch && astronautMatch;
  });

  const markReviewed = (alertId: string) => {
    setAlerts((current) => current.map((alert) => (alert.id === alertId ? { ...alert, reviewStatus: 'reviewed' } : alert)));
  };

  const escalate = (alertId: string) => {
    setAlerts((current) => current.map((alert) => (alert.id === alertId ? { ...alert, reviewStatus: 'escalated' } : alert)));
  };

  const submitRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const astronaut = astronauts.find((entry) => entry.id === astronautId);
    if (!astronaut || !description.trim()) {
      setMessage('Select an astronaut and describe the requested follow-up.');
      return;
    }
    const request: AlertEntry = {
      id: crypto.randomUUID(),
      astronautId: astronaut.id,
      astronautName: astronaut.name,
      metric: 'Crew-submitted medical review request',
      description: description.trim(),
      alertTime: new Date().toISOString(),
      severity,
      reviewStatus: 'open',
      source: 'MANUAL ENTRY',
    };
    setAlerts((current) => [request, ...current]);
    setDescription('');
    setMessage('Request filed. It will remain queued until sync is confirmed; this app does not send push, SMS, or emergency-service notifications.');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Alert system</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Medical review & escalation</h2>
      </div>

      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">
        No automatic medical thresholds are active. Crew-submitted requests are not sent as push or SMS notifications. For urgent situations, use the mission emergency communication procedure immediately.
      </div>

      <form onSubmit={submitRequest} className="glass-card grid gap-3 p-5 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
        <label className="block"><span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Astronaut</span><select value={astronautId} onChange={(event) => setAstronautId(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white">{astronauts.map((astronaut) => <option key={astronaut.id} value={astronaut.id}>{astronaut.name}</option>)}</select></label>
        <label className="block"><span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Review priority</span><select value={severity} onChange={(event) => setSeverity(event.target.value as 'yellow' | 'red')} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white"><option value="yellow">Attention — review requested</option><option value="red">Urgent — prompt medical review requested</option></select></label>
        <label className="block"><span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Request description</span><input value={description} onChange={(event) => { setDescription(event.target.value); setMessage(''); }} maxLength={500} required className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" placeholder="Describe the requested follow-up" /></label>
        <button type="submit" className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950">File request</button>
        {message && <p role="status" className="text-sm text-cyan-200 md:col-span-4">{message}</p>}
      </form>

      <div className="glass-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white">
            <option value="all">All priorities</option>
            <option value="green">Normal</option>
            <option value="yellow">Attention</option>
            <option value="red">Urgent</option>
          </select>
          <select value={astronautFilter} onChange={(event) => setAstronautFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white">
            <option value="all">All astronauts</option>
            {[...new Set(alerts.map((alert) => alert.astronautName))].map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && <div className="glass-card p-6 text-sm text-slate-400">No review requests match this filter. No concern is implied by an empty queue.</div>}
        {filtered.map((alert) => (
          <div key={alert.id} className="glass-card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-white">{alert.astronautName}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${getSeverityClass(alert.severity)}`}>{alert.severity === 'yellow' ? 'Attention' : alert.severity === 'red' ? 'Urgent' : 'Normal'}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{alert.metric}{alert.value !== undefined ? ` · recorded value ${alert.value} / configured boundary ${alert.threshold}` : ''}</p>
                {alert.description && <p className="mt-1 text-sm leading-5 text-slate-400">{alert.description}</p>}
                <p className="mt-1 text-xs text-slate-500">{new Date(alert.alertTime).toLocaleString()} · {alert.source}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-400">{alert.reviewStatus}</span>
                {alert.reviewStatus === 'open' && <><button type="button" onClick={() => markReviewed(alert.id)} className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">Acknowledge</button><button type="button" onClick={() => escalate(alert.id)} className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">Log escalation</button></>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryPage({ records, astronauts }: { records: HealthRecord[]; astronauts: Astronaut[] }) {
  const [astronautFilter, setAstronautFilter] = useState('all');
  const [parameterFilter, setParameterFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = records.filter((record) => {
    const astronautMatch = astronautFilter === 'all' || record.astronautName === astronautFilter;
    const paramMatch = parameterFilter === 'all' ||
      (parameterFilter === 'heartRate' && record.heartRate > 0) ||
      (parameterFilter === 'spO2' && record.spO2 > 0) ||
      (parameterFilter === 'bloodSugar' && record.bloodSugar !== undefined) ||
      (parameterFilter === 'sleepHours' && record.sleepHours !== undefined) ||
      (parameterFilter === 'mood' && record.mood !== undefined);
    return astronautMatch && paramMatch;
  });

  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const rows = [
      ['Astronaut', 'Timestamp', 'Source', 'Heart Rate', 'SpO2', 'Temperature', 'Respiratory Rate', 'Blood Pressure', 'Blood glucose', 'Sleep hours', 'Mood'],
      ...filtered.map((record) => [record.astronautName, record.timestamp, record.source, String(record.heartRate), String(record.spO2), String(record.temperature), String(record.respiratoryRate), `${record.bloodPressure.systolic}/${record.bloodPressure.diastolic}`, String(record.bloodSugar ?? ''), String(record.sleepHours ?? ''), record.mood ?? '']),
    ];
    const csvContent = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orbitcare-health-records.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Historical Records</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Medical timeline archive</h2>
        </div>
        <button type="button" onClick={exportCsv} className="rounded-xl bg-cyan-500 px-4 py-2.5 font-medium text-slate-950">
          Export CSV
        </button>
      </div>

      <div className="glass-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <select value={astronautFilter} onChange={(event) => { setAstronautFilter(event.target.value); setPage(1); }} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white">
            <option value="all">All astronauts</option>
            {astronauts.map((astronaut) => (
              <option key={astronaut.id} value={astronaut.name}>{astronaut.name}</option>
            ))}
          </select>
          <select value={parameterFilter} onChange={(event) => { setParameterFilter(event.target.value); setPage(1); }} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white">
            <option value="all">All parameters</option>
            <option value="heartRate">Heart Rate</option>
            <option value="spO2">SpO2</option>
            <option value="bloodSugar">Blood glucose</option>
            <option value="sleepHours">Sleep duration</option>
            <option value="mood">Mood check-in</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {currentPageData.map((record) => (
          <div key={record.id} className="glass-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold text-white">{record.astronautName}</p>
                <p className="text-sm text-slate-400">{formatValue(record.timestamp)}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-sm text-slate-300">
                <span>HR {record.heartRate}</span>
                <span>SpO2 {record.spO2}%</span>
                <span>Temp {record.temperature}°C</span>
                <span>BP {record.bloodPressure.systolic}/{record.bloodPressure.diastolic}</span>
                {record.bloodSugar !== undefined && <span>Glucose {record.bloodSugar} mg/dL</span>}
                {record.sleepHours !== undefined && <span>Sleep {record.sleepHours} hr</span>}
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">{record.source}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 disabled:opacity-40">
          Previous
        </button>
        <p className="text-sm text-slate-300">Page {page} of {pageCount}</p>
        <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}

function MissionPage({ missions, setMissions, demoMode }: { missions: Mission[]; setMissions: React.Dispatch<React.SetStateAction<Mission[]>>; demoMode: boolean }) {
  const [form, setForm] = useState({ name: '', missionType: '', status: 'active', spacecraft: '', location: '' });

  const createMission = () => {
    if (!form.name.trim()) return;

    const newMission: Mission = {
      id: `mission-${Date.now()}`,
      name: form.name,
      missionType: form.missionType,
      launchDate: new Date().toISOString().slice(0, 10),
      returnDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: form.status as Mission['status'],
      spacecraft: form.spacecraft || 'Astra-X',
      location: form.location || 'Earth Orbit',
      assignedAstronautIds: [],
    };

    setMissions((current) => [newMission, ...current]);
    setForm({ name: '', missionType: '', status: 'active', spacecraft: '', location: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Mission Management</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Mission operations</h2>
      </div>

      {demoMode ? (
      <div className="glass-card p-5">
        <h3 className="text-xl font-semibold text-white">Create mission</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" placeholder="Mission name" />
          <input value={form.missionType} onChange={(event) => setForm((current) => ({ ...current, missionType: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" placeholder="Mission type" />
          <input value={form.spacecraft} onChange={(event) => setForm((current) => ({ ...current, spacecraft: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" placeholder="Spacecraft" />
          <input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" placeholder="Mission location" />
          <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white md:col-span-2">
            <option value="active">Active</option>
            <option value="prelaunch">Prelaunch</option>
            <option value="returning">Returning</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={createMission} className="rounded-xl bg-cyan-500 px-4 py-2.5 font-medium text-slate-950">Save mission</button>
        </div>
      </div>
      ) : <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400">Mission records are read-only in this interface; administrative mission changes require an authorized provisioning workflow.</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {missions.map((mission) => (
          <div key={mission.id} className="glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">{mission.name}</p>
                <p className="text-sm text-slate-400">{mission.missionType}</p>
              </div>
              <span className={getStatusClass(mission.status === 'active' ? 'healthy' : mission.status === 'completed' ? 'warning' : 'healthy')}>{mission.status}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoCell label="Mission ID" value={mission.id} />
              <InfoCell label="Spacecraft" value={mission.spacecraft} />
              <InfoCell label="Launch date" value={mission.launchDate} />
              <InfoCell label="Return date" value={mission.returnDate} />
              <InfoCell label="Location" value={mission.location} />
              <InfoCell label="Astronauts" value={String(mission.assignedAstronautIds.length)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage({ thresholds, setThresholds }: { thresholds: ThresholdConfig | null; setThresholds: (thresholds: ThresholdConfig | null) => void }) {
  const [form, setForm] = useState(() => ({
    protocolName: thresholds?.protocolName ?? '',
    approvedBy: thresholds?.approvedBy ?? '',
    heartRateWarning: String(thresholds?.heartRate.warning ?? ''),
    heartRateCritical: String(thresholds?.heartRate.critical ?? ''),
    spO2Warning: String(thresholds?.spO2.warning ?? ''),
    spO2Critical: String(thresholds?.spO2.critical ?? ''),
    temperatureWarning: String(thresholds?.temperature.warning ?? ''),
    temperatureCritical: String(thresholds?.temperature.critical ?? ''),
    respiratoryWarning: String(thresholds?.respiratoryRate.warning ?? ''),
    respiratoryCritical: String(thresholds?.respiratoryRate.critical ?? ''),
    bloodPressureWarning: String(thresholds?.bloodPressure.warning ?? ''),
    bloodPressureCritical: String(thresholds?.bloodPressure.critical ?? ''),
  }));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    setSaved('');
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numbers = {
      heartRateWarning: Number(form.heartRateWarning),
      heartRateCritical: Number(form.heartRateCritical),
      spO2Warning: Number(form.spO2Warning),
      spO2Critical: Number(form.spO2Critical),
      temperatureWarning: Number(form.temperatureWarning),
      temperatureCritical: Number(form.temperatureCritical),
      respiratoryWarning: Number(form.respiratoryWarning),
      respiratoryCritical: Number(form.respiratoryCritical),
      bloodPressureWarning: Number(form.bloodPressureWarning),
      bloodPressureCritical: Number(form.bloodPressureCritical),
    };
    if (!form.protocolName.trim() || !form.approvedBy.trim() || Object.values(form).some((value) => typeof value === 'string' && value.trim() === '') ||
      Object.values(numbers).some((value) => !Number.isFinite(value) || value <= 0)) {
      setError('Enter a protocol identifier, reviewer name, and positive numeric boundaries for every measure.');
      return;
    }
    if (numbers.heartRateWarning >= numbers.heartRateCritical || numbers.temperatureWarning >= numbers.temperatureCritical ||
      numbers.respiratoryWarning >= numbers.respiratoryCritical || numbers.bloodPressureWarning >= numbers.bloodPressureCritical ||
      numbers.spO2Warning <= numbers.spO2Critical) {
      setError('For high-is-concern metrics, the warning boundary must be below critical. For oxygen saturation, the warning boundary must be above critical.');
      return;
    }
    setThresholds({
      protocolName: form.protocolName.trim(),
      approvedBy: form.approvedBy.trim(),
      heartRate: { warning: numbers.heartRateWarning, critical: numbers.heartRateCritical },
      spO2: { warning: numbers.spO2Warning, critical: numbers.spO2Critical },
      temperature: { warning: numbers.temperatureWarning, critical: numbers.temperatureCritical },
      respiratoryRate: { warning: numbers.respiratoryWarning, critical: numbers.respiratoryCritical },
      bloodPressure: { warning: numbers.bloodPressureWarning, critical: numbers.bloodPressureCritical },
    });
    setSaved('Thresholds saved locally. This application does not verify the protocol or reviewer authorization.');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Settings</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">System threshold configuration</h2>
      </div>

      <div className="glass-card p-5">
        <p className="mb-4 text-sm text-slate-300">No medical alert limits are preloaded. Configure only mission-approved values. The name/reviewer fields are audit labels, not proof of approval; this demo cannot verify authorization.</p>
        {thresholds && <p className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-100">Configured protocol: {thresholds.protocolName} · Reviewer: {thresholds.approvedBy}. Values remain locally stored and unverified.</p>}
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Protocol identifier</span><input value={form.protocolName} onChange={(event) => updateField('protocolName', event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" /></label>
            <label className="block"><span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Reviewer name / role</span><input value={form.approvedBy} onChange={(event) => updateField('approvedBy', event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" /></label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {([
              ['Heart rate warning', 'heartRateWarning'],
              ['Heart rate urgent', 'heartRateCritical'],
              ['SpO₂ warning (low)', 'spO2Warning'],
              ['SpO₂ urgent (low)', 'spO2Critical'],
              ['Temperature warning', 'temperatureWarning'],
              ['Temperature urgent', 'temperatureCritical'],
              ['Respiratory rate warning', 'respiratoryWarning'],
              ['Respiratory rate urgent', 'respiratoryCritical'],
              ['Systolic pressure warning', 'bloodPressureWarning'],
              ['Systolic pressure urgent', 'bloodPressureCritical'],
            ] as const).map(([label, key]) => <label key={key} className="block"><span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">{label}</span><input type="number" step="any" value={form[key]} onChange={(event) => updateField(key, event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white" /></label>)}
          </div>

          {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
          {saved && <p role="status" className="text-sm text-emerald-200">{saved}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            {thresholds && <button type="button" onClick={() => { setThresholds(null); setSaved('Thresholds cleared. Health classifications returned to unclassified.'); }} className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-200">Clear configuration</button>}
            <button type="submit" className="rounded-xl bg-cyan-500 px-4 py-2.5 font-medium text-slate-950">Apply thresholds</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoginPage({ onLogin, demoMode, authError }: { onLogin: (role: Role) => void | Promise<void>; demoMode: boolean; authError: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('ADMIN');
  const [error, setError] = useState(authError);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (demoMode) {
      await onLogin(selectedRole);
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured. Configure the project URL and anon key or enable demo mode explicitly.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      if (!data.user) throw new Error('Supabase did not return an authenticated user.');
      const userRole = await getUserRole(data.user.id);
      await onLogin(userRole);
    } catch (loginError) {
      console.error('ORBITCARE sign-in failed.', loginError);
      const errorMessage = loginError instanceof Error ? loginError.message : String(loginError);
      setError(errorMessage);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('Could not clear the failed Supabase session.', signOutError);
        setError(`${errorMessage} Sign-out also failed: ${signOutError.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#082033_0%,#020914_45%,#01070d_100%)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-cyan-500/20 bg-slate-950/80 p-8 shadow-[0_0_40px_rgba(34,211,238,0.14)] backdrop-blur-xl">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-300/70">ORBITCARE</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{demoMode ? 'Demonstration console' : 'Mission Control Login'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!demoMode && <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Email</label>
            <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3 text-white" />
          </div>}
          {!demoMode && <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Password</label>
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3 text-white" />
          </div>}
          {demoMode && <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Demo view role (not verified)</label>
            <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Role)} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3 text-white">
              <option value="ADMIN">ADMIN</option>
              <option value="MEDICAL TEAM">MEDICAL TEAM</option>
              <option value="MISSION CONTROL">MISSION CONTROL</option>
              <option value="ASTRONAUT">ASTRONAUT</option>
            </select>
          </div>}
          {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{submitting ? 'Authenticating…' : demoMode ? 'Enter demonstration console' : 'Sign in securely'}</button>
        </form>

        <p className="mt-4 text-center text-xs leading-5 text-slate-400">{demoMode ? 'Demonstration mode is not authentication. Profile selection does not enforce permissions.' : 'Access requires a Supabase account and a provisioned ORBITCARE role. Only the public anon key is used in this application.'}</p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: React.ReactNode }) {
  const gradient = accent === 'cyan' ? 'from-cyan-500/20 to-cyan-500/5' : accent === 'emerald' ? 'from-emerald-500/20 to-emerald-500/5' : accent === 'green' ? 'from-green-500/20 to-green-500/5' : accent === 'yellow' ? 'from-yellow-500/20 to-yellow-500/5' : accent === 'red' ? 'from-red-500/20 to-red-500/5' : 'from-sky-500/20 to-sky-500/5';

  return (
    <div className={`rounded-2xl border border-slate-800 bg-gradient-to-br ${gradient} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</span>
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2 text-cyan-200">{icon}</div>
      </div>
      <p className="mt-4 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

export default App;
