import { fetchAccountStage } from '../src/features/account/api';
import { sendCode, signOut, verifyCode } from '../src/features/auth/api';
import { supabase } from '../src/lib/supabase';
import { latestCodeFor } from './support/mailpit';

const email = `signin-${Date.now()}@test.milojulo`;

afterAll(() => signOut());

test('an emailed code signs a new account in at the invite step', async () => {
  await sendCode(email);
  await verifyCode(email, await latestCodeFor(email));

  const { data } = await supabase.auth.getUser();
  expect(data.user?.email).toBe(email);
  expect(await fetchAccountStage(data.user!.id)).toBe('invite');
});

test('a wrong code is refused', async () => {
  const other = `wrong-${Date.now()}@test.milojulo`;
  await sendCode(other);
  const code = await latestCodeFor(other);
  const wrong = code === '000000' ? '111111' : '000000';
  await expect(verifyCode(other, wrong)).rejects.toThrow(
    'That code is wrong or has expired. Check it, or send a new one.',
  );
});

test('a malformed email is refused with friendly copy', async () => {
  await expect(sendCode('not-an-email')).rejects.toThrow(
    'Enter a valid email address.',
  );
});
