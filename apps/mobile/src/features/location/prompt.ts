import AsyncStorage from '@react-native-async-storage/async-storage';

// What this phone remembers about asking a Member for location (#105).
export type PromptRecord = {
  answer?: 'allowed' | 'denied' | 'notNow';
  notNowCount: number;
  notNowAt?: number;
  offShown: boolean;
  sentAt?: number;
};

const hour = 60 * 60 * 1000;
const askAgainAfter = 7 * 24 * hour;
// Location is sent on app open at most this often; the server also keeps one an hour.
export const refreshEvery = 3 * hour;

// A seam for tests to move time without freezing the test runner's own timers.
export const clock = { now: () => Date.now() };

export const emptyRecord: PromptRecord = { notNowCount: 0, offShown: false };

const key = (userId: string) => `location_prompt:${userId}`;

export async function loadRecord(userId: string): Promise<PromptRecord> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? { ...emptyRecord, ...JSON.parse(raw) } : emptyRecord;
  } catch {
    return emptyRecord;
  }
}

export async function saveRecord(userId: string, record: PromptRecord) {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(record));
  } catch {
    // Losing it only means asking again.
  }
}

// permission: what the phone says (undefined where it can't be read without asking, iOS).
export function locationAllowed(
  record: PromptRecord,
  permission: boolean | undefined,
) {
  return permission ?? record.answer === 'allowed';
}

// Ask the first time; after "Not now" ask once more a week later, then never.
export function shouldPrompt(
  record: PromptRecord,
  permission: boolean | undefined,
  now: number,
) {
  if (locationAllowed(record, permission)) {
    return false;
  }
  if (!record.answer) {
    return true;
  }
  return (
    record.answer === 'notNow' &&
    record.notNowCount === 1 &&
    now - (record.notNowAt ?? 0) >= askAgainAfter
  );
}

// Where permission can't be read (iOS) a fix is still tried: it fails quietly without
// permission, and succeeds once the Member turned location on in Settings.
export function shouldRefresh(
  record: PromptRecord,
  permission: boolean | undefined,
  now: number,
) {
  return permission !== false && now - (record.sentAt ?? 0) >= refreshEvery;
}
