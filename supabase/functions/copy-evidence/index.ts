// Report evidence copy (#160, decision 62): copies a reported file to `evidence/<report id>`, so the
// original can follow its own lifecycle and the copy has its own 90 days. The database decides what
// is waiting (pending_evidence_copies); this file only wires in Supabase and R2.
import { createClient } from '@supabase/supabase-js';
import { createR2 } from '../_shared/r2.ts';
import { createHandler, type Db } from './handler.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`copy-evidence: ${name} is not set`);
  return value;
}

const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(env('SUPABASE_URL'), serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function check<T>({ data, error }: { data: T; error: { message: string } | null }, what: string): T {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

const db: Db = {
  async pending(batch, skip) {
    const rows = check(await supabase.rpc('pending_evidence_copies', { batch, skip }), 'load pending copies');
    return (rows ?? []).map((r: { report_id: string; source_key: string; evidence_key: string }) => ({
      reportId: r.report_id,
      sourceKey: r.source_key,
      evidenceKey: r.evidence_key,
    }));
  },
  async markCopied(reportIds) {
    const rows = check(await supabase.rpc('mark_evidence_copied', { report_ids: reportIds }), 'mark copied');
    // The rows are the originals nothing points at any more.
    return (rows ?? []).map((r: string | { mark_evidence_copied: string }) =>
      typeof r === 'string' ? r : r.mark_evidence_copied
    );
  },
};

const storage = createR2({
  accountId: env('R2_ACCOUNT_ID'),
  accessKeyId: env('R2_ACCESS_KEY_ID'),
  secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  bucket: env('R2_BUCKET'),
  now: () => new Date(),
});

Deno.serve(createHandler({ serviceRoleKey, db, storage }));
