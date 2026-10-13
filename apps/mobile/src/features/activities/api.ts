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
  type JoinRequest,
  type MyJoinRequest,
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
    myRequest: row.my_request_id
      ? { id: row.my_request_id, status: row.my_request_status }
      : null,
    connectionId: row.connection_id ?? null,
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

// Keys are the database's exact messages; kept apart from `refusals`, which words the shared
// ones ("your profile is not visible") for posting. "no activity to join" also covers a Block,
// so its copy never mentions one.
const joinRefusals: Record<string, string> = {
  'unpause your profile to join activities':
    'Your profile is paused. Unpause it to join Activities.',
  'your profile is not visible':
    "Your profile isn't visible right now, so you can't join Activities.",
  'no activity to join': "This Activity isn't open to join any more.",
  'you cannot join your own activity': "You're hosting this Activity.",
  'this activity has already started': 'This Activity has already started.',
  'you already asked to join this activity':
    "You've already asked to join this Activity.",
  'no spots left': 'There are no spots left on this Activity.',
  'you have sent 10 join requests in the last 24 hours':
    "You've sent 10 join requests in the last 24 hours, the most allowed. Try again later.",
  'no join request to answer':
    'This join request is no longer waiting for an answer.',
  'no join request to withdraw':
    "This join request can't be cancelled or withdrawn any more.",
};

function joinRefusal(error: { message: string }): Error {
  return new Error(joinRefusals[error.message] ?? fallback);
}

// Returns the new Join Request's id.
export async function askToJoin(activityId: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_activity_request', {
    activity_id: activityId,
  });
  if (error) {
    throw joinRefusal(error);
  }
  return data;
}

// Accepting returns the Activity Connection's id (a new one, or the pair's existing one);
// declining returns null.
export async function respondJoinRequest(
  requestId: string,
  accept: boolean,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('respond_activity_request', {
    request_id: requestId,
    accept,
  });
  if (error) {
    throw joinRefusal(error);
  }
  return data ?? null;
}

// Cancels a pending request, or withdraws an accepted one; either way it can't be asked again.
export async function withdrawJoinRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_activity_request', {
    request_id: requestId,
  });
  if (error) {
    throw joinRefusal(error);
  }
}

// The host's view; empty for anyone else.
export async function fetchJoinRequests(
  activityId: string,
): Promise<JoinRequest[]> {
  const { data, error } = await supabase.rpc('activity_join_requests', {
    activity_id: activityId,
  });
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.map(row => ({
    id: row.request_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterPhotoId: row.requester_photo_id ?? null,
    requesterAreaId: row.requester_area_id ?? null,
    status: row.status,
    createdAt: row.created_at,
    connectionId: row.connection_id ?? null,
  }));
}

export async function fetchMyJoinRequests(): Promise<MyJoinRequest[]> {
  const { data, error } = await supabase.rpc('my_join_requests');
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.map(row => ({
    id: row.request_id,
    activityId: row.activity_id,
    activityTitle: row.activity_title,
    activityStartsAt: row.activity_starts_at,
    otherId: row.other_id,
    otherName: row.other_name,
    otherPhotoId: row.other_photo_id ?? null,
    direction: row.direction,
    createdAt: row.created_at,
  }));
}
