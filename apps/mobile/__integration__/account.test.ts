import {
  deleteAccount,
  fetchAccountStage,
  fetchDataRequests,
  fetchMyConsents,
  requestDataCopy,
  withdrawConsent,
} from '../src/features/account/api';
import { signOut } from '../src/features/auth/api';
import {
  acceptConsents,
  fetchConsentDocuments,
} from '../src/features/consents/api';
import { createMember, type TestMember } from './support/members';

afterAll(() => signOut());

async function seenBy(viewer: TestMember, memberId: string) {
  // The profile view applies the same visibility as Discover, without paging.
  const { data, error } = await viewer.client.rpc('get_profile', {
    member_id: memberId,
  });
  expect(error).toBeNull();
  return data!.length > 0;
}

test('withdrawing a consent hides me until I accept the current documents again', async () => {
  const asha = await createMember('Asha', { app: true });
  const ravi = await createMember('Ravi');
  expect(await seenBy(ravi, asha.id)).toBe(true);

  const terms = (await fetchMyConsents()).find(c => c.kind === 'terms')!;
  await withdrawConsent(terms.documentId);
  expect(
    (await fetchMyConsents()).find(c => c.kind === 'terms')!.withdrawnAt,
  ).not.toBeNull();
  expect(await fetchAccountStage(asha.id)).toBe('reconsent');
  expect(await seenBy(ravi, asha.id)).toBe(false);
  await expect(withdrawConsent(terms.documentId)).rejects.toThrow(
    "You've already withdrawn this consent.",
  );

  await acceptConsents('1996-05-04', await fetchConsentDocuments());
  expect(await fetchAccountStage(asha.id)).toBe('member');
  expect(await seenBy(ravi, asha.id)).toBe(true);
});

test('a copy of my data is requested once and shows as in progress', async () => {
  await createMember('Isha', { app: true });
  const id = await requestDataCopy();
  expect(await fetchDataRequests()).toEqual([
    expect.objectContaining({ id, kind: 'access', status: 'pending' }),
  ]);
  await expect(requestDataCopy()).rejects.toThrow(
    "You've already asked for a copy.",
  );
});

test('deleting my account hides me at once, and asking twice is fine', async () => {
  const rohan = await createMember('Rohan', { app: true });
  const neha = await createMember('Neha');
  expect(await seenBy(neha, rohan.id)).toBe(true);

  await deleteAccount();
  await deleteAccount();

  expect(await seenBy(neha, rohan.id)).toBe(false);
});
