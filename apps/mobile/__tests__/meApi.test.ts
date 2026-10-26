import { ageOn } from '../src/features/consents/birthDate';
import { fetchMyBlocks, setPaused, unblock } from '../src/features/me/api';
import { saveBasics, savePrompts } from '../src/features/profileSetup/api';
import { supabase } from '../src/lib/supabase';

// jest.setup.js stands Supabase in with an empty object; give it what each call needs.
const stub = supabase as unknown as { rpc: jest.Mock; from: jest.Mock };
const rpc = jest.fn();
stub.rpc = rpc;

const connectionCopy = "That didn't work. Check your connection and try again.";

describe('pausing', () => {
  test.each([true, false])('set_paused(%p)', async paused => {
    rpc.mockResolvedValue({ data: null, error: null });
    await setPaused(paused);
    expect(rpc).toHaveBeenCalledWith('set_paused', { paused });
  });

  test('a failure reads as the connection', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(setPaused(true)).rejects.toThrow(connectionCopy);
  });
});

describe('blocked people', () => {
  test('lists my_blocks() newest first as the database orders them', async () => {
    rpc.mockResolvedValue({
      data: [
        { member_id: 'm2', display_name: 'Rohan', blocked_at: '2026-10-02' },
        { member_id: 'm1', display_name: 'Isha', blocked_at: '2026-10-01' },
      ],
      error: null,
    });
    await expect(fetchMyBlocks()).resolves.toEqual([
      { memberId: 'm2', name: 'Rohan', blockedAt: '2026-10-02' },
      { memberId: 'm1', name: 'Isha', blockedAt: '2026-10-01' },
    ]);
    expect(rpc).toHaveBeenCalledWith('my_blocks');
  });

  test('a failed load says so', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchMyBlocks()).rejects.toThrow("We couldn't load this.");
  });

  test('unblock deletes my own block row for that Member', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const remove = jest.fn(() => ({ eq }));
    stub.from = jest.fn(() => ({ delete: remove }));
    await unblock('m1');
    expect(stub.from).toHaveBeenCalledWith('blocks');
    expect(eq).toHaveBeenCalledWith('blocked_id', 'm1');
  });

  test('a failed unblock reads as the connection', async () => {
    const eq = jest.fn().mockResolvedValue({ error: { message: 'boom' } });
    stub.from = jest.fn(() => ({ delete: () => ({ eq }) }));
    await expect(unblock('m1')).rejects.toThrow(connectionCopy);
  });
});

describe('age', () => {
  test.each([
    ['1998-03-21', '2026-03-20', 27],
    ['1998-03-21', '2026-03-21', 28],
    ['2000-02-29', '2026-02-28', 25],
  ])('born %s, on %s is %i', (birth, today, age) => {
    expect(ageOn(birth, new Date(`${today}T12:00:00Z`))).toBe(age);
  });
});

describe('the word filter', () => {
  const wordFilter = "that wording isn't allowed; please change it";
  const copy =
    "Some of that wording isn't allowed on MiloJulo. Please change it.";

  test('a refused first name reads as friendly copy', async () => {
    const eq = jest.fn().mockResolvedValue({ error: { message: wordFilter } });
    stub.from = jest.fn(() => ({ update: () => ({ eq }) }));
    await expect(saveBasics('me', { displayName: 'x' })).rejects.toMatchObject({
      message: copy,
    });
  });

  test('a refused prompt answer reads as friendly copy', async () => {
    const select = () => ({
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    const insert = jest
      .fn()
      .mockResolvedValue({ error: { message: wordFilter } });
    stub.from = jest.fn(() => ({ select, insert }));
    await expect(
      savePrompts('me', [{ position: 1, questionId: 1, answer: 'x' }]),
    ).rejects.toMatchObject({ message: copy });
  });
});
