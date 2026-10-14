import { reportContent } from '../src/features/reports/api';
import { createMember, type TestMember } from './support/members';

// These run against local Supabase and only pass once #16's migration is applied (the reports
// table and `report`). They are written against the agreed contract and may fail until #16
// lands. Shared database: never `db reset`; run through the integration lock.

let asha: TestMember;
let kabir: TestMember;

beforeAll(async () => {
  // The app's own client is signed in as Asha for the whole file.
  asha = await createMember('Asha', { app: true });
  kabir = await createMember('Kabir');
});

// What gets stored is #16's pgTAP tests' job; here the app's call shape is accepted.
test('reporting another profile goes through, and can be repeated', async () => {
  const report = () =>
    reportContent({
      targetType: 'profile',
      targetId: kabir.id,
      reason: 'fake_or_spam',
      details: ' Same photos as another account. ',
    });
  await expect(report()).resolves.toBeUndefined();
  await expect(report()).resolves.toBeUndefined();
});

test('reporting my own profile reads as nothing to report', async () => {
  await expect(
    reportContent({
      targetType: 'profile',
      targetId: asha.id,
      reason: 'other',
    }),
  ).rejects.toThrow("This isn't available to report any more.");
});

test('details over 500 characters are refused', async () => {
  await expect(
    reportContent({
      targetType: 'profile',
      targetId: kabir.id,
      reason: 'other',
      details: 'x'.repeat(501),
    }),
  ).rejects.toThrow('Keep the details to 500 characters.');
});
