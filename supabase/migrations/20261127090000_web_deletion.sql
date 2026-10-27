-- The web deletion page (#98, decision 61) signs a person in with the email code and calls
-- delete_account(), now with an optional reason. An account that never accepted the terms has no
-- profile row; it gets a deleted one, so it is purged like any other account.

-- Why people leave, kept apart from the account so it survives the purge and names nobody.
create table public.deletion_reasons (
  id uuid primary key default gen_random_uuid(),
  reason text not null check (reason in ('not_useful', 'no_one_nearby', 'met_someone', 'privacy',
                                         'safety', 'too_many_notifications', 'taking_a_break', 'other')),
  note varchar(500),
  created_at timestamptz not null default now()
);
alter table public.deletion_reasons enable row level security;
-- Admins read them; nobody writes except delete_account().
create policy "Admins read deletion reasons" on public.deletion_reasons
  for select to authenticated using (public.is_admin());

drop function public.delete_account();
create function public.delete_account(reason text default null, note text default null) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;
  update public.profiles set deleted_at = now() where id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'your account is already being deleted';
  end if;
  delete from public.member_locations where user_id = auth.uid();
  insert into public.data_requests (user_id, kind) values (auth.uid(), 'erasure');
  if reason is not null then
    insert into public.deletion_reasons (reason, note) values (reason, nullif(btrim(note), ''));
  end if;
end;
$$;
revoke execute on function public.delete_account(text, text) from public, anon;
grant execute on function public.delete_account(text, text) to authenticated;
