from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

old = "let session=null,profile=null,places=[],myAds=[],favorites=new Set(),plans=[],signup=false,lang='ru';"
new = """const AdamarketState = window.AdamarketState = Object.assign(window.AdamarketState || {}, {
  session: null, profile: null, places: [], myAds: [], favorites: new Set(), plans: [], signup: false, lang: localStorage.getItem('adamarket_lang') || 'ru'
});
const S = AdamarketState;"""
if old not in text:
    raise SystemExit('state declaration not found')
text = text.replace(old, new, 1)

start = text.index('<script>') + len('<script>')
end = text.index('</script>', start)
js = text[start:end]

# Replace only bare state identifiers. Member accesses such as data.session remain intact.
for name in ('session', 'profile', 'places', 'myAds', 'favorites', 'plans', 'signup', 'lang'):
    js = re.sub(rf'(?<![.$\\w]){name}(?![\\w$])', f'S.{name}', js)

# Restore the declaration name that was intentionally introduced by the transformation.
js = js.replace('const S = S.AdamarketState', 'const S = AdamarketState')

# Persist language in the source of truth and restore it without a runtime patch.
old_set = "function toggleLang(){let m=document.getElementById(\"langmenu\");m.style.display=m.style.display===\"block\"?\"none\":\"block\"}function setLang(l,f){S.lang=l;flag.textContent=f;document.getElementById(\"langmenu\").style.display=\"none\";toast(l===\"ru\"?\"Русский\":\"Язык выбран\")}"
new_set = "function toggleLang(){let m=document.getElementById(\"langmenu\");m.style.display=m.style.display===\"block\"?\"none\":\"block\"}function setLang(l,f){S.lang=l;localStorage.setItem('adamarket_lang',l);localStorage.setItem('adamarket_flag',f);flag.textContent=f;document.getElementById(\"langmenu\").style.display=\"none\";toast(l===\"ru\"?\"Русский\":l===\"uz\"?\"O‘zbek\":\"English\")}"
if old_set in js:
    js = js.replace(old_set, new_set, 1)
else:
    raise SystemExit('setLang implementation not found')

# Make the existing Leaflet picker the canonical coordinate picker and persist its marker state.
# The picker already writes fLat/fLng; no iframe/Yandex replacement is needed.

text = text[:start] + js + text[end:]
path.write_text(text, encoding='utf-8')
print('centralized state in index.html')
