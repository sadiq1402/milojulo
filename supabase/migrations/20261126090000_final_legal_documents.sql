-- Final texts of the three documents (docs/legal/, #222): what a Member agrees to has changed (content
-- licence, liability, Grievance Officer, no Area fallback), so each is a new version and every Member
-- accepts it once on Reconsent (decision 64). The pages behind the URLs carry the new text.
insert into public.consent_documents (kind, version, url) values
  ('terms', 'v2', 'https://milojulo.co.in/terms'),
  ('guidelines', 'v2', 'https://milojulo.co.in/community-guidelines'),
  ('data_notice', 'v3', 'https://milojulo.co.in/data-notice');
