import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

const ROOT = process.cwd();
const INDEX = await readFile(`${ROOT}/index.html`, "utf8");
const SITEMAP_PATH = `${ROOT}/sitemap.xml`;
const match = INDEX.match(/const SUPA_URL="([^"]+)",SUPA_KEY="([^"]+)"/);
if (!match) throw new Error("Cannot find the public Supabase URL/key in index.html");
const [, supabaseUrl, publishableKey] = match;
const endpoint = `${supabaseUrl}/functions/v1/adamarket-web-api?action=places`;

const response = await fetch(endpoint, {
  headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, Accept: "application/json" },
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error(`Supabase listings request failed: HTTP ${response.status}`);
const payload = await response.json();
if (payload?.ok !== true || !Array.isArray(payload.places)) {
  throw new Error("Supabase returned an unexpected listings response; sitemap was not changed");
}

const transliteration = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",
  к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
  х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"
};
function slugFor(place) {
  const raw = String(place.slug || place.title || place.owner_name || `ad-${place.id}`).trim().toLowerCase();
  const slug = raw.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/[а-яё]/g, ch => transliteration[ch] || "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (slug || `ad-${place.id}`) + `-${place.id}`;
}
function xmlEscape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function dateOf(place) {
  const d = new Date(place.updated_at || place.created_at || Date.now());
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function htmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeImage(value) {
  const image = String(value || "").trim();
  return image.startsWith("https://") ? image : "https://adamarket.uz/assets/tashkent-hero.svg";
}
function priceText(place) {
  const price = Number(place.price);
  const amount = Number.isFinite(price) ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(price) : "По запросу";
  const unit = ({day:"в день",week:"в неделю",month:"в месяц"})[place.unit] || "за размещение";
  return `${amount} ${place.currency === "USD" ? "USD" : "сум"} ${unit}`;
}
function makeListingPage(place) {
  const slug = slugFor(place);
  const canonical = `https://adamarket.uz/profil/${slug}/`;
  const title = `${String(place.title).trim()} — ${String(place.city || "Ташкент").trim()} | ADAMARKET`;
  const location = [place.city || "Ташкент", place.district, place.address].filter(Boolean).join(", ");
  const description = String(place.description || `${place.type || "Рекламное место"} в ${location}. ${priceText(place)}. Объявление на ADAMARKET.`).replace(/\\s+/g, " ").trim().slice(0, 300);
  const image = safeImage(place.cover_image || (Array.isArray(place.images) ? place.images[0] : ""));
  const price = Number(place.price);
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": title,
    "url": canonical,
    "description": description,
    "isPartOf": {"@type":"WebSite","name":"ADAMARKET","url":"https://adamarket.uz/"},
    "primaryImageOfPage": {"@type":"ImageObject","url":image},
    "mainEntity": {
      "@type":"Service",
      "name": String(place.title).trim(),
      "description": description,
      "areaServed": {"@type":"Place","name":location},
      "image": image,
      "offers": {"@type":"Offer","url":canonical,"price":Number.isFinite(price)?String(price):"0","priceCurrency":place.currency||"UZS","availability":"https://schema.org/InStock"}
    }
  };
  const jsonLd = JSON.stringify(schema).replace(/</g, "\\u003c");
  return `<!doctype html>
<!-- ADAMARKET GENERATED SEO PAGE -->
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow,max-image-preview:large">
<title>${htmlEscape(title)}</title>
<meta name="description" content="${htmlEscape(description)}">
<link rel="canonical" href="${htmlEscape(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ADAMARKET">
<meta property="og:title" content="${htmlEscape(title)}">
<meta property="og:description" content="${htmlEscape(description)}">
<meta property="og:url" content="${htmlEscape(canonical)}">
<meta property="og:image" content="${htmlEscape(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${htmlEscape(title)}">
<meta name="twitter:description" content="${htmlEscape(description)}">
<meta name="twitter:image" content="${htmlEscape(image)}">
<script type="application/ld+json">${jsonLd}</script>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f7fc;color:#15263d;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}.wrap{max-width:960px;margin:auto;padding:20px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}.brand{font-size:23px;font-weight:900;letter-spacing:-1px;text-decoration:none;color:#15263d}.brand span{color:#126cff}.card{background:#fff;border:1px solid #dce6f1;border-radius:22px;overflow:hidden;box-shadow:0 16px 42px #1b3b5b12}.cover{display:block;width:100%;max-height:440px;object-fit:cover;background:#e9f0f8}.body{padding:clamp(20px,4vw,36px)}.tag{display:inline-block;background:#eaf2ff;color:#1255b7;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800}h1{font-size:clamp(28px,5vw,42px);line-height:1.15;margin:14px 0}.muted{color:#61748b}.price{font-size:clamp(22px,4vw,30px);font-weight:900;margin:18px 0;color:#0e2849}.desc{white-space:pre-line;overflow-wrap:anywhere}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}.btn{display:inline-block;padding:12px 18px;border-radius:12px;background:#126cff;color:#fff;text-decoration:none;font-weight:800}.btn.alt{background:#edf3fb;color:#193451}.foot{color:#708198;font-size:13px;margin:18px 4px}@media(max-width:560px){.wrap{padding:12px}.top{align-items:flex-start}.card{border-radius:16px}.cover{max-height:300px}}
</style>
</head>
<body><div class="wrap">
<header class="top"><a class="brand" href="https://adamarket.uz/">ADA<span>MARKET</span></a><span class="muted">Бесплатные объявления</span></header>
<main class="card">
<img class="cover" src="${htmlEscape(image)}" alt="${htmlEscape(place.title)}" loading="eager" onerror="this.onerror=null;this.src='https://adamarket.uz/assets/tashkent-hero.svg'">
<article class="body">
<span class="tag">${htmlEscape(place.type || "Рекламное место")}</span>
<h1>${htmlEscape(place.title)}</h1>
<p class="muted">⌖ ${htmlEscape(location)}</p>
<div class="price">${htmlEscape(priceText(place))}</div>
<p class="desc">${htmlEscape(description)}</p>
<div class="actions"><a class="btn" href="https://adamarket.uz/?ad=${encodeURIComponent(String(place.id))}">Открыть объявление</a><a class="btn alt" href="https://adamarket.uz/">Все объявления</a></div>
</article>
</main>
<p class="foot">Объявление размещено на ADAMARKET. Перед сделкой уточняйте актуальность предложения у владельца.</p>
</div></body></html>
`;
}

const ads = payload.places
  .filter(p => p && p.id != null && String(p.title || "").trim().length >= 3)
  .filter(p => p.status === "approved" && p.is_active === true);
const profileRoot = `${ROOT}/profil`;
await mkdir(profileRoot, { recursive: true });
const activeSlugs = new Set();
for (const place of ads) {
  const slug = slugFor(place);
  activeSlugs.add(slug);
  const dir = `${profileRoot}/${slug}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/index.html`, makeListingPage(place), "utf8");
}
for (const entry of await readdir(profileRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || activeSlugs.has(entry.name)) continue;
  const pagePath = `${profileRoot}/${entry.name}/index.html`;
  try {
    const existing = await readFile(pagePath, "utf8");
    if (existing.includes("<!-- ADAMARKET GENERATED SEO PAGE -->")) {
      await rm(`${profileRoot}/${entry.name}`, { recursive: true, force: true });
    }
  } catch {}
}

let xml = await readFile(SITEMAP_PATH, "utf8");
const entries = [...xml.matchAll(/<url>[\\s\\S]*?<\\/url>/g)].map(m => m[0]);
const staticEntries = entries.filter(entry => {
  const loc = entry.match(/<loc>(.*?)<\\/loc>/)?.[1] || "";
  return !loc.includes("/profil/");
});
const adEntries = ads.map(p => `  <url><loc>https://adamarket.uz/profil/${xmlEscape(slugFor(p))}/</loc><lastmod>${dateOf(p)}</lastmod><priority>0.7</priority></url>`);
const nextXml = `<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n${[...staticEntries, ...adEntries].join("\\n")}\\n</urlset>\\n`;
if (nextXml !== xml) await writeFile(SITEMAP_PATH, nextXml, "utf8");
console.log(`Sitemap and SEO pages current: ${staticEntries.length} static URLs, ${ads.length} approved listing pages.`);
