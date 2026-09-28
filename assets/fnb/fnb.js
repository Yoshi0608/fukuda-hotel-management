/* FHM Food & Beverage LP — locale, disclosure menu, composed contact links.
   No network requests, form submissions or tracking. Locale key shared with the homepage: fhm-lang. */
const initializeFhmPrototype = () => {
 const root=document.documentElement;
 const languageButtons=[...document.querySelectorAll('[data-set-lang]')];
 const bodyText={en:'Hello Yoshitaka,\n\nI would like to discuss sourcing from Japan.\n\nCompany / name:\nProduct / application:\nQuantity per order:\nExpected monthly / annual volume:\nPackaging:\nDestination:\nTarget price (optional):\nRequired documents / certifications:\nSample request:\n\nThank you.',ja:'福田様\n\n日本からの調達について相談いたします。\n\n会社名・お名前：\n商品・用途：\n1回あたりの発注量：\n月間・年間の想定数量：\n包装形態：\n仕向国・地域：\n目標価格（任意）：\n必要書類・認証：\nサンプル希望：\n\nよろしくお願いいたします。'};
 function applyLanguage(lang){
  if(!['en','ja'].includes(lang))lang='en';
  root.lang=lang;
  document.body.classList.toggle('lang-en',lang==='en');
  languageButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.setLang===lang)));
  document.querySelectorAll('img[data-alt-en]').forEach(i=>i.alt=i.dataset[lang==='en'?'altEn':'altJa']);
  document.querySelectorAll('[data-label-en]').forEach(e=>e.setAttribute('aria-label',e.dataset[lang==='en'?'labelEn':'labelJa']));
  document.querySelectorAll('.email-cta').forEach(a=>a.href='mailto:yfukuda@fukudahotel.com?subject='+encodeURIComponent(lang==='en'?'Japan sourcing enquiry | FHM':'日本からの調達に関するお問い合わせ | FHM')+'&body='+encodeURIComponent(bodyText[lang]));
  document.querySelectorAll('.whatsapp-cta').forEach(a=>a.href='https://wa.me/817031066969?text='+encodeURIComponent(bodyText[lang]));
  document.querySelectorAll('a[data-locale-link]').forEach(a=>{const u=new URL(a.href);u.searchParams.set('lang',lang);a.href=u.href;});
  document.title=lang==='en'?(document.body.dataset.home?'FHM | Our Businesses':'Japan Sourcing | FHM Food & Beverage Division'):(document.body.dataset.home?'FHM | 事業紹介':'日本からの調達 | FHM 食品・飲料事業部');
  const meta=document.querySelector('meta[name="description"]');
  if(meta&&!document.body.dataset.home)meta.content=lang==='en'?'One Japan-side sourcing partner for international B2B buyers. Japanese matcha and tea, bulk supply, private label and export coordination.':'海外バイヤーと日本の供給元をつなぐ調達窓口。抹茶・日本茶、業務用供給、プライベートラベル、輸出調整に対応します。';
  try{localStorage.setItem('fhm-lang',lang)}catch{}
 }
 let saved;try{saved=localStorage.getItem('fhm-lang')}catch{}
 const queryLang=new URLSearchParams(location.search).get('lang');
 document.querySelectorAll('a[href*="food-beverage.html"],a[href$="/index.html"]').forEach(a=>a.dataset.localeLink='true');
 applyLanguage(['en','ja'].includes(queryLang)?queryLang:(saved||'en'));
 languageButtons.forEach(b=>b.addEventListener('click',()=>applyLanguage(b.dataset.setLang)));
 const toggle=document.querySelector('.menu-toggle');const menu=document.querySelector('.mobile-navigation');
 function closeMenu(){if(menu&&toggle){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}}
 toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';menu.hidden=open;toggle.setAttribute('aria-expanded',String(!open));});
 menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu&&!menu.hidden){closeMenu();toggle.focus()}});
 matchMedia('(min-width:1101px)').addEventListener('change',e=>{if(e.matches)closeMenu()});
};
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeFhmPrototype, {once:true}); else initializeFhmPrototype();
