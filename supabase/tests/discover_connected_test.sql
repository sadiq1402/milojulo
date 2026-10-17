begin;
\ir helpers/act_as.psql
select plan(9);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000147' || suffix)::uuid $$;

create function pg_temp.member(member uuid) returns void
language plpgsql as $$
begin
  perform pg_temp.create_complete_member(member);
  update public.profiles set modes = '{friends}' where id = member;
  perform pg_temp.act_as_member(member);
  perform public.submit_profile();
  reset role;
end;
$$;

create function pg_temp.in_feed(member uuid) returns boolean
language sql as $$ select exists (select 1 from public.discover_feed(null, 50) where user_id = member) $$;

select pg_temp.member(pg_temp.m('01'));
select pg_temp.member(pg_temp.m('02'));
select pg_temp.member(pg_temp.m('03'));

select pg_temp.act_as_member(pg_temp.m('01'));
select ok(pg_temp.in_feed(pg_temp.m('02')), 'a Member with no Connection appears');

select public.send_request(pg_temp.m('02'), 'friends') as conn \gset
select ok(not pg_temp.in_feed(pg_temp.m('02')), 'the sender no longer sees a Member they are asking');
select pg_temp.act_as_member(pg_temp.m('02'));
select ok(not pg_temp.in_feed(pg_temp.m('01')), 'the recipient no longer sees a Member asking them');

select public.respond_request(:'conn', false);
select ok(pg_temp.in_feed(pg_temp.m('01')), 'a declined request brings the Member back');

select pg_temp.act_as_member(pg_temp.m('01'));
select public.send_request(pg_temp.m('03'), 'friends') as conn2 \gset
select pg_temp.act_as_member(pg_temp.m('03'));
select public.respond_request(:'conn2', true);
select ok(not pg_temp.in_feed(pg_temp.m('01')), 'an accepted Connection hides the other side');
select pg_temp.act_as_member(pg_temp.m('01'));
select ok(not pg_temp.in_feed(pg_temp.m('03')), 'both sides');
select ok((select count(*) = 1 from public.get_profile(pg_temp.m('03'))), 'the profile still opens for a Connection');

select public.close_connection(:'conn2');
select ok(pg_temp.in_feed(pg_temp.m('03')), 'a closed Connection brings the Member back');
select ok(pg_temp.in_feed(pg_temp.m('02')), 'the declined pair is visible to the sender too');

select * from finish();
rollback;
