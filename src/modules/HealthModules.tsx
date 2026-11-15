import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Brain,
  Check,
  CircleHelp,
  Heart,
  Info,
  Layers,
  Moon,
  ShieldAlert,
  Wind,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AlertEntry, Astronaut, HealthRecord, Mission } from '../types';

const cardClass = 'glass-card p-5';
const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-500';

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">{description}</p>
    </div>
  );
}

function Field({ label, unit, ...props }: { label: string; unit?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}{unit && <span className="normal-case tracking-normal text-slate-500">{unit}</span>}
      </span>
      <input {...props} className={inputClass} />
    </label>
  );
}

function SelectField({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <select {...props} className={inputClass}>{children}</select>
    </label>
  );
}

type AssessmentForm = {
  astronautId: string;
  recordedAt: string;
  systolic: string;
  diastolic: string;
  heartRate: string;
  respiratoryRate: string;
  bloodSugar: string;
  temperature: string;
  sleepHours: string;
  mood: string;
  spO2: string;
  hydrationLiters: string;
  nutrition: string;
  exerciseMinutes: string;
};

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function HealthAssessmentPage({ astronauts, records, onSave }: {
  astronauts: Astronaut[];
  records: HealthRecord[];
  onSave: (record: HealthRecord) => void;
}) {
  const [form, setForm] = useState<AssessmentForm>({
    astronautId: astronauts[0]?.id ?? '',
    recordedAt: localDateTimeValue(),
    systolic: '',
    diastolic: '',
    heartRate: '',
    respiratoryRate: '',
    bloodSugar: '',
    temperature: '',
    sleepHours: '',
    mood: '',
    spO2: '',
    hydrationLiters: '',
    nutrition: '',
    exerciseMinutes: '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const selectedAstronaut = astronauts.find((astronaut) => astronaut.id === form.astronautId);
  const recent = records.filter((record) => record.astronautId === form.astronautId).slice(0, 5);

  const change = (key: keyof AssessmentForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    setSaved('');
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const required = ['systolic', 'diastolic', 'heartRate', 'respiratoryRate', 'bloodSugar', 'temperature', 'sleepHours', 'mood', 'spO2', 'hydrationLiters', 'nutrition', 'exerciseMinutes'] as const;
    if (!selectedAstronaut || required.some((key) => form[key].trim() === '') || !form.recordedAt) {
      setError('Complete each assessment field before saving.');
      return;
    }

    const systolic = Number(form.systolic);
    const diastolic = Number(form.diastolic);
    const heartRate = Number(form.heartRate);
    const respiratoryRate = Number(form.respiratoryRate);
    const bloodSugar = Number(form.bloodSugar);
    const temperature = Number(form.temperature);
    const sleepHours = Number(form.sleepHours);
    const spO2 = Number(form.spO2);
    const hydrationLiters = Number(form.hydrationLiters);
    const exerciseMinutes = Number(form.exerciseMinutes);
    const recordedDate = new Date(form.recordedAt);
    const numericValues = [systolic, diastolic, heartRate, respiratoryRate, bloodSugar, temperature, sleepHours, spO2, hydrationLiters, exerciseMinutes];

    if (numericValues.some((value) => !Number.isFinite(value)) || Number.isNaN(recordedDate.getTime())) {
      setError('Enter valid numbers and a valid measurement time.');
      return;
    }
    if (systolic <= diastolic || systolic < 50 || systolic > 300 || diastolic < 30 || diastolic > 200 ||
      heartRate < 20 || heartRate > 250 || respiratoryRate < 1 || respiratoryRate > 100 || bloodSugar < 20 || bloodSugar > 1000 ||
      temperature < 25 || temperature > 45 || sleepHours < 0 || sleepHours > 24 ||
      spO2 < 50 || spO2 > 100 || hydrationLiters < 0 || hydrationLiters > 10 ||
      exerciseMinutes < 0 || exerciseMinutes > 600) {
      setError('One or more values are outside the supported recording range. Check units and the source device; this is data validation, not a medical assessment.');
      return;
    }

    const record: HealthRecord = {
      id: crypto.randomUUID(),
      astronautId: selectedAstronaut.id,
      astronautName: selectedAstronaut.name,
      timestamp: recordedDate.toISOString(),
      bloodPressure: { systolic, diastolic },
      heartRate,
      bloodSugar,
      temperature,
      sleepHours,
      mood: form.mood,
      spO2,
      hydrationLiters,
      nutrition: form.nutrition,
      exerciseMinutes,
      respiratoryRate,
      source: 'MANUAL ENTRY',
    };
    onSave(record);
    setSaved(`Assessment recorded for ${selectedAstronaut.name}. Remote synchronization status is shown in the console header.`);
    setForm((current) => ({
      ...current,
      recordedAt: localDateTimeValue(),
      systolic: '',
      diastolic: '',
      heartRate: '',
      respiratoryRate: '',
      bloodSugar: '',
      temperature: '',
      sleepHours: '',
      mood: '',
      spO2: '',
      hydrationLiters: '',
      nutrition: '',
      exerciseMinutes: '',
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Crew health / manual entry" title="Health assessment" description="Record an astronaut check-in. Values entered here are manual records, are stored in this browser in demo mode, and are not readings from medical sensors." />
      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-amber-100">
        <div className="flex items-start gap-3"><Info size={18} className="mt-0.5 shrink-0" /><p>Use mission-approved instruments and procedures. The input ranges below only catch likely data-entry errors; they are not medical reference ranges or alert thresholds.</p></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <form onSubmit={save} className={`${cardClass} space-y-5`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Astronaut" value={form.astronautId} onChange={(event) => change('astronautId', event.target.value)}>
              {astronauts.map((astronaut) => <option key={astronaut.id} value={astronaut.id}>{astronaut.name}</option>)}
            </SelectField>
            <Field label="Measurement time" type="datetime-local" value={form.recordedAt} onChange={(event) => change('recordedAt', event.target.value)} />
            <Field label="Blood pressure — systolic" unit="mmHg" type="number" min="50" max="300" step="1" value={form.systolic} onChange={(event) => change('systolic', event.target.value)} />
            <Field label="Blood pressure — diastolic" unit="mmHg" type="number" min="30" max="200" step="1" value={form.diastolic} onChange={(event) => change('diastolic', event.target.value)} />
            <Field label="Heart rate" unit="BPM" type="number" min="20" max="250" step="1" value={form.heartRate} onChange={(event) => change('heartRate', event.target.value)} />
            <Field label="Respiratory rate" unit="breaths/min" type="number" min="1" max="100" step="1" value={form.respiratoryRate} onChange={(event) => change('respiratoryRate', event.target.value)} />
            <Field label="Blood glucose" unit="mg/dL" type="number" min="20" max="1000" step="1" value={form.bloodSugar} onChange={(event) => change('bloodSugar', event.target.value)} />
            <Field label="Body temperature" unit="°C" type="number" min="25" max="45" step="0.1" value={form.temperature} onChange={(event) => change('temperature', event.target.value)} />
            <Field label="Sleep duration" unit="hours" type="number" min="0" max="24" step="0.1" value={form.sleepHours} onChange={(event) => change('sleepHours', event.target.value)} />
            <Field label="Oxygen saturation" unit="SpO₂ %" type="number" min="50" max="100" step="1" value={form.spO2} onChange={(event) => change('spO2', event.target.value)} />
            <Field label="Hydration" unit="liters" type="number" min="0" max="10" step="0.1" value={form.hydrationLiters} onChange={(event) => change('hydrationLiters', event.target.value)} />
            <SelectField label="Mood check-in" value={form.mood} onChange={(event) => change('mood', event.target.value)}>
              <option value="">Select a check-in</option><option>Very positive</option><option>Positive</option><option>Neutral</option><option>Stressed</option><option>Low</option>
            </SelectField>
            <SelectField label="Nutrition check-in" value={form.nutrition} onChange={(event) => change('nutrition', event.target.value)}>
              <option value="">Select a check-in</option><option>On plan</option><option>Partial</option><option>Missed meal</option><option>Needs follow-up</option>
            </SelectField>
            <Field label="Exercise activity" unit="minutes" type="number" min="0" max="600" step="1" value={form.exerciseMinutes} onChange={(event) => change('exerciseMinutes', event.target.value)} />
          </div>
          {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
          {saved && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{saved}</p>}
          <button type="submit" className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300">Save manual assessment</button>
        </form>
        <div className="space-y-4">
          <div className={cardClass}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Measurement guide</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>• Use approved, calibrated equipment and the mission procedure.</li>
              <li>• Record the unit and time shown; do not estimate a missing value.</li>
              <li>• For mood, sleep, nutrition, and hydration use the astronaut’s self-report.</li>
              <li>• Consult the flight surgeon for interpretation or concerns.</li>
            </ul>
          </div>
          <div className={cardClass}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent records · {selectedAstronaut?.name ?? 'No crew selected'}</p>
            <div className="mt-4 space-y-3">
              {recent.length === 0 && <p className="text-sm text-slate-500">No health assessments have been recorded for this astronaut.</p>}
              {recent.map((record) => <div key={record.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex justify-between gap-2"><span className="text-sm text-white">{new Date(record.timestamp).toLocaleString()}</span><span className="text-[10px] text-cyan-200">{record.source}</span></div><p className="mt-1 text-xs text-slate-400">BP {record.bloodPressure.systolic}/{record.bloodPressure.diastolic} · HR {record.heartRate} BPM · SpO₂ {record.spO2}%</p></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const hazards = [
  {
    name: 'Space radiation',
    subtitle: 'Ionizing radiation exposure',
    icon: ShieldAlert,
    description: 'Space crews encounter galactic cosmic rays and solar particle events. Exposure varies with mission trajectory, shielding, and solar conditions.',
    risks: 'Potential cumulative tissue and organ effects; risk depends on dose, duration, and individual factors.',
    measurements: 'Dosimeter readings, cumulative absorbed/equivalent dose, solar event reports. No connected radiation feed in this demo.',
    actions: 'Connect validated dosimetry, preserve time-stamped exposure records, and follow mission radiation protection protocols.',
  },
  {
    name: 'Isolation & confinement',
    subtitle: 'Behavioral health and sleep',
    icon: Brain,
    description: 'Confinement, workload, disrupted sleep, and distance from familiar support can affect mood, cognition, and team dynamics.',
    risks: 'Possible changes in stress, sleep, mood, attention, and interpersonal functioning.',
    measurements: 'Voluntary mood and stress check-ins, sleep duration and quality, behavioral health consultations.',
    actions: 'Use regular private check-ins, protect sleep opportunities, and escalate concerns through established behavioral-health channels.',
  },
  {
    name: 'Distance from Earth',
    subtitle: 'Communication and medical latency',
    icon: Layers,
    description: 'Increasing distance can increase one-way communication delay and reduce real-time access to ground-based medical support.',
    risks: 'Delayed consultation and constrained access to supplies or specialist support.',
    measurements: 'Mission distance, measured link latency, communication availability, support-request status.',
    actions: 'Validate mission-specific communications and onboard autonomy plans with flight operations; do not assume immediate ground response.',
  },
  {
    name: 'Gravity fields',
    subtitle: 'Microgravity and transitions',
    icon: Activity,
    description: 'Microgravity and gravity transitions change mechanical loading and fluid distribution, requiring individualized monitoring.',
    risks: 'Potential changes to bone, muscle, balance, and cardiovascular adaptation.',
    measurements: 'Approved exercise logs and mission-defined bone, muscle, balance, and cardiovascular assessments.',
    actions: 'Track prescribed countermeasure participation and assessments under the flight surgeon’s protocol.',
  },
  {
    name: 'Hostile closed environments',
    subtitle: 'Cabin and life-support conditions',
    icon: Wind,
    description: 'A confined spacecraft depends on life-support systems to maintain habitable thermal, humidity, and air-quality conditions.',
    risks: 'Environmental deviations may affect comfort and health; effects depend on the agent, exposure, and duration.',
    measurements: 'Calibrated cabin temperature, humidity, pressure, and air-quality sensors with verified telemetry.',
    actions: 'Connect validated environmental telemetry and follow spacecraft-specific environmental response procedures.',
  },
];

export function HazardsPage() {
  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Human research program concepts" title="Five spaceflight hazards" description="Explore how mission hazards can influence health and what should be monitored. This view is educational; it does not report connected sensor data or diagnose a crew member." />
      <div className="grid gap-4 xl:grid-cols-2">
        {hazards.map(({ name, subtitle, icon: Icon, description, risks, measurements, actions }) => (
          <section key={name} className={cardClass}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200"><Icon size={20} /></div>
              <div><h3 className="text-lg font-semibold text-white">{name}</h3><p className="text-xs uppercase tracking-[0.16em] text-slate-500">{subtitle}</p></div>
              <span className="ml-auto rounded-full border border-slate-700 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-400">Not connected</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="text-xs uppercase tracking-wider text-amber-200">Potential health risks</p><p className="mt-2 text-sm leading-5 text-slate-300">{risks}</p></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="text-xs uppercase tracking-wider text-cyan-200">Measurements to connect</p><p className="mt-2 text-sm leading-5 text-slate-300">{measurements}</p></div>
            </div>
            <p className="mt-4 text-sm text-slate-300"><span className="font-medium text-white">Monitoring action: </span>{actions}</p>
          </section>
        ))}
      </div>
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-6 text-slate-300">
        NASA Human Research Program hazard categories provide a framework for understanding mission risks. This demonstration does not claim to implement NASA operational procedures or ingest NASA telemetry.
      </div>
    </div>
  );
}

export function HealthIntelligencePage({ astronauts, records }: { astronauts: Astronaut[]; records: HealthRecord[] }) {
  const [selectedId, setSelectedId] = useState(astronauts[0]?.id ?? 'all');
  const crewRecords = records.filter((record) => selectedId === 'all' || record.astronautId === selectedId);
  const latest = crewRecords[0];
  const previous = crewRecords[1];
  const changes = latest && previous ? [
    { name: 'Heart rate', value: latest.heartRate - previous.heartRate, unit: 'BPM' },
    { name: 'Systolic pressure', value: latest.bloodPressure.systolic - previous.bloodPressure.systolic, unit: 'mmHg' },
    { name: 'Oxygen saturation', value: latest.spO2 - previous.spO2, unit: 'points' },
    ...(latest.sleepHours !== undefined && previous.sleepHours !== undefined ? [{ name: 'Sleep duration', value: latest.sleepHours - previous.sleepHours, unit: 'hours' }] : []),
  ] : [];
  const mood = latest?.mood;

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Explainable health intelligence" title="Health trend review" description="Rule-based summaries of recorded data only. No predictive model or diagnosis is used. Values are unclassified until a mission-approved flight-surgeon protocol is configured." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SelectField label="Crew member" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="all">All crew</option>{astronauts.map((astronaut) => <option key={astronaut.id} value={astronaut.id}>{astronaut.name}</option>)}
        </SelectField>
        <span className="rounded-full border border-slate-600 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-300">UNCLASSIFIED · NO PROTOCOL CONFIGURED</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Records available', value: String(crewRecords.length) },
          { label: 'Last recorded source', value: latest?.source ?? 'No data' },
          { label: 'Last mood check-in', value: mood ?? 'Not recorded' },
          { label: 'Assessment status', value: 'Unclassified' },
        ].map((item) => <div className={cardClass} key={item.label}><p className="text-xs uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-3 break-words text-lg font-semibold text-white">{item.value}</p></div>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className={cardClass}>
          <h3 className="text-lg font-semibold text-white">Changes between recent records</h3>
          <p className="mt-1 text-sm text-slate-400">Descriptive differences only; small samples do not establish clinical significance.</p>
          {changes.length === 0 ? <p className="mt-5 text-sm text-slate-500">At least two recorded assessments are needed to summarize changes.</p> : <div className="mt-4 space-y-3">{changes.map((change) => <div key={change.name} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3"><span className="text-sm text-slate-300">{change.name}</span><span className="font-mono text-sm text-white">{change.value > 0 ? '+' : ''}{change.value.toFixed(1)} {change.unit}</span></div>)}</div>}
        </section>
        <section className={cardClass}>
          <h3 className="text-lg font-semibold text-white">Follow-up guidance</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <li>• Review a measurement with the flight surgeon if it is unexpected, changing, or inconsistent with the astronaut’s baseline.</li>
            <li>• Recheck device technique and units when a reading appears unusual; preserve the original entry and its timestamp.</li>
            <li>• Consider sleep, mood, mission workload, radiation, communications, gravity adaptation, and cabin environment in the mission context.</li>
            <li>• Contact the flight surgeon according to the approved mission protocol for concerning symptoms, repeated changes, or any crew request for help.</li>
          </ul>
          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-100">This tool does not diagnose, estimate medical risk, prescribe medication, or replace flight-surgeon review.</div>
        </section>
      </div>
    </div>
  );
}

const bodySystems = [
  { id: 'brain', label: 'Brain', icon: Brain, function: 'Behavioral, cognitive, and sleep-related health.', hazards: 'Isolation & confinement; distance from Earth.', indicators: 'Mood check-ins, sleep duration, and clinical assessments recorded by authorized teams.', guidance: 'Use mission behavioral-health check-ins and contact the flight surgeon or behavioral-health specialist when support is wanted.' },
  { id: 'heart', label: 'Heart', icon: Heart, function: 'Cardiovascular function and adaptation to changing gravity.', hazards: 'Gravity fields; hostile environment.', indicators: 'Heart rate and blood pressure entries; additional mission-specific measures require a connected protocol.', guidance: 'Use approved equipment and compare readings with the astronaut’s established baseline and approved protocol.' },
  { id: 'lungs', label: 'Lungs', icon: Wind, function: 'Respiratory function and oxygen delivery.', hazards: 'Hostile closed environments; gravity fields.', indicators: 'Oxygen saturation and respiratory assessments; cabin air measurements require sensor integration.', guidance: 'Escalate symptoms or unexpected measurements through the flight-surgeon pathway.' },
  { id: 'bones', label: 'Bones', icon: Layers, function: 'Skeletal structure and mechanical loading.', hazards: 'Gravity fields; space radiation.', indicators: 'Mission-defined bone-health assessments and radiation dosimetry; not connected in this demo.', guidance: 'Follow individualized crew health and exercise plans; do not infer bone density from routine vital signs.' },
  { id: 'muscles', label: 'Muscles', icon: Activity, function: 'Strength, mobility, and physical conditioning.', hazards: 'Gravity fields; isolation & confinement.', indicators: 'Exercise activity logs and mission-defined strength assessments.', guidance: 'Record activity without rewarding extra or unsafe exercise; follow the assigned plan.' },
  { id: 'immune', label: 'Immune system', icon: ShieldAlert, function: 'Host defense and physiological response.', hazards: 'Space radiation; confinement and environmental conditions.', indicators: 'Clinical assessments and approved laboratory tests; no immune test data are connected.', guidance: 'Leave interpretation and follow-up to the flight surgeon and authorized medical team.' },
];

export function HumanBodyMapPage({ records }: { records: HealthRecord[] }) {
  const [selected, setSelected] = useState(bodySystems[0]);
  const system = bodySystems.find((item) => item.id === selected.id) ?? bodySystems[0];
  const latest = records[0];
  const Icon = system.icon;
  const points = [
    { id: 'brain', x: 120, y: 35 }, { id: 'heart', x: 120, y: 91 }, { id: 'lungs', x: 95, y: 99 },
    { id: 'bones', x: 120, y: 131 }, { id: 'muscles', x: 83, y: 133 }, { id: 'immune', x: 141, y: 106 },
  ];

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Interactive system map" title="Human body systems" description="Select a region to view its function, relevant spaceflight hazards, recorded indicators, and general monitoring guidance." />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className={`${cardClass} flex flex-col items-center`}>
          <svg viewBox="0 0 240 240" role="img" aria-label="Interactive diagram of human body systems" className="max-h-[430px] w-full">
            <path d="M120 16c-16 0-25 12-25 27 0 12 5 21 13 25l-4 11-27 12c-8 4-13 12-14 21l-5 55c0 7 11 8 13 1l8-47 7 43-6 55c-1 9 13 10 15 1l10-53 6-37h18l6 37 10 53c2 9 16 8 15-1l-6-55 7-43 8 47c2 7 13 6 13-1l-5-55c-1-9-6-17-14-21l-27-12-4-11c8-4 13-13 13-25 0-15-9-27-25-27Z" fill="#17283c" stroke="#38bdf8" strokeOpacity=".65" strokeWidth="2" />
            <path d="M103 80h34M107 80v65m26-65v65m-26-33h26" stroke="#64748b" strokeWidth="2" strokeDasharray="3 4" />
            {points.map((point) => {
              const isSelected = selected.id === point.id;
              return <g key={point.id} role="button" tabIndex={0} aria-label={`Select ${bodySystems.find((item) => item.id === point.id)?.label}`} onClick={() => setSelected(bodySystems.find((item) => item.id === point.id) ?? bodySystems[0])} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(bodySystems.find((item) => item.id === point.id) ?? bodySystems[0]); }} className="cursor-pointer">
                <circle cx={point.x} cy={point.y} r={isSelected ? 10 : 7} fill={isSelected ? '#22d3ee' : '#0f172a'} stroke="#67e8f9" strokeWidth="2" />
                <circle cx={point.x} cy={point.y} r="15" fill="transparent" />
              </g>;
            })}
          </svg>
          <div className="mt-2 grid w-full grid-cols-2 gap-2">
            {bodySystems.map((item) => <button key={item.id} type="button" onClick={() => setSelected(item)} className={`rounded-lg border px-3 py-2 text-left text-xs ${selected.id === item.id ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-100' : 'border-slate-800 text-slate-300 hover:bg-slate-800'}`}>{item.label}</button>)}
          </div>
        </section>
        <section className={cardClass}>
          <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-200"><Icon size={22} /></div><div><p className="text-xs uppercase tracking-wider text-slate-500">Selected system</p><h3 className="text-xl font-semibold text-white">{system.label}</h3></div></div>
          <dl className="mt-5 space-y-4">
            <div><dt className="text-xs uppercase tracking-wider text-slate-500">Function</dt><dd className="mt-1 text-sm leading-6 text-slate-200">{system.function}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-slate-500">Relevant hazards</dt><dd className="mt-1 text-sm text-slate-200">{system.hazards}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-slate-500">Related health indicators</dt><dd className="mt-1 text-sm leading-6 text-slate-200">{system.indicators}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-slate-500">Monitoring guidance</dt><dd className="mt-1 text-sm leading-6 text-slate-200">{system.guidance}</dd></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><dt className="text-xs uppercase tracking-wider text-slate-500">Latest record context</dt><dd className="mt-1 text-sm text-slate-200">{latest ? `${latest.astronautName} · ${new Date(latest.timestamp).toLocaleString()} · ${latest.source}` : 'No health records are available.'}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}

const routineTasks = [
  'Morning health assessment',
  'Blood pressure measurement',
  'Sleep recording',
  'Hydration check',
  'Nutrition check',
  'Exercise tracking',
  'Mood assessment',
  'Evening health assessment',
];
type RoutineLog = Record<string, string[]>;
const routineStorageKey = 'orbitcare:routine:v1';

function readRoutineLog(): RoutineLog {
  try {
    const stored = localStorage.getItem(routineStorageKey);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Stored routine log has an invalid shape.');
    return parsed as RoutineLog;
  } catch (error) {
    console.error('Unable to read the saved routine log.', error);
    return {};
  }
}

export function DailyRoutinePage() {
  const [dateContext] = useState(() => {
    const now = new Date();
    const today = dateKey(now);
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - index));
      return { key: dateKey(date), day: date.toLocaleDateString(undefined, { weekday: 'short' }) };
    });
    return { today, displayDate: now.toLocaleDateString(), week };
  });
  const today = dateContext.today;
  const [log, setLog] = useState<RoutineLog>(readRoutineLog);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [notice, setNotice] = useState('');
  const checkedToday = log[today] ?? [];
  const progress = Math.round((checkedToday.length / routineTasks.length) * 100);
  const weekly = dateContext.week.map(({ day, key }) => ({ day, percent: Math.round(((log[key]?.length ?? 0) / routineTasks.length) * 100) }));

  useEffect(() => {
    if (!remindersEnabled || typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    const next = new Date();
    next.setHours(9, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const timer = window.setTimeout(() => {
      new Notification('ORBITCARE daily check-in', { body: 'Review today’s health routine using your mission-approved schedule.' });
    }, next.getTime() - now.getTime());
    return () => window.clearTimeout(timer);
  }, [remindersEnabled]);

  const toggleTask = (task: string) => {
    const currentDay = log[today] ?? [];
    const next = { ...log, [today]: currentDay.includes(task) ? currentDay.filter((item) => item !== task) : [...currentDay, task] };
    try {
      localStorage.setItem(routineStorageKey, JSON.stringify(next));
      setNotice('');
    } catch (error) {
      console.error('Unable to persist the routine log.', error);
      setNotice('Routine updates could not be saved in this browser. Export or otherwise preserve your work before leaving.');
    }
    setLog(next);
  };

  const enableReminders = async () => {
    if (!('Notification' in window)) {
      setNotice('Browser notifications are not supported here. The checklist remains available in-app.');
      return;
    }
    const permission = await Notification.requestPermission();
    setRemindersEnabled(permission === 'granted');
    setNotice(permission === 'granted' ? 'Daily reminder scheduled for 09:00 while this app remains open.' : 'Notification permission was not granted; the checklist remains available in-app.');
  };

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Crew daily routine" title="Daily health checklist" description="Track healthy monitoring habits, not performance or exercise intensity. Progress is stored locally in this browser in demo mode." />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cardClass}><p className="text-xs uppercase tracking-wider text-slate-500">Today’s progress</p><p className="mt-2 text-3xl font-semibold text-white">{progress}%</p><p className="mt-1 text-xs text-slate-400">{checkedToday.length} of {routineTasks.length} routine tasks</p></div>
        <div className={cardClass}><p className="text-xs uppercase tracking-wider text-slate-500">Mission points</p><p className="mt-2 text-3xl font-semibold text-cyan-200">{Object.values(log).reduce((sum, tasks) => sum + tasks.length, 0)}</p><p className="mt-1 text-xs text-slate-400">One point per completed check-in</p></div>
        <div className={cardClass}><p className="text-xs uppercase tracking-wider text-slate-500">Current badge</p><p className="mt-2 text-xl font-semibold text-white">{progress === 100 ? 'Routine complete' : checkedToday.length >= 4 ? 'Steady check-in' : 'Mission ready'}</p><p className="mt-1 text-xs text-slate-400">No rewards for unsafe activity</p></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <section className={cardClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-lg font-semibold text-white">Today · {dateContext.displayDate}</h3><button type="button" onClick={enableReminders} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-400/10">Enable 09:00 reminder</button></div>
          {notice && <p role="status" className="mt-3 text-sm text-cyan-200">{notice}</p>}
          <div className="mt-4 space-y-2">{routineTasks.map((task) => {
            const done = checkedToday.includes(task);
            return <button type="button" key={task} onClick={() => toggleTask(task)} aria-pressed={done} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${done ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${done ? 'border-emerald-300 bg-emerald-300 text-slate-950' : 'border-slate-600 text-transparent'}`}><Check size={14} /></span><span className={`text-sm ${done ? 'text-emerald-100' : 'text-slate-200'}`}>{task}</span></button>;
          })}</div>
        </section>
        <section className={cardClass}>
          <h3 className="text-lg font-semibold text-white">Weekly routine history</h3>
          <div className="mt-4 space-y-4">{weekly.map((day) => <div key={day.day} className="flex items-center gap-3"><span className="w-10 text-xs text-slate-400">{day.day}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${day.percent}%` }} /></div><span className="w-10 text-right text-xs text-slate-400">{day.percent}%</span></div>)}</div>
          <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-400">Reminders are browser notifications scheduled while this page is open; they are not a mission operations alert or a substitute for the approved crew schedule.</p>
        </section>
      </div>
    </div>
  );
}

const tutorials = [
  { title: 'Blood pressure', why: 'Supports cardiovascular trend review alongside clinical context.', equipment: 'Mission-approved, calibrated blood pressure device.', steps: ['Follow the approved device instructions and posture guidance.', 'Use the specified cuff and arm position; remain still during measurement.', 'Record both systolic and diastolic values, units, time, and device/source.', 'Repeat only as directed by the mission procedure.'], attention: 'A repeated unexpected reading, symptoms, or a change from baseline should be discussed through the flight-surgeon protocol.' },
  { title: 'Blood glucose', why: 'Supports review of glucose measurements when required by the care plan.', equipment: 'Approved glucose meter and compatible test supplies.', steps: ['Follow the device and sample-handling procedure.', 'Record the displayed value and unit; note timing relative to meals if requested.', 'Do not convert units unless the protocol requires it.', 'Dispose of used supplies using the mission procedure.'], attention: 'Do not interpret a single result without the approved care plan; contact the flight surgeon for concerning results or symptoms.' },
  { title: 'Body temperature', why: 'Provides a time-stamped temperature trend for clinical review.', equipment: 'Mission-approved thermometer.', steps: ['Use the device in the approved measurement mode and site.', 'Wait for the completion indicator.', 'Record the value, unit, time, and method.', 'Clean and store the device according to procedure.'], attention: 'Unexpected readings or symptoms should be reviewed under mission medical guidance.' },
  { title: 'Heart rate', why: 'Provides a pulse trend; measurement method affects interpretation.', equipment: 'Approved monitor or the procedure-specified manual method.', steps: ['Rest or follow the protocol’s activity timing.', 'Use the specified sensor placement or pulse-count duration.', 'Record beats per minute, time, and whether the value is measured or device-derived.', 'Note activity context when requested.'], attention: 'Discuss persistent changes, irregular readings, or symptoms with the flight surgeon.' },
  { title: 'Oxygen saturation', why: 'A pulse oximeter estimates peripheral oxygen saturation; accuracy has limitations.', equipment: 'Approved pulse oximeter.', steps: ['Place the sensor as instructed and minimize movement.', 'Wait for a stable signal according to device instructions.', 'Record SpO₂, pulse, time, and device/source.', 'Consider device limitations and mission context.'], attention: 'Do not rely on a reading alone. Symptoms or unexpected changes require clinical review.' },
  { title: 'Mood assessment', why: 'Self-reported check-ins help support behavioral-health conversations.', equipment: 'Private, approved check-in channel; no medical device required.', steps: ['Choose the description that best reflects how you feel now.', 'Use the mission-approved scale if one is specified.', 'Add context only if comfortable and using an authorized channel.', 'Request a confidential conversation when support is wanted.'], attention: 'If you feel unsafe or need immediate support, use the mission emergency communication process.' },
  { title: 'Sleep and hydration', why: 'Sleep and hydration records support routine health and workload discussions.', equipment: 'Mission-approved sleep log and measured fluid tracking method.', steps: ['Record sleep timing/duration using the approved log.', 'Record fluid intake using the mission’s specified units and method.', 'Avoid estimates when precise measurement is required.', 'Note relevant schedule or environmental context.'], attention: 'Discuss persistent difficulty or symptoms with the medical team; follow individualized mission guidance.' },
];

export function TutorialsPage() {
  const [open, setOpen] = useState(0);
  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Crew education" title="Measurement tutorials" description="General steps for accurate recording. Mission-specific equipment manuals and approved medical procedures always take priority." />
      <div className="space-y-3">
        {tutorials.map((tutorial, index) => <section key={tutorial.title} className={cardClass}>
          <button type="button" onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index} className="flex w-full items-center justify-between gap-3 text-left"><div><p className="text-xs uppercase tracking-wider text-cyan-300/70">Tutorial {String(index + 1).padStart(2, '0')}</p><h3 className="mt-1 text-lg font-semibold text-white">{tutorial.title}</h3></div><CircleHelp size={20} className="shrink-0 text-cyan-200" /></button>
          {open === index && <div className="mt-4 border-t border-slate-800 pt-4"><p className="text-sm text-slate-300"><strong className="text-white">Why it matters:</strong> {tutorial.why}</p><p className="mt-2 text-sm text-slate-300"><strong className="text-white">Equipment:</strong> {tutorial.equipment}</p><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">{tutorial.steps.map((step) => <li key={step}>{step}</li>)}</ol><p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm leading-6 text-amber-100"><strong>When to seek review:</strong> {tutorial.attention}</p></div>}
        </section>)}
      </div>
    </div>
  );
}

export function AdvancedAnalyticsPage({ astronauts, records }: { astronauts: Astronaut[]; records: HealthRecord[] }) {
  const [range, setRange] = useState<7 | 30>(7);
  const [astronautId, setAstronautId] = useState('all');
  const [now] = useState(() => Date.now());
  const filtered = useMemo(() => {
    const cutoff = now - range * 24 * 60 * 60 * 1000;
    return records.filter((record) => new Date(record.timestamp).getTime() >= cutoff && (astronautId === 'all' || record.astronautId === astronautId)).slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [astronautId, now, range, records]);
  const chartData = filtered.map((record) => ({
    time: new Date(record.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    heartRate: record.heartRate,
    systolic: record.bloodPressure.systolic,
    diastolic: record.bloodPressure.diastolic,
    bloodSugar: record.bloodSugar,
    temperature: record.temperature,
    sleepHours: record.sleepHours,
    spO2: record.spO2,
  }));
  const exportCsv = () => {
    const rows = [
      ['Astronaut', 'Timestamp', 'Source', 'Systolic mmHg', 'Diastolic mmHg', 'Heart rate BPM', 'Blood glucose mg/dL', 'Temperature C', 'Sleep hours', 'Mood', 'SpO2 percent', 'Hydration liters', 'Nutrition', 'Exercise minutes'],
      ...filtered.map((record) => [record.astronautName, record.timestamp, record.source, record.bloodPressure.systolic, record.bloodPressure.diastolic, record.heartRate, record.bloodSugar ?? '', record.temperature, record.sleepHours ?? '', record.mood ?? '', record.spO2, record.hydrationLiters ?? '', record.nutrition ?? '', record.exerciseMinutes ?? '']),
    ];
    const content = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orbitcare-health-${range}d.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const chartCards = [
    { title: 'Heart rate', key: 'heartRate', color: '#22d3ee', unit: 'BPM' },
    { title: 'Blood pressure', key: 'systolic', color: '#818cf8', unit: 'mmHg' },
    { title: 'Blood glucose', key: 'bloodSugar', color: '#fbbf24', unit: 'mg/dL' },
    { title: 'Body temperature', key: 'temperature', color: '#fb7185', unit: '°C' },
    { title: 'Sleep duration', key: 'sleepHours', color: '#c084fc', unit: 'hours' },
    { title: 'Oxygen saturation', key: 'spO2', color: '#34d399', unit: '%' },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Historical health analytics" title="Crew health trends" description="Charts use recorded assessment data only; all sample readings in this demonstration are simulated and labeled. A chart does not indicate a diagnosis." />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex gap-2">{([7, 30] as const).map((days) => <button key={days} type="button" onClick={() => setRange(days)} className={`rounded-lg px-4 py-2 text-sm ${range === days ? 'bg-cyan-400 font-semibold text-slate-950' : 'border border-slate-700 text-slate-300'}`}>{days}-day view</button>)}</div>
        <div className="flex flex-wrap gap-2"><SelectField label="Astronaut filter" value={astronautId} onChange={(event) => setAstronautId(event.target.value)}><option value="all">All astronauts</option>{astronauts.map((astronaut) => <option key={astronaut.id} value={astronaut.id}>{astronaut.name}</option>)}</SelectField><button type="button" onClick={exportCsv} className="self-end rounded-xl border border-cyan-400/30 px-4 py-2.5 text-sm text-cyan-200 hover:bg-cyan-400/10">Download CSV</button><button type="button" onClick={() => window.print()} className="self-end rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">Print / Save PDF</button></div>
      </div>
      <p className="text-xs text-slate-500">{filtered.length} records · {filtered.some((record) => record.source === 'SIMULATED DEMO') ? 'SIMULATED DEMO DATA INCLUDED' : 'MANUAL RECORDS ONLY'}</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {chartCards.map(({ title, key, color, unit }) => <section key={key} className={cardClass}>
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-white">{title}</h3><p className="text-xs text-slate-500">{unit}</p></div><span className="text-[10px] uppercase tracking-wider text-slate-500">Recorded values</span></div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.12} connectNulls={false} />
                {key === 'systolic' && <Line type="monotone" dataKey="diastolic" stroke="#38bdf8" strokeWidth={2} dot={false} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>)}
      </div>
      <section className={cardClass}>
        <div className="flex items-center gap-2"><Moon size={18} className="text-violet-300" /><h3 className="font-semibold text-white">Mood history</h3></div>
        <div className="mt-3 flex flex-wrap gap-2">{filtered.filter((record) => record.mood).map((record) => <div key={record.id} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"><span className="text-white">{record.mood}</span><span className="ml-2 text-xs text-slate-500">{record.astronautName} · {new Date(record.timestamp).toLocaleDateString()}</span></div>)}</div>
        {!filtered.some((record) => record.mood) && <p className="mt-2 text-sm text-slate-500">No mood check-ins are available in the selected window.</p>}
      </section>
      <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs leading-5 text-slate-400">Hazard exposure history is not plotted because no radiation dosimeter, environmental telemetry, communications-latency, or exercise-system data source is connected. Connect validated sources before operational use.</p>
    </div>
  );
}

export function EarthMissionControlPage({ astronauts, missions, records, alerts }: {
  astronauts: Astronaut[];
  missions: Mission[];
  records: HealthRecord[];
  alerts: AlertEntry[];
}) {
  const [missionFilter, setMissionFilter] = useState('all');
  const crew = astronauts.filter((astronaut) => missionFilter === 'all' || astronaut.missionId === missionFilter);
  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Ground operations" title="Earth Mission Control" description="Authorized ground personnel can review mission-scoped astronaut summaries, recorded health check-ins, and locally tracked medical review status. Demo values are not live telemetry." />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={cardClass}><p className="text-xs uppercase tracking-wider text-slate-500">Active missions</p><p className="mt-2 text-2xl font-semibold text-white">{missions.filter((mission) => mission.status === 'active').length}</p></div>
          <div className={cardClass}><p className="text-xs uppercase tracking-wider text-slate-500">Crew monitored</p><p className="mt-2 text-2xl font-semibold text-white">{crew.length}</p></div>
          <div className={cardClass}><p className="text-xs uppercase tracking-wider text-slate-500">Open review requests</p><p className="mt-2 text-2xl font-semibold text-amber-200">{alerts.filter((alert) => alert.reviewStatus === 'open').length}</p></div>
        </div>
        <SelectField label="Mission filter" value={missionFilter} onChange={(event) => setMissionFilter(event.target.value)}><option value="all">All missions</option>{missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.name}</option>)}</SelectField>
      </div>
      <section className="grid gap-4 xl:grid-cols-2">
        {crew.map((astronaut) => {
          const mission = missions.find((entry) => entry.id === astronaut.missionId);
          const latest = records.find((record) => record.astronautId === astronaut.id);
          const pendingReview = alerts.filter((alert) => alert.astronautId === astronaut.id && alert.reviewStatus !== 'reviewed');
          return <article key={astronaut.id} className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400/10 font-semibold text-cyan-200">{astronaut.avatar}</div><div><h3 className="font-semibold text-white">{astronaut.name}</h3><p className="text-xs text-slate-400">{astronaut.role}</p></div></div>
              <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-300">{astronaut.healthStatus}</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Mission</p><p className="mt-1 text-sm text-slate-200">{mission?.name ?? 'Unassigned'} · {mission?.status ?? 'unknown'}</p></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Mission location</p><p className="mt-1 text-sm text-slate-200">{mission?.location ?? 'Not available'}</p></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Latest health record</p><p className="mt-1 text-sm text-slate-200">{latest ? `${new Date(latest.timestamp).toLocaleString()} · ${latest.source}` : 'No record available'}</p></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Flight surgeon review</p><p className="mt-1 text-sm text-slate-200">{pendingReview.length ? `${pendingReview.length} request(s) awaiting review` : 'No open review request'}</p></div>
            </div>
            {latest && <p className="mt-3 text-xs text-slate-400">Latest recorded snapshot: BP {latest.bloodPressure.systolic}/{latest.bloodPressure.diastolic} mmHg · HR {latest.heartRate} BPM · SpO₂ {latest.spO2}% · Temp {latest.temperature} °C</p>}
            <div className="mt-4 flex flex-wrap gap-2"><Link to={`/astronauts/${astronaut.id}`} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs text-cyan-200">Open crew profile</Link><Link to="/alerts" className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Review queue</Link></div>
          </article>;
        })}
        {crew.length === 0 && <div className={`${cardClass} text-sm text-slate-400`}>No astronauts are assigned to the selected mission.</div>}
      </section>
      <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100">Mission status in this panel is retrieved from the configured database only in secure mode; sample crew and mission information is explicitly simulated in demo mode. Health status remains unclassified without configured protocol limits.</p>
    </div>
  );
}

