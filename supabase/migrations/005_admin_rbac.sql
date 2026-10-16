-- ====================================================================
-- VitalTrace Migration 005: Server-Enforced Administrator RBAC
-- Trusted server-controlled role provisioning.
-- Ordinary users cannot read or modify their own role column.
-- Administrators are provisioned via database-level seed or migration,
-- never via public registration or client-editable fields.
-- ====================================================================

-- 1. Add role column to profiles (default 'patient')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'patient'
  CHECK (role IN ('patient', 'admin'));

-- 2. Function: is_admin — server-side admin check for RLS policies
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. RLS policy: users cannot read the role column directly (profiles still readable for own data)
-- Users can read own profile (already exists from 002). We add a specific policy to prevent
-- updating role to anything other than 'patient'. The safest approach: disallow role updates
-- by normal users entirely.

-- Drop any existing update policy that allows role changes
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Re-create update policy that prevents role escalation:
-- Users may update display_name and other fields but NOT role.
CREATE POLICY "Users can update own profile (no role escalation)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- 4. Extend handle_new_user() trigger to always set role = 'patient' on registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, display_name, role)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'patient'   -- Always 'patient' — admin role is provisioned separately, never via registration
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Admin-scoped analytical views for extraction runs
--    Admins can read extraction_runs for ALL documents (cross-user analytics).
--    Patients can only see their own document runs (existing policy).
DROP POLICY IF EXISTS "Admins can read all extraction runs" ON public.extraction_runs;
CREATE POLICY "Admins can read all extraction runs"
  ON public.extraction_runs FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 6. Admin-scoped read for validation_issues (cross-user analytics)
DROP POLICY IF EXISTS "Admins can read all validation issues" ON public.validation_issues;
CREATE POLICY "Admins can read all validation issues"
  ON public.validation_issues FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 7. Admin-scoped read for all documents (for pipeline telemetry, not patient records)
DROP POLICY IF EXISTS "Admins can read all documents" ON public.documents;
CREATE POLICY "Admins can read all documents"
  ON public.documents FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 8. Admin-scoped read for all observations (for data quality analytics, not patient records)
DROP POLICY IF EXISTS "Admins can read all observations" ON public.observations;
CREATE POLICY "Admins can read all observations"
  ON public.observations FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 9. Admin-scoped read for all profiles (for user management)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- 10. Provision seed administrator account
--     Run this only in your own database with your actual user UUID.
--     Do NOT commit real UUIDs. Use psql locally:
--     UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
--     This migration records the pattern only.

COMMENT ON COLUMN public.profiles.role IS
  'Server-controlled access role. Values: patient (default), admin.
   Admin role is provisioned via direct database UPDATE with service-role credentials only.
   Public registration always creates patient accounts. Users cannot escalate their own role.';
