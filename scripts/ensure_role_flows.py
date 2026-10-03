from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
old='function action(id){if(id==="search")return renderSearch();if(!S.session)return needAuth();if(id==="add")renderAdd();else if(id==="favorites")renderFav();else if(id==="profile")renderProfile();else if(id==="messages")renderMessages()}'
new='function action(id){if(id==="search")return renderSearch();if(!S.session)return needAuth();if(id==="add"){const role=S.profile?.account_type||S.profile?.role;if(role==="manufacturer")return renderProducer();if(role==="business"||role==="admin")return renderAdd();return renderSearch()}if(id==="favorites")return renderFav();if(id==="profile")return renderProfile();if(id==="messages")return renderMessages()}'
if old in s:s=s.replace(old,new,1)

# Keep DOM ids literal; never leak the canonical state token into HTML ids.
s=s.replace('id="S.plans"','id="plans"').replace('getElementById("S.plans")','getElementById("plans")')

# Business advertising-place fields must exist in the actual form because
# create/update flows persist them.
marker='<div class="full"><label class="label">Адрес</label><input id="fAddress" class="field"></div>'
if 'id="fArea"' not in s and marker in s:
    extra=marker+'<div><label class="label">Площадь, м²</label><input id="fArea" class="field" type="number" min="0" step="0.01"></div><div class="full"><label class="label">Разрешённые форматы рекламы</label><div id="fAllowed" class="actions">'+''.join(f'<button type="button" class="ghost" data-type="{x}">{x}</button>' for x in ['Баннер','LED-экран','Билборд','Вывеска','Объёмные буквы'])+'</div></div>'
    s=s.replace(marker,extra,1)

if 'function renderProducer()' not in s:
    anchor='function renderAdd(){'
    producer='''function renderProducer(){if(!S.session)return needAuth();document.getElementById("content").innerHTML=`<div class="page"><div class="head"><h1 class="pageTitle">Разместить производство</h1><button class="ghost" onclick="goHome()">Отмена</button></div><div class="panel"><div class="formgrid"><div class="full"><label class="label">Название компании *</label><input id="pCompany" class="field"></div><div><label class="label">Город *</label><input id="pCity" class="field" value="Ташкент"></div><div><label class="label">Район</label><input id="pDistrict" class="field"></div><div class="full"><label class="label">Что изготавливаете *</label><div id="pCats" class="actions">${["Баннеры","Объёмные буквы","Вывески","Световые короба","LED-экраны","Билборды","Плёнка / наклейки"].map(x=>`<button type="button" class="ghost" data-cat="${esc(x)}">${esc(x)}</button>`).join("")}</div></div><div class="full"><label class="label">Описание</label><textarea id="pDesc" class="field" rows="5"></textarea></div><div class="full"><button class="primary" onclick="createProducer()">Отправить на модерацию</button></div></div></div></div>`;document.getElementById("pCats").querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{b.classList.toggle("primary");b.classList.toggle("ghost")})}
async function createProducer(){try{const categories=[...document.getElementById("pCats").querySelectorAll(".primary")].map(x=>x.dataset.cat);if(!categories.length)throw Error("Выберите хотя бы одну категорию производства");await api("create_producer",{producer:{company_name:document.getElementById("pCompany").value.trim(),city:document.getElementById("pCity").value.trim(),district:document.getElementById("pDistrict").value.trim(),description:document.getElementById("pDesc").value.trim(),categories}});toast("Услуга отправлена на проверку");await bootstrap();renderProfile()}
catch(e){toast(e.message)}}
'''
    if anchor not in s: raise SystemExit('renderAdd anchor missing')
    s=s.replace(anchor,producer+anchor,1)

assert 'function renderProducer()' in s
assert 'function createProducer()' in s
assert 'return renderProducer()' in s
assert 'id="S.plans"' not in s
assert 'id="plans"' in s
assert 'id="fArea"' in s
assert 'id="fAllowed"' in s
p.write_text(s,encoding='utf-8')
print('role flows ensured')
