from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old_s = 'function action(id){if(id==="search")return renderSearch();if(!S.session)return needAuth();if(id==="add")renderAdd();else if(id==="favorites")renderFav();else if(id==="profile")renderProfile();else if(id==="messages")renderMessages()}'
old_state = 'function action(id){if(id==="add"){if(!state.session)return needAuth();renderAdd()}else if(id==="search"){loadPlaces().finally(renderSearch)}else if(id==="favorites")renderFav();else if(id==="profile")state.session?renderProfile():needAuth();else if(id==="messages")renderMessages()}'
new_state = "function action(id){if(id===\"search\")return loadPlaces().finally(renderSearch);if(!state.session&&id!==\"search\")return needAuth();if(id===\"add\"){const role=state.profile?.account_type||state.profile?.role;if(role===\"manufacturer\")return renderProducer();if(role===\"business\"||role===\"admin\")return renderAdd();return renderSearch()}if(id===\"favorites\")return renderFav();if(id===\"profile\")return renderProfile();if(id===\"messages\")return renderMessages()}"
s = s.replace(old_s, new_state).replace(old_state, new_state)
s = s.replace('id="S.plans"', 'id="plans"').replace('getElementById("S.plans")', 'getElementById("plans")')

marker = '<div class="full"><label class="label">Адрес</label><input id="fAddress" class="field"></div>'
if 'id="fArea"' not in s and marker in s:
    extra = marker + '<div><label class="label">Площадь, м²</label><input id="fArea" class="field" type="number" min="0" step="0.01"></div><div class="full"><label class="label">Разрешённые форматы рекламы</label><div id="fAllowed" class="actions"><button type="button" class="ghost" data-type="Баннер">Баннер</button><button type="button" class="ghost" data-type="LED-экран">LED-экран</button><button type="button" class="ghost" data-type="Билборд">Билборд</button><button type="button" class="ghost" data-type="Вывеска">Вывеска</button><button type="button" class="ghost" data-type="Объёмные буквы">Объёмные буквы</button></div></div>'
    s = s.replace(marker, extra, 1)

assert 'function renderProducer()' in s
assert 'function createProducer()' in s
assert 'return renderProducer()' in s
assert 'id="S.plans"' not in s
assert 'id="plans"' in s
assert 'id="fArea"' in s
assert 'id="fAllowed"' in s
p.write_text(s, encoding='utf-8')
print('role flows ensured')
