import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';
import { supabase as appClient } from '../../src/lib/supabase';
import { admin } from './admin';
import { latestCodeFor } from './mailpit';

export type TestMember = {
  id: string;
  name: string;
  client: SupabaseClient<Database>;
};

let counter = 0;

// Another person's phone: its own client and session, separate from the app's.
function otherClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

// Members sit in Baner unless placed elsewhere; `at: null` leaves them without a location.
export const baner = { lat: 18.559, lng: 73.786 };

// A Member with a Submitted Profile, signed in through the real email-code flow.
// Pass `app: true` to sign the app's own client in as them.
export async function createMember(
  name: string,
  {
    app = false,
    at = baner,
  }: { app?: boolean; at?: { lat: number; lng: number } | null } = {},
): Promise<TestMember> {
  const client = app ? appClient : otherClient();
  const email = `${name.toLowerCase()}-${Date.now()}-${counter++}@test.milojulo`;
  await client.auth.signOut();
  await check(client.auth.signInWithOtp({ email }));
  await check(
    client.auth.verifyOtp({
      email,
      token: await latestCodeFor(email),
      type: 'email',
    }),
  );
  const id = (await client.auth.getUser()).data.user!.id;

  // Accept only the current version of each document, as the app does.
  const { data: docs } = await client
    .from('consent_documents')
    .select('id, kind, effective_at')
    .lte('effective_at', new Date().toISOString())
    .order('effective_at', { ascending: false });
  const current = new Map<string, string>();
  docs!.forEach(d => current.has(d.kind) || current.set(d.kind, d.id));
  await check(
    client.rpc('accept_consents', {
      birth_date: '1996-05-04',
      document_ids: [...current.values()],
    }),
  );

  // Profile content is set up directly (photos need the media function, which CI doesn't run).
  await check(
    admin
      .from('profiles')
      .update({ display_name: name, modes: ['friends'] })
      .eq('id', id),
  );
  const { data: questions } = await admin
    .from('prompt_questions')
    .select('id')
    .limit(2);
  await check(
    admin.from('profile_prompts').insert(
      questions!.map((q, i) => ({
        user_id: id,
        position: i + 1,
        question_id: q.id,
        answer: 'An answer',
      })),
    ),
  );
  await check(
    admin.from('photos').insert(
      [1, 2].map(position => ({
        user_id: id,
        position,
        object_key: `${id}/${position}.jpg`,
        uploaded_at: new Date().toISOString(),
      })),
    ),
  );
  await check(client.rpc('submit_profile'));
  if (at) {
    await check(client.rpc('set_location', at));
  }
  return { id, name, client };
}

// An accepted Friends Connection between two Members; returns its id.
export async function connect(
  from: TestMember,
  to: TestMember,
): Promise<string> {
  const { data: connectionId } = await check(
    from.client.rpc('send_request', { to_member: to.id, mode: 'friends' }),
  );
  await check(
    to.client.rpc('respond_request', {
      connection_id: connectionId!,
      accept: true,
    }),
  );
  return connectionId!;
}

async function check<T extends { error: unknown }>(
  request: PromiseLike<T>,
): Promise<T> {
  const result = await request;
  if (result.error) {
    throw result.error;
  }
  return result;
}
