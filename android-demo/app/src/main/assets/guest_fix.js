(function(){
'use strict';
const KEY='adamarket_guest_mode';
const protectedViews=['search','map','favorites','add','myads','plans','company','profile','admin'];
function isGuest(){return !window.session||!window.session.user;}
function openRegistration(){
  const auth=document.getElementById('authScreen'),app=document.getElementById('app');
  if(app)app.classList.add('hidden');
  if(auth)auth.classList.remove('hidden');
  const toggle=document.getElementById('toggleAuth'),title=document.getElementById('authTitle');
  if(toggle&&title&&/Войти|Sign in|Kirish/i.test(title.textContent||''))toggle.click();
  window.scrollTo({top:0,behavior:'smooth'});
}
window.openRegistration=openRegistration;
function showPublicHome(){
  localStorage.removeItem(KEY);
  const auth=document.getElementById('authScreen'),app=document.getElementById('app');
  if(auth)auth.classList.add('hidden');
  if(app)app.classList.remove('hidden');
  document.getElementById('topAvatar')?.classList.add('hidden');
  const n=document.getElementById('userNameTop');if(n)n.textContent='';
  const admin=document.getElementById('adminNav');if(admin)admin.classList.add('hidden');
  const homeBtn=document.querySelector('.side button[data-view="home"]');if(homeBtn)homeBtn.remove();
  const logout=document.querySelector('.side button[onclick*="logout"]');if(logout)logout.classList.add('hidden');
  if(typeof loadPlaces==='function')Promise.resolve(loadPlaces()).then(()=>{if(typeof go==='function')go('home')});
  else if(typeof go==='function')go('home');
}
function patchGo(){
  if(typeof window.go!=='function'||window.go.__adamPublicHome)return;
  const old=window.go;
  const f=function(id){if(isGuest()&&protectedViews.indexOf(id)>=0){openRegistration();return;}old(id)};
  f.__adamPublicHome=true;window.go=f;
}
function patchHomeActions(){
  const h=document.getElementById('home');if(!h||h.__adamPublicActions)return;
  h.__adamPublicActions=true;
  h.addEventListener('click',function(e){if(!isGuest())return;const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();openRegistration()},true);
}
function patchLogo(){const logo=document.querySelector('.logo');if(!logo||logo.__adamLogo)return;logo.__adamLogo=true;logo.style.cursor='pointer';logo.addEventListener('click',function(){if(typeof go==='function')go('home')})}
function init(){if(isGuest())showPublicHome();patchGo();patchHomeActions();patchLogo()}
function tick(){patchGo();patchHomeActions();patchLogo();if(isGuest()&&document.getElementById('authScreen')?.classList.contains('hidden')===false&&document.getElementById('app')?.classList.contains('hidden')===false)showPublicHome()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
setInterval(tick,700);
})();
