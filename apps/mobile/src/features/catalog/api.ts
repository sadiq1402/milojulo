import { supabase } from '../../lib/supabase';

// One catalog entry in display order. Retired entries stay so other Members' old choices keep
// their names; pickers offer only the active ones.
export type CatalogItem<Id> = { id: Id; label: string; active: boolean };

type Row<Id> = { id: Id; label: string; is_active: boolean };

async function list<Id>(
  request: PromiseLike<{ data: Row<Id>[] | null; error: unknown }>,
): Promise<CatalogItem<Id>[]> {
  const { data, error } = await request;
  if (error) {
    throw error;
  }
  return data!.map(row => ({
    id: row.id,
    label: row.label,
    active: row.is_active,
  }));
}

export const fetchTags = () =>
  list<number>(
    supabase.from('tags').select('id, label, is_active').order('sort_order'),
  );

export const fetchPromptQuestions = () =>
  list<number>(
    supabase
      .from('prompt_questions')
      .select('id, label:text, is_active')
      .order('sort_order'),
  );

export const fetchIndustries = () =>
  list<number>(
    supabase
      .from('industries')
      .select('id, label, is_active')
      .order('sort_order'),
  );
