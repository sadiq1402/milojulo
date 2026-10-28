# Waitlist (Google Sheets)

The landing page's form posts to a Google Apps Script web app bound to a Google Sheet. Each sign-up is
one row: when they joined, their email (lower-cased, each address once), the city they typed, the
Modes they ticked under "What are you looking for?" (all optional) and the source: the page link's
`utm_source` or `ref` (`milojulo.co.in/?utm_source=instagram`, `?ref=<creator>`), blank for a direct visit.
A hidden `website` field catches bots; a post that fills it is dropped. There's no bot check beyond that.

## Set it up (once, in the founder's Google account)
1. Create a Google Sheet named "MiloJulo waitlist". Don't share it with anyone.
2. Extensions → Apps Script. Delete what's in `Code.gs`, paste in this folder's `Code.gs`, save.
3. Deploy → New deployment → type "Web app". Description "waitlist", Execute as "Me",
   Who has access "Anyone". Deploy, and allow the permissions Google asks for (it needs the Sheet).
4. Copy the web app URL (it ends in `/exec`).
5. Put it in `web/index.html` as `const WAITLIST_URL = '<url>';`, then open a pull request. Once it
   merges, the form goes live.
6. Test: sign up on milojulo.co.in with your own email. A row appears in the `Waitlist` tab.

## Changing the script later
Edit it in the Apps Script editor, then Deploy → Manage deployments → edit (pencil) → Version
"New version" → Deploy. That keeps the same URL; a new deployment would get a new one.

The Modes and Source columns came later: a Sheet made before them gets the two headings on its next
sign-up, once the new script version is deployed.

## Exporting
File → Download → CSV. Delete the Sheet once the beta has opened in a city and its rows have been invited.
