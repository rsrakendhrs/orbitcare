alter table public.health_records
  add column if not exists blood_sugar numeric(7,2) check (blood_sugar > 0),
  add column if not exists sleep_hours numeric(4,2) check (sleep_hours between 0 and 24),
  add column if not exists mood text,
  add column if not exists hydration_liters numeric(5,2) check (hydration_liters between 0 and 10),
  add column if not exists nutrition text,
  add column if not exists exercise_minutes integer check (exercise_minutes between 0 and 600);

alter table public.health_records drop constraint if exists health_records_data_source_check;
alter table public.health_records
  add constraint health_records_data_source_check
  check (data_source in ('SIMULATED DEMO', 'AUTHORIZED TELEMETRY', 'MANUAL ENTRY'));

alter table public.alerts
  alter column value drop not null,
  alter column threshold drop not null,
  add column if not exists description text;
alter table public.alerts drop constraint if exists alerts_review_status_check;
alter table public.alerts
  add constraint alerts_review_status_check
  check (review_status in ('open', 'reviewed', 'escalated'));
alter table public.alerts drop constraint if exists alerts_source_check;
alter table public.alerts
  add constraint alerts_source_check
  check (source in ('SIMULATED DEMO', 'AUTHORIZED TELEMETRY', 'MANUAL ENTRY'));

create table if not exists public.hazard_exposures (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid not null references public.astronauts(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  hazard_type text not null check (hazard_type in ('radiation', 'isolation', 'distance', 'gravity', 'environment')),
  measured_at timestamptz not null default now(),
  measurement_name text not null,
  measurement_value numeric(12,4),
  unit text,
  source text not null check (source in ('MANUAL ENTRY', 'SIMULATED DEMO', 'AUTHORIZED TELEMETRY')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_health_tasks (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid not null references public.astronauts(id) on delete cascade,
  task_key text not null,
  task_date date not null default current_date,
  completed_at timestamptz,
  source text not null default 'MANUAL ENTRY' check (source in ('MANUAL ENTRY', 'SIMULATED DEMO')),
  unique (astronaut_id, task_key, task_date)
);

create table if not exists public.health_reports (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid not null references public.astronauts(id) on delete cascade,
  generated_by uuid not null references public.profiles(id),
  range_start timestamptz not null,
  range_end timestamptz not null,
  report_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (range_end >= range_start)
);

create index if not exists idx_hazard_exposures_astronaut_time
  on public.hazard_exposures (astronaut_id, measured_at desc);
create index if not exists idx_daily_health_tasks_astronaut_date
  on public.daily_health_tasks (astronaut_id, task_date desc);
create index if not exists idx_health_reports_astronaut_time
  on public.health_reports (astronaut_id, created_at desc);

alter table public.hazard_exposures enable row level security;
alter table public.daily_health_tasks enable row level security;
alter table public.health_reports enable row level security;

create or replace function public.current_orbitcare_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() limit 1
$$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL', 'ASTRONAUT'));
alter table public.profiles
  add column if not exists astronaut_id uuid references public.astronauts(id) on delete set null;
alter table public.profiles drop constraint if exists profiles_astronaut_role_check;
alter table public.profiles
  add constraint profiles_astronaut_role_check
  check (role <> 'ASTRONAUT' or astronaut_id is not null);

create or replace function public.current_orbitcare_astronaut_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select astronaut_id from public.profiles where id = auth.uid() limit 1
$$;

create or replace function public.current_orbitcare_mission_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(mission_id), array[]::uuid[])
  from public.mission_assignments
  where astronaut_id = public.current_orbitcare_astronaut_id()
$$;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "Authenticated users can read astronauts" on public.astronauts;
drop policy if exists "Medical team and admins manage astronauts" on public.astronauts;
drop policy if exists "Authorized users can read missions" on public.missions;
drop policy if exists "Admins manage missions" on public.missions;
drop policy if exists "Medical users can read health records" on public.health_records;
drop policy if exists "Admins and medical reviewers can update health records" on public.health_records;
drop policy if exists "Mission control can read location records" on public.location_records;
drop policy if exists "Admins can manage location records" on public.location_records;
drop policy if exists "Medical users can read alerts" on public.alerts;
drop policy if exists "Admins and reviewers can manage alerts" on public.alerts;
drop policy if exists "Mission users can read assignments" on public.mission_assignments;
drop policy if exists "Admins can manage assignments" on public.mission_assignments;
drop policy if exists "Users can read system logs" on public.system_logs;
drop policy if exists "Admins can manage system logs" on public.system_logs;

create policy "Users read authorized profiles" on public.profiles
  for select using (id = auth.uid() or public.current_orbitcare_role() = 'ADMIN');
create policy "Admins manage profiles" on public.profiles
  for all using (public.current_orbitcare_role() = 'ADMIN')
  with check (public.current_orbitcare_role() = 'ADMIN');

create policy "Authorized ground staff read astronauts" on public.astronauts
  for select using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or id = public.current_orbitcare_astronaut_id()
  );
create policy "Medical staff manage astronauts" on public.astronauts
  for all using (public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM'))
  with check (public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM'));

create policy "Authorized ground staff read missions" on public.missions
  for select using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or id = any(public.current_orbitcare_mission_ids())
  );
create policy "Admins manage missions" on public.missions
  for all using (public.current_orbitcare_role() = 'ADMIN')
  with check (public.current_orbitcare_role() = 'ADMIN');

create policy "Authorized ground staff read health records" on public.health_records
  for select using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or astronaut_id = public.current_orbitcare_astronaut_id()
  );
create policy "Medical staff create health records" on public.health_records
  for insert with check (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM')
    or (
      public.current_orbitcare_role() = 'ASTRONAUT'
      and astronaut_id = public.current_orbitcare_astronaut_id()
      and data_source = 'MANUAL ENTRY'
    )
  );
create policy "Medical staff update health records" on public.health_records
  for update using (public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM'))
  with check (public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM'));

create policy "Authorized ground staff read locations" on public.location_records
  for select using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or astronaut_id = public.current_orbitcare_astronaut_id()
  );
create policy "Admins manage locations" on public.location_records
  for all using (public.current_orbitcare_role() = 'ADMIN')
  with check (public.current_orbitcare_role() = 'ADMIN');

create policy "Authorized ground staff read alerts" on public.alerts
  for select using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or astronaut_id = public.current_orbitcare_astronaut_id()
  );
create policy "Ground staff file alerts" on public.alerts
  for insert with check (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or (
      public.current_orbitcare_role() = 'ASTRONAUT'
      and astronaut_id = public.current_orbitcare_astronaut_id()
      and source = 'MANUAL ENTRY'
    )
  );
create policy "Ground staff update alerts" on public.alerts
  for update using (public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL'))
  with check (public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL'));

create policy "Authorized ground staff read assignments" on public.mission_assignments
  for select using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or astronaut_id = public.current_orbitcare_astronaut_id()
  );
create policy "Admins manage assignments" on public.mission_assignments
  for all using (public.current_orbitcare_role() = 'ADMIN')
  with check (public.current_orbitcare_role() = 'ADMIN');

create policy "Admins read logs" on public.system_logs
  for select using (public.current_orbitcare_role() = 'ADMIN');
create policy "Admins manage logs" on public.system_logs
  for all using (public.current_orbitcare_role() = 'ADMIN')
  with check (public.current_orbitcare_role() = 'ADMIN');

create policy "Authorized staff read hazard exposures" on public.hazard_exposures
  for select using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or astronaut_id = public.current_orbitcare_astronaut_id()
  );
create policy "Medical staff manage hazard exposures" on public.hazard_exposures
  for all using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM')
    or (
      public.current_orbitcare_role() = 'ASTRONAUT'
      and astronaut_id = public.current_orbitcare_astronaut_id()
    )
  )
  with check (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM')
    or (
      public.current_orbitcare_role() = 'ASTRONAUT'
      and astronaut_id = public.current_orbitcare_astronaut_id()
      and source = 'MANUAL ENTRY'
    )
  );

create policy "Authorized staff read daily tasks" on public.daily_health_tasks
  for select using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or astronaut_id = public.current_orbitcare_astronaut_id()
  );
create policy "Authorized staff manage daily tasks" on public.daily_health_tasks
  for all using (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or (
      public.current_orbitcare_role() = 'ASTRONAUT'
      and astronaut_id = public.current_orbitcare_astronaut_id()
    )
  )
  with check (
    public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL')
    or (
      public.current_orbitcare_role() = 'ASTRONAUT'
      and astronaut_id = public.current_orbitcare_astronaut_id()
      and source = 'MANUAL ENTRY'
    )
  );

create policy "Authorized staff read health reports" on public.health_reports
  for select using (public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM', 'MISSION CONTROL'));
create policy "Medical staff create health reports" on public.health_reports
  for insert with check (public.current_orbitcare_role() in ('ADMIN', 'MEDICAL TEAM'));
