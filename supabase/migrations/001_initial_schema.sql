-- ====================================================================
-- VitalTrace Migration 001: Initial Relational Schema
-- Healthcare Data Quality Analytics & Personal Health Record Engine
-- ====================================================================

-- 1. Helper Function: Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Table: profiles
-- Tied 1:1 with Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'User',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS set_profiles_timestamp ON public.profiles;
CREATE TRIGGER set_profiles_timestamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- Function to automatically handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, display_name)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users for profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any users created prior to this migration
INSERT INTO public.profiles (id, user_id, display_name)
SELECT 
  id, 
  id, 
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1), 'User')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. Table: documents
-- Stores metadata for uploaded lab report files
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  checksum TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL DEFAULT 'lab_report',
  document_date DATE,
  processing_status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (processing_status IN ('uploaded', 'processing', 'review_required', 'completed', 'failed')),
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_profile_id ON public.documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_document_date ON public.documents(document_date);

DROP TRIGGER IF EXISTS set_documents_timestamp ON public.documents;
CREATE TRIGGER set_documents_timestamp
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 4. Table: extraction_runs
-- Server-side execution telemetry per document extraction
CREATE TABLE IF NOT EXISTS public.extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  extracted_count INTEGER NOT NULL DEFAULT 0,
  validation_issue_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_document_id ON public.extraction_runs(document_id);
CREATE INDEX IF NOT EXISTS idx_extraction_runs_status ON public.extraction_runs(status);

-- 5. Table: observations
-- Normalized clinical lab measurements extracted from reports
CREATE TABLE IF NOT EXISTS public.observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  extraction_run_id UUID REFERENCES public.extraction_runs(id) ON DELETE SET NULL,
  raw_test_name TEXT NOT NULL,
  canonical_test_name TEXT NOT NULL,
  loinc_code TEXT,
  value_numeric DOUBLE PRECISION,
  value_text TEXT,
  original_unit TEXT NOT NULL DEFAULT '',
  normalized_unit TEXT,
  reference_low DOUBLE PRECISION,
  reference_high DOUBLE PRECISION,
  observation_date DATE NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'valid'
    CHECK (validation_status IN ('valid', 'warning', 'error')),
  verified_by_user TEXT NOT NULL DEFAULT 'pending'
    CHECK (verified_by_user IN ('pending', 'confirmed', 'rejected')),
  user_corrected BOOLEAN NOT NULL DEFAULT FALSE,
  page_number INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure that either numeric or text value is provided
  CONSTRAINT chk_observation_value CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_observations_profile_id ON public.observations(profile_id);
CREATE INDEX IF NOT EXISTS idx_observations_document_id ON public.observations(document_id);
CREATE INDEX IF NOT EXISTS idx_observations_canonical_name ON public.observations(canonical_test_name);
CREATE INDEX IF NOT EXISTS idx_observations_date ON public.observations(observation_date);
CREATE INDEX IF NOT EXISTS idx_observations_verified ON public.observations(verified_by_user);
CREATE INDEX IF NOT EXISTS idx_observations_validation ON public.observations(validation_status);

DROP TRIGGER IF EXISTS set_observations_timestamp ON public.observations;
CREATE TRIGGER set_observations_timestamp
BEFORE UPDATE ON public.observations
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 6. Table: validation_issues
-- Detailed audit trail of deterministic rule discrepancies
CREATE TABLE IF NOT EXISTS public.validation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  extraction_run_id UUID NOT NULL REFERENCES public.extraction_runs(id) ON DELETE CASCADE,
  observation_id UUID REFERENCES public.observations(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL
    CHECK (issue_type IN (
      'missing_test_name',
      'missing_value',
      'missing_unit',
      'invalid_date',
      'duplicate_observation',
      'implausible_bounds',
      'unsupported_unit',
      'unmapped_test'
    )),
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_validation_issues_document_id ON public.validation_issues(document_id);
CREATE INDEX IF NOT EXISTS idx_validation_issues_observation_id ON public.validation_issues(observation_id);
CREATE INDEX IF NOT EXISTS idx_validation_issues_issue_type ON public.validation_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_validation_issues_resolved ON public.validation_issues(resolved);
