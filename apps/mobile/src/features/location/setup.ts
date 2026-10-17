import { setLocation } from './api';
import { currentPosition, hasPermission, requestPermission } from './device';
import type { Coords } from './device';
import { clock, loadRecord, locationAllowed, saveRecord } from './prompt';

// Profile setup asks for location in its Area step (#142). The answer is saved as LocationGate's
// prompt record, so the gate doesn't ask again after setup. Null when refused or there's no fix.
export async function askLocationInSetup(
  userId: string,
): Promise<Coords | null> {
  let granted = false;
  try {
    granted = await requestPermission();
  } catch {
    granted = false;
  }
  const record = await loadRecord(userId);
  await saveRecord(userId, {
    ...record,
    answer: granted ? 'allowed' : 'denied',
  });
  if (!granted) {
    return null;
  }
  try {
    return await currentPosition();
  } catch {
    return null;
  }
}

// Right after the profile is submitted, so the first Discover feed measures from the phone, not
// the Area centre. Never throws: LocationGate's refresh tries again on the next app open.
export async function sendLocationAfterSetup(userId: string): Promise<void> {
  try {
    const record = await loadRecord(userId);
    if (!locationAllowed(record, await hasPermission())) {
      return;
    }
    const { lat, lng } = await currentPosition();
    await setLocation(lat, lng);
    await saveRecord(userId, {
      ...record,
      answer: 'allowed',
      sentAt: clock.now(),
    });
  } catch {
    // No fix, no network or refused by the server.
  }
}
