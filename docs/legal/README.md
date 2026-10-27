# Legal documents

The three documents a Member accepts before using MiloJulo: Terms of Use, Community Guidelines and
the Data Notice (privacy policy). They are written from what the product actually does
(docs/04-safety-compliance.md, docs/12-db-schema.md and the decision log), in plain language.

**These are final texts written from research, not from a lawyer's review.** They follow the
structure of comparable apps' public documents (Bumble, Hinge, Aisle, Timeleft) and the published
requirements of India's DPDP Act 2023 and DPDP Rules 2025, the IT (Intermediary Guidelines) Rules
2021, GDPR basics, and Google Play's and Apple's user-generated-content rules. They are not legal
advice. No lawyer has seen them.

Published as Terms v2, Community Guidelines v2 and Data Notice v3 (migration
`20261126090000_final_legal_documents.sql`); every Member accepts them once on Reconsent.

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
| How location is stored or shown | Data Notice, "Where you are" (decisions 40, 66) |
| Takedown, ban or report handling | Community Guidelines, "What we do about it" (decision 56) |
| Casual, or anything about adult content | Terms, "Being 18 or over"; Guidelines, "Casual" (decision 33) |
| Processors (Supabase, Cloudflare, Resend, FCM) | Data Notice, "Who else handles your data" |
| The web deletion page ships (#98) | Terms, "Ending it"; Data Notice, "Deleting your account" |
| Grievance Officer or timelines | Terms, "Grievance Officer"; Data Notice, "Grievance Officer" |
| How fresh a Member Location must be | Data Notice, "Where you are" (decision 66) |
