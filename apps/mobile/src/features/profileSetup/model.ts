import type { Database } from '../../lib/database.types';
import type { Mode } from '../modes';

type Enums = Database['public']['Enums'];
export type Gender = Enums['gender'];
export type CareerStage = Enums['career_stage'];
export type AvailabilitySlot = Enums['availability_slot'];

export const setupSteps = [
  'basics',
  'photos',
  'prompts',
  'modes',
  'interests',
] as const;
export type SetupStep = (typeof setupSteps)[number];

export const datingModes: Mode[] = ['dating', 'serious', 'casual'];
export const holdsDatingMode = (modes: Mode[]) =>
  modes.some(mode => datingModes.includes(mode));

export type PromptAnswer = {
  position: 1 | 2;
  questionId: number;
  answer: string;
};

export type Basics = { displayName: string; areaId: string };

export type ModeFields = {
  modes: Mode[];
  gender: Gender | null;
  prefGenders: Gender[];
  prefAgeMin: number | null;
  prefAgeMax: number | null;
  prefMaxKm: number | null;
  profession: string | null;
  industryId: number | null;
  careerStage: CareerStage | null;
};

export type Interests = { tagIds: number[]; availability: AvailabilitySlot[] };

// Everything profile setup edits, as saved so far.
export type ProfileDraft = {
  displayName: string | null;
  areaId: string | null;
  birthDate: string | null;
  prompts: PromptAnswer[];
} & ModeFields &
  Interests;

// A refusal with the step that fixes it, when there is one.
export class SetupError extends Error {
  constructor(message: string, readonly step?: SetupStep) {
    super(message);
  }
}

export const minPhotos = 2;
export const nameMaxLength = 30;
export const answerMaxLength = 140;
export const professionMaxLength = 40;

export function basicsDone(
  draft: Pick<ProfileDraft, 'displayName' | 'areaId'>,
) {
  return !!draft.displayName?.trim() && !!draft.areaId;
}

export function promptsDone(prompts: PromptAnswer[]) {
  return prompts.filter(prompt => prompt.answer.trim()).length >= 2;
}

export function modesDone(fields: ModeFields) {
  if (fields.modes.length === 0) {
    return false;
  }
  if (!holdsDatingMode(fields.modes)) {
    return true;
  }
  return (
    !!fields.gender &&
    fields.prefGenders.length > 0 &&
    fields.prefAgeMin !== null &&
    fields.prefAgeMax !== null &&
    fields.prefMaxKm !== null
  );
}

// Where a returning Member picks up; interests are optional, so the last step is always open.
export function firstIncompleteStep(
  draft: ProfileDraft,
  photoCount: number,
): SetupStep {
  if (!basicsDone(draft)) {
    return 'basics';
  }
  if (photoCount < minPhotos) {
    return 'photos';
  }
  if (!promptsDone(draft.prompts)) {
    return 'prompts';
  }
  if (!modesDone(draft)) {
    return 'modes';
  }
  return 'interests';
}

export const ageLimits = { min: 18, max: 99 };
export const distanceLimits = { min: 5, max: 50, step: 5, default: 15 };

// A starting age range of five years either side of the Member's own age.
export function defaultAgeRange(
  birthDate: string | null,
  today = new Date(),
): { min: number; max: number } {
  if (!birthDate) {
    return { min: ageLimits.min, max: 35 };
  }
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }
  return {
    min: Math.max(ageLimits.min, age - 5),
    max: Math.min(ageLimits.max, age + 5),
  };
}

// Display order of the Modes step (Setup4Modes mockup).
export const modeOptions: { mode: Mode; description: string }[] = [
  { mode: 'friends', description: 'Everyday company and casual hangouts' },
  {
    mode: 'activities',
    description: 'People for badminton, treks, board games',
  },
  { mode: 'networking', description: 'Professional contacts and peers' },
  { mode: 'dating', description: 'Getting to know someone, romantic interest' },
  { mode: 'serious', description: 'Looking for a long-term relationship' },
  {
    mode: 'casual',
    description:
      'Adults only, clearly labelled. Shown only to others who also choose Casual.',
  },
];

export const genderLabels: Record<Gender, string> = {
  woman: 'Woman',
  man: 'Man',
  nonbinary: 'Non-binary',
};

export const prefGenderLabels: Record<Gender, string> = {
  woman: 'Women',
  man: 'Men',
  nonbinary: 'Non-binary people',
};

export const careerStageLabels: Record<CareerStage, string> = {
  student: 'Student',
  early: 'Early career',
  mid: 'Mid career',
  senior: 'Senior',
  founder: 'Founder',
};

export const availabilityLabels: Record<AvailabilitySlot, string> = {
  weekday_evenings: 'Weekday evenings',
  weekends: 'Weekends',
  early_mornings: 'Early mornings',
};
