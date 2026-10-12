import type { Database } from '../lib/database.types';

export type Mode = Database['public']['Enums']['mode'];

export const modeLabels: Record<Mode, string> = {
  friends: 'Friends',
  activities: 'Activities',
  dating: 'Dating',
  serious: 'Serious',
  casual: 'Casual',
  networking: 'Networking',
};
