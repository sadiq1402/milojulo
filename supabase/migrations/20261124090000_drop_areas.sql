-- #203 (decision 66), last step: nothing reads the Area catalog any more, so it goes,
-- along with the one piece of seeded copy that still named Pune.

drop table public.areas;

-- Answers keep their question id; only the wording changes.
update public.prompt_questions
set text = 'A perfect Sunday is…'
where text = 'A perfect Sunday in Pune is…';
