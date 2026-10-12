import { fetchAccountStage } from '../src/features/account/api';
import {
  acceptConsents,
  fetchConsentDocuments,
} from '../src/features/consents/api';
import { signOut } from '../src/features/auth/api';
import { checkInvite, redeemInvite } from '../src/features/invite/api';
import { createInvite } from './support/admin';
import { signInNewAccount, uniqueCode } from './support/signIn';

afterAll(() => signOut());

describe('checking an invite code before sign-in', () => {
  test('a code with uses left passes', async () => {
    const code = uniqueCode('valid');
    await createInvite(code);
    expect(await checkInvite(code)).toBe(true);
  });

  test('an unknown, used-up or expired code does not', async () => {
    const usedUp = uniqueCode('used');
    const expired = uniqueCode('expired');
    await createInvite(usedUp, { usesLeft: 0 });
    await createInvite(expired, { expiresAt: '2020-01-01T00:00:00Z' });
    expect(await checkInvite(uniqueCode('unknown'))).toBe(false);
    expect(await checkInvite(usedUp)).toBe(false);
    expect(await checkInvite(expired)).toBe(false);
  });

  test('surrounding spaces from a pasted code are ignored', async () => {
    const code = uniqueCode('spaced');
    await createInvite(code);
    expect(await checkInvite(`  ${code} `)).toBe(true);
  });
});

describe('redeeming the invite after sign-in', () => {
  test('a new account starts at the invite step and moves on to consent once it redeems', async () => {
    const code = uniqueCode('redeem');
    await createInvite(code);
    const userId = await signInNewAccount();
    expect(await fetchAccountStage(userId)).toBe('invite');

    await redeemInvite(code);
    expect(await fetchAccountStage(userId)).toBe('consent');
  });

  test('redeeming again after a retry is harmless', async () => {
    const code = uniqueCode('twice');
    await createInvite(code);
    await signInNewAccount();
    await redeemInvite(code);
    await expect(redeemInvite(code)).resolves.toBeUndefined();
  });

  test('a code used up since it was checked is refused with friendly copy', async () => {
    const code = uniqueCode('gone');
    await createInvite(code, { usesLeft: 0 });
    await signInNewAccount();
    await expect(redeemInvite(code)).rejects.toThrow(
      "This invite code doesn't work. It may be mistyped, used up or expired.",
    );
  });
});

describe('date of birth and consents', () => {
  async function redeemedAccount() {
    const code = uniqueCode('consent');
    await createInvite(code);
    const userId = await signInNewAccount();
    await redeemInvite(code);
    return userId;
  }

  test('the current Terms, Community Guidelines and data notice are listed', async () => {
    await redeemedAccount();
    const docs = await fetchConsentDocuments();
    expect(Object.keys(docs).sort()).toEqual([
      'data_notice',
      'guidelines',
      'terms',
    ]);
  });

  test('accepting them with an adult date of birth moves on to profile setup', async () => {
    const userId = await redeemedAccount();
    await acceptConsents('1998-03-21', await fetchConsentDocuments());
    expect(await fetchAccountStage(userId)).toBe('profile');
  });

  test('someone under 18 is refused with friendly copy and stays at consent', async () => {
    const userId = await redeemedAccount();
    const fifteenYearsAgo = new Date(Date.now() - 15 * 365 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    await expect(
      acceptConsents(fifteenYearsAgo, await fetchConsentDocuments()),
    ).rejects.toThrow('You need to be 18 or older to use MiloJulo.');
    expect(await fetchAccountStage(userId)).toBe('consent');
  });
});
