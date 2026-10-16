import { supabase } from '../../lib/supabase';

export type Platform = 'android' | 'ios';

export type NotificationSettings = { messages: boolean; activities: boolean };

const couldNotLoad =
  "We couldn't load this. Check your connection and try again.";
const fallback = "That didn't work. Check your connection and try again.";

// Only once the account stage is 'member'; before that the database refuses it.
export async function registerDeviceToken(
  token: string,
  platform: Platform,
): Promise<void> {
  const { error } = await supabase.rpc('register_device_token', {
    token,
    platform,
  });
  if (error) {
    throw new Error(error.message);
  }
}

// Must run while still signed in: RLS lets only the owner delete the row.
export async function removeDeviceToken(token: string): Promise<void> {
  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('token', token);
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  const { data, error } = await supabase
    .from('profiles')
    .select('notify_messages, notify_activities')
    .eq('id', userId)
    .single();
  if (error) {
    throw new Error(couldNotLoad);
  }
  return { messages: data.notify_messages, activities: data.notify_activities };
}

export async function saveNotificationSettings(
  userId: string,
  change: Partial<NotificationSettings>,
): Promise<void> {
  const columns: { notify_messages?: boolean; notify_activities?: boolean } =
    {};
  if (change.messages !== undefined) {
    columns.notify_messages = change.messages;
  }
  if (change.activities !== undefined) {
    columns.notify_activities = change.activities;
  }
  const { error } = await supabase
    .from('profiles')
    .update(columns)
    .eq('id', userId);
  if (error) {
    throw new Error(fallback);
  }
}
