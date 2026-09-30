const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

new Function(script); // syntax validation
assert(script.includes('window.AdamarketState'), 'AdamarketState is missing');
assert(!/\blet\s+session\s*=/.test(script), 'legacy session lexical state remains');
assert(!/\blet\s+profile\s*=/.test(script), 'legacy profile lexical state remains');
assert(!/\blet\s+places\s*=/.test(script), 'legacy places lexical state remains');
assert(!/\blet\s+myAds\s*=/.test(script), 'legacy myAds lexical state remains');
assert(!/window\.(session|profile|places|myAds|demo)\b/.test(script), 'frontend still depends on window state aliases');
assert(html.includes('id="fArea"'), 'business area field is missing');
assert(html.includes('id="fAllowed"'), 'allowed ad types field is missing');
assert(html.includes('leaflet'), 'Leaflet map dependency is missing');
assert(html.includes('localStorage.setItem(\'adamarket_lang\''), 'language persistence is missing');
console.log('frontend smoke tests passed');
