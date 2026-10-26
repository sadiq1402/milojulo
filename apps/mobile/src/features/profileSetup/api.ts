import type { Database } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { wordFilterCopy, wordFilterRefusal } from '../wordFilter';
import {
  SetupError,
  type Basics,
  type Interests,
  type ModeFields,
  type ProfileDraft,
  type PromptAnswer,
  type SetupStep,
} from './model';

export const couldNotLoad =
  "We couldn't load your profile. Check your connection and try again.";
const fallback = "That didn't save. Check your connection and try again.";

// Keys are the database's exact messages (submit_profile, the minimum guard, the word filter).
const refusals: Record<string, { message: string; step?: SetupStep }> = {
  [wordFilterRefusal]: { message: wordFilterCopy },
  'accept the terms first': {
    message: 'Accept the terms and give your date of birth first.',
  },
  'add your first name': { message: 'Add your first name.', step: 'basics' },
  'choose at least one mode': {
    message: 'Choose at least one Mode.',
    step: 'modes',
  },
  'add your gender': {
    message: 'Add your gender to use Dating, Serious or Casual.',
    step: 'modes',
  },
  'set your dating preferences': {
    message: "Choose who you'd like to meet, their age range and how far away.",
    step: 'modes',
  },
  'answer 2 prompts': { message: 'Answer both prompts.', step: 'prompts' },
  'add at least 2 photos': {
    message: 'Add at least 2 photos.',
    step: 'photos',
  },
};

function refusal(error: { message: string }): SetupError {
  const known = refusals[error.message];
  return known
    ? new SetupError(known.message, known.step)
    : new SetupError(fallback);
}

export async function fetchDraft(userId: string): Promise<ProfileDraft> {
  const [profile, prompts, tags] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'display_name, date_of_birth, modes, availability, gender, pref_genders, pref_age_min, pref_age_max, pref_max_km, profession, industry_id, career_stage',
      )
      .eq('id', userId)
      .single(),
    supabase
      .from('profile_prompts')
      .select('position, question_id, answer')
      .eq('user_id', userId)
      .order('position'),
    supabase.from('profile_tags').select('tag_id').eq('user_id', userId),
  ]);
  if (profile.error || prompts.error || tags.error) {
    throw new Error(couldNotLoad);
  }
  const p = profile.data;
  return {
    displayName: p.display_name,
    birthDate: p.date_of_birth,
    modes: p.modes,
    availability: p.availability,
    gender: p.gender,
    prefGenders: p.pref_genders ?? [],
    prefAgeMin: p.pref_age_min,
    prefAgeMax: p.pref_age_max,
    prefMaxKm: p.pref_max_km,
    profession: p.profession,
    industryId: p.industry_id,
    careerStage: p.career_stage,
    prompts: prompts.data.map(row => ({
      position: row.position as 1 | 2,
      questionId: row.question_id,
      answer: row.answer,
    })),
    tagIds: tags.data.map(row => row.tag_id),
  };
}

async function updateProfile(
  userId: string,
  changes: Database['public']['Tables']['profiles']['Update'],
) {
  const { error } = await supabase
    .from('profiles')
    .update(changes)
    .eq('id', userId);
  if (error) {
    throw refusal(error);
  }
}

export async function saveBasics(userId: string, basics: Basics) {
  await updateProfile(userId, {
    display_name: basics.displayName.trim(),
  });
}

// Update the positions already answered and insert the rest; an upsert would also write
// user_id and position, which Members can't update.
export async function savePrompts(userId: string, prompts: PromptAnswer[]) {
  const { data: existing, error } = await supabase
    .from('profile_prompts')
    .select('position')
    .eq('user_id', userId);
  if (error) {
    throw refusal(error);
  }
  const answered = new Set(existing.map(row => row.position));
  for (const prompt of prompts) {
    const fields = {
      question_id: prompt.questionId,
      answer: prompt.answer.trim(),
    };
    const result = answered.has(prompt.position)
      ? await supabase
          .from('profile_prompts')
          .update(fields)
          .eq('user_id', userId)
          .eq('position', prompt.position)
      : await supabase
          .from('profile_prompts')
          .insert({ ...fields, user_id: userId, position: prompt.position });
    if (result.error) {
      throw refusal(result.error);
    }
  }
}

export async function saveModes(userId: string, fields: ModeFields) {
  await updateProfile(userId, {
    modes: fields.modes,
    gender: fields.gender,
    pref_genders: fields.prefGenders.length ? fields.prefGenders : null,
    pref_age_min: fields.prefAgeMin,
    pref_age_max: fields.prefAgeMax,
    pref_max_km: fields.prefMaxKm,
    profession: fields.profession?.trim() || null,
    industry_id: fields.industryId,
    career_stage: fields.careerStage,
  });
}

export async function saveInterests(userId: string, interests: Interests) {
  await updateProfile(userId, { availability: interests.availability });
  const { data: existing, error } = await supabase
    .from('profile_tags')
    .select('tag_id')
    .eq('user_id', userId);
  if (error) {
    throw refusal(error);
  }
  const had = existing.map(row => row.tag_id);
  const removed = had.filter(id => !interests.tagIds.includes(id));
  const added = interests.tagIds.filter(id => !had.includes(id));
  if (removed.length) {
    const result = await supabase
      .from('profile_tags')
      .delete()
      .eq('user_id', userId)
      .in('tag_id', removed);
    if (result.error) {
      throw refusal(result.error);
    }
  }
  if (added.length) {
    const result = await supabase
      .from('profile_tags')
      .insert(added.map(tag_id => ({ user_id: userId, tag_id })));
    if (result.error) {
      throw refusal(result.error);
    }
  }
}

// Visible at once (no pre-approval); a refusal names the step that fixes it.
export async function submitProfile() {
  const { error } = await supabase.rpc('submit_profile');
  if (error) {
    throw refusal(error);
  }
}
