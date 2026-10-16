import {
  fetchNotificationSettings,
  registerDeviceToken,
  removeDeviceToken,
  saveNotificationSettings,
} from '../src/features/push/api';
import { supabase } from '../src/lib/supabase';

const stub = supabase as unknown as { rpc: jest.Mock; from: jest.Mock };

beforeEach(() => {
  stub.rpc = jest.fn();
  stub.from = jest.fn();
});

describe('device tokens', () => {
  test('registers this phone with register_device_token', async () => {
    stub.rpc.mockResolvedValue({ data: null, error: null });
    await registerDeviceToken('tok-1', 'android');
    expect(stub.rpc).toHaveBeenCalledWith('register_device_token', {
      token: 'tok-1',
      platform: 'android',
    });
  });

  test('a refusal is thrown', async () => {
    stub.rpc.mockResolvedValue({
      data: null,
      error: { message: 'create your profile first' },
    });
    await expect(registerDeviceToken('tok-1', 'android')).rejects.toThrow(
      'create your profile first',
    );
  });

  test('removing deletes my row for that token', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const remove = jest.fn(() => ({ eq }));
    stub.from.mockReturnValue({ delete: remove });
    await removeDeviceToken('tok-1');
    expect(stub.from).toHaveBeenCalledWith('device_tokens');
    expect(eq).toHaveBeenCalledWith('token', 'tok-1');
  });

  test('a failed removal is thrown', async () => {
    const eq = jest.fn().mockResolvedValue({ error: { message: 'boom' } });
    stub.from.mockReturnValue({ delete: () => ({ eq }) });
    await expect(removeDeviceToken('tok-1')).rejects.toThrow();
  });
});

describe('notification settings', () => {
  test('reads both switches from my profile', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { notify_messages: true, notify_activities: false },
      error: null,
    });
    const eq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq }));
    stub.from.mockReturnValue({ select });
    await expect(fetchNotificationSettings('me')).resolves.toEqual({
      messages: true,
      activities: false,
    });
    expect(stub.from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('notify_messages, notify_activities');
    expect(eq).toHaveBeenCalledWith('id', 'me');
  });

  test('a failed load says so', async () => {
    const single = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'x' } });
    stub.from.mockReturnValue({
      select: () => ({ eq: () => ({ single }) }),
    });
    await expect(fetchNotificationSettings('me')).rejects.toThrow(
      "We couldn't load this.",
    );
  });

  test.each([
    [{ messages: false }, { notify_messages: false }],
    [{ activities: true }, { notify_activities: true }],
  ])('saves %p as %p on my profile', async (change, columns) => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq }));
    stub.from.mockReturnValue({ update });
    await saveNotificationSettings('me', change);
    expect(update).toHaveBeenCalledWith(columns);
    expect(eq).toHaveBeenCalledWith('id', 'me');
  });

  test('a failed save reads as the connection', async () => {
    const eq = jest.fn().mockResolvedValue({ error: { message: 'x' } });
    stub.from.mockReturnValue({ update: () => ({ eq }) });
    await expect(
      saveNotificationSettings('me', { messages: false }),
    ).rejects.toThrow("That didn't work.");
  });
});
