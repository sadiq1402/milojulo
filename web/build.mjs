// Builds milojulo.co.in from docs/legal/ (Cloudflare Pages runs `npm run build` and serves dist/).
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { marked } from 'marked';
const out = new URL('./dist', import.meta.url).pathname;
const legal = new URL('../docs/legal/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const site = 'https://milojulo.co.in';
const pages = [['terms', 'Terms of Use'], ['community-guidelines', 'Community Guidelines'], ['data-notice', 'Data Notice']];
const blurb = {
  terms: 'The terms for using MiloJulo, the app to find friends, activity partners, dates and professional contacts nearby.',
  'community-guidelines': 'How MiloJulo Members treat each other online and when they meet in person.',
  'data-notice': 'What data MiloJulo collects, why, how long it is kept and how to get a copy or delete it.',
  'delete-account': 'Delete your MiloJulo account and its photos, messages and data.',
};
// The top bar and home page also link the deletion page, which isn't built from docs/legal.
const menu = [...pages, ['delete-account', 'Delete account']];
const css = `:root{--orchid:#CC2E86;--violet:#7B4DFF;--ink:#2B1233;--secondary:#6D5876;--ground:#FFF7FB;--card:#FFFFFF;--line:#F3DDEA;--tint:#FFE3F1}
*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:16px/24px Figtree,system-ui,sans-serif}
header{max-width:760px;margin:0 auto;padding:24px 20px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.brand{font:700 24px/32px 'Bricolage Grotesque',system-ui,sans-serif;text-decoration:none;color:var(--orchid)}.brand span{color:var(--violet)}
nav{display:flex;gap:8px;flex-wrap:wrap}nav a{font-size:14px;line-height:20px;font-weight:600;color:var(--ink);text-decoration:none;padding:8px 14px;border-radius:999px;background:var(--card)}
nav a[aria-current]{background:var(--tint);color:var(--orchid)}
main{max-width:760px;margin:16px auto 48px;padding:24px 20px;background:var(--card);border-radius:24px}@media(min-width:800px){main{padding:32px 40px}}
h1{font:700 28px/32px 'Bricolage Grotesque',system-ui,sans-serif;margin:0 0 16px}h2{font:700 20px/24px 'Bricolage Grotesque',system-ui,sans-serif;margin:32px 0 8px}
h3{font-size:17px;line-height:24px;font-weight:600;margin:24px 0 8px}a{color:var(--orchid)}.table{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px;line-height:20px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
label{display:block;font-size:14px;line-height:20px;font-weight:600;margin:16px 0 6px}
fieldset{border:0;padding:0;margin:0}fieldset label{font-weight:400;font-size:16px;line-height:24px;display:flex;gap:10px;align-items:center;min-height:48px;margin:0}
input[type=email],input[inputmode],textarea{width:100%;font:inherit;color:var(--ink);border:1px solid #E9CFE0;background:#fff;padding:0 20px;height:52px;border-radius:999px}
textarea{height:auto;min-height:96px;border-radius:20px;padding:12px 16px}
input[type=radio],input[type=checkbox]{width:20px;height:20px;accent-color:var(--orchid)}
.confirm{display:flex;gap:10px;align-items:flex-start;font-weight:400}
button{display:block;width:100%;height:52px;margin-top:20px;border:0;border-radius:999px;background:var(--orchid);color:#fff;font:700 16px/20px Figtree,system-ui,sans-serif;cursor:pointer}
button:disabled{opacity:.6}button.danger{background:#C62828}
.error{color:#C62828;font-weight:600}.small{color:var(--secondary);font-size:14px}
hr{border:0;border-top:1px solid var(--line);margin:24px 0}footer{max-width:760px;margin:0 auto 32px;padding:0 20px;color:var(--secondary);font-size:14px}`;
const shell = (title, slug, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · MiloJulo</title><meta name="description" content="${blurb[slug]}"><link rel="canonical" href="${site}/${slug}"><meta property="og:title" content="${title} · MiloJulo"><meta property="og:url" content="${site}/${slug}"><meta property="og:image" content="${site}/assets/share.png"><link rel="icon" type="image/png" href="/assets/favicon.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700&family=Figtree:wght@400;600;700&display=swap" rel="stylesheet"><style>${css}</style></head><body><header><a class="brand" href="/">Milo<span>Julo</span></a><nav>${menu.map(([s, t]) => `<a href="/${s}"${s === slug ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav></header><main>${body}</main><footer>MiloJulo · Find your people. · <a href="mailto:support@milojulo.co.in">support@milojulo.co.in</a></footer></body></html>`;
const r = new marked.Renderer(); const t = r.table.bind(r); r.table = x => `<div class="table">${t(x)}</div>`;
for (const [slug, title] of pages) {
  const md = readFileSync(`${legal}${slug}.md`, 'utf8').replace(/\]\(\.\/([a-z-]+)\.md(#[^)]*)?\)/g, (_, s, h = '') => `](/${s}${h})`);
  writeFileSync(`${out}/${slug}.html`, shell(title, slug, marked.parse(md, { renderer: r })));
}
writeFileSync(`${out}/delete-account.html`, shell('Delete your account', 'delete-account', readFileSync(new URL('./delete-account.html', import.meta.url), 'utf8')));
// The landing page carries its own head and styles, so it is copied as is, with its images.
cpSync(new URL('./index.html', import.meta.url), `${out}/index.html`);
cpSync(new URL('./assets', import.meta.url), `${out}/assets`, { recursive: true });
writeFileSync(`${out}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
const urls = ['', ...menu.map(([s]) => s)].map(s => `<url><loc>${site}/${s}</loc></url>`).join('');
writeFileSync(`${out}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
