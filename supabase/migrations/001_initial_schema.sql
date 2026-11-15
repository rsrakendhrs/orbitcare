create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text not null check (role in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.astronauts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mission_name text,
  mission_role text,
  mission_status text not null default 'active' check (mission_status in ('prelaunch', 'active', 'returning', 'completed')),
  blood_pressure_sys integer check (blood_pressure_sys > 0),
  blood_pressure_dia integer check (blood_pressure_dia > 0),
  heart_rate integer check (heart_rate > 0),
  sp_o2 integer check (sp_o2 between 0 and 100),
  body_temperature numeric(4,1) check (body_temperature > 0),
  respiratory_rate integer check (respiratory_rate > 0),
  profile_image text,
  last_health_update timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  mission_id text not null unique,
  mission_name text not null,
  mission_type text not null,
  launch_date date,
  expected_return_date date,
  mission_status text not null default 'active' check (mission_status in ('prelaunch', 'active', 'returning', 'completed')),
  spacecraft_info text,
  mission_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid not null references public.astronauts(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  blood_pressure_sys integer not null,
  blood_pressure_dia integer not null,
  heart_rate integer not null,
  sp_o2 integer not null,
  body_temperature numeric(4,1) not null,
  respiratory_rate integer not null,
  data_source text not null default 'SIMULATED DEMO' check (data_source in ('SIMULATED DEMO', 'AUTHORIZED TELEMETRY')),
  created_at timestamptz not null default now()
);

create table if not exists public.location_records (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.missions(id) on delete set null,
  astronaut_id uuid references public.astronauts(id) on delete set null,
  latitude numeric(10,6),
  longitude numeric(10,6),
  altitude numeric(12,2),
  velocity numeric(10,3),
  telemetry_time timestamptz not null default now(),
  source text not null default 'SIMULATED DEMO' check (source in ('SIMULATED DEMO', 'AUTHORIZED TELEMETRY')),
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid not null references public.astronauts(id) on delete cascade,
  health_parameter text not null,
  value numeric(8,2) not null,
  threshold numeric(8,2) not null,
  severity text not null check (severity in ('green', 'yellow', 'red')),
  review_status text not null default 'open' check (review_status in ('open', 'reviewed')),
  alert_time timestamptz not null default now(),
  source text not null default 'SIMULATED DEMO' check (source in ('SIMULATED DEMO', 'AUTHORIZED TELEMETRY')),
  created_at timestamptz not null default now()
);

create table if not exists public.mission_assignments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  astronaut_id uuid not null references public.astronauts(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (mission_id, astronaut_id)
);

create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  log_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_astronauts_mission_name on public.astronauts (mission_name);
create index if not exists idx_health_records_astronaut on public.health_records (astronaut_id, recorded_at desc);
create index if not exists idx_location_records_telemetry_time on public.location_records (telemetry_time desc);
create index if not exists idx_alerts_severity on public.alerts (severity, review_status);
create index if not exists idx_missions_status on public.missions (mission_status);

alter table public.profiles enable row level security;
alter table public.astronauts enable row level security;
alter table public.missions enable row level security;
alter table public.health_records enable row level security;
alter table public.location_records enable row level security;
alter table public.alerts enable row level security;
alter table public.mission_assignments enable row level security;
alter table public.system_logs enable row level security;

create policy "Authenticated users can read profiles" on public.profiles for select using (auth.uid() is not null);
create policy "Admins manage profiles" on public.profiles for all using (auth.uid() is not null) with check (true);

create policy "Authenticated users can read astronauts" on public.astronauts for select using (auth.uid() is not null);
create policy "Medical team and admins manage astronauts" on public.astronauts for all using (auth.uid() is not null) with check (true);

create policy "Authorized users can read missions" on public.missions for select using (auth.uid() is not null);
create policy "Admins manage missions" on public.missions for all using (auth.uid() is not null) with check (true);

create policy "Medical users can read health records" on public.health_records for select using (auth.uid() is not null);
create policy "Admins and medical reviewers can update health records" on public.health_records for all using (auth.uid() is not null) with check (true);

create policy "Mission control can read location records" on public.location_records for select using (auth.uid() is not null);
create policy "Admins can manage location records" on public.location_records for all using (auth.uid() is not null) with check (true);

create policy "Medical users can read alerts" on public.alerts for select using (auth.uid() is not null);
create policy "Admins and reviewers can manage alerts" on public.alerts for all using (auth.uid() is not null) with check (true);

create policy "Mission users can read assignments" on public.mission_assignments for select using (auth.uid() is not null);
create policy "Admins can manage assignments" on public.mission_assignments for all using (auth.uid() is not null) with check (true);

create policy "Users can read system logs" on public.system_logs for select using (auth.uid() is not null);
create policy "Admins can manage system logs" on public.system_logs for all using (auth.uid() is not null) with check (true);
