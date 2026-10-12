import { signOut } from '../src/features/auth/api';
import { fetchConversations, newMessageId } from '../src/features/chat/api';
import { admin } from './support/admin';
import { connect, createMember } from './support/members';

afterAll(() => signOut());

// The Auth admin API is what the Supabase dashboard and in-app account deletion (#20) use.
test('deleting a Member with a submitted profile removes them, their Connections and messages', async () => {
  const me = await createMember('Asha', { app: true });
  const ravi = await createMember('Ravi');
  const connectionId = await connect(ravi, me);
  await ravi.client.from('messages').insert({
    id: newMessageId(),
    connection_id: connectionId,
    type: 'text',
    body: 'Hi!',
  });

  const { error } = await admin.auth.admin.deleteUser(ravi.id);
  expect(error).toBeNull();

  expect(await fetchConversations()).toEqual([]);
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', ravi.id);
  expect(profile).toEqual([]);
});
