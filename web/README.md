# milojulo.co.in

The public site: the three documents a Member accepts (docs/legal/), rendered as pages at
`/terms`, `/community-guidelines` and `/data-notice`, the account deletion page, and the landing page.

The landing page is `index.html`, copied to `dist/` as is with `assets/` (logo pieces, favicon, the
1200 x 630 share image). Its design is design/reference-html/screens/Landing.html. The waitlist form
posts to the Apps Script URL in `WAITLIST_URL` at the bottom of the page (set up: waitlist/README.md); while that is empty it
says sign-ups open soon. Visits are counted by Cloudflare Web Analytics, turned on in the Pages dashboard.

Cloudflare Pages builds it from `main`: root directory `web`, build command `npm ci && npm run build`,
output directory `dist`. A change to docs/legal/ on `main` republishes the site. Locally:
`cd web && npm ci && npm run build`, then open `dist/`.
