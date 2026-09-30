from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

# The current source has accumulated a duplicated/corrupted tail from an old
# runtime patch. Keep only the first complete inline script block.
start = text.index('<script>') + len('<script>')
end = text.index('</script>', start)
js = text[start:end]
first_boot = js.find('(async()=>{let {data}=await sb.auth.getSession();')
if first_boot >= 0:
    boot_end = js.find('renderHome()})();', first_boot)
    if boot_end >= 0:
        js = js[:boot_end + len('renderHome()})();')]

# One canonical state object. Demo data is state as well; no window.demo alias.
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
js = re.sub(r'const\s+AdamarketState\s*=.*?const\s+S\s*=\s*AdamarketState;\s*', state, js, count=1, flags=re.S)
if 'window.AdamarketState' not in js:
    marker = 'const SUPA_URL='
    pos = js.index(marker)
    js = js[:pos] + state + js[pos:]

# Remove legacy state declarations if any remain.
js = re.sub(r'\b(?:let|var|const)\s+(?:session|profile|places|myAds|favorites|plans|signup|lang)\s*(?:=[^;]+)?;', '', js)

# Demo data belongs to the state object.
js = js.replace('const demo=[', 'S.demo=[')
# Explicitly rewrite the known data references instead of relying on DOM globals.
repls = {
    'S.places.length?places:demo': 'S.places.length ? S.places : S.demo',
    '(S.places.length?places:demo)': '(S.places.length ? S.places : S.demo)',
    'S.places.length?places:demo': 'S.places.length ? S.places : S.demo',
    'const a=places;': 'const a=S.places;',
    '...places,...demo': '...S.places,...S.demo',
    'demo.slice(0,2)': 'S.demo.slice(0,2)',
    'const m=document.getElementById("S.langmenu")': 'const m=document.getElementById("langmenu")',
    'document.getElementById("S.langmenu")': 'document.getElementById("langmenu")',
    'document.getElementById("S.signupFields")': 'document.getElementById("signupFields")',
    'API+"?action=S.plans"': 'API+"?action=plans"',
    'API+"?action=S.places"': 'API+"?action=places"',
}
for a,b in repls.items():
    js = js.replace(a,b)

# Fix authentication form to use explicit DOM references.
old_submit = 'document.getElementById("authForm").onsubmit=async e=>{e.preventDefault();try{'
if old_submit in js:
    prefix = old_submit
    suffix = 'catch(e){toast(e.message)}};'
    i = js.index(prefix)
    j = js.index(suffix, i) + len(suffix)
    new_submit = '''document.getElementById("authForm").onsubmit=async e=>{e.preventDefault();const nameEl=document.getElementById("aName"),phoneEl=document.getElementById("aPhone"),innEl=document.getElementById("aInn"),emailEl=document.getElementById("aEmail"),passEl=document.getElementById("aPass");try{if(S.signup){const inn=innEl.value.replace(/\\s/g,"");if(!/^[0-9]{9,14}$/.test(inn))throw Error("ИНН фирмы: 9–14 цифр");const {data,error}=await sb.auth.signUp({email:emailEl.value.trim(),password:passEl.value,options:{data:{full_name:nameEl.value.trim(),phone:phoneEl.value.trim(),inn}}});if(error)throw error;if(!data.session){toast("Проверьте email для подтверждения");return}}else{const {error}=await sb.auth.signInWithPassword({email:emailEl.value.trim(),password:passEl.value});if(error)throw error}closeAuth();await bootstrap().catch(()=>{});renderHome()}catch(e){toast(e.message)}};'''
    js = js[:i] + new_submit + js[j:]

# Guest search remains public; only protected actions require auth.
js = re.sub(r'function action\(id\)\{if\(!S\.session\)return needAuth\(\);', 'function action(id){if(id==="search")return renderSearch();if(!S.session)return needAuth();', js, count=1)

# Explicit DOM fields for search/filter/map/create/edit.
js = js.replace('let q=(searchQ.value||"").toLowerCase();', 'let q=(document.getElementById("searchQ")?.value||"").toLowerCase();')
js = js.replace('results.innerHTML=', 'document.getElementById("results").innerHTML=')
for name in ['fTitle','fType','fPrice','fCity','fDistrict','fAddress','fLat','fLng','fDesc','fPhotos','fArea','fAllowed']:
    js = re.sub(rf'(?<![.\w]){name}\.value', f'document.getElementById("{name}").value', js)
js = js.replace('flag.textContent', 'document.getElementById("flag").textContent')

# Add the business-only fields required by create/update place.
if 'id="fArea"' not in text:
    marker = '<div class="full"><label class="label">Адрес</label><input id="fAddress" class="field"></div>'
    extra = '''<div class="full"><label class="label">Адрес</label><input id="fAddress" class="field"></div><div><label class="label">Площадь, м²</label><input id="fArea" class="field" type="number" min="0" step="0.01"></div><div class="full"><label class="label">Разрешённые форматы рекламы</label><div id="fAllowed" class="actions">''' + ''.join(f'<button type="button" class="ghost" data-type="{x}">{x}</button>' for x in ['Баннер','LED-экран','Билборд','Вывеска','Объёмные буквы']) + '</div></div>'
    text = text.replace(marker, extra, 1)

# Rebuild the script after potential HTML form modification.
text = text[:start] + js + text[end:]

# Persist language immediately and keep the flag UI in sync.
text = text.replace("function setLang(l,f){S.lang=l;", "function setLang(l,f){S.lang=l;localStorage.setItem('adamarket_lang',l);localStorage.setItem('adamarket_flag',f);")
path.write_text(text, encoding='utf-8')
print('source state refactor prepared')