import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

export type ConsentKind = Database['public']['Enums']['consent_kind'];
export type ConsentDocument = { id: string; url: string | null };
export type ConsentDocuments = Record<ConsentKind, ConsentDocument>;

// The version of each document in force now; all three must be accepted together.
export async function fetchConsentDocuments(): Promise<ConsentDocuments> {
  const { data, error } = await supabase
    .from('consent_documents')
    .select('id, kind, url')
    .lte('effective_at', new Date().toISOString())
    .order('effective_at', { ascending: false });
  if (error) {
    throw error;
  }
  const current: Partial<ConsentDocuments> = {};
  for (const doc of data) {
    current[doc.kind] ??= { id: doc.id, url: doc.url };
  }
  return current as ConsentDocuments;
}

const friendly: Record<string, string> = {
  'members must be 18 or older': 'You need to be 18 or older to use MiloJulo.',
  'accept the current terms, guidelines and data notice':
    'Please accept the Terms, Community Guidelines and data notice to continue.',
};

// birthDate is YYYY-MM-DD; the database judges 18+ by the calendar date in India.
export async function acceptConsents(
  birthDate: string,
  documents: ConsentDocuments,
): Promise<void> {
  const { error } = await supabase.rpc('accept_consents', {
    birth_date: birthDate,
    document_ids: Object.values(documents).map(doc => doc.id),
  });
  if (error) {
    throw new Error(friendly[error.message] ?? error.message);
  }
}
