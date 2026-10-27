import type { Database } from '../../lib/database.types';

// What the Activity screens share; kept apart from api.ts so tests can mock the calls alone.
export type ActivityType = Database['public']['Enums']['activity_type'];
export type ActivityStatus = Database['public']['Enums']['activity_status'];
// Bucketed by the database in India time (an Activity still running counts as tonight); the
// phone never works it out.
export type StartsWhen = 'tonight' | 'this_weekend' | 'later';

export const activityTypes: ActivityType[] = [
  'sports',
  'food_chai',
  'outdoors',
  'games',
  'learning',
];

export const activityTypeLabels: Record<ActivityType, string> = {
  sports: 'Sports',
  food_chai: 'Food & chai',
  outdoors: 'Outdoors',
  games: 'Games',
  learning: 'Learning',
};

export const startsWhenLabels: Record<StartsWhen, string> = {
  tonight: 'Tonight',
  this_weekend: 'This weekend',
  later: 'Later',
};

export const titleMaxLength = 60;
export const descriptionMaxLength = 300;
export const venueMaxLength = 200;
export const minSpots = 1;
export const maxSpots = 20;

export type BoardActivity = {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  type: ActivityType;
  // How far it is from me, as a band like `~3 km`; null when I have no fresh location.
  distanceBand: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  spotsLeft: number;
  description: string | null;
  startsWhen: StartsWhen;
  isMine: boolean;
  // The Circle this Activity was posted to; the name is null when that Circle is archived,
  // so the label drops but the Activity stays (CONTEXT: an archived Circle disappears).
  circleId: string | null;
  circleName: string | null;
  // The host's cover photo; its link is asked for separately.
  hostPhotoId: string | null;
};

export type JoinRequestStatus = Database['public']['Enums']['request_status'];

// On the Joined screen: accepted shows under Going, requested under Waiting.
export type JoinedActivity = BoardActivity & {
  requestStatus: Extract<JoinRequestStatus, 'accepted' | 'requested'>;
};

// On the board until `visibleUntil`, the end the database hides it at.
export type BoardListing = BoardActivity & { visibleUntil: string };

export type Activity = BoardActivity & {
  status: ActivityStatus;
  // Only the host and accepted joiners get it.
  venueDetail: string | null;
  // Someone has joined: only the description and a higher number of Spots can change.
  isLocked: boolean;
  // My one Join Request for it, whatever became of it; null when I never asked.
  myRequest: { id: string; status: JoinRequestStatus } | null;
  // The Activity Connection with the host, while my request stands accepted.
  connectionId: string | null;
};

// A request to the host's own Activity: waiting ones and accepted joiners, oldest first.
export type JoinRequest = {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterPhotoId: string | null;
  status: JoinRequestStatus;
  createdAt: string;
  connectionId: string | null;
};

// A waiting Join Request, to one of my Activities (incoming) or from me (outgoing).
export type MyJoinRequest = {
  id: string;
  activityId: string;
  activityTitle: string;
  activityStartsAt: string;
  otherId: string;
  otherName: string;
  otherPhotoId: string | null;
  direction: Database['public']['Enums']['connection_direction'];
  createdAt: string;
};

// No place: an Activity is placed where the host is when posting, and never moves.
export type ActivityFields = {
  title: string;
  type: ActivityType;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  description: string;
  venueDetail: string;
  // Set when posting from a Circle; the host must be a member of it.
  circleId: string | null;
};

// Leave a field out to keep it; an empty description or venue clears it.
export type ActivityChanges = Partial<Omit<ActivityFields, 'type'>>;

export type ActivityField =
  | 'title'
  | 'type'
  | 'startsAt'
  | 'endsAt'
  | 'capacity'
  | 'description'
  | 'venueDetail';

// A refusal the form can show under the field it's about; with no field, above the button.
export class ActivityError extends Error {
  constructor(message: string, readonly field?: ActivityField) {
    super(message);
  }
}

export type BoardSection = { when: StartsWhen; activities: BoardActivity[] };

// Tonight, This weekend, Later; empty groups left out. Within a group the server's order
// stands (start day, then nearest, then start time).
export function groupBoard(activities: BoardActivity[]): BoardSection[] {
  const order: StartsWhen[] = ['tonight', 'this_weekend', 'later'];
  return order
    .map(when => ({
      when,
      activities: activities.filter(a => a.startsWhen === when),
    }))
    .filter(section => section.activities.length > 0);
}

export function spotsLeftLabel(spotsLeft: number): string {
  if (spotsLeft <= 0) {
    return 'Full';
  }
  return spotsLeft === 1 ? '1 spot left' : `${spotsLeft} spots left`;
}

// Field errors the form finds itself, worded like the database's refusals.
export const fieldMessages = {
  title: 'Give your Activity a title.',
  type: 'Pick a type.',
  startsAt: 'Pick a start time that is still to come.',
  endsAt: 'The end has to be after the start.',
  capacity: `Spots must be between ${minSpots} and ${maxSpots}.`,
} as const;

// Google Maps searches the venue text the host typed, as is.
export function directionsUrl(venue: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    venue,
  )}`;
}

export function hostLine(activity: Pick<BoardActivity, 'isMine' | 'hostName'>) {
  return activity.isMine ? 'Hosted by you' : `Hosted by ${activity.hostName}`;
}
