import { supabase } from '../../lib/supabase';

// Area id → display name ("baner" → "Baner").
export async function fetchAreaNames(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('areas').select('id, name');
  if (error) {
    throw error;
  }
  return Object.fromEntries(data.map(area => [area.id, area.name]));
}

// Tag id → label (3 → "Trekking").
export async function fetchTagNames(): Promise<Record<number, string>> {
  const { data, error } = await supabase.from('tags').select('id, label');
  if (error) {
    throw error;
  }
  return Object.fromEntries(data.map(tag => [tag.id, tag.label]));
}

// Prompt question id → its text ("A perfect Sunday in Pune is…").
export async function fetchPromptQuestions(): Promise<Record<number, string>> {
  const { data, error } = await supabase
    .from('prompt_questions')
    .select('id, text');
  if (error) {
    throw error;
  }
  return Object.fromEntries(data.map(question => [question.id, question.text]));
}
