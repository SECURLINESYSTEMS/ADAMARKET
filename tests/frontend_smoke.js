const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
if (!scripts.includes('window.AdamarketState')) throw new Error('canonical state is missing');
for (const legacy of ['let session=', 'let profile=', 'let places=', 'let myAds=', 'let favorites=', 'let plans=', 'let signup=', 'let lang=', 'const demo=']) {
  if (scripts.includes(legacy)) throw new Error(`legacy state declaration found: ${legacy}`);
}
for (const legacy of ['window.session', 'window.profile', 'window.places', 'window.myAds', 'window.favorites', 'window.plans', 'window.signup', 'window.lang', 'window.demo']) {
  if (scripts.includes(legacy)) throw new Error(`legacy window alias found: ${legacy}`);
}
for (const required of ['document.getElementById("aEmail")','document.getElementById("aPass")','document.getElementById("aInn")','document.getElementById("searchQ")','L.map','toggle_favorite','create_place','update_place','localStorage.setItem("adamarket_lang"']) {
  if (!scripts.includes(required)) throw new Error(`required behavior missing: ${required}`);
}
new vm.Script(scripts);
console.log('frontend smoke: PASS');
