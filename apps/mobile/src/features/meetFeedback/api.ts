import { supabase } from '../../lib/supabase';

const fallback = "That didn't work. Check your connection and try again.";
const couldNotLoad =
  "We couldn't load this. Check your connection and try again.";

const refusals: Record<string, string> = {
  // Not eligible, unknown, self or blocked; the copy never says which.
  'no one to give feedback about':
    "You can't answer about this person any more.",
};

// An answer already stands (perhaps from another phone), so there's nothing left to do.
export class AlreadyAnsweredError extends Error {
  constructor() {
    super("You've already answered about this one.");
  }
}

// Without an Activity, the answer is about the pair's chat ("We met").
export type MeetAnswer = {
  otherUserId: string;
  activityId?: string;
  didMeet: boolean;
  keep: boolean;
};

export async function submitMeetFeedback({
  otherUserId,
  activityId,
  didMeet,
  keep,
}: MeetAnswer): Promise<void> {
  const { error } = await supabase.rpc('submit_meetup_feedback', {
    other_user: otherUserId,
    ...(activityId ? { activity: activityId } : {}),
    did_meet: didMeet,
    keep,
  });
  if (error?.message === 'you already answered') {
    throw new AlreadyAnsweredError();
  }
  if (error) {
    throw new Error(refusals[error.message] ?? fallback);
  }
}

export type PendingFeedback = {
  otherUserId: string;
  otherName: string;
  coverPhotoId: string | null;
  activityId: string;
  activityTitle: string;
  endsAt: string;
};

// RLS shows a Member only their own answers, so this is "have I said We met about them".
export async function hasAnswered(otherUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('meetup_feedback')
    .select('id')
    .eq('other_user_id', otherUserId)
    .is('activity_id', null)
    .limit(1);
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.length > 0;
}

// Activities that ended 2 hours to 14 days ago, with each person the caller hasn't answered about.
export async function fetchPendingFeedback(): Promise<PendingFeedback[]> {
  const { data, error } = await supabase.rpc('pending_meetup_feedback');
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.map(row => ({
    otherUserId: row.other_user_id,
    otherName: row.display_name,
    coverPhotoId: row.cover_photo_id,
    activityId: row.activity_id,
    activityTitle: row.activity_title,
    endsAt: row.ends_at,
  }));
}
