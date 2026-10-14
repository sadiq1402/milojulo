import { supabase } from '../../lib/supabase';
import { toBoardActivity } from '../activities/api';
import type { BoardActivity } from '../activities/model';
import type { Circle, CircleMember } from './model';

export const couldNotLoad =
  "We couldn't load this. Check your connection and try again.";
const fallback = "That didn't work. Check your connection and try again.";

// Keys are the database's exact messages.
const joinRefusals: Record<string, string> = {
  'your profile is not visible':
    "Your profile isn't visible right now, so you can't join Circles.",
  // Unknown or archived Circle; the copy never says which.
  'no circle to join': "This Circle isn't available any more.",
};

const leaveRefusals: Record<string, string> = {
  'you are not in this circle': "You're not a member of this Circle.",
};

function refusal(error: { message: string }, table: Record<string, string>) {
  return new Error(table[error.message] ?? fallback);
}

// Active Circles, visible caller only (empty otherwise); joined ones first, then by name.
export async function fetchCircles(): Promise<Circle[]> {
  const { data, error } = await supabase.rpc('browse_circles');
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.map(toCircle);
}

// Null when the Circle isn't mine to see (unknown, archived to a non-member).
export async function fetchCircle(circleId: string): Promise<Circle | null> {
  const { data, error } = await supabase.rpc('get_circle', {
    circle_id: circleId,
  });
  if (error) {
    throw new Error(couldNotLoad);
  }
  const row = data[0];
  return row ? toCircle(row) : null;
}

// Fellow Circle members; empty unless the caller is a member of that Circle.
export async function fetchCircleMembers(
  circleId: string,
): Promise<CircleMember[]> {
  const { data, error } = await supabase.rpc('circle_members_of', {
    circle_id: circleId,
  });
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.map(row => ({
    id: row.member_id,
    name: row.display_name,
    coverPhotoId: row.cover_photo_id ?? null,
    areaId: row.area_id ?? null,
  }));
}

// The Circle's upcoming Activities, same shape and rules as the board, soonest first.
export async function fetchCircleActivities(
  circleId: string,
): Promise<BoardActivity[]> {
  const { data, error } = await supabase.rpc('circle_activities', {
    circle_id: circleId,
  });
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.map(toBoardActivity);
}

// Idempotent: already a member is fine.
export async function joinCircle(circleId: string): Promise<void> {
  const { error } = await supabase.rpc('join_circle', { circle_id: circleId });
  if (error) {
    throw refusal(error, joinRefusals);
  }
}

// Leaving does not touch the Member's posted Activities.
export async function leaveCircle(circleId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_circle', { circle_id: circleId });
  if (error) {
    throw refusal(error, leaveRefusals);
  }
}

type CircleRow = {
  circle_id: string;
  name: string;
  area_id: string;
  tag_id: number;
  description: string | null;
  member_count: number;
  i_am_member: boolean;
};

function toCircle(row: CircleRow): Circle {
  return {
    id: row.circle_id,
    name: row.name,
    areaId: row.area_id,
    tagId: row.tag_id,
    description: row.description ?? null,
    memberCount: row.member_count,
    iAmMember: row.i_am_member,
  };
}
