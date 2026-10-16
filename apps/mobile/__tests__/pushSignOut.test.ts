import { signOut } from '../src/features/auth/api';
import * as push from '../src/features/push/api';
import * as messaging from '../src/features/push/messaging';
import { supabase } from '../src/lib/supabase';

jest.mock('../src/features/push/api');
jest.mock('../src/features/push/messaging', () => ({
  getToken: jest.fn(),
}));

const order: string[] = [];
const stub = supabase as unknown as { auth: { signOut: jest.Mock } };

beforeEach(() => {
  order.length = 0;
  stub.auth = {
    signOut: jest.fn(async () => {
      order.push('signOut');
      return { error: null };
    }),
  };
  jest.mocked(messaging.getToken).mockResolvedValue('tok-1');
  jest.mocked(push.removeDeviceToken).mockImplementation(async () => {
    order.push('remove');
  });
});

test("signing out removes this phone's token first, while still signed in", async () => {
  await signOut();
  expect(push.removeDeviceToken).toHaveBeenCalledWith('tok-1');
  expect(order).toEqual(['remove', 'signOut']);
});

test('a failed removal still signs out', async () => {
  jest.mocked(push.removeDeviceToken).mockRejectedValue(new Error('offline'));
  await signOut();
  expect(stub.auth.signOut).toHaveBeenCalled();
});

test('with no token there is nothing to remove', async () => {
  jest.mocked(messaging.getToken).mockResolvedValue(null);
  await signOut();
  expect(push.removeDeviceToken).not.toHaveBeenCalled();
  expect(stub.auth.signOut).toHaveBeenCalled();
});
