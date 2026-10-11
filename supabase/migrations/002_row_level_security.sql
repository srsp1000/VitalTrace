-- ====================================================================
-- VitalTrace Migration 002: Row-Level Security (RLS)
-- Multi-Tenant Clinical Privacy & Ownership Boundaries
-- ====================================================================

-- 1. Enable RLS on all user-owned tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_issues ENABLE ROW LEVEL SECURITY;

-- 2. Policies for: profiles
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. Policies for: documents
CREATE POLICY "Users can read own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = profile_id);

-- 4. Policies for: extraction_runs
-- Traceable via parent document ownership
CREATE POLICY "Users can read extraction runs of own documents"
  ON public.extraction_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = extraction_runs.document_id
      AND documents.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users or Edge Functions can insert runs for own documents"
  ON public.extraction_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = extraction_runs.document_id
      AND documents.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users or Edge Functions can update runs for own documents"
  ON public.extraction_runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = extraction_runs.document_id
      AND documents.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete extraction runs of own documents"
  ON public.extraction_runs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = extraction_runs.document_id
      AND documents.profile_id = auth.uid()
    )
  );

-- 5. Policies for: observations
CREATE POLICY "Users can read own observations"
  ON public.observations FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own observations"
  ON public.observations FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own observations"
  ON public.observations FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete own observations"
  ON public.observations FOR DELETE
  USING (auth.uid() = profile_id);

-- 6. Policies for: validation_issues
CREATE POLICY "Users can read validation issues for own documents"
  ON public.validation_issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = validation_issues.document_id
      AND documents.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update/resolve validation issues for own documents"
  ON public.validation_issues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = validation_issues.document_id
      AND documents.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert validation issues for own documents"
  ON public.validation_issues FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = validation_issues.document_id
      AND documents.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete validation issues for own documents"
  ON public.validation_issues FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = validation_issues.document_id
      AND documents.profile_id = auth.uid()
    )
  );
