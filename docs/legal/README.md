# Legal documents

Drafts of the three documents a Member accepts before using MiloJulo. They are written from what
the product actually does (docs/04-safety-compliance.md, docs/12-db-schema.md and the decision
log), in plain language.

**These are drafts, not legal advice, and no lawyer has seen them** (docs/09). They are here so
the app stops asking people to accept documents they cannot read, and so a lawyer has something
concrete to review rather than a blank page.

## How they reach the app

The app does not contain these texts. Each is hosted as a web page, and the URL lives in the
database, one row per kind and version in `consent_documents`:

```sql
update public.consent_documents set url = 'https://milojulo.co.in/terms'
where kind = 'terms' and version = 'v1';
```

So the wording can change without an app release. A **new version** is a new row (a new `version`),
which makes every Member reconsent (`needs_reconsent()`); editing the page behind an existing URL
does not. Use a new version when what a Member agreed to has actually changed.

## Keeping them true

Each document describes behaviour that is in the code today. When any of these change, the
document changes with them:

| If this changes | Check |
|---|---|
| What is collected at sign-up or in a profile | Data Notice, "What we collect" |
| Retention of chat media or report evidence | Data Notice, "How long we keep things" (decisions 17, 62) |
| How location is stored or shown | Data Notice, "Where you are" (decision 40) |
| Takedown, ban or report handling | Community Guidelines, "What we do about it" (decision 56) |
| Casual, or anything about adult content | Terms, "Being 18 or over"; Guidelines, "Casual" (decision 33) |
| Processors (Supabase, Cloudflare, Resend, FCM) | Data Notice, "Who else handles your data" |
