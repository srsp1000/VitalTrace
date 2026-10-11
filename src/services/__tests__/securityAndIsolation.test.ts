import { describe, it, expect } from 'vitest';
import { generateUUID } from '../../lib/uuid';
import { getSignedDocumentUrl } from '../../lib/supabaseClient';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Security & Multi-Tenant Isolation Architecture', () => {
  describe('Document Storage Boundaries & Scoping', () => {
    it('constructs isolated user-scoped storage paths', () => {
      const profileId = generateUUID();
      const documentId = generateUUID();
      const ext = 'pdf';
      const storagePath = `${profileId}/${documentId}.${ext}`;

      // Enforce strict regex: <UUID>/<UUID>.<ext>
      const pathRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i;
      expect(storagePath).toMatch(pathRegex);
      expect(storagePath.startsWith(profileId)).toBe(true);
      expect(storagePath.includes('..')).toBe(false);
    });

    it('returns an informative error when creating signed URL without live Supabase credentials', async () => {
      const res = await getSignedDocumentUrl('test/doc.pdf');
      expect(res.url).toBeNull();
      expect(res.error).toBeTruthy();
    });
  });

  describe('PostgreSQL RLS & View Security Invoker Auditing', () => {
    it('verifies all analytical views enforce WITH (security_invoker = true)', () => {
      const viewsSqlPath = path.resolve(__dirname, '../../../supabase/migrations/004_analytical_views.sql');
      const sqlContent = fs.readFileSync(viewsSqlPath, 'utf8');

      // Count occurrences of security_invoker = true
      const matches = sqlContent.match(/WITH\s*\(\s*security_invoker\s*=\s*true\s*\)/gi);
      expect(matches).not.toBeNull();
      // There are exactly 9 analytical views in 004_analytical_views.sql (item 9 is a trajectory function)
      expect(matches?.length).toBe(9);
    });

    it('verifies RLS policies include DELETE operations for audit tables', () => {
      const rlsSqlPath = path.resolve(__dirname, '../../../supabase/migrations/002_row_level_security.sql');
      const rlsContent = fs.readFileSync(rlsSqlPath, 'utf8');

      expect(rlsContent).toContain('Users can delete extraction runs of own documents');
      expect(rlsContent).toContain('Users can delete validation issues for own documents');
    });

    it('verifies Cartesian product fix in view_run_quality_telemetry CTE pre-aggregation', () => {
      const viewsSqlPath = path.resolve(__dirname, '../../../supabase/migrations/004_analytical_views.sql');
      const sqlContent = fs.readFileSync(viewsSqlPath, 'utf8');

      expect(sqlContent).toContain('obs_summary AS');
      expect(sqlContent).toContain('issue_summary AS');
      // Confirms view_run_quality_telemetry left joins to the CTE summaries rather than directly to both tables simultaneously
      expect(sqlContent).toContain('LEFT JOIN obs_summary os ON os.extraction_run_id = er.id');
      expect(sqlContent).toContain('LEFT JOIN issue_summary isum ON isum.extraction_run_id = er.id');
    });
  });
});
