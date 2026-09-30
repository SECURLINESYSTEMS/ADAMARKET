from pathlib import Path

path=Path('index.html')
text=path.read_text(encoding='utf-8')
old="let session=null,profile=null,places=[],myAds=[],favorites=new Set(),plans=[],signup=false,lang='ru';"
new="""const AdamarketState = window.AdamarketState = Object.assign(window.AdamarketState || {}, {
  session:null, profile:null, places:[], myAds:[], favorites:new Set(), plans:[], signup:false, lang:localStorage.getItem('adamarket_lang')||'ru', demo:[]
});
const S=AdamarketState;"""
if old not in text: raise SystemExit('legacy state declaration not found')
text=text.replace(old,new,1)
start=text.index('<script>')+8; end=text.index('</script>',start); js=text[start:end]
keys={'session','profile','places','myAds','favorites','plans','signup','lang','demo'}

def rewrite(code):
    out=[];i=0;n=len(code);q=None;line=False;block=False;last_word=''
    while i<n:
        c=code[i]
        if line:
            out.append(c);line=c!='\n';i+=1;continue
        if block:
            out.append(c)
            if c=='*' and i+1<n and code[i+1]=='/':out.append('/');i+=2;block=False
            else:i+=1
            continue
        if q:
            out.append(c)
            if c=='\\' and i+1<n:out.append(code[i+1]);i+=2;continue
            if c==q:q=None
            i+=1;continue
        if c=='/' and i+1<n and code[i+1]=='/':out.extend('//');i+=2;line=True;continue
        if c=='/' and i+1<n and code[i+1]=='*':out.extend('/*');i+=2;block=True;continue
        if c in "'\"`":q=c;out.append(c);i+=1;continue
        if c.isalpha() or c in '_$':
            j=i+1
            while j<n and (code[j].isalnum() or code[j] in '_$'):j+=1
            word=code[i:j];prev=code[i-1] if i else '';k=j
            while k<n and code[k].isspace():k+=1
            if word in keys and prev!='.' and code[k:k+1] != ':' and last_word not in ('const','let','var','function'):
                out.append('S.'+word)
            else:out.append(word)
            last_word=word;i=j;continue
        out.append(c);i+=1
    return ''.join(out)

js=rewrite(js)
js=js.replace('const demo=', 'S.demo=').replace('let demo=', 'S.demo=').replace('var demo=', 'S.demo=')
for k in keys: js=js.replace(f'S.{k}:',f'{k}:')
js=js.replace('function setLang(l,f){S.lang=l;',"function setLang(l,f){S.lang=l;localStorage.setItem('adamarket_lang',l);localStorage.setItem('adamarket_flag',f);")
marker='<div class="full"><label class="label">Адрес</label><input id="fAddress" class="field"></div>'
if marker in text and 'id="fArea"' not in text:
    buttons=''.join(f'<button type="button" class="ghost" data-type="{x}">{x}</button>' for x in ['Баннер','LED-экран','Билборд','Вывеска','Объёмные буквы'])
    text=text.replace(marker,marker+'<div><label class="label">Площадь, м²</label><input id="fArea" class="field" type="number" min="0" step="0.01"></div><div><label class="label">Разрешённые форматы</label><div id="fAllowed" class="actions">'+buttons+'</div></div>',1)
text=text[:start]+js+text[end:]
path.write_text(text,encoding='utf-8')
print('frontend state centralized')
