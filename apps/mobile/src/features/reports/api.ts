import type { Database } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

export type ReportTarget = Database['public']['Enums']['report_target'];
// word_filter is the database's own reason; Members never choose it.
export type ReportReason = Exclude<
  Database['public']['Enums']['report_reason'],
  'word_filter'
>;

export const reportReasons: { reason: ReportReason; label: string }[] = [
  { reason: 'fake_or_spam', label: 'Fake profile or spam' },
  { reason: 'harassment', label: 'Harassment or unwanted contact' },
  {
    reason: 'inappropriate_content',
    label: 'Inappropriate photos or messages',
  },
  { reason: 'underage', label: 'Seems under 18' },
  { reason: 'felt_unsafe', label: 'I felt unsafe in person' },
  { reason: 'other', label: 'Something else' },
];

export const detailsLimit = 500;

const fallback = "That didn't work. Check your connection and try again.";

// Keys are the database's exact messages.
const refusals: Record<string, string> = {
  'sign in first': 'Sign in again to send a report.',
  'choose a reason': 'Choose a reason for your report.',
  'keep details to 500 characters': 'Keep the details to 500 characters.',
  // Unknown, deleted, own or out-of-reach target; the copy never says which.
  'nothing to report': "This isn't available to report any more.",
};

export async function reportContent({
  targetType,
  targetId,
  reason,
  details,
}: {
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details?: string;
}): Promise<void> {
  const trimmed = details?.trim();
  const { error } = await supabase.rpc('report', {
    target_type: targetType,
    target_id: targetId,
    reason,
    ...(trimmed ? { details: trimmed } : {}),
  });
  if (error) {
    throw new Error(refusals[error.message] ?? fallback);
  }
}
