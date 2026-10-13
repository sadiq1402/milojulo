import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';

// Service-role client for test setup only (what an admin or the dashboard would do); never used by the app.
export const admin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  },
);
