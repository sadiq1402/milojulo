import { setLocation } from '../src/features/location/api';
import {
  emptyRecord,
  shouldPrompt,
  shouldRefresh,
} from '../src/features/location/prompt';
import { supabase } from '../src/lib/supabase';

const stub = supabase as unknown as { rpc: jest.Mock };
const rpc = jest.fn();
stub.rpc = rpc;
const refused = (message: string) =>
  rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message } });

describe('sending the location', () => {
  test('sends the coordinates', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await setLocation(18.59, 73.76);
    expect(rpc).toHaveBeenCalledWith('set_location', {
      lat: 18.59,
      lng: 73.76,
    });
  });

  test.each([
    'you can update your location once an hour',
    'that location is outside Pune',
  ])('passes over "%s" quietly', async message => {
    refused(message);
    await expect(setLocation(18.59, 73.76)).resolves.toBeUndefined();
  });

  test('other refusals still fail', async () => {
    refused('create your profile first');
    await expect(setLocation(18.59, 73.76)).rejects.toThrow(
      'create your profile first',
    );
  });
});

describe('when to ask and refresh', () => {
  const day = 24 * 60 * 60 * 1000;

  test('asks first, and not with permission already given', () => {
    expect(shouldPrompt(emptyRecord, false, 0)).toBe(true);
    expect(shouldPrompt(emptyRecord, undefined, 0)).toBe(true);
    expect(shouldPrompt(emptyRecord, true, 0)).toBe(false);
  });

  test('never asks again after the phone dialog was refused', () => {
    const denied = { ...emptyRecord, answer: 'denied' as const };
    expect(shouldPrompt(denied, false, 365 * day)).toBe(false);
  });

  test('refreshes only with permission and every few hours', () => {
    const sent = { ...emptyRecord, sentAt: 0 };
    expect(shouldRefresh(sent, false, day)).toBe(false);
    expect(shouldRefresh(sent, true, 2 * 60 * 60 * 1000)).toBe(false);
    expect(shouldRefresh(sent, true, 3 * 60 * 60 * 1000)).toBe(true);
  });
});
