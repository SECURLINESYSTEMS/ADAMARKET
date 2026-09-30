from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')
start = text.index('<script>') + len('<script>')
end = text.index('</script>', start)
js = text[start:end]

# Remove everything from the first boot IIFE onward. The historical file had
# several duplicated boot/logout/lang fragments appended after the real app.
boot_idx = js.find('\n(async()=>')
if boot_idx >= 0:
    js = js[:boot_idx]

# Remove any legacy state declaration, then install one canonical source.
js = re.sub(r'\b(?:let|var|const)\s+(?:session|profile|places|myAds|favorites|plans|signup|lang)\s*(?:=[^;]+)?;', '', js)
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
if 'window.AdamarketState' in js:
    js = re.sub(r'const\s+AdamarketState\s*=.*?const\s+S\s*=\s*(?:AdamarketState|window\.AdamarketState);\s*', state, js, count=1, flags=re.S)
else:
    pos = js.index('const SUPA_URL=')
    js = js[:pos] + state + js[pos:]

# Lexically rewrite state identifiers so strings/comments/property keys are not touched.
keys = {'session','profile','places','myAds','favorites','plans','signup','lang','demo'}
def rewrite(code):
    out=[]; i=0; quote=None; line=False; block=False; n=len(code)
    while i<n:
        c=code[i]
        if line:
            out.append(c); line=(c!='\n'); i+=1; continue
        if block:
            out.append(c)
            if c=='*' and i+1<n and code[i+1]=='/': out.append('/'); i+=2; block=False
            else: i+=1
            continue
        if quote:
            out.append(c)
            if c=='\\' and i+1<n: out.append(code[i+1]); i+=2; continue
            if c==quote: quote=None
            i+=1; continue
        if c=='/' and i+1<n and code[i+1]=='/': out.extend('//'); i+=2; line=True; continue
        if c=='/' and i+1<n and code[i+1]=='*': out.extend('/*'); i+=2; block=True; continue
        if c in "'\"`": quote=c; out.append(c); i+=1; continue
        if c.isalpha() or c in '_$':
            j=i+1
            while j<n and (code[j].isalnum() or code[j] in '_$'): j+=1
            word=code[i:j]
            k=j
            while k<n and code[k].isspace(): k+=1
            prev=code[i-1] if i else ''
            if word in keys and prev!='.' and code[k:k+1] != ':': out.append('S.'+word)
            else: out.append(word)
            i=j; continue
        out.append(c); i+=1
    return ''.join(out)
js = rewrite(js)
js = re.sub(r'(?:S\.)+demo\b', 'S.demo', js)
js = js.replace('const demo=[', 'S.demo=[')

# Explicit DOM references for auth/search/forms/map.
for name in ['aName','aPhone','aInn','aEmail','aPass','searchQ','results','fTitle','fType','fPrice','fCity','fDistrict','fAddress','fLat','fLng','fDesc','fPhotos','fArea','fAllowed','flag']:
    js = re.sub(rf'(?<![.\w"\']){name}(?=\.value|\.textContent|\.innerHTML|\.required|\?\.)', f'document.getElementById("{name}")', js)
js = js.replace('document.getElementById("S.signupFields")', 'document.getElementById("signupFields")')
js = js.replace('document.getElementById("S.langmenu")', 'document.getElementById("langmenu")')
js = js.replace('API+"?action=S.plans"', 'API+"?action=plans"').replace('API+"?action=S.places"', 'API+"?action=places"')

# Guest search is public; all other actions are protected.
js = re.sub(r'function action\(id\)\{.*?\}', 'function action(id){if(id==="search")return renderSearch();if(!S.session)return needAuth();if(id==="add")renderAdd();else if(id==="favorites")renderFav();else if(id==="profile")renderProfile();else if(id==="messages")renderMessages()}', js, count=1, flags=re.S)

# Replace auth handler with explicit DOM access.
auth_marker = 'document.getElementById("authForm").onsubmit='
if auth_marker in js:
    i=js.index(auth_marker); j=js.find('\nfunction renderHome',i)
    if j<0: raise SystemExit('auth handler boundary missing')
    auth='''document.getElementById("authForm").onsubmit=async e=>{e.preventDefault();const nameEl=document.getElementById("aName"),phoneEl=document.getElementById("aPhone"),innEl=document.getElementById("aInn"),emailEl=document.getElementById("aEmail"),passEl=document.getElementById("aPass");try{if(S.signup){const inn=innEl.value.replace(/\\s/g,"");if(!/^[0-9]{9,14}$/.test(inn))throw Error("ИНН фирмы: 9–14 цифр");const {data,error}=await sb.auth.signUp({email:emailEl.value.trim(),password:passEl.value,options:{data:{full_name:nameEl.value.trim(),phone:phoneEl.value.trim(),inn}}});if(error)throw error;if(!data.session){toast("Проверьте email для подтверждения");return}}else{const {error}=await sb.auth.signInWithPassword({email:emailEl.value.trim(),password:passEl.value});if(error)throw error}closeAuth();const current=await sb.auth.getSession();S.session=current.data.session||null;if(S.session)await bootstrap();renderHome()}catch(e){toast(e.message)}};\n'''
    js=js[:i]+auth+js[j+1:]

# Ensure business fields exist in source HTML.
form_marker='<div class="full"><label class="label">Адрес</label><input id="fAddress" class="field"></div>'
if 'id="fArea"' not in text:
    extra=form_marker+'<div><label class="label">Площадь, м²</label><input id="fArea" class="field" type="number" min="0" step="0.01"></div><div class="full"><label class="label">Разрешённые форматы рекламы</label><div id="fAllowed" class="actions">'+''.join(f'<button type="button" class="ghost" data-type="{x}">{x}</button>' for x in ['Баннер','LED-экран','Билборд','Вывеска','Объёмные буквы'])+'</div></div>'
    text=text.replace(form_marker,extra,1)

# Create/update payloads use the real form fields and preserve existing metadata.
if 'area_m2:document.getElementById("fArea")' not in js:
    js=js.replace('description:document.getElementById("fDesc").value};await api("create_place",{place});','description:document.getElementById("fDesc").value,area_m2:document.getElementById("fArea")?.value?Number(document.getElementById("fArea").value):null,allowed_ad_types:[...(document.getElementById("fAllowed")?.querySelectorAll(".primary")||[])].map(x=>x.dataset.type)};await api("create_place",{place});')
if 'async function updatePlace(' not in js:
    anchor='async function toggleFav('
    update='''async function updatePlace(id){try{const p=S.myAds.find(x=>x.id===id);if(!p)throw Error("Объявление не найдено");const allowed=[...(document.getElementById("fAllowed")?.querySelectorAll(".primary")||[])].map(x=>x.dataset.type);const place={title:document.getElementById("fTitle").value,type:document.getElementById("fType").value,price:document.getElementById("fPrice").value,unit:p.unit||"month",city:document.getElementById("fCity").value,district:document.getElementById("fDistrict").value,address:document.getElementById("fAddress").value,latitude:document.getElementById("fLat").value?Number(document.getElementById("fLat").value):null,longitude:document.getElementById("fLng").value?Number(document.getElementById("fLng").value):null,description:document.getElementById("fDesc").value,reach:p.reach??null,traffic:p.traffic??null,images:Array.isArray(p.images)?p.images:[],cover_image:p.cover_image??(Array.isArray(p.images)?p.images[0]:null),area_m2:document.getElementById("fArea")?.value?Number(document.getElementById("fArea").value):(p.area_m2??null),allowed_ad_types:allowed.length?allowed:(p.allowed_ad_types||[])};await api("update_place",{placeId:id,place});toast("Изменения сохранены");await bootstrap();renderMyAds()}catch(e){toast(e.message)}}\n'''
    js=js.replace(anchor,update+anchor,1)

# Edit selected record and switch submit button to updatePlace.
edit_re=r'async function editPlace\(id\)\{.*?\n\}'
edit='''async function editPlace(id){const p=S.myAds.find(x=>x.id===id);if(!p)return;renderAdd();setTimeout(()=>{document.getElementById("fTitle").value=p.title||"";document.getElementById("fType").value=p.type||"Баннер";document.getElementById("fPrice").value=p.price||"";document.getElementById("fCity").value=p.city||"Ташкент";document.getElementById("fDistrict").value=p.district||"";document.getElementById("fAddress").value=p.address||"";document.getElementById("fLat").value=p.latitude??"";document.getElementById("fLng").value=p.longitude??"";document.getElementById("fDesc").value=p.description||"";if(document.getElementById("fArea"))document.getElementById("fArea").value=p.area_m2??"";if(document.getElementById("fAllowed"))document.getElementById("fAllowed").querySelectorAll("[data-type]").forEach(b=>b.classList.toggle("primary",(p.allowed_ad_types||[]).includes(b.dataset.type)));const btn=document.querySelector('#content .primary[onclick="createPlace()"]');if(btn){btn.textContent="Сохранить изменения";btn.onclick=()=>updatePlace(p.id)}},0)}\n'''
js=re.sub(edit_re,edit,js,count=1,flags=re.S)

# Language persistence and canonical boot.
js=re.sub(r'function toggleLang\(\)\{.*?\}', 'function toggleLang(){const m=document.getElementById("langmenu");m.style.display=m.style.display==="block"?"none":"block"}', js, count=1, flags=re.S)
js=re.sub(r'function setLang\(l,f\)\{.*?\}', '''function setLang(l,f){S.lang=l;localStorage.setItem('adamarket_lang',l);localStorage.setItem('adamarket_flag',f);document.getElementById("flag").textContent=f;document.getElementById("langmenu").style.display="none";toast(l==="ru"?"Русский":l==="uz"?"O‘zbek":"English")}''', js, count=1, flags=re.S)
js += '\n(async()=>{const {data}=await sb.auth.getSession();if(data.session){S.session=data.session;try{await bootstrap()}catch(e){S.session=null;S.profile=null}}await loadPlaces();renderHome()})();\n'

text=text[:start]+js+text[end:]
path.write_text(text,encoding='utf-8')
print('source state refactor prepared')