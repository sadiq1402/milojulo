begin;
\ir helpers/act_as.psql
select plan(6);

insert into public.invite_codes (code, event_tag, uses_left, expires_at)
values ('CHAI-BANER', 'baner-chai-meetup', 5, now() + interval '30 days'),
       ('USED-UP', 'wakad-trek', 0, now() + interval '30 days'),
       ('LAST-WEEK', 'kharadi-games', 5, now() - interval '1 day');

select pg_temp.act_as_anon();
select is(public.check_invite('CHAI-BANER'), true, 'a signed-out visitor sees a live invite code as valid');

select is(public.check_invite('USED-UP'), false, 'a code with no uses left is invalid');
select is(public.check_invite('LAST-WEEK'), false, 'an expired code is invalid');
select is(public.check_invite('NOPE'), false, 'an unknown code is invalid');
select is_empty('select code from public.invite_codes', 'a signed-out visitor cannot list invite codes');

reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-00000000000a');
select is_empty('select code from public.invite_codes', 'a Member cannot list invite codes');

select * from finish();
rollback;
