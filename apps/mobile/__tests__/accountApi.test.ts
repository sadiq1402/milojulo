import {
  deleteAccount,
  fetchAccountStage,
  fetchDataRequests,
  fetchMyConsents,
  requestDataCopy,
  withdrawConsent,
} from '../src/features/account/api';
import { supabase } from '../src/lib/supabase';

// jest.setup.js stands Supabase in with an empty object; give it what each call needs.
const stub = supabase as unknown as { rpc: jest.Mock; from: jest.Mock };
const rpc = jest.fn();
stub.rpc = rpc;

const connectionCopy = "That didn't work. Check your connection and try again.";

// A query builder whose every step returns itself and which resolves to the given result.
function query(result: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(result);
  const builder: Record<string, jest.Mock> = {
    then: jest.fn(promise.then.bind(promise)),
  };
  for (const step of ['select', 'eq', 'order', 'maybeSingle']) {
    builder[step] = jest.fn(() => builder);
  }
  return builder;
}

describe('account stage', () => {
  function tables(profile: unknown, consents: unknown[]) {
    stub.from = jest.fn((table: string) =>
      table === 'profiles'
        ? query({ data: profile, error: null })
        : query({ data: consents, error: null }),
    );
  }

  test('a Member who withdrew a consent goes back to accept it again', async () => {
    tables({ date_of_birth: '1998-03-21', submitted_at: '2026-10-01' }, [
      { withdrawn_at: null },
      { withdrawn_at: '2026-10-16T10:00:00Z' },
    ]);
    await expect(fetchAccountStage('u1')).resolves.toBe('reconsent');
  });

  test('a Member with every consent standing stays a Member', async () => {
    tables({ date_of_birth: '1998-03-21', submitted_at: '2026-10-01' }, [
      { withdrawn_at: null },
    ]);
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(fetchAccountStage('u1')).resolves.toBe('member');
    expect(rpc).toHaveBeenCalledWith('needs_reconsent', undefined);
  });

  test('a Member who accepted an older notice version accepts the new one', async () => {
    tables({ date_of_birth: '1998-03-21', submitted_at: '2026-10-01' }, [
      { withdrawn_at: null },
    ]);
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(fetchAccountStage('u1')).resolves.toBe('updatedNotice');
  });

  test('an account with no profile row yet gives age and consent first', async () => {
    tables(null, []);
    await expect(fetchAccountStage('u1')).resolves.toBe('consent');
  });
});

describe('consents', () => {
  test('lists my consents in document order with what each is', async () => {
    const builder = query({
      data: [
        {
          document_id: 'd3',
          accepted_at: '2026-10-01',
          withdrawn_at: null,
          consent_documents: { kind: 'data_notice', version: '1' },
        },
        {
          document_id: 'd1',
          accepted_at: '2026-10-01',
          withdrawn_at: null,
          consent_documents: { kind: 'terms', version: '2' },
        },
      ],
      error: null,
    });
    stub.from = jest.fn(() => builder);
    await expect(fetchMyConsents()).resolves.toEqual([
      {
        documentId: 'd1',
        kind: 'terms',
        version: '2',
        acceptedAt: '2026-10-01',
        withdrawnAt: null,
      },
      {
        documentId: 'd3',
        kind: 'data_notice',
        version: '1',
        acceptedAt: '2026-10-01',
        withdrawnAt: null,
      },
    ]);
    expect(stub.from).toHaveBeenCalledWith('consents');
  });

  test('a failed load says so', async () => {
    stub.from = jest.fn(() => query({ data: null, error: { message: 'x' } }));
    await expect(fetchMyConsents()).rejects.toThrow("We couldn't load this.");
  });

  test('withdraw_consent(document_id)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await withdrawConsent('d1');
    expect(rpc).toHaveBeenCalledWith('withdraw_consent', { document_id: 'd1' });
  });

  test('a consent already withdrawn says so', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'no consent to withdraw' },
    });
    await expect(withdrawConsent('d1')).rejects.toThrow(
      "You've already withdrawn this consent.",
    );
  });

  test('another failure reads as the connection', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(withdrawConsent('d1')).rejects.toThrow(connectionCopy);
  });
});

describe('a copy of my data', () => {
  test('request_data_copy() returns the new request', async () => {
    rpc.mockResolvedValue({ data: 'r1', error: null });
    await expect(requestDataCopy()).resolves.toBe('r1');
    expect(rpc).toHaveBeenCalledWith('request_data_copy');
  });

  test('a request already in progress says so', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'you already have a data copy request in progress' },
    });
    await expect(requestDataCopy()).rejects.toThrow(
      "You've already asked for a copy. We'll email it to you when it's ready.",
    );
  });

  test('lists my requests newest first', async () => {
    const builder = query({
      data: [
        {
          id: 'r1',
          kind: 'access',
          status: 'pending',
          created_at: '2026-10-16',
          completed_at: null,
        },
      ],
      error: null,
    });
    stub.from = jest.fn(() => builder);
    await expect(fetchDataRequests()).resolves.toEqual([
      {
        id: 'r1',
        kind: 'access',
        status: 'pending',
        createdAt: '2026-10-16',
        completedAt: null,
      },
    ]);
    expect(stub.from).toHaveBeenCalledWith('data_requests');
    expect(builder.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
  });
});

describe('deleting the account', () => {
  test('delete_account()', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await deleteAccount();
    expect(rpc).toHaveBeenCalledWith('delete_account');
  });

  // Asking twice ends the same way: the account goes and the Member is signed out.
  test('an account already being deleted counts as done', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'your account is already being deleted' },
    });
    await expect(deleteAccount()).resolves.toBeUndefined();
  });

  test('another failure reads as the connection', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(deleteAccount()).rejects.toThrow(connectionCopy);
  });
});
