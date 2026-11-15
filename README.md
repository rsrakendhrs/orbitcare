# ORBITCARE

ORBITCARE is a spaceflight health-monitoring interface prototype for astronaut self-assessment and ground mission-control review. It separates demonstration/manual entries from authenticated records, presents health status as **unclassified** when mission protocol thresholds are absent, and does not diagnose or prescribe.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The default `VITE_DEMO_MODE=true` runs without external credentials. Demo crew, measurements, mission coordinates, and charts are simulated examples, not real astronaut records, medical sensor readings, or live spacecraft tracking. The demo stores its working data in this browser.

## Screens

- Overview and Earth Mission Control crew summaries
- Astronaut roster and profiles
- Health snapshot and validated manual health assessment
- Five NASA Human Research Program-inspired hazard explainers
- Explainable health trend review, with no diagnosis or automatic medical thresholds
- Simulated 3D Earth / spacecraft view
- Interactive human body-system map
- Daily routine checklist and in-app/browser reminder
- 7-/30-day record analytics, CSV export, and print-to-PDF
- Medical review request queue and local escalation/acknowledgement state
- Measurement tutorials and configurable local protocol thresholds

## Supabase setup (optional)

1. Create a Supabase project and apply `supabase/migrations/001_initial_schema.sql`, then `supabase/migrations/002_health_workflows.sql`.
2. Optionally run `supabase/seed.sql` for the supplied demonstration roster. Those entries remain sample data.
3. Create users through Supabase Auth. Provision each `public.profiles.id` with the matching Auth user UUID and a role: `ADMIN`, `MEDICAL TEAM`, `MISSION CONTROL`, or `ASTRONAUT`. For an astronaut account, also set `profiles.astronaut_id` to that person's `astronauts.id`; this scopes their records and assigned missions through row-level security. Provisioning must be performed by an authorized administrator; a user without a role receives no application data access.
4. Put the project URL and **anon/public** key in `.env`. Never put a Supabase service-role key in the browser or this repository.
5. Set `VITE_DEMO_MODE=false` to require Supabase email/password sign-in. The app reads mission, astronaut, health-record, and alert rows subject to RLS. Manual health entries and review requests are upserted by UUID; a failed/offline sync remains queued locally and can be retried after reconnecting.

The migration replaces broad authenticated-user policies with role-based policies. Mission Control, Medical Team, and Admin can read authorized crew health summaries; astronauts can read their own records and submit manual entries; medical reviewers/Admin can manage health records; configured ground roles can file and update review requests. Review the policies against your organization’s medical privacy, retention, and operational requirements before deployment.

## Data sources and limitations

- No NASA API, dosimeter, spacecraft environmental sensor, communications-latency service, or live trajectory feed is configured. The Earth globe and coordinates are explicitly simulated. The hazard section explains measurements and risks but reports no live exposure measurements.
- The health-intelligence view uses descriptive comparisons only. No predictive AI model or diagnosis is implemented. No threshold values are preloaded. A user-supplied protocol label/reviewer is not verified by the app and must not be treated as approval.
- Alert priority is selected by the person filing a review request; this prototype does not infer a clinical severity. Escalation is recorded in the application and does not send push/SMS or emergency notifications. Use the mission emergency communication procedure for urgent events.
- PDF output uses the browser print dialog; CSV exports are available separately.
- Offline queues and demo state use browser storage. Browser storage is not encrypted clinical storage, can be removed by the user/browser, and is not suitable for operational protected health information without an approved secure-device, encryption, backup, access-control, and retention design.
- Supabase role checks and RLS are application safeguards, not a medical-device certification or a substitute for deployment security review. Profile/mission/alert administrative workflows and flight-surgeon notification integrations must be configured for operational use.
- Routine history is browser-local. NASA/spaceflight health guidance is educational, not a mission procedure; approved flight-surgeon and spacecraft instructions take precedence.

## Validation

```powershell
npm run build
npm run lint
```
