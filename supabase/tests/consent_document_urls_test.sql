-- #201: every document a Member must accept can actually be read.
begin;
\ir helpers/act_as.psql
select plan(3);

\set asha '00000000-0000-0000-0000-00000000e101'
select pg_temp.create_member(:'asha');
select pg_temp.act_as_member(:'asha');

select is_empty(
  $$ select kind from public.consent_documents where url is null $$,
  'every document, of every version, has somewhere to read it');
select results_eq(
  $$ select distinct kind::text, url from public.consent_documents order by kind::text $$,
  $$ values ('data_notice', 'https://milojulo.co.in/data-notice'),
            ('guidelines', 'https://milojulo.co.in/community-guidelines'),
            ('terms', 'https://milojulo.co.in/terms') $$,
  'each kind points at its page on the MiloJulo domain, whatever the version');
select ok(
  (select bool_and(url like 'https://%') from public.consent_documents),
  'over https, so the link opens');

select * from finish();
rollback;
