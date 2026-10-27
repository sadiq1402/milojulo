-- #201: every document a Member must accept can actually be read.
begin;
\ir helpers/act_as.psql
select plan(5);

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

-- #222: the final texts are new versions, so a Member who accepted the drafts accepts again.
reset role;
select results_eq(
  $$ select d.kind::text, d.version from public.consent_documents d
     join public.current_consent_documents() c (id) on c.id = d.id order by d.kind::text $$,
  $$ values ('data_notice', 'v3'), ('guidelines', 'v2'), ('terms', 'v2') $$,
  'the current documents are the final texts');
\set ravi '00000000-0000-0000-0000-00000000e102'
select pg_temp.create_member(:'ravi');
update public.consents set document_id = (select id from public.consent_documents where kind = 'terms' and version = 'v1')
where user_id = :'ravi' and document_id = (select id from public.consent_documents where kind = 'terms' and version = 'v2');
select ok(public.consent_withdrawn(:'ravi'), 'a Member who only accepted the draft Terms must accept the final ones');

select * from finish();
rollback;
