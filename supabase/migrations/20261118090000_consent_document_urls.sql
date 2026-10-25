-- #201: the three documents a Member accepts now have texts (docs/legal/) and a home on the
-- MiloJulo domain. The URL lives here, not in the app, so the wording can change without a
-- release; a change to what a Member agreed to is a new version row, which asks everyone again.
--
-- Every version of a kind points at the same page, which carries the current text. A Member who
-- accepted an older version and wants to read exactly what they agreed to has to ask us; keeping
-- a separate page per version is not worth it for a beta.
update public.consent_documents
set url = case kind
            when 'terms' then 'https://milojulo.co.in/terms'
            when 'guidelines' then 'https://milojulo.co.in/community-guidelines'
            when 'data_notice' then 'https://milojulo.co.in/data-notice'
          end
where url is null;
