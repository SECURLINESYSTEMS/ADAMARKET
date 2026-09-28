(function(){
'use strict';
const KEY='adamarket_guest_mode';
const protectedViews=['favorites','add','myads','plans','company','profile','admin'];
const text={
 ru:{guest:'👁️ Гостевой режим',enabled:'Гостевой режим включён',login:'↪ Войти',logout:'↪ Выйти',locked:'Эта функция доступна после регистрации',details:'Подробнее',count:'рекламных мест.',empty:'Пока нет рекламных мест с координатами.',loc:'Моё местоположение',geo:'Определяем точное местоположение…',gps:'Местоположение определено по GPS',geoerr:'Не удалось определить местоположение'},
 uz:{guest:'👁️ Mehmon rejimi',enabled:'Mehmon rejimi yoqildi',login:'↪ Kirish',logout:'↪ Chiqish',locked:'Bu funksiya ro‘yxatdan o‘tgandan keyin mavjud',details:'Batafsil',count:'reklama joyi.',empty:'Hozircha koordinatalari ko‘rsatilgan reklama joylari yo‘q.',loc:'Mening joylashuvim',geo:'Aniq joylashuv aniqlanmoqda…',gps:'Joylashuv GPS orqali aniqlandi',geoerr:'Joylashuvni aniqlab bo‘lmadi'},
 en:{guest:'👁️ Guest mode',enabled:'Guest mode enabled',login:'↪ Sign in',logout:'↪ Log out',locked:'This feature is available after registration',details:'Details',count:'advertising places.',empty:'There are no advertising places with coordinates yet.',loc:'My location',geo:'Detecting precise location…',gps:'Location detected by GPS',geoerr:'Unable to determine location'}
};
function L(){return text[typeof lang!=='undefined'?lang:'ru']||text.ru}
function guest(){return localStorage.getItem(KEY)==='1'}
function setGuestUi(){
 const g=guest();
 document.querySelectorAll('.side button[data-view]').forEach(b=>b.classList.toggle('hidden',g&&protectedViews.indexOf(b.dataset.view)>=0));
 const av=document.getElementById('topAvatar'); if(av) av.classList.toggle('hidden',g);
 const an=document.getElementById('adminNav'); if(an) an.classList.toggle('hidden',g);
 const top=document.getElementById('userNameTop'); if(top&&top.textContent!== (g?'Гость':'')) top.textContent=g?'Гость':'';
 const out=document.querySelector('.side button[onclick*="logout"],.side button[data-adam-logout]');
 if(out){out.dataset.adamLogout='1';const wanted=g?L().login:L().logout;if(out.textContent!==wanted)out.textContent=wanted;out.onclick=g?exitGuest:window.logout;}
}
function enterGuest(){
 if(guest()){showApp();setGuestUi();if(typeof loadPlaces==='function'&&!window.__adamGuestLoaded){window.__adamGuestLoaded=true;Promise.resolve(loadPlaces()).then(function(){if(typeof renderHome==='function')renderHome();if(typeof renderSearch==='function')renderSearch();if(typeof go==='function')go('home');});}else if(typeof go==='function')go('home');return;}
 localStorage.setItem(KEY,'1');showApp();setGuestUi();
 if(typeof loadPlaces==='function'&&!window.__adamGuestLoaded){window.__adamGuestLoaded=true;Promise.resolve(loadPlaces()).then(function(){if(typeof renderHome==='function')renderHome();if(typeof renderSearch==='function')renderSearch();if(typeof go==='function')go('home');toast(L().enabled);});}
}
function exitGuest(){localStorage.removeItem(KEY);location.reload()}
function showApp(){const a=document.getElementById('authScreen'),b=document.getElementById('app');if(a)a.classList.add('hidden');if(b)b.classList.remove('hidden')}
function addGuestButton(){
 const box=document.querySelector('.authbox'); if(!box||document.getElementById('guestModeBtn'))return;
 const b=document.createElement('button');b.id='guestModeBtn';b.className='btn ghost';b.style.cssText='width:100%;margin-top:10px;border:1px solid #e1e3e8';b.onclick=enterGuest;b.textContent=L().guest;
 const t=document.getElementById('toggleAuth');if(t)t.insertAdjacentElement('beforebegin',b);else box.appendChild(b);
}
function patchGo(){
 if(typeof window.go!=='function'||window.go.__adamGuest)return;
 const old=window.go;const f=function(id){if(guest()&&protectedViews.indexOf(id)>=0){toast(L().locked);return;}old(id);if(id==='map')setTimeout(renderYandex,150)};f.__adamGuest=true;window.go=f;
}
function yurl(lat,lng,zoom,arr){
 const pts=(arr||[]).map(function(p,i){const la=Number(p.latitude),lo=Number(p.longitude);return Number.isFinite(la)&&Number.isFinite(lo)?lo.toFixed(6)+','+la.toFixed(6)+',pm2rdm'+((i%9)+1):''}).filter(Boolean).join('~');
 const ll=Number(lng).toFixed(6)+','+Number(lat).toFixed(6);
 return 'https://yandex.com/map-widget/v1/?ll='+encodeURIComponent(ll)+'&z='+(zoom||11)+'&l=map'+(pts?'&pt='+encodeURIComponent(pts):'');
}
function renderYandex(){
 const el=document.getElementById('mapBox');if(!el)return;
 const arr=(typeof places!=='undefined'?places:[]).filter(function(p){return Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude));});
 const lat=Number(el.dataset.lat||41.3111),lng=Number(el.dataset.lng||69.2797),zoom=Number(el.dataset.zoom||11);
 const old=el.querySelector('#adamYandexMap');if(!old||old.dataset.key!==String(lat)+','+String(lng)+','+String(arr.length)){el.innerHTML='<iframe id="adamYandexMap" data-key="'+String(lat)+','+String(lng)+','+String(arr.length)+'" title="Yandex Maps" style="width:100%;height:100%;border:0;border-radius:18px" loading="lazy" allowfullscreen src="'+yurl(lat,lng,zoom,arr)+'"></iframe>';}
 const hint=document.getElementById('mapHint');if(hint)hint.textContent=arr.length?(L().count.replace('рекламных мест.','')+arr.length+' '+L().count):L().empty;
 let list=document.getElementById('adamYandexList');if(!list){list=document.createElement('div');list.id='adamYandexList';list.style.cssText='display:grid;gap:10px;margin-top:14px';const p=el.parentElement;if(p)p.appendChild(list);}
 const html=arr.map(function(p){return '<div style="background:#fff;border:1px solid #e6e8ec;border-radius:16px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px"><div><b>'+esc(p.title||'Рекламное место')+'</b><div class="meta">'+esc(p.type||'Реклама')+' · '+money(p.price)+' / '+unit(p.unit)+'</div></div><button class="btn dark" style="white-space:nowrap" onclick="openPlace('+p.id+')">'+L().details+'</button></div>';}).join('');
 if(list.innerHTML!==html)list.innerHTML=html;
}
function patchMap(){
 if(typeof window.renderMap!=='function'||window.renderMap.__adamYandex)return;
 const f=function(){renderYandex()};f.__adamYandex=true;window.renderMap=f;
}
function patchLocate(){window.locateMe=function(){if(!navigator.geolocation)return toast(L().geoerr);toast(L().geo);navigator.geolocation.getCurrentPosition(function(pos){const e=document.getElementById('mapBox');if(e){e.dataset.lat=pos.coords.latitude;e.dataset.lng=pos.coords.longitude;e.dataset.zoom='16'}renderYandex();toast(L().gps+' · ±'+Math.round(pos.coords.accuracy)+' m')},function(){toast(L().geoerr)},{enableHighAccuracy:true,timeout:30000,maximumAge:0})}}
function patchAuthButton(){const b=document.getElementById('guestModeBtn');if(b&&b.textContent!==L().guest)b.textContent=L().guest}
function init(){addGuestButton();patchGo();patchMap();patchLocate();if(guest())enterGuest();setGuestUi();patchAuthButton()}
function tick(){addGuestButton();patchGo();patchMap();setGuestUi();patchAuthButton();if(guest()&&document.getElementById('map')&&!document.getElementById('map').classList.contains('hidden'))renderYandex()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
setInterval(tick,1000);
})();