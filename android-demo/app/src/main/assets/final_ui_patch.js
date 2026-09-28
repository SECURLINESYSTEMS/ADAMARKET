(function(){
'use strict';
function css(){
 if(document.getElementById('adamFinalPatchStyles')) return;
 const s=document.createElement('style'); s.id='adamFinalPatchStyles'; s.textContent=`
@media(max-width:850px){
 .side{order:-1;display:flex!important;gap:6px;overflow-x:auto;padding:0 2px 4px;margin:0 0 8px;scrollbar-width:none}
 .side::-webkit-scrollbar{display:none}
 .side button{display:none!important}
 .side button[data-view="search"],.side button[data-view="map"],.side button[data-view="favorites"]{display:flex!important;flex:0 0 auto;width:auto!important;min-width:88px;justify-content:center;align-items:center;text-align:center;background:#f0f1f3!important;color:#555!important;border-radius:16px!important;padding:12px 16px!important;margin:0!important;font-size:16px}
 .side button[data-view="search"] span:first-child,.side button[data-view="map"] span:first-child,.side button[data-view="favorites"] span:first-child{background:transparent!important;margin-right:6px!important;width:auto!important}
 .hero{margin-top:6px;border-radius:28px;min-height:330px;padding:30px 28px;display:flex;flex-direction:column;justify-content:flex-start}
 .hero h1{font-size:40px;line-height:1.02;max-width:360px;margin-top:4px}
 .hero p{font-size:17px;line-height:1.5;max-width:360px}
 .hero .btn{align-self:flex-start;margin-top:8px;padding:14px 20px;border-radius:18px;font-size:16px}
 .section{margin-top:28px}
 .sectionhead h2{font-size:27px}
 .chips{gap:9px}
 .chip{padding:11px 16px;border-radius:17px;font-size:15px}
 .cards{gap:12px}
 .card{grid-template-columns:205px 1fr;min-height:190px;border-radius:22px;padding:10px}
 .cardimg{width:205px;height:190px;border-radius:18px}
 .title{font-size:19px}
 .price{font-size:20px}
}
@media(max-width:560px){
 .top{height:76px}
 .topin{padding:0 18px}
 .logo{font-size:27px;letter-spacing:-1.6px}
 .topright{gap:8px}
 .tag{display:none}
 .topright:before{content:'🇷🇺';display:grid;place-items:center;width:42px;height:42px;border:1px solid #e4e6ea;border-radius:13px;background:#fff;font-size:21px}
 #userNameTop{display:block;font-size:17px;color:#222;max-width:92px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .avatar{width:44px;height:44px;border-radius:14px}
 .wrap{padding:14px 14px 30px}
 .layout{display:flex!important;flex-direction:column!important;gap:0!important}
 .main{width:100%}
 .hero{min-height:350px;padding:32px 28px}
 .hero h1{font-size:38px}
 .hero p{font-size:16px}
 .cards{grid-template-columns:1fr}
 .card{grid-template-columns:1fr 1fr;min-height:180px}
 .cardimg{width:100%;height:175px}
}
#adamRoleWrap .adam-role-grid,#adamRoleWrap #adamRoleNote,#adamRoleWrap>label:first-child{display:none!important}
#adamRoleWrap{display:block!important;background:transparent!important;border:0!important;padding:0!important;margin:12px 0 0!important}
#adamRoleWrap>div:has(#authInn){display:block!important}
#adamRoleWrap #authInn{display:block!important}
`;
 document.head.appendChild(s);
}
function patchRegistration(){
 const wrap=document.getElementById('adamRoleWrap');
 const title=document.getElementById('authTitle');
 if(!wrap||!title) return;
 const isReg=/Создать|Create|Ro['’‘]yxatdan/i.test(title.textContent||'');
 wrap.classList.toggle('hidden',!isReg);
 if(!isReg) return;
 const roles=wrap.querySelector('.adam-role-grid'); if(roles) roles.style.display='none';
 const note=wrap.querySelector('#adamRoleNote'); if(note) note.style.display='none';
 const firstLabel=wrap.querySelector(':scope > label'); if(firstLabel) firstLabel.style.display='none';
 const inn=wrap.querySelector('#authInn');
 if(inn){
   const parent=inn.parentElement;
   let label=parent.querySelector('[data-inn-label]');
   if(!label){label=document.createElement('label');label.className='label';label.dataset.innLabel='1';label.textContent='ИНН фирмы *';parent.insertBefore(label,inn)}
   localStorage.setItem('adamarket_role','business');
 }
}
function patchHeader(){
 const logo=document.querySelector('.logo'); if(!logo||logo.dataset.finalHeader)return;
 logo.dataset.finalHeader='1';
 const tr=document.querySelector('.topright');
 if(tr && !document.getElementById('adamLangFlag')){
   const f=document.createElement('button');f.id='adamLangFlag';f.type='button';f.textContent='🇷🇺';
   f.title='Русский';f.style.cssText='width:44px;height:44px;border:1px solid #e4e6ea;border-radius:13px;background:#fff;font-size:21px;display:grid;place-items:center;cursor:pointer';
   f.onclick=()=>typeof toast==='function'&&toast('Язык: Русский');
   tr.insertBefore(f,tr.firstChild);
 }
}
css();patchHeader();patchRegistration();setInterval(()=>{patchHeader();patchRegistration()},500);
})();
