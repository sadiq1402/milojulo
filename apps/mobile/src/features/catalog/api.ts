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

export type CatalogItem<Id> = { id: Id; label: string };

// The lists profile setup offers, in display order; retired entries are left out.
export async function fetchAreaList(): Promise<CatalogItem<string>[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('id, name')
    .eq('is_active', true)
    .order('name');
  if (error) {
    throw error;
  }
  return data.map(area => ({ id: area.id, label: area.name }));
}

export async function fetchTagList(): Promise<CatalogItem<number>[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('id, label')
    .eq('is_active', true)
    .order('sort_order');
  if (error) {
    throw error;
  }
  return data;
}

export async function fetchPromptQuestionList(): Promise<
  CatalogItem<number>[]
> {
  const { data, error } = await supabase
    .from('prompt_questions')
    .select('id, text')
    .eq('is_active', true)
    .order('sort_order');
  if (error) {
    throw error;
  }
  return data.map(question => ({ id: question.id, label: question.text }));
}

export async function fetchIndustryList(): Promise<CatalogItem<number>[]> {
  const { data, error } = await supabase
    .from('industries')
    .select('id, label')
    .eq('is_active', true)
    .order('sort_order');
  if (error) {
    throw error;
  }
  return data;
}
