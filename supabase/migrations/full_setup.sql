-- ====================================================================
-- Environmental Intelligence Platform: Full Schema, PostGIS & RLS
-- Run this script in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/_/sql
-- 2. Click "New Query"
-- 3. Paste this entire file and click "Run"
-- ====================================================================

-- 1. Enable PostGIS & UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Profiles Table (Citizen / Official / Moderator profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    preferred_language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Incidents Table (Issue clusters aggregated from citizen reports)
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('investigating', 'verified', 'monitoring', 'resolved', 'reopened', 'closed')),
    severity TEXT NOT NULL CHECK (severity IN ('unknown', 'low', 'moderate', 'high', 'critical')),
    evidence_confidence TEXT NOT NULL CHECK (evidence_confidence IN ('low', 'medium', 'high')),
    escalation TEXT NOT NULL CHECK (escalation IN ('decreasing', 'stable', 'increasing', 'unknown')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326),
    location_name TEXT NOT NULL,
    first_reported_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE OR REPLACE FUNCTION public.set_incident_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_incident_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.set_incident_location();

-- 4. Reports Table (Individual citizen submissions)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    location_name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'processing', 'reviewed', 'linked', 'rejected')),
    incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE OR REPLACE FUNCTION public.set_report_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_report_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_report_location();

-- 5. Evidence Table (Multi-source validated supporting materials)
CREATE TABLE IF NOT EXISTS public.evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('government', 'monitoring', 'news', 'citizen', 'research')),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    stance TEXT NOT NULL CHECK (stance IN ('supports', 'contradicts', 'contextual', 'unknown')),
    reliability TEXT NOT NULL CHECK (reliability IN ('high', 'medium', 'low', 'unassessed')),
    content_hash TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 6. Measurements Table (Environmental station readings)
CREATE TABLE IF NOT EXISTS public.measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    station_name TEXT NOT NULL,
    parameter TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    quality_flag TEXT NOT NULL DEFAULT 'valid' CHECK (quality_flag IN ('valid', 'suspect', 'invalid', 'unknown'))
);

-- 7. Standards Table (Curated legally authoritative thresholds)
CREATE TABLE IF NOT EXISTS public.standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority TEXT NOT NULL,
    standard_name TEXT NOT NULL,
    parameter TEXT NOT NULL,
    medium TEXT NOT NULL CHECK (medium IN ('ambient_air', 'drinking_water', 'surface_water', 'noise', 'emissions')),
    unit TEXT NOT NULL,
    limit_value DOUBLE PRECISION,
    comparator TEXT NOT NULL CHECK (comparator IN ('gt', 'gte', 'lt', 'lte', 'range', 'categorical')),
    averaging_period TEXT NOT NULL,
    applicable_context TEXT NOT NULL,
    source_url TEXT NOT NULL,
    effective_from DATE,
    effective_to DATE,
    reviewed_by TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- 8. Incident Timeline Table (Audit trail of events)
CREATE TABLE IF NOT EXISTS public.incident_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('report_received', 'evidence_added', 'status_changed', 'notice_found', 'risk_changed', 'resolution_claimed')),
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Subscriptions Table (Citizen notifications)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
    category TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius_km DOUBLE PRECISION,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Attachments Table (Report photos & documents)
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Indexes for Fast Spatial & Category Queries
CREATE INDEX IF NOT EXISTS idx_reports_category_created ON public.reports(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_incident ON public.reports(incident_id);
CREATE INDEX IF NOT EXISTS idx_reports_location ON public.reports USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_incidents_status_cat_updated ON public.incidents(status, category, last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_location ON public.incidents USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_evidence_incident_retrieved ON public.evidence(incident_id, retrieved_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_content_hash ON public.evidence(content_hash) WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_measurements_param_time ON public.measurements(parameter, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_standards_param_medium ON public.standards(parameter, medium, is_active);
CREATE INDEX IF NOT EXISTS idx_timeline_incident_created ON public.incident_timeline(incident_id, created_at ASC);

-- 12. Spatial Proximity Function
CREATE OR REPLACE FUNCTION public.find_nearby_incidents(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_radius_meters DOUBLE PRECISION,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category TEXT,
    status TEXT,
    severity TEXT,
    distance_meters DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.title,
        i.category,
        i.status,
        i.severity,
        ST_Distance(i.location, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography) AS distance_meters
    FROM public.incidents i
    WHERE
        ST_DWithin(i.location, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_radius_meters)
        AND (p_category IS NULL OR i.category = p_category)
        AND i.status NOT IN ('closed')
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- 13. Curated Indian Regulatory Standards Seed Data
INSERT INTO public.standards (authority, standard_name, parameter, medium, unit, limit_value, comparator, averaging_period, applicable_context, source_url, is_active)
VALUES
    ('CPCB (Central Pollution Control Board)', 'NAAQS 2009', 'PM2.5', 'ambient_air', 'µg/m³', 60.0, 'lte', '24-hour', 'Residential, Rural and other Areas', 'https://cpcb.nic.in/air-pollution/', true),
    ('CPCB (Central Pollution Control Board)', 'NAAQS 2009', 'PM2.5', 'ambient_air', 'µg/m³', 40.0, 'lte', 'Annual', 'Residential, Rural and other Areas', 'https://cpcb.nic.in/air-pollution/', true),
    ('CPCB (Central Pollution Control Board)', 'NAAQS 2009', 'PM10', 'ambient_air', 'µg/m³', 100.0, 'lte', '24-hour', 'Residential, Rural and other Areas', 'https://cpcb.nic.in/air-pollution/', true),
    ('CPCB (Central Pollution Control Board)', 'NAAQS 2009', 'PM10', 'ambient_air', 'µg/m³', 60.0, 'lte', 'Annual', 'Residential, Rural and other Areas', 'https://cpcb.nic.in/air-pollution/', true),
    ('CPCB (Central Pollution Control Board)', 'NAAQS 2009', 'NO2', 'ambient_air', 'µg/m³', 80.0, 'lte', '24-hour', 'Residential and other Areas', 'https://cpcb.nic.in/air-pollution/', true),
    ('CPCB (Central Pollution Control Board)', 'NAAQS 2009', 'SO2', 'ambient_air', 'µg/m³', 80.0, 'lte', '24-hour', 'Residential and other Areas', 'https://cpcb.nic.in/air-pollution/', true),
    ('CPCB (Central Pollution Control Board)', 'NAAQS 2009', 'CO', 'ambient_air', 'mg/m³', 2.0, 'lte', '8-hour', 'General Population Protection', 'https://cpcb.nic.in/air-pollution/', true),
    ('BIS (Bureau of Indian Standards)', 'IS 10500:2012', 'pH', 'drinking_water', 'pH', 8.5, 'range', 'Instantaneous', 'Drinking water acceptable range: 6.5 to 8.5', 'https://law.resource.org/pub/in/bis/S02/is.10500.2012.pdf', true),
    ('BIS (Bureau of Indian Standards)', 'IS 10500:2012', 'Turbidity', 'drinking_water', 'NTU', 1.0, 'lte', 'Instantaneous', 'Potable water maximum permissible limit', 'https://law.resource.org/pub/in/bis/S02/is.10500.2012.pdf', true),
    ('BIS (Bureau of Indian Standards)', 'IS 10500:2012', 'TDS', 'drinking_water', 'mg/L', 500.0, 'lte', 'Instantaneous', 'Total Dissolved Solids potable limit', 'https://law.resource.org/pub/in/bis/S02/is.10500.2012.pdf', true),
    ('BIS (Bureau of Indian Standards)', 'IS 10500:2012', 'Total Coliform', 'drinking_water', 'MPN/100ml', 0.0, 'lte', 'Instantaneous', 'Shall not be detectable in any 100 ml sample', 'https://law.resource.org/pub/in/bis/S02/is.10500.2012.pdf', true),
    ('CPCB (Noise Rules 2000)', 'Noise Standards', 'Leq', 'noise', 'dB(A)', 55.0, 'lte', 'Day (06:00-22:00)', 'Residential Area Daytime Limit', 'https://cpcb.nic.in/noise-pollution/', true),
    ('CPCB (Noise Rules 2000)', 'Noise Standards', 'Leq', 'noise', 'dB(A)', 45.0, 'lte', 'Night (22:00-06:00)', 'Residential Area Nighttime Limit', 'https://cpcb.nic.in/noise-pollution/', true),
    ('CPCB (Water Quality)', 'Designated Best Use Class C', 'Dissolved Oxygen (DO)', 'surface_water', 'mg/L', 4.0, 'gte', 'Instantaneous', 'Drinking water source after conventional treatment', 'https://cpcb.nic.in/water-pollution/', true),
    ('CPCB (Water Quality)', 'Designated Best Use Class C', 'BOD', 'surface_water', 'mg/L', 3.0, 'lte', '3-day 27°C', 'Drinking water source after conventional treatment', 'https://cpcb.nic.in/water-pollution/', true)
ON CONFLICT DO NOTHING;

-- 14. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- 15. RLS Policies
CREATE POLICY "Public can view incidents" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Public can view evidence" ON public.evidence FOR SELECT USING (true);
CREATE POLICY "Public can view measurements" ON public.measurements FOR SELECT USING (quality_flag != 'invalid');
CREATE POLICY "Public can view active standards" ON public.standards FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view incident timeline" ON public.incident_timeline FOR SELECT USING (true);

CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view reports" ON public.reports FOR SELECT USING (true);
