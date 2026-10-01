from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')
start = text.index('<script>') + len('<script>')
end = text.index('</script>', start)
js = text[start:end]

# The frontend already uses a canonical state object. This script deliberately
# avoids token-level JavaScript rewriting: regex literals, template literals,
# and nested expressions must never be rewritten by a text substitution pass.
state = """const AdamarketState = window.AdamarketState = Object.assign(window.AdamarketState || {}, {
  session: null,
  profile: null,
  places: [],
  myAds: [],
  favorites: new Set(),
  plans: [],
  signup: false,
  lang: localStorage.getItem('adamarket_lang') || 'ru',
  demo: []
});
const S = window.AdamarketState;
"""

# Remove an old canonical state block only if it is present in the expected form,
# then install the single canonical block. Do not touch the rest of the JS.
state_re = re.compile(
    r'const\s+AdamarketState\s*=\s*window\.AdamarketState\s*=\s*Object\.assign\(window\.AdamarketState\s*\|\|\s*\{\}\s*,\s*\{.*?\}\);\s*const\s+S\s*=\s*window\.AdamarketState;\s*',
    re.S,
)
if state_re.search(js):
    js = state_re.sub(state, js, count=1)
elif 'window.AdamarketState' not in js:
    pos = js.index('const SUPA_URL=')
    js = js[:pos] + state + js[pos:]

# Canonicalize only the known legacy state declarations. This is safe because
# these declarations are outside strings/template literals in the source.
legacy = re.compile(r'\b(?:let|const)\s+(session|profile|places|myAds|favorites|plans|signup|lang)\s*=')
if legacy.search(js):
    raise SystemExit('legacy lexical state declaration remains; fix source manually instead of patching it')

# Required invariant: all application state is read from the canonical object.
for key in ('session', 'profile', 'places', 'myAds', 'favorites', 'plans', 'signup', 'lang'):
    if not re.search(rf'\b{key}\s*:', js):
        raise SystemExit(f'state field missing: {key}')
    if re.search(rf'window\.{key}\b', js):
        raise SystemExit(f'legacy window state alias remains: window.{key}')

if 'const S = window.AdamarketState;' not in js:
    raise SystemExit('canonical state alias missing')

# The demo dataset is part of the canonical state, not a separate global.
js = js.replace('const demo=[', 'S.demo=[')
js = re.sub(r'(?<![.\w])window\.demo\b', 'S.demo', js)

text = text[:start] + js + text[end:]
path.write_text(text, encoding='utf-8')
print('source state refactor prepared')
