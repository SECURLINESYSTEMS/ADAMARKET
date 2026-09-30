from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

old = "let session=null,profile=null,places=[],myAds=[],favorites=new Set(),plans=[],signup=false,lang='ru';"
new = """const AdamarketState = window.AdamarketState = Object.assign(window.AdamarketState || {}, {
  session: null, profile: null, places: [], myAds: [], favorites: new Set(), plans: [], signup: false, lang: localStorage.getItem('adamarket_lang') || 'ru'
});
const S = AdamarketState;"""
if old in text:
    text = text.replace(old, new, 1)

start = text.index('<script>') + len('<script>')
end = text.index('</script>', start)
js = text[start:end]

for name in ('session', 'profile', 'places', 'myAds', 'favorites', 'plans', 'signup', 'lang'):
    js = re.sub(rf'(?<![.$\\w]){name}(?![\\w$])', f'S.{name}', js)
js = js.replace('const S = S.AdamarketState', 'const S = AdamarketState')

marker = '<div class="full"><label class="label">Адрес</label><input id="fAddress" class="field"></div>'
if marker in text and 'id="fArea"' not in text:
    buttons=''.join(f'<button type="button" class="ghost" data-type="{x}">{x}</button>' for x in ['Баннер','LED-экран','Билборд','Вывеска','Объёмные буквы'])
    insert = marker + '<div><label class="label">Площадь, м²</label><input id="fArea" class="field" type="number" min="0" step="0.01"></div><div><label class="label">Разрешённые форматы</label><div id="fAllowed" class="actions">'+buttons+'</div></div>'
    text = text.replace(marker, insert, 1)

old_set = "function toggleLang(){let m=document.getElementById(\"langmenu\");m.style.display=m.style.display===\"block\"?\"none\":\"block\"}function setLang(l,f){S.lang=l;flag.textContent=f;document.getElementById(\"langmenu\").style.display=\"none\";toast(l===\"ru\"?\"Русский\":\"Язык выбран\")}"
new_set = "function toggleLang(){let m=document.getElementById(\"langmenu\");m.style.display=m.style.display===\"block\"?\"none\":\"block\"}function setLang(l,f){S.lang=l;localStorage.setItem('adamarket_lang',l);localStorage.setItem('adamarket_flag',f);flag.textContent=f;document.getElementById(\"langmenu\").style.display=\"none\";toast(l===\"ru\"?\"Русский\":l===\"uz\"?\"O‘zbek\":\"English\")}"
if old_set in js:
    js = js.replace(old_set, new_set, 1)

text = text[:start] + js + text[end:]
path.write_text(text, encoding='utf-8')
print('centralized state and business form fields')
