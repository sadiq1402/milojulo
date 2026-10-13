import type { Database } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import {
  ActivityError,
  fieldMessages,
  type Activity,
  type ActivityChanges,
  type ActivityField,
  type ActivityFields,
  type BoardActivity,
  type StartsWhen,
} from './model';

type Functions = Database['public']['Functions'];
type BoardRow = Functions['activity_board']['Returns'][number];

export const couldNotLoad =
  "We couldn't load this. Check your connection and try again.";
const fallback = "That didn't work. Check your connection and try again.";

const lockedMessage =
  'Someone has joined, so only the description and more Spots can change now.';

// Keys are the database's exact messages.
const refusals: Record<string, { message: string; field?: ActivityField }> = {
  'unpause your profile to post activities': {
    message: 'Your profile is paused. Unpause it to post Activities.',
  },
  'your profile is not visible': {
    message:
      "Your profile isn't visible right now, so you can't post Activities.",
  },
  'an activity needs a title': { message: fieldMessages.title, field: 'title' },
  'an activity must start in the future': {
    message: fieldMessages.startsAt,
    field: 'startsAt',
  },
  'an activity must end after it starts': {
    message: fieldMessages.endsAt,
    field: 'endsAt',
  },
  'spots must be between 1 and 20': {
    message: fieldMessages.capacity,
    field: 'capacity',
  },
  'no activity to change': {
    message: "This Activity can't be changed any more.",
  },
  // Also what lowering the Spots of a Locked Activity gets.
  'this activity is locked: only its description and a higher number of spots can change':
    { message: lockedMessage },
  'no activity to cancel': {
    message: 'This Activity is already over or cancelled.',
  },
};

function refusal(error: { message: string }): ActivityError {
  const known = refusals[error.message];
  return known
    ? new ActivityError(known.message, known.field)
    : new ActivityError(fallback);
}

// Generated function types drop nullability; description and ends_at can be null.
function toBoardActivity(row: BoardRow): BoardActivity {
  return {
    id: row.id,
    hostId: row.host_id,
    hostName: row.host_name,
    title: row.title,
    type: row.type,
    areaId: row.area_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? null,
    capacity: row.capacity,
    spotsLeft: row.spots_left,
    description: row.description ?? null,
    startsWhen: row.starts_when as StartsWhen,
    isMine: row.is_mine,
  };
}

// Open Activities only; empty when I'm not a Visible Member (Paused, hidden).
export async function fetchBoard(): Promise<BoardActivity[]> {
  const { data, error } = await supabase.rpc('activity_board');
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.map(toBoardActivity);
}

// Null when it isn't mine to see (a blocked host, or not there at all). The host sees their
// own in any status.
export async function fetchActivity(
  activityId: string,
): Promise<Activity | null> {
  const { data, error } = await supabase.rpc('get_activity', {
    activity_id: activityId,
  });
  if (error) {
    throw new Error(couldNotLoad);
  }
  const row = data[0];
  if (!row) {
    return null;
  }
  return {
    ...toBoardActivity(row),
    status: row.status,
    venueDetail: row.venue_detail ?? null,
    isLocked: row.is_locked,
  };
}

const blankToUndefined = (text: string) => text.trim() || undefined;

export async function postActivity(fields: ActivityFields): Promise<string> {
  const { data, error } = await supabase.rpc('post_activity', {
    title: fields.title.trim(),
    type: fields.type,
    area_id: fields.areaId,
    starts_at: fields.startsAt,
    ends_at: fields.endsAt ?? undefined,
    capacity: fields.capacity,
    description: blankToUndefined(fields.description),
    venue_detail: blankToUndefined(fields.venueDetail),
  });
  if (error) {
    throw refusal(error);
  }
  return data;
}

// Fields left out stay as they are; an empty description or venue clears it.
export async function updateActivity(
  activityId: string,
  changes: ActivityChanges,
): Promise<void> {
  const { error } = await supabase.rpc('update_activity', {
    activity_id: activityId,
    title: changes.title?.trim(),
    description: changes.description?.trim(),
    capacity: changes.capacity,
    starts_at: changes.startsAt,
    ends_at: changes.endsAt ?? undefined,
    area_id: changes.areaId,
    venue_detail: changes.venueDetail?.trim(),
  });
  if (error) {
    throw refusal(error);
  }
}

export async function cancelActivity(activityId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_activity', {
    activity_id: activityId,
  });
  if (error) {
    throw refusal(error);
  }
}
