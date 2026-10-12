import { signOut } from '../src/features/auth/api';
import {
  fetchConversations,
  fetchMessages,
  newMessageId,
} from '../src/features/chat/api';
import { admin } from './support/admin';
import { connect, createMember } from './support/members';

afterAll(() => signOut());

// Deletion goes through the Auth admin API, as from the Supabase dashboard.
test('deleting a Member with a submitted profile removes their profile, photos, prompts, Connections and messages', async () => {
  const asha = await createMember('Asha', { app: true });
  const ravi = await createMember('Ravi');
  const connectionId = await connect(ravi, asha);
  await ravi.client.from('messages').insert({
    id: newMessageId(),
    connection_id: connectionId,
    type: 'text',
    body: 'Hi!',
  });

  const { error } = await admin.auth.admin.deleteUser(ravi.id);
  expect(error).toBeNull();

  // What the other side sees.
  expect(await fetchConversations()).toEqual([]);
  expect(await fetchMessages(connectionId)).toEqual([]);

  // Profile, photos and prompts are private, so only an admin can confirm they're gone.
  const profile = await admin.from('profiles').select('id').eq('id', ravi.id);
  const photos = await admin.from('photos').select('id').eq('user_id', ravi.id);
  const prompts = await admin
    .from('profile_prompts')
    .select('position')
    .eq('user_id', ravi.id);
  expect([profile.data, photos.data, prompts.data]).toEqual([[], [], []]);
});
