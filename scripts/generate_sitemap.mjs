import { readFile, writeFile } from "node:fs/promises";

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

let xml = await readFile(SITEMAP_PATH, "utf8");
const entries = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)].map(m => m[0]);
const staticEntries = entries.filter(entry => {
  const loc = entry.match(/<loc>(.*?)<\/loc>/)?.[1] || "";
  return !loc.includes("/profil/");
});
const ads = payload.places
  .filter(p => p && p.id != null && String(p.title || "").trim().length >= 3)
  .filter(p => p.status === "approved" && p.is_active === true);
const adEntries = ads.map(p => `  <url><loc>https://adamarket.uz/profil/${xmlEscape(slugFor(p))}/</loc><lastmod>${dateOf(p)}</lastmod><priority>0.7</priority></url>`);
const nextXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticEntries, ...adEntries].join("\n")}\n</urlset>\n`;
if (nextXml !== xml) {
  await writeFile(SITEMAP_PATH, nextXml, "utf8");
  console.log(`Updated sitemap: ${staticEntries.length} static URLs, ${adEntries.length} approved listing URLs.`);
} else {
  console.log(`Sitemap already current: ${staticEntries.length} static URLs, ${adEntries.length} approved listing URLs.`);
}
