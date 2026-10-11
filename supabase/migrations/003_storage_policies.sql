-- ====================================================================
-- VitalTrace Migration 003: Private Medical Storage Bucket & Policies
-- HIPAA-Aligned Encrypted Document Isolation
-- ====================================================================

-- 1. Create Private Storage Bucket 'medical-documents'
-- Note: 'public' is explicitly FALSE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-documents',
  'medical-documents',
  false,
  10485760, -- 10MB in bytes
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- 2. Drop existing policies to prevent duplicate / conflict errors on re-run
DROP POLICY IF EXISTS "Users can upload medical files to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view medical files in own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update medical files in own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete medical files in own folder" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Individual User Access" ON storage.objects;

-- 3. Storage RLS Policies for 'medical-documents'
-- Files are stored under the folder path pattern: "<auth.uid()>/<document_id>.<ext>"

-- Allow authenticated users to upload files only to their own user directory
CREATE POLICY "Users can upload medical files to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'medical-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- Allow authenticated users to view/download files only from their own folder
CREATE POLICY "Users can view medical files in own folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- Allow authenticated users to update/overwrite files in their own folder
CREATE POLICY "Users can update medical files in own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- Allow authenticated users to delete files from their own folder
CREATE POLICY "Users can delete medical files in own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );
