-- One answer per Member about another Member, for an Activity or (activity_id null) their Connection.
create table public.meetup_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  other_user_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete set null,
  did_meet boolean not null,
  keep boolean not null,
  created_at timestamptz not null default now(),
  check (user_id <> other_user_id),
  constraint meetup_feedback_once unique nulls not distinct (user_id, other_user_id, activity_id)
);
create index on public.meetup_feedback (other_user_id);
alter table public.meetup_feedback enable row level security;
revoke all on public.meetup_feedback from anon, authenticated;
grant select on public.meetup_feedback to authenticated;
create policy "owner reads own answers" on public.meetup_feedback for select to authenticated
  using (user_id = auth.uid());
create policy "admins read every answer" on public.meetup_feedback for select to authenticated
  using (public.is_admin());

-- Internal: whether the member may answer about the other at all (reachable, no Block either way); shared by
-- submit_meetup_feedback() and the pending list.
create function public.can_give_feedback_about(member_id uuid, other_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select public.is_reachable(other_id) and not public.is_blocked(member_id, other_id);
$$;
revoke execute on function public.can_give_feedback_about(uuid, uuid) from public, anon, authenticated;

-- Internal (no app role may call it): the member's pairs from Activities that ran (open past their end,
-- or expired; never cancelled or removed): host with each accepted, non-withdrawn joiner, either way round.
create function public.activity_feedback_pairs(member_id uuid)
returns table (other_user_id uuid, activity_id uuid, activity_title varchar, ends_at timestamptz)
language sql stable
set search_path = ''
as $$
  select case when a.host_id = member_id then r.requester_id else a.host_id end, a.id, a.title,
         public.activity_ends_at(a)
  from public.activities a
  join public.activity_requests r on r.activity_id = a.id and r.status = 'accepted'
  where (a.host_id = member_id or r.requester_id = member_id)
    and a.status in ('open', 'expired')
    and public.can_give_feedback_about(member_id,
          case when a.host_id = member_id then r.requester_id else a.host_id end)
    and public.activity_ends_at(a) <= now();
$$;
revoke execute on function public.activity_feedback_pairs(uuid) from public, anon, authenticated;

create function public.submit_meetup_feedback(other_user uuid, did_meet boolean, keep boolean,
  activity uuid default null) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not public.can_give_feedback_about(me, other_user)
     or activity is not null and not exists (select 1 from public.activity_feedback_pairs(me) p
                                          where p.other_user_id = other_user and p.activity_id = activity)
     -- Accepted at some point: still accepted, or closed after it was (a waiting request closed by a Block never was).
     or activity is null and not exists (select 1 from public.connections c
                                          where least(c.requester_id, c.addressee_id) = least(me, other_user)
                                            and greatest(c.requester_id, c.addressee_id) = greatest(me, other_user)
                                            and (c.status = 'accepted' or c.status = 'closed' and c.responded_at is not null))
  then
    raise exception 'no one to give feedback about';
  end if;
  insert into public.meetup_feedback (user_id, other_user_id, activity_id, did_meet, keep)
  values (me, other_user, activity, submit_meetup_feedback.did_meet, submit_meetup_feedback.keep)
  on conflict on constraint meetup_feedback_once do nothing;
  if not found then
    raise exception 'you already answered';
  end if;
end;
$$;
revoke execute on function public.submit_meetup_feedback(uuid, boolean, boolean, uuid) from public, anon;

-- The caller's Activity pairs waiting for an answer: ended 2 hours to 14 days ago, newest first.
create function public.pending_meetup_feedback()
returns table (other_user_id uuid, display_name varchar, cover_photo_id uuid, activity_id uuid,
               activity_title varchar, ends_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select p.other_user_id, pr.display_name, public.cover_photo_id(p.other_user_id), p.activity_id,
         p.activity_title, p.ends_at
  from public.activity_feedback_pairs(auth.uid()) p
  join public.profiles pr on pr.id = p.other_user_id
  where p.ends_at <= now() - interval '2 hours'
    and p.ends_at >= now() - interval '14 days'
    and not exists (select 1 from public.meetup_feedback f
                    where f.user_id = auth.uid() and f.other_user_id = p.other_user_id
                      and f.activity_id = p.activity_id)
  order by p.ends_at desc, p.other_user_id;
$$;
revoke execute on function public.pending_meetup_feedback() from public, anon;

-- Kept Connections for the North Star metric, admins only: each pair of people once, by any route (an Activity
-- or chat) on which both answered met and keep; kept_at is the earliest time that held on a route.
create function public.kept_connections(since timestamptz)
returns table (user_a uuid, user_b uuid, kept_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select a.user_id, a.other_user_id, min(greatest(a.created_at, b.created_at)) as kept_at
  from public.meetup_feedback a
  join public.meetup_feedback b
    on b.user_id = a.other_user_id and b.other_user_id = a.user_id
   and b.activity_id is not distinct from a.activity_id
  where public.is_admin()
    and a.user_id < a.other_user_id
    and a.did_meet and a.keep and b.did_meet and b.keep
  group by a.user_id, a.other_user_id
  having min(greatest(a.created_at, b.created_at)) >= since
  order by kept_at desc;
$$;
revoke execute on function public.kept_connections(timestamptz) from public, anon;
