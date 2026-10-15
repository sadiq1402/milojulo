import type { Database } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import type { ConsentKind } from '../consents/api';
import { couldNotLoad } from '../me/api';

// The step a signed-in account is at: give age and consents, accept a withdrawn consent again,
// build a profile, or a Member.
export type AccountStage = 'consent' | 'reconsent' | 'profile' | 'member';

export async function fetchAccountStage(userId: string): Promise<AccountStage> {
  const { data, error } = await supabase
    .from('profiles')
    .select('date_of_birth, submitted_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  // accept_consents creates the profile row, so a new account has none yet.
  if (!data?.date_of_birth) {
    return 'consent';
  }
  const consents = await supabase
    .from('consents')
    .select('withdrawn_at')
    .eq('user_id', userId);
  if (consents.error) {
    throw consents.error;
  }
  // Every consent is required, so one withdrawn hides the Member until they accept again.
  if (consents.data.some(row => row.withdrawn_at)) {
    return 'reconsent';
  }
  return data.submitted_at ? 'member' : 'profile';
}

export type MyConsent = {
  documentId: string;
  kind: ConsentKind;
  version: string;
  acceptedAt: string;
  withdrawnAt: string | null;
};

export type DataRequest = {
  id: string;
  kind: Database['public']['Enums']['data_request_kind'];
  status: Database['public']['Enums']['data_request_status'];
  createdAt: string;
  completedAt: string | null;
};

const fallback = "That didn't work. Check your connection and try again.";

const friendly: Record<string, string> = {
  'no consent to withdraw': "You've already withdrawn this consent.",
  'you already have a data copy request in progress':
    "You've already asked for a copy. We'll email it to you within 30 days.",
};

const refusal = (message: string) => new Error(friendly[message] ?? fallback);

const kindOrder: ConsentKind[] = ['terms', 'guidelines', 'data_notice'];

export async function fetchMyConsents(): Promise<MyConsent[]> {
  const { data, error } = await supabase
    .from('consents')
    .select(
      'document_id, accepted_at, withdrawn_at, consent_documents (kind, version)',
    );
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data
    .map(row => ({
      documentId: row.document_id,
      kind: row.consent_documents.kind,
      version: row.consent_documents.version,
      acceptedAt: row.accepted_at,
      withdrawnAt: row.withdrawn_at,
    }))
    .sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind));
}

export async function withdrawConsent(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_consent', {
    document_id: documentId,
  });
  if (error) {
    throw refusal(error.message);
  }
}

export async function requestDataCopy(): Promise<string> {
  const { data, error } = await supabase.rpc('request_data_copy');
  if (error) {
    throw refusal(error.message);
  }
  return data;
}

export async function fetchDataRequests(): Promise<DataRequest[]> {
  const { data, error } = await supabase
    .from('data_requests')
    .select('id, kind, status, created_at, completed_at')
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.map(row => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}

// Deleting twice ends the same way, so "already being deleted" counts as done.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error && error.message !== 'your account is already being deleted') {
    throw new Error(fallback);
  }
}
