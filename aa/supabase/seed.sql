insert into public.missions (mission_id, mission_name, mission_type, launch_date, expected_return_date, mission_status, spacecraft_info, mission_location)
values
  ('AUR-204', 'Aurora Orbit', 'Orbital Research', '2026-03-12', '2026-12-20', 'active', 'Astra-9', 'Low Earth Orbit'),
  ('EUR-117', 'Europa Survey', 'Deep Space Survey', '2025-11-03', '2027-02-14', 'active', 'Vega-5', 'Lunar Transfer Corridor');

insert into public.astronauts (
  full_name,
  mission_name,
  mission_role,
  mission_status,
  blood_pressure_sys,
  blood_pressure_dia,
  heart_rate,
  sp_o2,
  body_temperature,
  respiratory_rate,
  profile_image,
  last_health_update
)
values
  ('Luna Hart', 'Aurora Orbit', 'Mission Specialist', 'active', 118, 76, 68, 98, 36.9, 16, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', now()),
  ('Ilya Petrov', 'Aurora Orbit', 'Flight Engineer', 'active', 122, 82, 74, 96, 37.1, 18, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', now()),
  ('Sofia Alvarez', 'Aurora Orbit', 'Systems Officer', 'active', 114, 72, 62, 99, 36.6, 14, 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f', now()),
  ('Amir Rahman', 'Europa Survey', 'Payload Specialist', 'active', 126, 84, 80, 95, 37.3, 21, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d', now());

insert into public.health_records (astronaut_id, recorded_at, blood_pressure_sys, blood_pressure_dia, heart_rate, sp_o2, body_temperature, respiratory_rate, data_source)
select id, now(), 118, 76, 68, 98, 36.9, 16, 'SIMULATED DEMO' from public.astronauts where full_name = 'Luna Hart'
union all
select id, now(), 122, 82, 74, 96, 37.1, 18, 'SIMULATED DEMO' from public.astronauts where full_name = 'Ilya Petrov'
union all
select id, now(), 114, 72, 62, 99, 36.6, 14, 'SIMULATED DEMO' from public.astronauts where full_name = 'Sofia Alvarez'
union all
select id, now(), 126, 84, 80, 95, 37.3, 21, 'SIMULATED DEMO' from public.astronauts where full_name = 'Amir Rahman';

insert into public.location_records (mission_id, astronaut_id, latitude, longitude, altitude, velocity, telemetry_time, source)
select m.id, a.id, 17.3, -89.2, 385000, 7.8, now(), 'SIMULATED DEMO'
from public.missions m
join public.astronauts a on a.mission_name = m.mission_name and a.full_name = 'Luna Hart'
where m.mission_name = 'Aurora Orbit'
union all
select m.id, a.id, 20.7, -91.4, 383000, 7.92, now(), 'SIMULATED DEMO'
from public.missions m
join public.astronauts a on a.mission_name = m.mission_name and a.full_name = 'Ilya Petrov'
where m.mission_name = 'Aurora Orbit'
union all
select m.id, a.id, 31.24, -115.11, 420000, 8.4, now(), 'SIMULATED DEMO'
from public.missions m
join public.astronauts a on a.mission_name = m.mission_name and a.full_name = 'Amir Rahman'
where m.mission_name = 'Europa Survey';

insert into public.alerts (astronaut_id, health_parameter, value, threshold, severity, review_status, alert_time, source)
select id, 'SpO2', 94, 92, 'yellow', 'open', now(), 'SIMULATED DEMO' from public.astronauts where full_name = 'Ilya Petrov'
union all
select id, 'Respiratory Rate', 23, 22, 'yellow', 'open', now(), 'SIMULATED DEMO' from public.astronauts where full_name = 'Amir Rahman';

insert into public.system_logs (log_type, message)
values
  ('telemetry', 'Telemetry relay synchronized with mission control.'),
  ('alert', 'Warning threshold checked for human metrics review queue.');
