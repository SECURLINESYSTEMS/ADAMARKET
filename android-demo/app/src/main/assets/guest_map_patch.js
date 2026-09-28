(function(){
'use strict';

/* ADAMARKET Android demo: Yandex map + guest browsing mode. */
const GUEST_KEY='adamarket_guest_mode';

function gt(s){
  const l=(typeof lang!=='undefined'?lang:'ru');
  const m={
    'Гостевой режим':{ru:'Гостевой режим',uz:'Mehmon rejimi',en:'Guest mode'},
    'Гостевой режим включён':{ru:'Гостевой режим включён',uz:'Mehmon rejimi yoqildi',en:'Guest mode enabled'},
    'Войти':{ru:'Войти',uz:'Kirish',en:'Sign in'},
    'Выйти':{ru:'Выйти',uz:'Chiqish',en:'Log out'},
    'Эта функция доступна после регистрации':{ru:'Эта функция доступна после регистрации',uz:'Bu funksiya ro‘yxatdan o‘tgandan keyin mavjud',en:'This feature is available after registration'},
    'На карте':{ru:'На карте',uz:'Xaritada',en:'On the map'},
    'рекламных мест.':{ru:'рекламных мест.',uz:'reklama joyi.',en:'advertising places.'},
    'Пока нет рекламных мест с координатами.':{ru:'Пока нет рекламных мест с координатами.',uz:'Hozircha koordinatalari ko‘rsatilgan reklama joylari yo‘q.',en:'There are no advertising places with coordinates yet.'},
    'Геолокация недоступна':{ru:'Геолокация недоступна',uz:'Geolokatsiya mavjud emas',en:'Geolocation unavailable'},
    'Определяем точное местоположение…':{ru:'Определяем точное местоположение…',uz:'Aniq joylashuv aniqlanmoqda…',en:'Detecting precise location…'},
    'Местоположение определено по GPS':{ru:'Местоположение определено по GPS',uz:'Joylashuv GPS orqali aniqlandi',en:'Location detected by GPS'},
    'Разрешите точную геолокацию':{ru:'Разрешите точную геолокацию',uz:'Aniq geolokatsiyaga ruxsat bering',en:'Allow precise location'},
    'GPS не успел определить точку':{ru:'GPS не успел определить точку',uz:'GPS nuqtani aniqlashga ulgurmayapti',en:'GPS timed out'},
    'Не удалось определить местоположение':{ru:'Не удалось определить местоположение',uz:'Joylashuvni aniqlab bo‘lmadi',en:'Unable to determine location'},
    'Подробнее':{ru:'Подробнее',uz:'Batafsil',en:'Details'}
  };
  return m[s]?.[l]||s;
}
const t=gt;

function addGuestButton(){
  const box=document.querySelector('.authbox');
  if(!box || document.getElementById('guestModeBtn')) return;
  const b=document.createElement('button');
  b.id='guestModeBtn';
  b.className='btn ghost';
  b.style.cssText='width:100%;margin-top:10px;border:1px solid #e1e3e8';
  b.textContent='👁️ '+t('Гостевой режим');
  b.onclick=enterGuest;
  const toggle=document.getElementById('toggleAuth');
  if(toggle) toggle.insertAdjacentElement('beforebegin',b); else box.appendChild(b);
}

function setGuestUi(isGuest){
  const ids=['topAvatar','adminNav'];
  ids.forEach(id=>{const e=document.getElementById(id);if(e)e.classList.toggle('hidden',isGuest);});
  document.querySelectorAll('.side button').forEach(b=>{
    const v=b.dataset.view;
    if(isGuest && ['favorites','add','myads','plans','company','profile','admin'].includes(v)) b.classList.add('hidden');
  });
  const logoutBtn=document.querySelector('.side button[onclick*="logout"]');
  if(logoutBtn){
    logoutBtn.textContent=isGuest?'↪ '+t('Войти'):'↪ '+t('Выйти');
    logoutBtn.onclick=isGuest?function(){exitGuest();}:function(){logout();};
  }
  const topName=document.getElementById('userNameTop');
  if(topName) topName.textContent=isGuest?'Гость':'';
}

async function enterGuest(){
  localStorage.setItem(GUEST_KEY,'1');
  document.getElementById('authScreen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
  setGuestUi(true);
  try{
    if(typeof loadPlaces==='function') await loadPlaces();
    if(typeof renderHome==='function') renderHome();
    if(typeof renderSearch==='function') renderSearch();
    if(typeof go==='function') go('home');
    toast(t('Гостевой режим включён'));
  }catch(e){
    toast('Не удалось загрузить рекламные места');
  }
}

function exitGuest(){localStorage.removeItem(GUEST_KEY);location.reload();}

function guestGuard(){
  if(localStorage.getItem(GUEST_KEY)!=='1') return false;
  setGuestUi(true);
  return true;
}

function patchAuthGuest(){
  const old=document.getElementById('authForm');
  if(old && !old.dataset.guestGuard){
    old.dataset.guestGuard='1';
    old.addEventListener('submit',function(){localStorage.removeItem(GUEST_KEY);},true);
  }
}

function yandexUrl(lat,lng,zoom,arr){
  const pts=(arr||[]).map((p,i)=>{
    const lo=Number(p.longitude),la=Number(p.latitude);
    return Number.isFinite(lo)&&Number.isFinite(la)?(lo+','+la+',pm2rdm'+(i%9+1)):'';
  }).filter(Boolean).join('~');
  const ll=(Number.isFinite(Number(lng))&&Number.isFinite(Number(lat)))
    ? Number(lng).toFixed(6)+','+Number(lat).toFixed(6)
    : '69.2797,41.3111';
  return 'https://yandex.com/map-widget/v1/?ll='+encodeURIComponent(ll)+'&z='+(zoom||11)+'&l=map'+(pts?'&pt='+encodeURIComponent(pts):'');
}

function renderYandexMap(){
  const el=document.getElementById('mapBox');
  if(!el) return;
  const arr=(typeof places!=='undefined'?places:[]).filter(p=>Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude)));
  const lat=Number(el.dataset.lat||41.3111),lng=Number(el.dataset.lng||69.2797),zoom=Number(el.dataset.zoom||11);
  el.innerHTML='<iframe id="adamYandexMap" title="Yandex Maps" style="width:100%;height:100%;border:0;border-radius:18px" loading="lazy" allowfullscreen src="'+yandexUrl(lat,lng,zoom,arr)+'"></iframe>';
  const hint=document.getElementById('mapHint');
  if(hint) hint.textContent=arr.length?(t('На карте')+' '+arr.length+' '+(typeof lang!=='undefined'&&lang==='uz'?'reklama joyi.':typeof lang!=='undefined'&&lang==='en'?'advertising places.':'рекламных мест.')):t('Пока нет рекламных мест с координатами.');
  let list=document.getElementById('adamYandexList');
  if(!list){list=document.createElement('div');list.id='adamYandexList';list.style.cssText='display:grid;gap:10px;margin-top:14px';el.parentElement?.appendChild(list);}
  list.innerHTML=arr.length?arr.map(p=>'<div style="background:#fff;border:1px solid #e6e8ec;border-radius:16px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px"><div><b>'+esc(p.title||'Рекламное место')+'</b><div class="meta">'+esc(p.type||'Реклама')+' · '+money(p.price)+' / '+unit(p.unit)+'</div></div><button class="btn dark" style="white-space:nowrap" onclick="openPlace('+p.id+')">'+t('Подробнее')+'</button></div>').join(''):'';
}

function patchMap(){
  if(typeof window.renderMap!=='function'||window.renderMap.__adamYandex)return;
  const f=function(){renderYandexMap();};
  f.__adamYandex=true;
  window.renderMap=f;
}

function patchLocate(){
  window.locateMe=function(){
    if(!navigator.geolocation)return toast(t('Геолокация недоступна'));
    toast(t('Определяем точное местоположение…'));
    navigator.geolocation.getCurrentPosition(pos=>{
      const el=document.getElementById('mapBox');
      if(el){el.dataset.lat=pos.coords.latitude;el.dataset.lng=pos.coords.longitude;el.dataset.zoom='16';}
      renderYandexMap();
      toast(t('Местоположение определено по GPS')+' · ±'+Math.round(pos.coords.accuracy)+' m');
    },err=>toast(err.code===1?t('Разрешите точную геолокацию'):err.code===3?t('GPS не успел определить точку'):t('Не удалось определить местоположение')),{enableHighAccuracy:true,timeout:30000,maximumAge:0});
  };
}

function patchGo(){
  if(typeof window.go!=='function'||window.go.__adamGuest)return;
  const old=window.go;
  const f=function(id){
    if(localStorage.getItem(GUEST_KEY)==='1'&&['favorites','add','myads','plans','company','profile','admin'].includes(id)){
      toast(t('Эта функция доступна после регистрации'));
      return;
    }
    old(id);
    if(id==='map')setTimeout(renderYandexMap,100);
  };
  f.__adamGuest=true;
  window.go=f;
}

function patchGuestActions(){
  if(localStorage.getItem(GUEST_KEY)!=='1')return;
  if(typeof window.requestPlace==='function'&&!window.requestPlace.__adamGuest){
    const oldReq=window.requestPlace;
    const f=function(id){
      if(localStorage.getItem(GUEST_KEY)==='1'){closeModal();toast(t('Эта функция доступна после регистрации'));return;}
      return oldReq(id);
    };
    f.__adamGuest=true;window.requestPlace=f;
  }
  if(typeof window.toggleFav==='function'&&!window.toggleFav.__adamGuest){
    const oldFav=window.toggleFav;
    const f=function(id){
      if(localStorage.getItem(GUEST_KEY)==='1'){toast(t('Эта функция доступна после регистрации'));return;}
      return oldFav(id);
    };
    f.__adamGuest=true;window.toggleFav=f;
  }
}

function init(){
  addGuestButton();
  patchAuthGuest();
  patchMap();
  patchLocate();
  patchGo();
  patchGuestActions();
  if(guestGuard())setTimeout(enterGuest,50);
}

const obs=new MutationObserver(()=>{
  addGuestButton();
  patchAuthGuest();
  patchMap();
  patchLocate();
  patchGo();
  patchGuestActions();
  if(localStorage.getItem(GUEST_KEY)==='1')setGuestUi(true);
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
obs.observe(document.body,{childList:true,subtree:true});
})();