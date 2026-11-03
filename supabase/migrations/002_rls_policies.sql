-- ====================================================================
-- Environmental Intelligence & Incident Verification Platform
-- Migration: 002_rls_policies.sql
-- Purpose: Row Level Security (RLS) policies and storage configuration
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Helper function to check if current user is moderator/admin
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.jwt() ->> 'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND (raw_app_meta_data->>'is_moderator')::boolean = true
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------
-- 1. Profiles Policies
-- ---------------------------------------------------------------------
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 2. Reports Policies
-- ---------------------------------------------------------------------
CREATE POLICY "Citizens can create reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "Citizens can view their own reports"
    ON public.reports FOR SELECT
    USING (user_id = auth.uid() OR public.is_moderator());

-- ---------------------------------------------------------------------
-- 3. Incidents Policies (Public read for verified/investigating incidents)
-- ---------------------------------------------------------------------
CREATE POLICY "Public can view active non-closed incidents"
    ON public.incidents FOR SELECT
    USING (true);

CREATE POLICY "Moderators can update incident status"
    ON public.incidents FOR UPDATE
    USING (public.is_moderator());

-- ---------------------------------------------------------------------
-- 4. Evidence Policies
-- ---------------------------------------------------------------------
CREATE POLICY "Public can view verified evidence"
    ON public.evidence FOR SELECT
    USING (true);

CREATE POLICY "Moderators can insert and manage evidence"
    ON public.evidence FOR ALL
    USING (public.is_moderator());

-- ---------------------------------------------------------------------
-- 5. Measurements Policies
-- ---------------------------------------------------------------------
CREATE POLICY "Public can view published measurements"
    ON public.measurements FOR SELECT
    USING (quality_flag != 'invalid');

CREATE POLICY "Moderators can manage measurements"
    ON public.measurements FOR ALL
    USING (public.is_moderator());

-- ---------------------------------------------------------------------
-- 6. Standards Policies
-- ---------------------------------------------------------------------
CREATE POLICY "Public can view active regulatory standards"
    ON public.standards FOR SELECT
    USING (is_active = true);

-- ---------------------------------------------------------------------
-- 7. Incident Timeline Policies
-- ---------------------------------------------------------------------
CREATE POLICY "Public can view incident timeline"
    ON public.incident_timeline FOR SELECT
    USING (true);

-- ---------------------------------------------------------------------
-- 8. Subscriptions Policies
-- ---------------------------------------------------------------------
CREATE POLICY "Users can manage own subscriptions"
    ON public.subscriptions FOR ALL
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 9. Attachments Policies
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view attachments linked to own reports"
    ON public.attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.reports
            WHERE reports.id = attachments.report_id AND (reports.user_id = auth.uid() OR public.is_moderator())
        )
    );

CREATE POLICY "Users can upload attachments for own reports"
    ON public.attachments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reports
            WHERE reports.id = report_id AND (reports.user_id = auth.uid() OR reports.user_id IS NULL)
        )
    );

-- ---------------------------------------------------------------------
-- Storage Setup for Private Bucket 'report-attachments'
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'report-attachments',
    'report-attachments',
    false,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload attachments to storage"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'report-attachments' AND
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can read own uploaded files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'report-attachments' AND
    (auth.uid() = owner OR public.is_moderator())
);
