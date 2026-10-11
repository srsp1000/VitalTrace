-- ====================================================================
-- VitalTrace Seed Data: Synthetic Laboratory Observations
-- Used for Database View Verification & Standalone Demonstration
-- ====================================================================

DO $$
DECLARE
  v_user_id UUID := '00000000-0000-0000-0000-000000000001';
  v_doc1_id UUID := '11111111-1111-1111-1111-111111111111';
  v_doc2_id UUID := '22222222-2222-2222-2222-222222222222';
  v_doc3_id UUID := '33333333-3333-3333-3333-333333333333';
  v_doc4_id UUID := '44444444-4444-4444-4444-444444444444';
  v_doc5_id UUID := '55555555-5555-5555-5555-555555555555';
  
  v_run1_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_run2_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_run3_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_run4_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_run5_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  v_obs_dup UUID := gen_random_uuid();
  v_obs_nounit UUID := gen_random_uuid();
  v_obs_bounds UUID := gen_random_uuid();
BEGIN
  -- 1. Seed Profile
  INSERT INTO public.profiles (id, user_id, display_name, created_at)
  VALUES (v_user_id, v_user_id, 'Alex Morgan (Synthetic Clinical Demo)', '2024-01-10 08:00:00+00')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Seed Documents
  INSERT INTO public.documents (id, profile_id, original_filename, storage_path, mime_type, file_size_bytes, document_date, processing_status, created_at)
  VALUES
    (v_doc1_id, v_user_id, 'Quest_Comprehensive_Metabolic_2024-03-15.pdf', v_user_id || '/doc1.pdf', 'application/pdf', 245800, '2024-03-15', 'completed', '2024-03-15 14:22:00+00'),
    (v_doc2_id, v_user_id, 'LabCorp_Lipid_Metabolic_Panel_2024-06-20.pdf', v_user_id || '/doc2.pdf', 'application/pdf', 312400, '2024-06-20', 'review_required', '2024-06-20 09:15:00+00'),
    (v_doc3_id, v_user_id, 'BioReference_CBC_Differential_2024-09-10.pdf', v_user_id || '/doc3.pdf', 'application/pdf', 189200, '2024-09-10', 'completed', '2024-09-10 11:40:00+00'),
    (v_doc4_id, v_user_id, 'Endocrine_Specialists_TSH_Thyroid_2024-11-04.png', v_user_id || '/doc4.png', 'image/png', 1048576, '2024-11-04', 'completed', '2024-11-04 16:05:00+00'),
    (v_doc5_id, v_user_id, 'Corrupted_Fax_Scan_Electrolytes_2024-11-28.pdf', v_user_id || '/doc5.pdf', 'application/pdf', 98120, '2024-11-28', 'failed', '2024-11-28 10:12:00+00')
  ON CONFLICT (id) DO NOTHING;

  -- 3. Seed Extraction Runs
  INSERT INTO public.extraction_runs (id, document_id, model_name, status, started_at, completed_at, extracted_count, validation_issue_count, duration_ms, error_message)
  VALUES
    (v_run1_id, v_doc1_id, 'gemini-1.5-flash', 'completed', '2024-03-15 14:22:10+00', '2024-03-15 14:23:15+00', 6, 0, 2450, NULL),
    (v_run2_id, v_doc2_id, 'gemini-1.5-flash', 'completed', '2024-06-20 09:15:15+00', '2024-06-20 09:16:10+00', 6, 3, 3100, NULL),
    (v_run3_id, v_doc3_id, 'gemini-1.5-flash', 'completed', '2024-09-10 11:40:10+00', '2024-09-10 11:41:22+00', 5, 0, 1980, NULL),
    (v_run4_id, v_doc4_id, 'gemini-1.5-flash', 'completed', '2024-11-04 16:05:10+00', '2024-11-04 16:06:05+00', 2, 0, 1820, NULL),
    (v_run5_id, v_doc5_id, 'gemini-1.5-flash', 'failed', '2024-11-28 10:12:05+00', '2024-11-28 10:12:45+00', 0, 1, 1250, 'Document parser syntax error: truncated PDF stream or illegible raster scan.')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Seed Confirmed Longitudinal Observations (March 2024)
  INSERT INTO public.observations (profile_id, document_id, extraction_run_id, raw_test_name, canonical_test_name, loinc_code, value_numeric, original_unit, reference_low, reference_high, observation_date, validation_status, verified_by_user)
  VALUES
    (v_user_id, v_doc1_id, v_run1_id, 'Glucose, Fasting (Serum)', 'Fasting Glucose', '1558-6', 92, 'mg/dL', 70, 99, '2024-03-15', 'valid', 'confirmed'),
    (v_user_id, v_doc1_id, v_run1_id, 'Hemoglobin A1c (NGSP)', 'HbA1c', '4548-4', 5.4, '%', 4.0, 5.6, '2024-03-15', 'valid', 'confirmed'),
    (v_user_id, v_doc1_id, v_run1_id, 'Creatinine, Serum', 'Creatinine', '2160-0', 0.95, 'mg/dL', 0.70, 1.30, '2024-03-15', 'valid', 'confirmed'),
    (v_user_id, v_doc1_id, v_run1_id, 'Cholesterol, Total', 'Total Cholesterol', '2093-3', 210, 'mg/dL', 125, 200, '2024-03-15', 'valid', 'confirmed'),
    (v_user_id, v_doc1_id, v_run1_id, 'HDL Cholesterol', 'HDL Cholesterol', '2085-9', 52, 'mg/dL', 40, 60, '2024-03-15', 'valid', 'confirmed'),
    (v_user_id, v_doc1_id, v_run1_id, 'LDL Calculated', 'LDL Cholesterol', '13457-7', 128, 'mg/dL', NULL, 100, '2024-03-15', 'valid', 'confirmed');

  -- 5. Seed June 2024 Observations (including test cases for review)
  INSERT INTO public.observations (id, profile_id, document_id, extraction_run_id, raw_test_name, canonical_test_name, loinc_code, value_numeric, original_unit, reference_low, reference_high, observation_date, validation_status, verified_by_user)
  VALUES
    (gen_random_uuid(), v_user_id, v_doc2_id, v_run2_id, 'Fasting Blood Glucose', 'Fasting Glucose', '1558-6', 98, 'mg/dL', 70, 99, '2024-06-20', 'valid', 'pending'),
    (gen_random_uuid(), v_user_id, v_doc2_id, v_run2_id, 'Cholesterol, Total', 'Total Cholesterol', '2093-3', 202, 'mg/dL', 125, 200, '2024-06-20', 'valid', 'confirmed'),
    (v_obs_dup, v_user_id, v_doc2_id, v_run2_id, 'Cholesterol, Total (Duplicate Entry)', 'Total Cholesterol', '2093-3', 202, 'mg/dL', 125, 200, '2024-06-20', 'warning', 'pending'),
    (v_obs_nounit, v_user_id, v_doc2_id, v_run2_id, 'Triglycerides, Serum', 'Triglycerides', '2571-8', 140, '', NULL, 150, '2024-06-20', 'warning', 'pending'),
    (v_obs_bounds, v_user_id, v_doc2_id, v_run2_id, 'Platelets (Automated Count)', 'Platelet Count', '777-3', 850, 'x10^3/uL', 150, 450, '2024-06-20', 'warning', 'pending'),
    (gen_random_uuid(), v_user_id, v_doc2_id, v_run2_id, 'LDL Cholesterol Direct', 'LDL Cholesterol', '13457-7', 120, 'mg/dL', NULL, 100, '2024-06-20', 'valid', 'confirmed');

  -- 6. Seed September & November 2024 Observations
  INSERT INTO public.observations (profile_id, document_id, extraction_run_id, raw_test_name, canonical_test_name, loinc_code, value_numeric, original_unit, reference_low, reference_high, observation_date, validation_status, verified_by_user)
  VALUES
    (v_user_id, v_doc3_id, v_run3_id, 'Hemoglobin (HGB)', 'Hemoglobin', '718-7', 14.8, 'g/dL', 13.5, 17.5, '2024-09-10', 'valid', 'confirmed'),
    (v_user_id, v_doc3_id, v_run3_id, 'Platelet Count (PLT)', 'Platelet Count', '777-3', 245, 'x10^3/uL', 150, 450, '2024-09-10', 'valid', 'confirmed'),
    (v_user_id, v_doc3_id, v_run3_id, 'Glucose, Fasting', 'Fasting Glucose', '1558-6', 106, 'mg/dL', 70, 99, '2024-09-10', 'valid', 'confirmed'),
    (v_user_id, v_doc3_id, v_run3_id, 'Total Cholesterol', 'Total Cholesterol', '2093-3', 195, 'mg/dL', 125, 200, '2024-09-10', 'valid', 'confirmed'),
    (v_user_id, v_doc3_id, v_run3_id, 'LDL Cholesterol', 'LDL Cholesterol', '13457-7', 115, 'mg/dL', NULL, 100, '2024-09-10', 'valid', 'confirmed'),
    (v_user_id, v_doc4_id, v_run4_id, 'TSH (Thyroid Stimulating Hormone)', 'TSH', '3016-3', 2.2, 'mIU/L', 0.4, 4.0, '2024-11-04', 'valid', 'confirmed'),
    (v_user_id, v_doc4_id, v_run4_id, 'Glucose (Spot)', 'Fasting Glucose', '1558-6', 95, 'mg/dL', 70, 99, '2024-11-04', 'valid', 'confirmed');

  -- 7. Seed Validation Issues
  INSERT INTO public.validation_issues (document_id, extraction_run_id, observation_id, issue_type, severity, message, resolved, created_at)
  VALUES
    (v_doc2_id, v_run2_id, v_obs_dup, 'duplicate_observation', 'warning', 'Duplicate observation detected: "Total Cholesterol" recorded twice on same observation date (2024-06-20).', FALSE, '2024-06-20 09:16:10+00'),
    (v_doc2_id, v_run2_id, v_obs_nounit, 'missing_unit', 'warning', 'Missing unit: Expected clinical unit for Triglycerides (standard: mg/dL) was null or blank.', FALSE, '2024-06-20 09:16:10+00'),
    (v_doc2_id, v_run2_id, v_obs_bounds, 'implausible_bounds', 'warning', 'Plausibility bound review: Platelet count 850 x10^3/uL exceeds normal physiological threshold (150 - 450). Verify transcription.', FALSE, '2024-06-20 09:16:10+00'),
    (v_doc5_id, v_run5_id, NULL, 'unmapped_test', 'error', 'Pipeline failure: Optical recognition could not find tabular test coordinates due to corrupted raster encoding.', FALSE, '2024-11-28 10:12:45+00');

END $$;
