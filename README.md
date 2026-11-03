# Environmental Intelligence & Citizen Incident Verification Platform - Backend

This backend implements the end-to-end specifications outlined in **`content.md`** for the **INFOMATRIX Hackathon Problem Statement (`Hackops2_PS.PDF`)**: *Environmental Intelligence & Compliance Management System*.

It connects citizen environmental observations, automated evidence research (official municipal/CPCB notices, news, and datasets), regulatory compliance evaluation against legally reviewed standards (CPCB NAAQS, IS 10500:2012 Drinking Water, CPCB Noise Rules, and Surface Water quality criteria), and incident tracking with persistent timelines.

---

## 🏛️ System Architecture

```text
Next.js / MapLibre Frontend
           │ (Public Anon Key or API Calls)
           ▼
REST & Edge Functions API Server (Port 5000 / Supabase Functions v1)
   ├── 1. Citizen Reporting & Geo-Clustering Engine (PostGIS / Haversine)
   ├── 2. Smart Clarification Question Generator
   ├── 3. External Evidence Research & Deduplication Service
   ├── 4. xAI Grok Evidence Synthesis (Bounded prompt & Schema Validation)
   ├── 5. Regulatory Compliance & Environmental Risk Assessor
   ├── 6. GeoJSON MapLibre Service (`/map-data`)
   └── 7. Scheduled Incident Monitoring Worker (`/monitor-incidents`)
           │
           ▼
PostgreSQL / Supabase Database + PostGIS Spatial Storage
   ├── profiles, reports, incidents, evidence, measurements,
   └── standards, incident_timeline, subscriptions, attachments
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20+ (tested and verified on Node v24.13.0)
- **Dependencies**: Express, Zod, Cors, Dotenv

### 2. Setup & Installation
```bash
cd enviro-ment
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key variables:
- `PORT=5000`
- `XAI_API_KEY`: *(Optional)* Your xAI Grok API key. If omitted, the server uses an intelligent deterministic compliance engine that guarantees 100% schema compliance for demos.
- `SEARCH_API_KEY`: *(Optional)* Tavily / Serper API key for real-time web research. If omitted, authoritative curated government notices and datasets are seamlessly used.

### 4. Run Automated API Tests
Verifies all 15 API contracts and edge scenarios:
```bash
npm test
```
*(All 15 tests pass out-of-the-box).*

### 5. Launch the Backend Server
```bash
npm start
# or with hot reload:
npm run dev
```

Server endpoints are active simultaneously at:
- Root paths: `http://localhost:5000/<route>`
- API paths: `http://localhost:5000/api/<route>`
- Supabase Edge Function paths: `http://localhost:5000/functions/v1/<route>`

---

## 📡 API Endpoint Contracts (Section 7 Compliant)

All responses follow the standard JSON envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "request_id": "uuid"
}
```

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/create-report` | Submits citizen complaint, deduplicates/clusters by 5km radius, links or creates incident, logs timeline event. |
| `POST` | `/clarify-report` | Returns contextual follow-up questions (single/multi-select) to refine complaint details. |
| `POST` | `/analyze-report` | Synthesizes evidence bundle through xAI Grok / rule validator, updates confidence, severity, and escalation. |
| `POST` | `/search-evidence` | Searches official government notices, monitoring datasets, and news with deduplication. |
| `GET` | `/incidents` | Lists active incidents with filters (`category`, `status`, `severity`, `latitude`, `longitude`, `radius_km`). |
| `GET` | `/incident-detail?id=<uuid>` | Returns full incident record, evidence bundle, sensor readings, reviewed standards, and chronological timeline. |
| `GET` | `/map-data` | Returns GeoJSON `FeatureCollection` for direct rendering in MapLibre GL JS (`[longitude, latitude]`). |
| `GET` | `/environmental-data` | Station monitoring readings (PM2.5, PM10, Turbidity, pH, etc.). |
| `POST` | `/assess-risk` | Evaluates measurement against reviewed standard (checks units, comparator, and instantaneous vs averaging period). |
| `GET` | `/incident-timeline?incident_id=<uuid>` | Chronological audit trail of all incident milestones. |
| `POST` | `/subscribe-alerts` | Registers alerts for an incident or geographic radius. |
| `PATCH` | `/incidents?id=<uuid>` | Moderator status update (investigating, verified, monitoring, resolved, closed). |
| `POST` | `/incidents/claim-resolution` | Records citizen resolution claim; enters **monitoring** rather than claiming immediate resolution. |
| `POST` | `/monitor-incidents` | Scheduled worker checking for new evidence across active incidents. |

---

## 🗄️ Database & Migrations

- [`001_initial_schema.sql`](file:///C:/Users/patel/Documents/proj-env/enviro-ment/supabase/migrations/001_initial_schema.sql):
  - PostGIS geography points and GiST spatial indexes.
  - Core tables: `profiles`, `reports`, `incidents`, `evidence`, `measurements`, `standards`, `incident_timeline`, `subscriptions`, `attachments`.
  - Curated Indian regulatory thresholds:
    - **Air**: CPCB NAAQS 2009 (PM2.5 24h 60 µg/m³, PM10 24h 100 µg/m³, NO2 80 µg/m³, SO2 80 µg/m³, CO 2 mg/m³).
    - **Drinking Water**: BIS IS 10500:2012 (pH 6.5-8.5, Turbidity 1 NTU, TDS 500 mg/L, Total Coliform 0).
    - **Noise**: CPCB Noise Pollution Rules 2000 (Residential Day 55 dB, Night 45 dB).
    - **Surface Water**: CPCB Class C (DO > 4 mg/L, BOD < 3 mg/L).
- [`002_rls_policies.sql`](file:///C:/Users/patel/Documents/proj-env/enviro-ment/supabase/migrations/002_rls_policies.sql):
  - Row Level Security (RLS) policies for Citizen, Moderator, and Service Role.
  - Storage bucket definition for private attachments.
