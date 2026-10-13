import { supabase } from '../src/lib/supabase';
import { fetchAccountStage } from '../src/features/account/api';
import {
  acceptConsents,
  fetchConsentDocuments,
  type ConsentDocuments,
} from '../src/features/consents/api';
import { signOut } from '../src/features/auth/api';
import { signInNewAccount } from './support/signIn';

afterAll(() => signOut());

async function hasProfileRow(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  return data !== null;
}

test('a new account starts at consent, with no profile row yet', async () => {
  const userId = await signInNewAccount();
  expect(await fetchAccountStage(userId)).toBe('consent');
  expect(await hasProfileRow(userId)).toBe(false);
});

describe('date of birth and consents', () => {
  test('the current Terms, Community Guidelines and data notice are listed', async () => {
    await signInNewAccount();
    const docs = await fetchConsentDocuments();
    expect(Object.keys(docs).sort()).toEqual([
      'data_notice',
      'guidelines',
      'terms',
    ]);
  });

  test('accepting them with an adult date of birth creates the profile and moves on to profile setup', async () => {
    const userId = await signInNewAccount();
    await acceptConsents('1998-03-21', await fetchConsentDocuments());
    expect(await hasProfileRow(userId)).toBe(true);
    expect(await fetchAccountStage(userId)).toBe('profile');
  });

  test('someone under 18 is refused with friendly copy, gets no profile and stays at consent', async () => {
    const userId = await signInNewAccount();
    const fifteenYearsAgo = new Date(Date.now() - 15 * 365 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    await expect(
      acceptConsents(fifteenYearsAgo, await fetchConsentDocuments()),
    ).rejects.toThrow('You need to be 18 or older to use MiloJulo.');
    expect(await hasProfileRow(userId)).toBe(false);
    expect(await fetchAccountStage(userId)).toBe('consent');
  });

  test('leaving a document out is refused with friendly copy', async () => {
    const userId = await signInNewAccount();
    const { terms, guidelines } = await fetchConsentDocuments();
    await expect(
      acceptConsents('1998-03-21', {
        terms,
        guidelines,
      } as ConsentDocuments),
    ).rejects.toThrow(
      'Please accept the Terms, Community Guidelines and data notice to continue.',
    );
    expect(await fetchAccountStage(userId)).toBe('consent');
  });
});
