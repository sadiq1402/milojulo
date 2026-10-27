# milojulo.co.in

The public site: the three documents a Member accepts (docs/legal/), rendered as pages at
`/terms`, `/community-guidelines` and `/data-notice`, plus a short home page.

Cloudflare Pages builds it from `main`: root directory `web`, build command `npm ci && npm run build`,
output directory `dist`. A change to docs/legal/ on `main` republishes the site. Locally:
`cd web && npm ci && npm run build`, then open `dist/`.
