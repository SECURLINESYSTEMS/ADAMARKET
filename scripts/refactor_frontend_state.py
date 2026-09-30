from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')
start = text.index('<script>') + len('<script>')
end = text.index('</script>', start)
js = text[start:end]

# Rebuild the boot tail from a known-good source boundary. This removes all
# duplicated fragments left by the historical runtime patch chain.
boot_marker = '(async()=>{let {data}=await sb.auth.getSession();'
if boot_marker in js:
    js = js.split(boot_marker, 1)[0]
js += '''(async()=>{const {data}=await sb.auth.getSession();if(data.session){S.session=data.session;try{await bootstrap()}catch(e){S.session=null;S.profile=null}}await loadPlaces();renderHome()})();\n'''

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
js = re.sub(r'const\s+AdamarketState\s*=.*?const\s+S\s*=\s*(?:AdamarketState|window\.AdamarketState);\s*', state, js, count=1, flags=re.S)
if 'window.AdamarketState' not in js:
    marker = 'const SUPA_URL='
    pos = js.index(marker)
    js = js[:pos] + state + js[pos:]

# No independent lexical state.
js = re.sub(r'\b(?:let|var|const)\s+(?:session|profile|places|myAds|favorites|plans|signup|lang)\s*(?:=[^;]+)?;', '', js)

# State-owned demo data and references.
js = re.sub(r'\b(?:S\.)+demo\b', 'S.demo', js)
js = js.replace('const demo=[', 'S.demo=[')
js = js.replace('demo.slice(0,2)', 'S.demo.slice(0,2)')
js = js.replace('...places,...demo', '...S.places,...S.demo')
js = js.replace('S.S.S.demo', 'S.demo')
js = js.replace('S.S.demo', 'S.demo')
js = js.replace('const a=places;', 'const a=S.places;')
js = js.replace('S.places.length?places:demo', 'S.places.length ? S.places : S.demo')
js = js.replace('S.places.length ? places : demo', 'S.places.length ? S.places : S.demo')

# Explicit DOM access; never rely on browser-created globals.
for name in ['aName','aPhone','aInn','aEmail','aPass','searchQ','results','fTitle','fType','fPrice','fCity','fDistrict','fAddress','fLat','fLng','fDesc','fPhotos','fArea','fAllowed','flag']:
    js = re.sub(rf'(?<![.\w\"]){name}(?=\.value|\.textContent|\.innerHTML|\.required|\?\.)', f'document.getElementById("{name}")', js)
js = js.replace('document.getElementById("S.signupFields")', 'document.getElementById("signupFields")')
js = js.replace('document.getElementById("S.langmenu")', 'document.getElementById("langmenu")')
js = js.replace('API+"?action=S.plans"', 'API+"?action=plans"')
js = js.replace('API+"?action=S.places"', 'API+"?action=places"')

# Canonical authentication handler.
auth_marker = 'document.getElementById("authForm").onsubmit='
if auth_marker in js:
    i = js.index(auth_marker)
    next_fn = js.find('\nfunction renderHome', i)
    if next_fn < 0: raise SystemExit('renderHome boundary missing')
    auth_code = '''document.getElementById("authForm").onsubmit=async e=>{e.preventDefault();const nameEl=document.getElementById("aName"),phoneEl=document.getElementById("aPhone"),innEl=document.getElementById("aInn"),emailEl=document.getElementById("aEmail"),passEl=document.getElementById("aPass");try{if(S.signup){const inn=innEl.value.replace(/\\s/g,"");if(!/^[0-9]{9,14}$/.test(inn))throw Error("ИНН фирмы: 9–14 цифр");const {data,error}=await sb.auth.signUp({email:emailEl.value.trim(),password:passEl.value,options:{data:{full_name:nameEl.value.trim(),phone:phoneEl.value.trim(),inn}}});if(error)throw error;if(!data.session){toast("Проверьте email для подтверждения");return}}else{const {error}=await sb.auth.signInWithPassword({email:emailEl.value.trim(),password:passEl.value});if(error)throw error}closeAuth();const current=await sb.auth.getSession();S.session=current.data.session||null;if(S.session)await bootstrap();renderHome()}catch(e){toast(e.message)}};\n'''
    js = js[:i] + auth_code + js[next_fn+1:]

# Guest search is public; all other actions require an authenticated session.
js = re.sub(r'function action\(id\)\{.*?\}', 'function action(id){if(id==="search")return renderSearch();if(!S.session)return needAuth();if(id==="add")renderAdd();else if(id==="favorites")renderFav();else if(id==="profile")renderProfile();else if(id==="messages")renderMessages()}', js, count=1, flags=re.S)

# API query parameters must be literal action names, never state property names.
js = js.replace('API+"?action=S.plans"', 'API+"?action=plans"').replace('API+"?action=S.places"', 'API+"?action=places"')

# Make language persistence deterministic and remove duplicate writes.
js = re.sub(r'function setLang\(l,f\)\{.*?\}', '''function setLang(l,f){S.lang=l;localStorage.setItem('adamarket_lang',l);localStorage.setItem('adamarket_flag',f);document.getElementById("flag").textContent=f;document.getElementById("langmenu").style.display="none";toast(l==="ru"?"Русский":l==="uz"?"O‘zbek":"English")}''', js, count=1, flags=re.S)

# Business-specific form fields.
form_marker = '<div class="full"><label class="label">Адрес</label><input id="fAddress" class="field"></div>'
if 'id="fArea"' not in text:
    extra = form_marker + '<div><label class="label">Площадь, м²</label><input id="fArea" class="field" type="number" min="0" step="0.01"></div><div class="full"><label class="label">Разрешённые форматы рекламы</label><div id="fAllowed" class="actions">' + ''.join(f'<button type="button" class="ghost" data-type="{x}">{x}</button>' for x in ['Баннер','LED-экран','Билборд','Вывеска','Объёмные буквы']) + '</div></div>'
    text = text.replace(form_marker, extra, 1)

# Add area/allowed fields to createPlace and implement source-level updatePlace.
js = js.replace('description:document.getElementById("fDesc").value};await api("create_place",{place});', 'description:document.getElementById("fDesc").value,area_m2:document.getElementById("fArea")?.value?Number(document.getElementById("fArea").value):null,allowed_ad_types:[...(document.getElementById("fAllowed")?.querySelectorAll(".primary")||[])].map(x=>x.dataset.type)};await api("create_place",{place});')
if 'async function updatePlace(' not in js:
    anchor = 'async function toggleFav('
    update = '''async function updatePlace(id){try{const p=S.myAds.find(x=>x.id===id);if(!p)throw Error("Объявление не найдено");const images=Array.isArray(p.images)?p.images:[];const allowed=[...(document.getElementById("fAllowed")?.querySelectorAll(".primary")||[])].map(x=>x.dataset.type);const place={title:document.getElementById("fTitle").value,type:document.getElementById("fType").value,price:document.getElementById("fPrice").value,unit:p.unit||"month",city:document.getElementById("fCity").value,district:document.getElementById("fDistrict").value,address:document.getElementById("fAddress").value,latitude:document.getElementById("fLat").value?Number(document.getElementById("fLat").value):null,longitude:document.getElementById("fLng").value?Number(document.getElementById("fLng").value):null,description:document.getElementById("fDesc").value,reach:p.reach??null,traffic:p.traffic??null,images,cover_image:p.cover_image??images[0]??null,area_m2:document.getElementById("fArea")?.value?Number(document.getElementById("fArea").value):(p.area_m2??null),allowed_ad_types:allowed.length?allowed:(p.allowed_ad_types||[])};await api("update_place",{placeId:id,place});toast("Изменения сохранены");await bootstrap();renderMyAds()}catch(e){toast(e.message)}}\n'''
    js = js.replace(anchor, update + anchor, 1)

# Edit button uses the selected record and keeps the source of truth in state.
js = re.sub(r'async function editPlace\(id\)\{.*?\n\}', '''async function editPlace(id){const p=S.myAds.find(x=>x.id===id);if(!p)return;renderAdd();setTimeout(()=>{document.getElementById("fTitle").value=p.title||"";document.getElementById("fType").value=p.type||"Баннер";document.getElementById("fPrice").value=p.price||"";document.getElementById("fCity").value=p.city||"Ташкент";document.getElementById("fDistrict").value=p.district||"";document.getElementById("fAddress").value=p.address||"";document.getElementById("fLat").value=p.latitude??"";document.getElementById("fLng").value=p.longitude??"";document.getElementById("fDesc").value=p.description||"";if(document.getElementById("fArea"))document.getElementById("fArea").value=p.area_m2??"";if(document.getElementById("fAllowed"))document.getElementById("fAllowed").querySelectorAll("[data-type]").forEach(b=>b.classList.toggle("primary",(p.allowed_ad_types||[]).includes(b.dataset.type)));const btn=document.querySelector('#content .primary[onclick="createPlace()"]');if(btn){btn.textContent="Сохранить изменения";btn.onclick=()=>updatePlace(p.id)}},0)}\n''', js, count=1, flags=re.S)

# Canonical state boot and no window aliases.
js = re.sub(r'window\.(session|profile|places|myAds|favorites|plans|signup|lang|demo)\b', r'S.\1', js)

text = text[:start] + js + text[end:]
path.write_text(text, encoding='utf-8')
print('source state refactor prepared')