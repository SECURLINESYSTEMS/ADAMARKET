from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')
start = text.index('<script>') + len('<script>')
end = text.index('</script>', start)
js = text[start:end]

# This checker is intentionally conservative: current source already owns the
# canonical state block, so never rewrite template literals or nested JS.
if 'window.AdamarketState' not in js:
    pos = js.index('const SUPA_URL=')
    state = "const AdamarketState = window.AdamarketState = Object.assign(window.AdamarketState || {}, {session:null,profile:null,places:[],myAds:[],favorites:new Set(),plans:[],signup:false,lang:localStorage.getItem('adamarket_lang')||'ru',demo:[]});\nconst state=window.AdamarketState;\n"
    js = js[:pos] + state + js[pos:]

legacy = re.compile(r'\b(?:let|const)\s+(session|profile|places|myAds|favorites|plans|signup|lang)\s*=')
if legacy.search(js):
    raise SystemExit('legacy lexical state declaration remains; fix source manually instead of patching it')

for key in ('session', 'profile', 'places', 'myAds', 'favorites', 'plans', 'signup', 'lang'):
    if not re.search(rf'\b{key}\s*:', js):
        raise SystemExit(f'state field missing: {key}')
    if re.search(rf'window\.{key}\b', js):
        raise SystemExit(f'legacy window state alias remains: window.{key}')

if not ('const state=window.AdamarketState;' in js or 'const S = window.AdamarketState;' in js):
    raise SystemExit('canonical state alias missing')

# Only migrate the obsolete standalone demo declaration; current inline demo
# data is already a property of AdamarketState.
js = js.replace('const demo=[', 'state.demo=[')
js = re.sub(r'(?<![.\w])window\.demo\b', 'state.demo', js)

text = text[:start] + js + text[end:]
path.write_text(text, encoding='utf-8')
print('source state refactor prepared')
