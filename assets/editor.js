/* Knowledge book - advanced page editor (v17)
   Click = select any element | double-click = edit text | drag the ⠿ handle = move anywhere
   Drop on the left/right edge of a block = place side by side | side panel = full control
   Saves the page HTML to /api/page (Vercel Blob). Same API as before. */
(function(){
'use strict';
var root=document.querySelector('.page');
if(!root||root.classList.contains('head-only'))return;
var slug=(location.pathname.split('/').pop()||'').replace('.html','');
var API='/api/page?slug='+encodeURIComponent(slug);
var pw=sessionStorage.getItem('kb_pw')||'';
var RTL=getComputedStyle(root).direction==='rtl';
var editing=false,prev=false,sel=null,txt=null,rng=null,hist=[],hi=-1,dirty=false,backup='',tab='add',insIn=true,vp='d';

/* ---------- safety: what is allowed to be saved / shown ---------- */
var IF=/^(https:\/\/(www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/\d+|drive\.google\.com\/file\/d\/[\w-]+\/preview|www\.google\.com\/maps\/embed|www\.facebook\.com\/plugins\/video\.php\?href=|www\.tiktok\.com\/(player\/v1|embed\/v2)\/\d+|www\.instagram\.com\/(p|reel|tv)\/[\w-]+\/embed)|\.\.\/assets\/)/;
function badDecl(d){return /expression|javascript:|@import|behavior|binding|position\s*:\s*(fixed|sticky)/i.test(d)||(/url\(/i.test(d)&&!/url\(\s*['"]?(\.\.\/assets\/|\/api\/file\?)/i.test(d))}
function cleanStyle(s){return s.split(';').map(function(d){return d.trim()}).filter(function(d){return d&&!badDecl(d)}).join(';')}
function clean(h){
  var box=new DOMParser().parseFromString('<div>'+h+'</div>','text/html').body.firstChild;
  box.querySelectorAll('script,style,object,embed,link,meta,form,base').forEach(function(n){n.remove()});
  box.querySelectorAll('iframe').forEach(function(f){if(!IF.test(f.getAttribute('src')||''))f.remove();else f.removeAttribute('srcdoc')});
  box.querySelectorAll('*').forEach(function(n){[].slice.call(n.attributes).forEach(function(a){
    var nm=a.name.toLowerCase();
    if(/^on/.test(nm)||nm==='srcdoc'||nm==='formaction'||nm==='contenteditable'||(/^(href|src|xlink:href)$/.test(nm)&&/^\s*(javascript:|data:text)/i.test(a.value)))n.removeAttribute(a.name);
    else if(nm==='style'){var v=cleanStyle(a.value);v?n.setAttribute('style',v):n.removeAttribute('style')}})});
  return box.innerHTML}
function ser(){
  var t=root.cloneNode(true);t.removeAttribute('contenteditable');t.classList.remove('kb-on');
  t.querySelectorAll('[contenteditable]').forEach(function(n){n.removeAttribute('contenteditable')});
  t.querySelectorAll('.kb-txt').forEach(function(n){n.classList.remove('kb-txt')});
  t.querySelectorAll('[class=""]').forEach(function(n){n.removeAttribute('class')});
  return t.innerHTML}

/* ---------- page-level settings (stored in a hidden element inside the page) ---------- */
function cfgEl(){return root.querySelector(':scope>.kb-cfg')}
function cfgGet(k){var c=cfgEl();return c?(c.dataset[k]||''):''}
function cfgSet(k,v){var c=cfgEl();if(!c){c=document.createElement('div');c.className='kb-cfg';c.hidden=true;root.prepend(c)}
  v===''||v==null?delete c.dataset[k]:c.dataset[k]=v;applyCfg()}
function applyCfg(){var w=cfgGet('w');root.style.maxWidth=w==='full'?'none':(+w?w+'px':'');
  root.style.fontSize=+cfgGet('fs')?cfgGet('fs')+'px':'';document.body.style.background=cfgGet('bg')||'';
  cfgGet('hc')?root.style.setProperty('--head',cfgGet('hc')):root.style.removeProperty('--head')}

/* ---------- load saved version for every visitor ---------- */
fetch(API).then(function(r){return r.json()}).then(function(d){if(!editing){if(d&&d.html)root.innerHTML=clean(d.html);applyCfg()}}).catch(function(){});

/* ---------- tiny helpers ---------- */
function E(t,p){var e=document.createElement(t);p=p||{};for(var a in p){if(a==='class')e.className=p[a];else if(a==='text')e.textContent=p[a];else if(/^on/.test(a))e[a]=p[a];else e.setAttribute(a,p[a])}
  function add(k){if(Array.isArray(k))k.forEach(add);else if(k!=null&&k!==false)e.append(k.nodeType?k:document.createTextNode(k))}
  for(var i=2;i<arguments.length;i++)add(arguments[i]);return e}
function H(s){var t=document.createElement('template');t.innerHTML=s.trim();return t.content.firstElementChild}
function $$(s,r){return [].slice.call((r||document).querySelectorAll(s))}
function st(el,p,v){v===''||v==null?el.style.removeProperty(p):el.style.setProperty(p,v)}
function toast(m,ms){var t=E('div',{class:'kb-toast',text:m});document.body.appendChild(t);setTimeout(function(){t.remove()},ms||2200);return t}
function num(v,d){v=parseFloat(v);return isNaN(v)?(d||0):v}
function hex(c){var m=(c||'').match(/[\d.]+/g);if(!m||m.length<3||(m.length>3&&+m[3]===0))return '';return '#'+m.slice(0,3).map(function(x){return ('0'+(+x).toString(16)).slice(-2)}).join('')}

/* ---------- block detection ---------- */
var INL=/^(B|I|U|S|EM|STRONG|SPAN|A|BR|SMALL|MARK|CODE|SUB|SUP|FONT|LABEL|STRIKE|DEL|INS|ABBR|SVG|PATH|SUMMARY|FIGCAPTION)$/i;
function isCont(e){return e===root||e.matches('.card,.callout,.kb-row,section,.col,.grid,.rooms,.note')}
function pick(t){
  if(!t||!t.closest||t===root||!root.contains(t)||t.closest('.kb-cfg'))return null;
  var c=t.closest('td,th');if(c&&root.contains(c))return c;
  c=t.closest('.social,.video,.vslot,figure.kb-fig,.extlink,details');if(c&&c!==root&&root.contains(c))return c;
  var n=t;while(n&&n!==root){if(!INL.test(n.tagName))return n;n=n.parentElement}return null}
function hasBlockKid(n){return [].some.call(n.children,function(c){return !INL.test(c.tagName)})}
function editTarget(t){var n=t.closest('summary,figcaption,.extlink a,.splay,td,th')||pick(t);if(!n||n===root||hasBlockKid(n)||n.matches('img,hr,.video,.vslot,.kb-sp,table,.kb-row'))return null;return n}
function kind(e){var t=e.tagName;
  if(e.matches('.vslot'))return 'slot';if(e.matches('.todo'))return 'todo';if(t==='IMG')return 'img';if(e.matches('.video'))return 'video';
  if(e.matches('.social'))return 'social';if(e.matches('.kb-row'))return 'row';if(e.matches('.card,section'))return 'card';
  if(e.matches('.callout'))return 'callout';if(e.matches('.extlink'))return 'btn';if(/^(TD|TH)$/.test(t))return 'cell';
  if(/^(UL|OL)$/.test(t))return 'list';if(/^(H1|H2|H3|H4|P|LI|BLOCKQUOTE|PRE)$/.test(t))return 'text';if(t==='TABLE')return 'table';
  if(t==='HR'||e.matches('.kb-sp'))return 'sep';return 'other'}
function lbl(e){var s=(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,24),k=kind(e),t=e.tagName,x=s?' · '+s:'';
  var m={slot:'⬚ مكان '+(e.dataset.k==='image'?'صورة':'فيديو'),todo:'📝 ملحوظة',img:'🖼 صورة',video:'🎬 فيديو',social:'📱 فيديو سوشيال',row:'▥ صف أعمدة',card:'🗂 كارت'+x,callout:'💡 تنبيه'+x,
   btn:'🔗 زرار'+x,cell:'▦ خلية'+x,list:'• قائمة'+x,table:'▦ جدول',sep:'─ فاصل'};
  if(m[k])return m[k];if(t==='HEADER')return '🏷 عنوان الصفحة';if(/^H\d$/.test(t))return '🔤 '+(s||'عنوان');if(t==='P')return '¶ '+(s||'فقرة');if(t==='LI')return '• '+s;
  if(t==='PRE')return '💬 نص جاهز';if(t==='DETAILS')return '📂 قابل للطي';if(t==='FIGURE')return '🖼 صورة بتعليق';if(t==='BLOCKQUOTE')return '❝ اقتباس';return '◻ '+t.toLowerCase()+x}
function sib(e,d){var s=d<0?e.previousElementSibling:e.nextElementSibling;while(s&&s.matches('.kb-cfg'))s=d<0?s.previousElementSibling:s.nextElementSibling;return s}

/* ---------- history ---------- */
function tidy(){$$('.kb-row',root).reverse().forEach(function(r){var k=[].filter.call(r.children,function(c){return !c.matches('.kb-cfg')});
  if(k.length<=1){k.forEach(function(c){c.style.removeProperty('--w');if(!c.getAttribute('style'))c.removeAttribute('style');r.before(c)});r.remove()}})}
function snap(){tidy();var h=ser();if(hist[hi]===h){refresh();return}hist=hist.slice(0,hi+1);hist.push(h);if(hist.length>80)hist.shift();hi=hist.length-1;dirty=true;refresh()}
function go(d){endText();var n=hi+d;if(n<0||n>=hist.length)return;hi=n;root.innerHTML=hist[hi];applyCfg();dirty=true;select(null);refresh()}

/* ---------- injected styles ---------- */
var CSS=[
'.kb-fab{position:fixed;left:16px;bottom:16px;z-index:50;border:0;border-radius:999px;padding:11px 18px;background:#081a2e;color:#fff;font:700 .9rem Cairo,sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.3)}',
'.kb-bar{position:sticky;top:0;z-index:2147483000;display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:7px 10px;background:#06335c;border-bottom:3px solid #f5891f;direction:rtl;font-family:Cairo,sans-serif}',
'.kb-bar button,.kb-bar select{border:1px solid rgba(255,255,255,.3);background:#0860aa;color:#fff;border-radius:8px;padding:5px 9px;font:700 .78rem Cairo,sans-serif;cursor:pointer;line-height:1.2;min-width:30px}',
'.kb-bar button:hover{background:#f5891f}.kb-bar button.on{background:#f5891f}.kb-bar .sv{background:#1e8e5a}.kb-bar .cn{background:#d1343c}.kb-bar select option{color:#000}',
'.kb-bar input[type=color]{width:32px;height:28px;padding:2px;border-radius:8px;border:0;background:#fff}.kb-bar i{flex:1}.kb-sep{width:1px;height:24px;background:rgba(255,255,255,.25);margin:0 2px}',
'.kb-pn{position:fixed;left:0;bottom:0;width:318px;z-index:2147482000;background:#fff;color:#14202e;border-right:1px solid #dde2e8;box-shadow:6px 0 30px -12px rgba(0,0,0,.35);direction:rtl;font:600 13px/1.5 Cairo,sans-serif;display:flex;flex-direction:column}',
'.kb-pn *{box-sizing:border-box}.kb-tabs{display:flex;border-bottom:1px solid #dde2e8;background:#f2f4f6;flex:none}',
'.kb-tabs button{flex:1;border:0;background:none;padding:10px 4px;font:700 12px Cairo,sans-serif;color:#66707f;cursor:pointer;border-bottom:3px solid transparent}',
'.kb-tabs button.on{color:#06335c;border-bottom-color:#f5891f;background:#fff}.kb-pb{flex:1;overflow:auto;padding:12px 12px 40px}',
'.kb-g{margin:14px 0 6px;font-weight:800;color:#06335c;font-size:12px;border-inline-start:3px solid #f5891f;padding-inline-start:8px}.kb-g:first-child{margin-top:0}',
'.kb-r{display:flex;align-items:center;gap:8px;margin:7px 0;min-height:28px}.kb-r>span{flex:0 0 74px;color:#66707f;font-size:12px}.kb-c{flex:1;min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
'.kb-c input[type=range]{flex:1;min-width:70px;accent-color:#f5891f}.kb-c output{min-width:38px;font-size:11px;color:#66707f;direction:ltr;text-align:end}',
'.kb-c input[type=color]{width:38px;height:28px;padding:1px;border:1px solid #dde2e8;border-radius:6px;background:#fff}',
'.kb-c select,.kb-pn input[type=text],.kb-pn input[type=url],.kb-pn textarea{width:100%;border:1px solid #dde2e8;border-radius:8px;padding:6px 8px;font:600 12px Cairo,sans-serif;background:#fff;color:#14202e}',
'.kb-pn textarea{height:120px;direction:ltr;font:12px/1.5 Consolas,monospace;resize:vertical}',
'.kb-seg{display:flex;flex-wrap:wrap;gap:4px}.kb-seg button,.kb-m,.kb-act{border:1px solid #dde2e8;background:#fff;border-radius:8px;padding:5px 9px;font:700 12px Cairo,sans-serif;cursor:pointer;color:#14202e}',
'.kb-seg button:hover,.kb-m:hover,.kb-act:hover{border-color:#f5891f;color:#c76a0a}.kb-seg button.on{background:#f5891f;border-color:#f5891f;color:#fff}',
'.kb-acts{display:flex;flex-wrap:wrap;gap:5px}.kb-act.red{color:#d1343c;border-color:#f3c2c5}.kb-act.big{width:100%;padding:10px;background:#06335c;color:#fff;border-color:#06335c}.kb-act.big:hover{background:#f5891f;color:#fff}',
'.kb-chips{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.kb-chip{display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 3px;border:1px solid #dde2e8;border-radius:10px;background:#fff;cursor:grab;font:700 11px Cairo,sans-serif;color:#14202e;touch-action:pan-y;user-select:none}',
'.kb-chip b{font-size:18px;line-height:1.2;font-weight:400}.kb-chip:hover{border-color:#f5891f;background:#fff7ee}',
'.kb-hint{color:#66707f;font-size:12px;margin:6px 0 10px;line-height:1.7}.kb-where{background:#fff7ee;border:1px dashed #f5891f;border-radius:8px;padding:7px 10px;font-size:12px;color:#8a4a07;margin-bottom:10px}',
'.kb-crumbs{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;align-items:center}.kb-crumbs button{border:0;background:#eef1f5;border-radius:6px;padding:2px 7px;font:700 11px Cairo,sans-serif;cursor:pointer}.kb-crumbs button:last-child{background:#f5891f;color:#fff}',
'.kb-ti{display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:6px;cursor:pointer;font-size:12px}.kb-ti:hover{background:#f2f4f6}.kb-ti.on{background:#fff0de;outline:1px solid #f5891f}.kb-ti span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kb-ti b{padding:0 5px;cursor:pointer;color:#66707f}.kb-ti b:hover{color:#f5891f}',
'.kb-ov{position:fixed;z-index:2147481000;pointer-events:none;border:2px solid #f5891f;border-radius:6px;background:rgba(245,137,31,.05)}.kb-hv{position:fixed;z-index:2147480000;pointer-events:none;border:1px dashed #f5891f;border-radius:6px}',
'.kb-top{position:absolute;top:-30px;inset-inline-start:-2px;display:flex;gap:2px;pointer-events:auto;background:#f5891f;border-radius:7px 7px 0 0;padding:2px;white-space:nowrap}.kb-top.in{top:2px;border-radius:7px}',
'.kb-top span{color:#fff;font:700 11px Cairo,sans-serif;padding:3px 7px;max-width:150px;overflow:hidden;text-overflow:ellipsis}.kb-top button{border:0;background:rgba(255,255,255,.22);color:#fff;border-radius:5px;min-width:26px;height:24px;cursor:pointer;font:700 12px Cairo}.kb-top button:hover{background:#06335c}',
'.kb-top .dg{cursor:grab;touch-action:none;font-size:15px}.kb-rs{position:absolute;bottom:-10px;width:18px;height:18px;border-radius:50%;background:#fff;border:3px solid #f5891f;pointer-events:auto;cursor:ew-resize;touch-action:none}',
'.kb-badge{position:absolute;bottom:-34px;inset-inline-start:0;background:#06335c;color:#fff;font:700 11px Cairo;padding:2px 7px;border-radius:5px}',
'.kb-ghost{position:fixed;left:0;top:0;z-index:2147483600;pointer-events:none;background:#06335c;color:#fff;padding:6px 12px;border-radius:8px;font:700 12px Cairo,sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.35)}',
'.kb-ind{position:fixed;z-index:2147483500;pointer-events:none;background:#1e8e5a;border-radius:3px;box-shadow:0 0 0 3px rgba(30,142,90,.28)}.kb-ind.box{background:rgba(30,142,90,.08);border:2px dashed #1e8e5a;box-shadow:none}',
'.kb-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1e8e5a;color:#fff;padding:10px 20px;border-radius:10px;font:700 .9rem Cairo,sans-serif;z-index:2147483647}',
'.kb-md{position:fixed;inset:0;z-index:2147483646;background:rgba(7,41,74,.55);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl}',
'.kb-mb{background:#fff;color:#14202e;border-radius:16px;padding:20px;width:min(440px,100%);font:600 14px Cairo,sans-serif;display:flex;flex-direction:column;gap:10px}.kb-mb h4{margin:0 0 4px;font-size:16px;color:#06335c}',
'.kb-mb input{width:100%;border:1px solid #dde2e8;border-radius:8px;padding:9px 10px;font:600 13px Cairo,sans-serif}.kb-mb button{border:0;border-radius:10px;padding:10px;font:700 13px Cairo,sans-serif;cursor:pointer;background:#0860aa;color:#fff}.kb-mb .kb-x{background:#eef1f5;color:#14202e}.kb-mb .kb-big{background:#06335c}.kb-or{text-align:center;color:#66707f;font-size:12px}',
'body.kb-ed{padding-left:318px!important}',
'@media (max-width:980px){.kb-pn{width:100%;height:44vh;top:auto!important;border-right:0;border-top:3px solid #f5891f}body.kb-ed{padding-left:0!important;padding-bottom:46vh!important}}',
'.kb-bar[hidden],.kb-pn[hidden],.kb-ov[hidden],.kb-hv[hidden]{display:none!important}',
'.kb-on{min-height:60vh;-webkit-user-select:none;user-select:none}.kb-on .kb-row{outline:1px dotted #94a3b8;outline-offset:3px}.kb-on .video iframe,.kb-on .video video,.kb-on iframe.frame,.kb-on .social .splay{pointer-events:none}',
'.kb-on .vslot{display:flex!important;align-items:center;justify-content:center;min-height:150px;margin:14px 0;border:2px dashed #f5891f;border-radius:14px;background:rgba(245,137,31,.07);color:#c76a0a;font-weight:700;text-align:center;padding:14px}',
'.kb-on [contenteditable=true]{outline:2px solid #1e8e5a!important;outline-offset:2px;-webkit-user-select:text;user-select:text;cursor:text;min-width:20px}',
'.kb-pv .kb-pn,.kb-pv .kb-ov,.kb-pv .kb-hv{display:none!important}.kb-pv.kb-ed{padding:0!important}.kb-pv .kb-on .vslot{display:none!important}.kb-pv .kb-on .kb-row{outline:0}',
'.kb-vp-t .page{max-width:780px!important}.kb-vp-m .page{max-width:410px!important}.kb-vp-t .page,.kb-vp-m .page{box-shadow:0 0 0 1px #c9d1da,0 20px 60px -20px rgba(0,0,0,.4);background:var(--bg)}',
'.kb-vp-m .kb-row>[style*="--w"]{flex-basis:100%}'
].join('\n');
var stl=document.createElement('style');stl.textContent=CSS;document.head.appendChild(stl);

/* ---------- modal helpers ---------- */
function modal(title,build){return new Promise(function(res){var m=E('div',{class:'kb-md'}),b=E('div',{class:'kb-mb'});
  function done(v){m.remove();res(v)}b.append(E('h4',{text:title}));build(b,done);b.append(E('button',{class:'kb-x',text:'إلغاء',onclick:function(){done(null)}}));
  m.append(b);m.onclick=function(e){if(e.target===m)done(null)};document.body.append(m);var i=b.querySelector('input[type=url],input[type=text]');if(i)setTimeout(function(){i.focus()},50)})}
function askText(title,ph,val){return modal(title,function(b,done){var i=E('input',{type:'text',placeholder:ph||'',dir:'auto'});i.value=val||'';
  i.onkeydown=function(e){if(e.key==='Enter')done(i.value.trim())};b.append(i,E('button',{text:'تأكيد',onclick:function(){done(i.value.trim())}}))})}
function shrink(f){return new Promise(function(ok,no){var m=new Image();m.onload=function(){var s=Math.min(1,1600/m.width),c=document.createElement('canvas');c.width=Math.round(m.width*s);c.height=Math.round(m.height*s);
  var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(m,0,0,c.width,c.height);c.toBlob(function(b){b?ok(b):no()},'image/jpeg',.86)};m.onerror=no;m.src=URL.createObjectURL(f)})}
async function upload(f){var r=await fetch('/api/upload?name='+encodeURIComponent(f.name),{method:'POST',headers:{'x-admin-password':pw,'Content-Type':'application/octet-stream'},body:await shrink(f)});
  var j=await r.json();if(!r.ok)throw new Error(j.error||r.status);return j.url}
function mkImg(src,alt){var i=document.createElement('img');i.src=src;i.alt=alt||'';i.loading='lazy';return i}
async function files2imgs(list){var out=[],t=toast('جاري رفع الصور…',9e4);for(var k=0;k<list.length;k++){var f=list[k];if(!/^image\//.test(f.type))continue;
  try{out.push(mkImg(await upload(f),f.name.replace(/\.\w+$/,'')))}catch(e){alert('فشل رفع '+f.name+'\n'+(e.message||''))}}t.remove();return out}
function askImages(){return modal('🖼 إضافة صورة',function(b,done){
  var f=E('input',{type:'file',accept:'image/*',multiple:'',hidden:''});f.onchange=async function(){done(await files2imgs(f.files))};
  var u=E('input',{type:'url',placeholder:'https://... رابط صورة',dir:'ltr'});
  b.append(E('button',{class:'kb-big',text:'📁 رفع من جهازك (تقدر تختار أكتر من صورة)',onclick:function(){f.click()}}),f,E('div',{class:'kb-or',text:'أو'}),u,
    E('button',{text:'إضافة بالرابط',onclick:function(){var v=u.value.trim();/^https:\/\//i.test(v)?done([mkImg(v,'')]):alert('الرابط لازم يبدأ بـ https://')}}))})}

/* ---------- video builder (YouTube / Vimeo / Drive / Facebook / TikTok / Instagram / mp4) ---------- */
var YT=/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/,IG=/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/,TTV=/tiktok\.com\/(?:@[\w.\-]+\/)?(?:video|embed(?:\/v2)?|v)\/(\d+)/;
function vidInfo(u){var h,m;try{h=new URL(u).hostname.replace(/^(www|m|web|mobile)\./,'')}catch(e){return null}
  if(/^(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(h)&&(m=u.match(YT)))return{src:'https://www.youtube-nocookie.com/embed/'+m[1],t:'YouTube'};
  if(h==='vimeo.com'&&(m=u.match(/vimeo\.com\/(?:.*\/)?(\d+)/)))return{src:'https://player.vimeo.com/video/'+m[1],t:'Vimeo'};
  if(h==='drive.google.com'&&(m=u.match(/\/file\/d\/([\w-]+)/)))return{src:'https://drive.google.com/file/d/'+m[1]+'/preview',t:'Google Drive'};
  if(/(^|\.)tiktok\.com$/.test(h)){if(m=u.match(TTV))return{src:'https://www.tiktok.com/player/v1/'+m[1]+'?description=1',c:'tt',t:'TikTok'};return{short:/^(vm|vt)\.tiktok\.com$/.test(h)||/tiktok\.com\/t\//.test(u),t:'TikTok'}}
  if(h==='instagram.com'&&(m=u.match(IG)))return{src:'https://www.instagram.com/'+(m[1]==='reels'?'reel':m[1])+'/'+m[2]+'/embed',c:'ig',t:'Instagram'};
  if(h==='fb.watch'||h==='facebook.com'||h==='fb.com'){if(h==='fb.watch'||/(\/videos?\/|\/reel\/|\/watch\/?|\/share\/[vr]\/|[?&]v=\d)/.test(u)){var v=/\/reel\/|\/share\/r\//.test(u);
    return{src:'https://www.facebook.com/plugins/video.php?href='+encodeURIComponent(u)+'&show_text=false&width='+(v?360:560),c:v?'fbv':'',t:'Facebook'}}return{t:'Facebook'}}
  if(h==='instagram.com')return{t:'Instagram'};return{t:h}}
async function mkVideo(u){u=(u||'').trim();if(!u)return null;
  if(!/^https?:\/\//i.test(u)){if(/^[\w-]+(\.[\w-]+)+(\/|$)/.test(u))u='https://'+u;else{alert('الرابط غير صحيح');return null}}
  var d=document.createElement('div'),i=vidInfo(u);if(!i){alert('الرابط غير صحيح');return null}
  if(i.short){try{var r=await fetch('/api/resolve?u='+encodeURIComponent(u),{headers:{'x-admin-password':pw}}),j=await r.json(),m=(j.url||'').match(TTV);
    if(m)i={src:'https://www.tiktok.com/player/v1/'+m[1]+'?description=1',c:'tt',t:'TikTok'}}catch(e){}}
  if(i.src&&i.c){d.className='social '+i.c;d.setAttribute('data-src',i.src);d.setAttribute('data-c',i.c);
    d.append(E('span',{class:'slbl',text:i.t}),E('button',{type:'button',class:'splay',text:'▶ تشغيل هنا'}),E('a',{class:'sopen',href:u,target:'_blank',rel:'noopener',text:'🔗 افتح على '+i.t}))}
  else if(i.src){d.className='video';var f=document.createElement('iframe');f.src=i.src;f.title=i.t;f.allow='autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';f.allowFullscreen=true;f.loading='lazy';d.appendChild(f)}
  else if(/^https:\/\/\S+\.(mp4|webm)(\?\S*)?$/i.test(u)){d.className='video';var v=document.createElement('video');v.controls=true;v.preload='metadata';v.src=u;d.appendChild(v)}
  else{d.className='extlink';d.append(E('a',{href:u,target:'_blank',rel:'noopener',text:'🔗 افتح على '+i.t}));toast('الرابط ده مش فيديو قابل للتضمين، اتضاف كزرار رابط',3500)}
  return d}

/* ---------- selection overlay ---------- */
var ov=E('div',{class:'kb-ov',hidden:''}),hv=E('div',{class:'kb-hv',hidden:''});
var tag=E('span',{}),top=E('div',{class:'kb-top'});
function tb(t,tt,fn,cls){return E('button',{type:'button',text:t,title:tt,class:cls||'',onpointerdown:function(e){e.stopPropagation()},onclick:function(e){e.stopPropagation();fn()}})}
var dg=E('button',{type:'button',class:'dg',text:'⠿',title:'اسحب لنقل العنصر لأي مكان'});
dg.onpointerdown=function(e){if(sel){e.preventDefault();e.stopPropagation();endText();startDrag(sel,lbl(sel),e,null)}};
top.append(dg,tag,tb('⬆','لفوق',function(){mv(-1)}),tb('⬇','لتحت',function(){mv(1)}),tb('⧉','نسخ',dup),tb('✎','تعديل النص',function(){if(sel)startEdit(sel)}),tb('🗑','حذف',del));
var rs=E('div',{class:'kb-rs',title:'اسحب لتغيير العرض'}),badge=E('div',{class:'kb-badge',hidden:''});ov.append(top,rs,badge);
function pos(){
  if(!editing||prev||!sel||!sel.isConnected){ov.hidden=true;return}
  var r=sel.getBoundingClientRect();if(!r.width&&!r.height){ov.hidden=true;return}
  ov.hidden=false;ov.style.cssText='left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px';
  top.classList.toggle('in',r.top<barH()+34);rs.style.cssText=RTL?'left:-10px':'right:-10px';tag.textContent=lbl(sel).slice(0,26)}
function barH(){return bar.getBoundingClientRect().height}
(function loop(){pos();requestAnimationFrame(loop)})();
function select(el,fromPage){
  if(el&&txt&&!txt.contains(el))endText();
  sel=el&&root.contains(el)&&el!==root?el:null;
  if(fromPage&&sel&&tab==='add')tab='fmt';refresh()}

/* ---------- text editing ---------- */
function startEdit(el){var et=el&&!hasBlockKid(el)&&!el.matches('img,hr,.video,.vslot,.social,table,.kb-row')?el:null;
  if(!et&&el){var c=el.querySelector('h1,h2,h3,h4,p,li,summary,figcaption');et=c||null}
  if(!et)return toast('العنصر ده مفيهوش نص للتعديل');
  endText();txt=et;et.contentEditable='true';et.classList.add('kb-txt');et.focus();
  try{document.execCommand('styleWithCSS',false,true);document.execCommand('defaultParagraphSeparator',false,'p')}catch(x){}}
function endText(){if(txt){var t=txt;txt=null;t.removeAttribute('contenteditable');t.classList.remove('kb-txt');if(editing)snap()}}
document.addEventListener('selectionchange',function(){if(!txt)return;var s=getSelection();if(s.rangeCount&&txt.contains(s.anchorNode))rng=s.getRangeAt(0).cloneRange()});
function fmt(c,v){
  if(txt){txt.focus();if(rng){var s=getSelection();s.removeAllRanges();s.addRange(rng)}try{document.execCommand(c,false,v||null)}catch(x){}return}
  if(!sel)return toast('اضغط على عنصر أو نص الأول');
  var m={bold:['font-weight',function(){return getComputedStyle(sel).fontWeight>=700?'400':'800'}],italic:['font-style',function(){return getComputedStyle(sel).fontStyle==='italic'?'normal':'italic'}],
    underline:['text-decoration',function(){return /underline/.test(getComputedStyle(sel).textDecorationLine)?'none':'underline'}],strikeThrough:['text-decoration',function(){return /line-through/.test(getComputedStyle(sel).textDecorationLine)?'none':'line-through'}],
    foreColor:['color',function(){return v}],hiliteColor:['background',function(){return v}],backColor:['background',function(){return v}]};
  if(m[c]){st(sel,m[c][0],m[c][1]());snap()}else toast('اضغط مرتين على النص عشان تعدله الأول')}
root.addEventListener('focusout',function(e){if(e.target===txt&&!(e.relatedTarget&&(bar.contains(e.relatedTarget)||pn.contains(e.relatedTarget))))endText()});
root.addEventListener('paste',function(e){if(!txt)return;e.preventDefault();var t=(e.clipboardData||window.clipboardData).getData('text/plain');document.execCommand('insertText',false,t)});

/* ---------- moving / duplicating / deleting ---------- */
function mv(d){var e=sel;if(!e)return;endText();var s=sib(e,d);
  if(s){d<0?s.before(e):s.after(e)}else if(e.parentElement!==root){var p=e.parentElement;d<0?p.before(e):p.after(e)}else return;snap()}
function dup(){if(!sel)return;endText();var c=sel.cloneNode(true);c.removeAttribute('contenteditable');sel.after(c);select(c);snap()}
function del(){if(!sel)return;endText();var n=sib(sel,1)||sib(sel,-1)||(sel.parentElement!==root?sel.parentElement:null);sel.remove();sel=null;snap();select(n);toast('اتحذف — Ctrl+Z للتراجع',1800)}
function retag(el,t){var n=document.createElement(t);[].slice.call(el.attributes).forEach(function(a){n.setAttribute(a.name,a.value)});while(el.firstChild)n.append(el.firstChild);el.replaceWith(n);select(n);snap()}
function moveOut(){var e=sel;if(!e||e.parentElement===root)return;var p=e.parentElement;e.style.removeProperty('--w');p.after(e);snap()}
function moveIn(){var e=sel;if(!e)return;var p=sib(e,-1);while(p&&!isCont(p))p=sib(p,-1);if(!p||p===e)return toast('مفيش كارت قبله');p.append(e);snap()}
function sideBy(){var e=sel;if(!e)return;var p=sib(e,-1);if(!p)return toast('مفيش عنصر قبله');dropAt(e,{ref:p,before:false,side:true,cont:p.parentElement});select(e);snap()}
function wrapCard(){var e=sel;if(!e)return;var c=H('<div class="card"></div>');e.before(c);c.append(e);select(c);snap()}
function unwrap(){var e=sel;if(!e)return;[].slice.call(e.children).forEach(function(c){e.before(c)});var n=sib(e,1)||sib(e,-1);e.remove();select(n);snap()}

/* ---------- width / side-by-side ---------- */
function inRow(e){return e.parentElement&&e.parentElement.classList.contains('kb-row')}
function getW(e){return inRow(e)?num(e.style.getPropertyValue('--w'),100):(num(e.style.width||e.style.maxWidth,100))}
function setW(e,p){
  var k=/^(IMG|VIDEO)$/.test(e.tagName)?'width':'max-width';
  ['--w','width','max-width'].forEach(function(x){e.style.removeProperty(x)});
  if(!p||p>=100)return;
  if(inRow(e))e.style.setProperty('--w',p);else{e.style.setProperty(k,p+'%')}}
function setAlign(e,v){v?e.setAttribute('data-al',v):e.removeAttribute('data-al')}

/* ---------- drag & drop (works with mouse and touch) ---------- */
var pn,bar;
function inside(el,src){return src&&src.nodeType&&src.contains(el)}
function target(x,y,src){
  var els=document.elementsFromPoint(x,y);
  if(els.some(function(n){return pn.contains(n)||bar.contains(n)}))return null;
  var cont=null;
  for(var i=0;i<els.length;i++){var el=els[i];if(el===root||(root.contains(el)&&isCont(el)&&!inside(el,src))){cont=el;break}}
  if(!cont)cont=root;
  if(cont!==root){var rc=cont.getBoundingClientRect();if(y<rc.top+14||y>rc.bottom-14){do{cont=cont.parentElement}while(cont!==root&&!isCont(cont))}}
  var kids=[].filter.call(cont.children,function(k){return k!==src&&!k.matches('.kb-cfg')&&!inside(k,src)});
  if(!kids.length)return{cont:cont,mode:'in'};
  var best=null,bd=1e12;kids.forEach(function(k){var r=k.getBoundingClientRect(),dx=x<r.left?r.left-x:x>r.right?x-r.right:0,dy=y<r.top?r.top-y:y>r.bottom?y-r.bottom:0,d=dx*dx+dy*dy;if(d<bd){bd=d;best=k}});
  var r=best.getBoundingClientRect(),fx=(x-r.left)/(r.width||1);
  var horiz=cont.classList.contains('kb-row')&&kids.some(function(k){if(k===best)return false;var q=k.getBoundingClientRect();return q.top<r.bottom-4&&q.bottom>r.top+4});
  if(horiz){var before=RTL?x>r.left+r.width/2:x<r.left+r.width/2;return{cont:cont,ref:best,before:before,horiz:true}}
  if(y>=r.top&&y<=r.bottom&&r.width>260&&(fx<.17||fx>.83)){return{cont:cont,ref:best,before:RTL?fx>.5:fx<.5,side:true}}
  return{cont:cont,ref:best,before:y<r.top+r.height/2}}
function showInd(d,ind){
  if(!d){ind.style.display='none';return}ind.style.display='block';ind.className='kb-ind';
  if(d.mode==='in'){var c=d.cont.getBoundingClientRect();ind.classList.add('box');ind.style.cssText='display:block;left:'+c.left+'px;top:'+c.top+'px;width:'+c.width+'px;height:'+Math.max(c.height,40)+'px';return}
  var r=d.ref.getBoundingClientRect();
  if(d.side||d.horiz){var px=d.before?(RTL?r.right:r.left):(RTL?r.left:r.right);ind.style.cssText='display:block;left:'+(px-2)+'px;top:'+r.top+'px;width:4px;height:'+r.height+'px'}
  else{var py=d.before?r.top:r.bottom;ind.style.cssText='display:block;left:'+r.left+'px;top:'+(py-2)+'px;width:'+r.width+'px;height:4px'}}
function dropAt(node,d){
  if(d.side){var row=d.ref.parentElement;if(!row.classList.contains('kb-row')){row=H('<div class="kb-row"></div>');d.ref.before(row);row.append(d.ref)}
    var w=inRow(d.ref)&&getW(d.ref)<100?getW(d.ref):50;d.ref.style.setProperty('--w',w);d.ref.style.removeProperty('max-width');d.ref.style.removeProperty('width');
    d.before?d.ref.before(node):d.ref.after(node);node.style.removeProperty('max-width');node.style.removeProperty('width');node.style.setProperty('--w',w);return}
  if(d.mode==='in'||!d.ref)(d.cont||root).append(node);else d.before?d.ref.before(node):d.ref.after(node);
  if(d.horiz&&d.ref){var w2=getW(d.ref);if(w2<100)node.style.setProperty('--w',w2)}
  else if(!inRow(node))node.style.removeProperty('--w')}
function startDrag(src,label,e,make,onClick){
  var ghost=E('div',{class:'kb-ghost',text:label}),ind=E('div',{class:'kb-ind'}),drop=null,moved=false,x0=e.clientX,y0=e.clientY,px=e.clientY,timer;
  document.body.append(ghost,ind);ghost.style.transform='translate('+(e.clientX+14)+'px,'+(e.clientY+14)+'px)';
  function mvh(ev){px=ev.clientY;if(Math.abs(ev.clientX-x0)+Math.abs(ev.clientY-y0)>6)moved=true;ghost.style.transform='translate('+(ev.clientX+14)+'px,'+(ev.clientY+14)+'px)';
    if(moved){drop=target(ev.clientX,ev.clientY,src);showInd(drop,ind)}}
  function end(ev){window.removeEventListener('pointermove',mvh);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);clearInterval(timer);ghost.remove();ind.remove();
    if(ev.type==='pointercancel')return;
    if(!moved){if(onClick)onClick();return}
    if(!drop)return;var node=src||make();if(!node)return;endText();dropAt(node,drop);select(node);snap();afterIns(node)}
  window.addEventListener('pointermove',mvh);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
  timer=setInterval(function(){if(!moved)return;if(px<barH()+46)window.scrollBy(0,-18);else if(px>innerHeight-46)window.scrollBy(0,18)},16)}

/* resize handle */
rs.onpointerdown=function(e){
  if(!sel)return;e.preventDefault();e.stopPropagation();endText();var el=sel,par=el.parentElement,cs=getComputedStyle(par),
    pw0=par.clientWidth-num(cs.paddingLeft)-num(cs.paddingRight),w0=el.getBoundingClientRect().width,x0=e.clientX;
  function mvh(ev){var dx=RTL?x0-ev.clientX:ev.clientX-x0,p=Math.round((w0+dx)/pw0*100/5)*5;p=Math.max(10,Math.min(100,p));setW(el,p);badge.hidden=false;badge.textContent=p+'%'}
  function up(){window.removeEventListener('pointermove',mvh);window.removeEventListener('pointerup',up);badge.hidden=true;snap()}
  window.addEventListener('pointermove',mvh);window.addEventListener('pointerup',up)};

/* ---------- inserting new blocks ---------- */
var P_='اكتب هنا...';
var ITEMS=[
 ['نصوص',[['h2','🔤','عنوان','<h2>عنوان جديد</h2>'],['h3','🔡','عنوان صغير','<h3>عنوان فرعي</h3>'],['p','¶','فقرة','<p>'+P_+'</p>'],['ul','•','قائمة نقط','<ul><li>نقطة أولى</li><li>نقطة تانية</li></ul>'],
  ['ol','١.','قائمة أرقام','<ol><li>الخطوة الأولى</li><li>الخطوة التانية</li></ol>'],['q','❝','اقتباس','<blockquote class="kb-q">اقتباس أو جملة مهمة</blockquote>'],
  ['msg','💬','نص جاهز للنسخ','<pre class="msg">النص الجاهز هنا...</pre>'],['det','📂','قابل للطي','<details class="kb-d"><summary>العنوان (اضغط للفتح)</summary><p>'+P_+'</p></details>']]],
 ['تخطيط',[['card','🗂','كارت','<div class="card"><h2>عنوان جديد</h2><p>'+P_+'</p></div>'],
  ['c2','▥','عمودين','<div class="kb-row"><div class="card" style="--w:50"><h2>عمود 1</h2><p>'+P_+'</p></div><div class="card" style="--w:50"><h2>عمود 2</h2><p>'+P_+'</p></div></div>'],
  ['c3','▥▥','٣ أعمدة','<div class="kb-row"><div class="card" style="--w:33"><h2>1</h2><p>'+P_+'</p></div><div class="card" style="--w:33"><h2>2</h2><p>'+P_+'</p></div><div class="card" style="--w:33"><h2>3</h2><p>'+P_+'</p></div></div>'],
  ['hr','─','فاصل','<hr class="kb-hr">'],['sp','↕','مسافة فاضية','<div class="kb-sp"></div>'],
  ['tbl','▦','جدول','<table class="kb-t"><tr><th>عنوان</th><th>عنوان</th><th>عنوان</th></tr><tr><td>…</td><td>…</td><td>…</td></tr><tr><td>…</td><td>…</td><td>…</td></tr></table>']]],
 ['وسائط',[['img','🖼','صورة','slot:image'],['video','🎬','فيديو','slot:video'],['btn','🔗','زرار رابط','<p class="extlink"><a href="https://" target="_blank" rel="noopener">اسم الزرار</a></p>']]],
 ['تنبيهات',[['cal','💡','ملحوظة','<div class="callout"><p>ملحوظة مهمة...</p></div>'],['calok','✅','نجاح','<div class="callout kb-c-ok"><p>✅ تمام...</p></div>'],
  ['calred','⚠️','تحذير','<div class="callout kb-c-red"><p>⚠️ انتبه...</p></div>'],['calblue','ℹ️','معلومة','<div class="callout kb-c-blue"><p>ℹ️ معلومة...</p></div>']]]
];
function makeItem(def){var s=def[3];if(s.indexOf('slot:')===0)return H('<div class="vslot" data-k="'+s.slice(5)+'">'+(s==='slot:image'?'🖼 مكان صورة — دوس مرتين لإضافتها':'🎬 مكان فيديو — دوس مرتين لإضافته')+'</div>');return H(s)}
function defLoc(){if(sel&&root.contains(sel)){if(insIn&&isCont(sel)&&sel!==root)return{cont:sel,mode:'in'};return{cont:sel.parentElement,ref:sel,before:false}}return{cont:root,mode:'in'}}
function insertItem(def){endText();var n=makeItem(def),d=defLoc();
  if(n.matches('.vslot')&&sel&&sel.matches('.todo,.vslot')){sel.replaceWith(n)}else dropAt(n,d);
  select(n);snap();n.scrollIntoView({block:'center',behavior:'smooth'});afterIns(n)}
function afterIns(n){if(n&&n.matches&&n.matches('.vslot'))fillSlot(n)}
function swap(o,n){['style','data-al'].forEach(function(a){if(o.hasAttribute(a)&&!n.hasAttribute(a))n.setAttribute(a,o.getAttribute(a))});o.replaceWith(n);select(n);snap()}
async function fillSlot(s){
  if((s.dataset.k||'video')==='video'){var u=await askText('🎬 الصق رابط الفيديو','YouTube / Facebook / TikTok / Instagram / Vimeo / Drive / mp4');if(!u)return;var v=await mkVideo(u);if(v)swap(s,v)}
  else{var im=await askImages();if(!im||!im.length)return;swap(s,im[0]);var last=im[0];im.slice(1).forEach(function(x){last.after(x);last=x});snap()}}
async function replaceMedia(e){
  if(e.matches('img')){var im=await askImages();if(im&&im[0]){swap(e,im[0])}}
  else{var u=await askText('🎬 رابط الفيديو الجديد','https://...');if(!u)return;var v=await mkVideo(u);if(v)swap(e,v)}}

/* ---------- side panel ---------- */
function G(t){return E('div',{class:'kb-g',text:t})}
function R(l){var c=[].slice.call(arguments,1);return E('div',{class:'kb-r'},E('span',{text:l}),E('div',{class:'kb-c'},c))}
function slider(get,set,min,max,step,unit){var i=E('input',{type:'range',min:min,max:max,step:step||1}),o=E('output');i.value=get();o.textContent=i.value+(unit||'');
  i.oninput=function(){set(+i.value);o.textContent=i.value+(unit||'')};i.onchange=snap;return [i,o]}
function color(get,set,clear){var i=E('input',{type:'color'});i.value=get()||'#000000';i.oninput=function(){set(i.value)};i.onchange=snap;
  return [i,E('button',{class:'kb-m',text:'✕',title:'رجّعه للأصل',onclick:function(){clear();snap()}})]}
function seg(opts,get,set){var w=E('div',{class:'kb-seg'});opts.forEach(function(o){w.append(E('button',{text:o[0],title:o[2]||o[0],class:String(get())===String(o[1])?'on':'',onclick:function(){set(o[1]);snap()}}))});return w}
function act(t,fn,cls){return E('button',{type:'button',class:'kb-act '+(cls||''),text:t,onclick:fn})}
function crumbs(e){var path=[],n=e;while(n&&n!==root){path.unshift(n);n=n.parentElement}var c=E('div',{class:'kb-crumbs'});
  path.forEach(function(p,i){c.append(E('button',{text:lbl(p).replace(/ · .*/,'').slice(0,14),onclick:function(){select(p)}}))});return c}
function addInside(){var wrap=E('div',{class:'kb-seg'});[['p','¶ فقرة'],['h3','🔡 عنوان'],['img','🖼 صورة'],['video','🎬 فيديو'],['ul','• قائمة'],['btn','🔗 زرار'],['cal','💡 ملحوظة']].forEach(function(x){
  var def=null;ITEMS.forEach(function(g){g[1].forEach(function(d){if(d[0]===x[0])def=d})});wrap.append(E('button',{text:x[1],onclick:function(){var o=insIn;insIn=true;insertItem(def);insIn=o}}))});return wrap}

function renderAdd(b){
  var w=!sel?'في آخر الصفحة':(insIn&&isCont(sel)&&sel!==root?'جوّه الكارت المحدد':'بعد العنصر المحدد');
  b.append(E('div',{class:'kb-where',text:'📍 هتتضاف: '+w}));
  if(sel&&isCont(sel)&&sel!==root)b.append(R('مكان الإضافة',seg([['جوّه','1'],['بعده','0']],function(){return insIn?'1':'0'},function(v){insIn=v==='1'})));
  b.append(E('div',{class:'kb-hint',text:'اضغط على أي عنصر عشان يتضاف في المكان المحدد، أو اسحبه وسيبه في أي مكان في الصفحة. سيبه على حرف عنصر (يمين/شمال) عشان يتحط جنبه.'}));
  ITEMS.forEach(function(g){b.append(G(g[0]));var grid=E('div',{class:'kb-chips'});
    g[1].forEach(function(d){var c=E('div',{class:'kb-chip',title:d[2]},E('b',{text:d[1]}),E('span',{text:d[2]}));
      c.onpointerdown=function(e){if(e.button>0)return;startDrag(null,d[1]+' '+d[2],e,function(){return makeItem(d)},function(){insertItem(d)})};grid.append(c)});b.append(grid)})}

function renderTree(b){
  b.append(E('div',{class:'kb-hint',text:'كل عناصر الصفحة. اضغط للتحديد، والأسهم لترتيبهم.'}));
  function walk(p,lv){[].forEach.call(p.children,function(c){if(c.matches('.kb-cfg'))return;
    b.append(E('div',{class:'kb-ti'+(c===sel?' on':''),style:'padding-inline-start:'+(lv*14+6)+'px',onclick:function(){select(c)}},E('span',{text:lbl(c)}),
      E('b',{text:'⬆',onclick:function(e){e.stopPropagation();select(c);mv(-1)}}),E('b',{text:'⬇',onclick:function(e){e.stopPropagation();select(c);mv(1)}})));
    if(lv<2&&isCont(c)&&c.children.length)walk(c,lv+1)})}
  walk(root,0)}

function renderPage(b){
  b.append(G('عرض الصفحة'),seg([['ضيّق','760'],['عادي',''],['واسع','1240'],['كامل','full']],function(){return cfgGet('w')},function(v){cfgSet('w',v);snap()}));
  b.append(G('الألوان والخط'),
   R('خلفية الصفحة',color(function(){return cfgGet('bg')||hex(getComputedStyle(document.body).backgroundColor)},function(v){cfgSet('bg',v)},function(){cfgSet('bg','')})),
   R('لون العناوين',color(function(){return cfgGet('hc')||hex(getComputedStyle(root).getPropertyValue('--head'))||'#07294a'},function(v){cfgSet('hc',v)},function(){cfgSet('hc','')})),
   R('حجم الخط',slider(function(){return +cfgGet('fs')||16.5},function(v){cfgSet('fs',v)},13,24,.5,'px')));
  b.append(G('نسخة احتياطية'),E('div',{class:'kb-acts'},act('⬇ تحميل HTML',function(){var a=E('a',{href:URL.createObjectURL(new Blob([clean(ser())],{type:'text/html'})),download:slug+'-backup.html'});document.body.append(a);a.click();a.remove()}),
    act('↺ رجّع الصفحة للأصل',async function(){if(!confirm('هتمسح كل التعديلات المحفوظة وترجع للصفحة الأصلية. متأكد؟'))return;
      try{var r=await fetch(API,{method:'PUT',headers:{'x-admin-password':pw,'Content-Type':'application/json'},body:JSON.stringify({html:''})});if(!r.ok)throw new Error('HTTP '+r.status);dirty=false;location.reload()}catch(e){alert('فشل: '+e.message)}},'red')));
  b.append(E('div',{class:'kb-hint',text:'اختصارات: Ctrl+S حفظ · Ctrl+Z تراجع · Ctrl+D نسخ · Delete حذف · Enter تعديل النص · الأسهم تنقل بين العناصر · Alt+↑/↓ نقل · Esc تحديد الأب.'}))}

function renderFmt(b){
  if(!sel){b.append(E('div',{class:'kb-hint',text:'اضغط على أي عنصر في الصفحة (كارت، نص، صورة، فيديو…) عشان تتحكم فيه بالكامل. اضغط مرتين على النص عشان تكتب فيه.'}));return}
  var e=sel,k=kind(e),isImg=k==='img';b.append(crumbs(e));
  if(k==='todo'||k==='slot'){b.append(G('حوّل المكان ده'),act('🎬 حط فيديو هنا',async function(){var u=await askText('🎬 رابط الفيديو','YouTube / Facebook / TikTok / Instagram / Vimeo / Drive / mp4');if(!u)return;var v=await mkVideo(u);if(v)swap(e,v)},'big'),E('div',{style:'height:6px'}),
    act('🖼 حط صورة هنا',async function(){var im=await askImages();if(im&&im[0])swap(e,im[0])},'big'))}
  if(k==='img'){b.append(G('الصورة'),E('div',{class:'kb-acts'},act('📁 استبدال',function(){replaceMedia(e)}),act('✎ وصف الصورة',async function(){var v=await askText('وصف الصورة (alt)','',e.alt);if(v!=null){e.alt=v;snap()}}),
      act('🔗 رابط',async function(){var v=await askText('رابط عند الضغط على الصورة (فاضي = بدون)','https://',e.parentElement.tagName==='A'?e.parentElement.href:'');if(v==null)return;
        if(e.parentElement.tagName==='A'){if(v)e.parentElement.href=v;else e.parentElement.replaceWith(e)}else if(v){var a=E('a',{href:v,target:'_blank',rel:'noopener'});e.before(a);a.append(e)}snap()}),
      act('💬 تعليق',async function(){var f=e.closest('figure.kb-fig'),v=await askText('تعليق تحت الصورة (فاضي = بدون)','',f?f.textContent:'');if(v==null)return;
        if(f){if(v)f.querySelector('figcaption').textContent=v;else{f.replaceWith(e)}}else if(v){f=H('<figure class="kb-fig"><figcaption></figcaption></figure>');f.querySelector('figcaption').textContent=v;e.before(f);f.prepend(e)}snap()})),
    R('القص',seg([['تلقائي',''],['16:9','16/9'],['4:3','4/3'],['1:1','1/1'],['3:4','3/4']],function(){return e.style.aspectRatio.replace(/ /g,'')},function(v){st(e,'aspect-ratio',v);st(e,'object-fit',v?(e.style.objectFit||'cover'):'');st(e,'width',v&&!inRow(e)&&!e.style.width?'100%':e.style.width)})),
    R('الملء',seg([['قص','cover'],['كامل','contain']],function(){return e.style.objectFit||'cover'},function(v){st(e,'object-fit',v)})))}
  if(k==='video'||k==='social'){b.append(G('الفيديو'),E('div',{class:'kb-acts'},act('🔄 تغيير الرابط',function(){replaceMedia(e)})));
    if(k==='video'&&!/\b(tt|ig|fbv)\b/.test(e.className))b.append(R('النسبة',seg([['16:9',''],['4:3','r43'],['1:1','r11'],['21:9','r219'],['9:16','r916']],function(){var m=e.className.match(/\br(43|11|219|916)\b/);return m?'r'+m[1]:''},
      function(v){e.className=e.className.replace(/\s*\br(43|11|219|916)\b/g,'').trim()+(v?' '+v:'')})))}
  if(k==='text'||k==='btn'||k==='callout'||k==='list'||k==='cell'||k==='card'||k==='other'||e.tagName==='HEADER'){
    b.append(G('النص'));
    if(/^(H1|H2|H3|H4|P)$/.test(e.tagName))b.append(R('النوع',seg([['عنوان كبير','H2'],['عنوان صغير','H3'],['فقرة','P']],function(){return e.tagName},function(v){if(v!==e.tagName)retag(e,v)})));
    if(k==='list')b.append(R('النوع',seg([['نقط','UL'],['أرقام','OL']],function(){return e.tagName},function(v){if(v!==e.tagName)retag(e,v)})));
    b.append(R('الحجم',slider(function(){return Math.round(num(getComputedStyle(e).fontSize,16))},function(v){st(e,'font-size',v+'px')},11,72,1,'px')),
     R('السُمك',seg([['عادي','400'],['وسط','600'],['عريض','800']],function(){var w=num(getComputedStyle(e).fontWeight,400);return w>=750?'800':w>=550?'600':'400'},function(v){st(e,'font-weight',v)})),
     R('المحاذاة',seg([['يمين','right'],['وسط','center'],['شمال','left'],['ضبط','justify']],function(){return e.style.textAlign},function(v){st(e,'text-align',v)})),
     R('المسافة بين السطور',slider(function(){return +(num(getComputedStyle(e).lineHeight,28)/num(getComputedStyle(e).fontSize,16)).toFixed(1)},function(v){st(e,'line-height',v)},1,3,.1)),
     R('لون النص',color(function(){return hex(getComputedStyle(e).color)},function(v){st(e,'color',v)},function(){st(e,'color','')})))}
  if(k==='btn'){b.append(G('الزرار'),E('div',{class:'kb-acts'},act('🔗 تغيير الرابط',async function(){var a=e.querySelector('a');var v=await askText('رابط الزرار','https://',a.href);if(v&&/^(https?:|mailto:|tel:)/i.test(v)){a.href=v;snap()}})),
    R('الشكل',seg([['أزرق',''],['برتقالي','kb-b2'],['أخضر','kb-b3'],['إطار','kb-b4']],function(){var m=e.className.match(/kb-b\d/);return m?m[0]:''},function(v){e.className=e.className.replace(/\s*kb-b\d/g,'')+(v?' '+v:'')})))}
  if(k==='card'){b.append(G('شكل الكارت'),R('الستايل',seg([['عادي',''],['فاتح','kb-v-soft'],['بإطار','kb-v-outline'],['حد ذهبي','kb-v-accent'],['غامق','kb-v-dark'],['شفاف','kb-v-plain']],
      function(){var m=e.className.match(/kb-v-\w+/);return m?m[0]:''},function(v){e.className=e.className.replace(/\s*kb-v-\w+/g,'')+(v?' '+v:'')})),
    G('ضيف جوّه الكارت'),addInside(),G('تحويل'),E('div',{class:'kb-acts'},act('فك الكارت',unwrap)))}
  if(k==='callout')b.append(G('لون التنبيه'),seg([['ذهبي',''],['أخضر','kb-c-ok'],['أحمر','kb-c-red'],['أزرق','kb-c-blue']],function(){var m=e.className.match(/kb-c-\w+/);return m?m[0]:''},function(v){e.className=e.className.replace(/\s*kb-c-\w+/g,'')+(v?' '+v:'')}));
  if(k==='row'){var kids=[].filter.call(e.children,function(c){return !c.matches('.kb-cfg')});b.append(G('الأعمدة'),E('div',{class:'kb-acts'},act('⚖ وزّع بالتساوي',function(){var w=Math.floor(100/kids.length);kids.forEach(function(c){c.style.setProperty('--w',w)});snap()}),
    act('فك الصف',function(){kids.forEach(function(c){c.style.removeProperty('--w');e.before(c)});e.remove();select(kids[0]);snap()})))}
  if(k==='cell'||k==='table'){var tbl=e.closest('table'),cell=e.closest('td,th');b.append(G('الجدول'),E('div',{class:'kb-acts'},
    act('+ صف',function(){var tr=(cell?cell.parentElement:tbl.rows[tbl.rows.length-1]),n=tr.cloneNode(true);[].forEach.call(n.cells,function(c){c.textContent='…'});tr.after(n);snap()}),
    act('+ عمود',function(){var i=cell?cell.cellIndex:tbl.rows[0].cells.length-1;[].forEach.call(tbl.rows,function(r){var c=r.cells[i].cloneNode(false);c.textContent='…';r.cells[i].after(c)});snap()}),
    act('− صف',function(){if(cell&&tbl.rows.length>1){cell.parentElement.remove();select(tbl)}}),
    act('− عمود',function(){if(cell&&tbl.rows[0].cells.length>1){var i=cell.cellIndex;[].forEach.call(tbl.rows,function(r){r.cells[i].remove()});select(tbl)}})))}

  b.append(G('الحجم والمكان'));
  if(!e.matches('td,th,li')){
    b.append(R('العرض',seg([['25','25'],['33','33'],['50','50'],['66','66'],['75','75'],['كامل','100']],function(){var w=getW(e);return w>=100?'100':String(Math.round(w))},function(v){setW(e,+v)})),
     R('عرض حر',slider(function(){return Math.round(getW(e))},function(v){setW(e,v)},10,100,1,'%')),
     R('المحاذاة',seg([['بداية','start'],['وسط','center'],['نهاية','end']],function(){return e.getAttribute('data-al')||''},function(v){setAlign(e,e.getAttribute('data-al')===v?'':v)})),
     R('فوق',slider(function(){return Math.round(num(getComputedStyle(e).marginTop))},function(v){st(e,'margin-top',v+'px')},0,140,2,'px')),
     R('تحت',slider(function(){return Math.round(num(getComputedStyle(e).marginBottom))},function(v){st(e,'margin-bottom',v+'px')},0,140,2,'px')))}
  if(k==='sep'&&e.matches('.kb-sp'))b.append(R('الارتفاع',slider(function(){return Math.round(e.getBoundingClientRect().height)},function(v){st(e,'height',v+'px')},4,240,2,'px')));
  if(/^(card|callout|row|other|text|img|video|btn|table)$/.test(k)&&!e.matches('li,td,th')){
    b.append(G('المظهر'));
    if(!/^(row|btn)$/.test(k))b.append(R('الخلفية',color(function(){return hex(getComputedStyle(e).backgroundColor)},function(v){st(e,'background',v)},function(){st(e,'background','')})));
    if(/^(card|callout|other|img|video|text)$/.test(k))b.append(R('الحواف',slider(function(){return Math.round(num(getComputedStyle(e).borderTopLeftRadius))},function(v){st(e,'border-radius',v+'px')},0,48,1,'px')));
    if(/^(card|callout|other|text)$/.test(k))b.append(R('الحشوة',slider(function(){return Math.round(num(getComputedStyle(e).paddingTop))},function(v){st(e,'padding',v+'px')},0,80,2,'px')));
    if(/^(card|callout|img|video|other)$/.test(k))b.append(R('الظل',seg([['افتراضي',''],['بدون','none'],['خفيف','0 10px 24px -14px rgba(11,26,43,.4)'],['قوي','0 24px 50px -16px rgba(11,26,43,.6)']],function(){return e.style.boxShadow},function(v){st(e,'box-shadow',v)})),
      R('الإطار',slider(function(){return Math.round(num(getComputedStyle(e).borderTopWidth))},function(v){st(e,'border-width',v+'px');st(e,'border-style',v?'solid':'')},0,8,1,'px'),
        color(function(){return hex(getComputedStyle(e).borderTopColor)},function(v){st(e,'border-color',v)},function(){st(e,'border-color','')})))}
  b.append(G('ترتيب ونقل'),E('div',{class:'kb-acts'},act('⬆ لفوق',function(){mv(-1)}),act('⬇ لتحت',function(){mv(1)}),act('⇆ جنب اللي قبله',sideBy),act('↖ خرّجه بره الكارت',moveOut),act('↘ دخّله الكارت اللي قبله',moveIn),
    act('🗂 لفّه في كارت',wrapCard),act('⧉ نسخ',dup),act('🗑 حذف',del,'red')));
  b.append(G('HTML (متقدم)'));var ta=E('textarea',{spellcheck:'false'});var copy=e.cloneNode(true);copy.removeAttribute('contenteditable');ta.value=copy.outerHTML;b.append(ta,E('div',{style:'height:6px'}),
    act('تطبيق الكود',function(){var n=H(clean(ta.value));if(!n)return alert('الكود مش صالح');e.replaceWith(n);select(n);snap()}))}

function refresh(){
  if(!pn)return;var b=pn.querySelector('.kb-pb');var y=b.scrollTop;b.textContent='';
  pn.querySelectorAll('.kb-tabs button').forEach(function(x){x.classList.toggle('on',x.dataset.t===tab)});
  if(tab==='add')renderAdd(b);else if(tab==='fmt')renderFmt(b);else if(tab==='tree')renderTree(b);else renderPage(b);b.scrollTop=y;
  bar.querySelectorAll('[data-u]').forEach(function(x){x.disabled=x.dataset.u==='z'?hi<=0:hi>=hist.length-1;x.style.opacity=x.disabled?.4:1})}

/* ---------- top bar ---------- */
function mk(t,title,fn,cls){var b=E('button',{type:'button',text:t,title:title||t});if(cls)b.className=cls;b.onmousedown=function(e){if(!/^(INPUT|SELECT)$/.test(e.target.tagName))e.preventDefault()};b.onclick=fn;return b}
bar=E('div',{class:'kb-bar',hidden:''});
function colorBtn(title,cmd,val){var i=E('input',{type:'color',title:title});i.value=val;i.onmousedown=function(){var s=getSelection();if(txt&&s.rangeCount&&txt.contains(s.anchorNode))rng=s.getRangeAt(0).cloneRange()};i.oninput=function(){fmt(cmd,i.value)};i.onchange=function(){if(!txt)snap()};return i}
function link(){if(!txt)return toast('اضغط مرتين على النص وحدد الكلمة الأول');var u=prompt('الرابط (https://...):');if(u&&/^(https?:|mailto:|tel:)/i.test(u))fmt('createLink',u)}
function setVP(v){vp=v;document.documentElement.classList.remove('kb-vp-t','kb-vp-m');if(v!=='d')document.documentElement.classList.add('kb-vp-'+v);bar.querySelectorAll('[data-vp]').forEach(function(x){x.classList.toggle('on',x.dataset.vp===v)})}
function togglePrev(){prev=!prev;endText();document.body.classList.toggle('kb-pv',prev);root.classList.toggle('kb-on',!prev);if(prev)select(null);bar.querySelector('[data-pv]').textContent=prev?'✏️ رجوع للتعديل':'👁 معاينة'}
[mk('↶','تراجع (Ctrl+Z)',function(){go(-1)}),mk('↷','إعادة (Ctrl+Y)',function(){go(1)}),
 E('span',{class:'kb-sep'}),mk('B','عريض',function(){fmt('bold')}),mk('I','مائل',function(){fmt('italic')}),mk('U','تحته خط',function(){fmt('underline')}),mk('S','يتوسطه خط',function(){fmt('strikeThrough')}),
 colorBtn('لون الخط','foreColor','#d1343c'),colorBtn('تحديد بلون','hiliteColor','#fff200'),mk('🔗','رابط',link),mk('⛓','شيل الرابط',function(){fmt('unlink')}),
 mk('• قائمة','قائمة',function(){fmt('insertUnorderedList')}),mk('🧹','مسح التنسيق',function(){fmt('removeFormat')}),
 E('span',{class:'kb-sep'}),mk('🖥','ديسكتوب',function(){setVP('d')}),mk('📲','تابلت',function(){setVP('t')}),mk('📱','موبايل',function(){setVP('m')}),mk('👁 معاينة','معاينة بدون أدوات',togglePrev),
 E('i'),mk('💾 حفظ','Ctrl+S',save,'sv'),mk('إلغاء','',cancel,'cn')].forEach(function(x){bar.append(x)});
bar.querySelector('button:nth-child(1)').dataset.u='z';bar.querySelector('button:nth-child(2)').dataset.u='y';
[].forEach.call(bar.querySelectorAll('button'),function(b){if(b.textContent==='🖥')b.dataset.vp='d';if(b.textContent==='📲')b.dataset.vp='t';if(b.textContent==='📱')b.dataset.vp='m';if(/معاينة/.test(b.textContent))b.dataset.pv='1'});

pn=E('div',{class:'kb-pn',hidden:''},E('div',{class:'kb-tabs'},[['add','➕ إضافة'],['fmt','🎛 تنسيق'],['tree','🌲 الهيكل'],['page','📄 الصفحة']].map(function(t){return E('button',{'data-t':t[0],text:t[1],onclick:function(){tab=t[0];refresh()}})})),E('div',{class:'kb-pb'}));
function layout(){var h=barH();pn.style.top=h+'px'}
window.addEventListener('resize',layout);

/* ---------- enter / exit / save ---------- */
var fab=mk('✏️ تعديل الصفحة','',enter,'kb-fab');
document.body.insertBefore(bar,document.body.firstChild);document.body.append(pn,ov,hv,fab);
async function enter(){
  if(!pw){pw=prompt('كلمة سر التعديل:')||'';if(!pw)return}
  var r;try{r=await fetch(API,{method:'POST',headers:{'x-admin-password':pw}})}catch(e){r={ok:false,status:0}}
  if(!r.ok){pw='';sessionStorage.removeItem('kb_pw');var m='';try{m=(await r.json()).error}catch(x){}return alert(m||(r.status==404?'فولدر api مش مرفوع على GitHub':'السيرفر مش جاهز (HTTP '+r.status+')'))}
  sessionStorage.setItem('kb_pw',pw);backup=ser();hist=[backup];hi=0;dirty=false;editing=true;prev=false;sel=null;tab='add';
  root.classList.add('kb-on');document.body.classList.add('kb-ed');document.body.classList.remove('kb-pv');bar.hidden=false;pn.hidden=false;fab.hidden=true;layout();refresh();setTimeout(layout,200)}
function exit(){endText();editing=false;prev=false;root.classList.remove('kb-on');document.body.classList.remove('kb-ed','kb-pv');setVP('d');sel=null;ov.hidden=true;hv.hidden=true;bar.hidden=true;pn.hidden=true;fab.hidden=false}
async function save(){
  endText();tidy();var html=clean(ser());
  try{var r=await fetch(API,{method:'PUT',headers:{'x-admin-password':pw,'Content-Type':'application/json'},body:JSON.stringify({html:html})});
    if(!r.ok){var j={};try{j=await r.json()}catch(x){}throw new Error(j.error||('HTTP '+r.status))}
    root.innerHTML=html;applyCfg();dirty=false;exit();toast('تم الحفظ ✓')}catch(e){alert('فشل الحفظ:\n'+(e.message||e))}}
function cancel(){if(dirty&&!confirm('فيه تعديلات متحفظتش. تتجاهلها؟'))return;root.innerHTML=backup;applyCfg();dirty=false;exit()}
window.addEventListener('beforeunload',function(e){if(editing&&dirty){e.preventDefault();e.returnValue=''}});

/* ---------- page events ---------- */
root.addEventListener('click',function(e){
  if(!editing||prev){return}
  if(txt&&txt.contains(e.target))return;
  e.preventDefault();e.stopPropagation();select(pick(e.target),true)},true);
root.addEventListener('dblclick',function(e){
  if(!editing||prev)return;var n=pick(e.target);if(!n)return;
  if(n.matches('.vslot')){fillSlot(n);return}if(n.matches('.video,.social,img')){replaceMedia(n);return}
  var et=editTarget(e.target);if(et){select(pick(et)||et);startEdit(et)}});
root.addEventListener('click',function(e){
  if(editing&&!prev)return;var b=e.target.closest('.splay');if(!b)return;var c=b.closest('.social'),src=c&&c.getAttribute('data-src');if(!src||!IF.test(src))return;
  var d=document.createElement('div');d.className='video '+(c.getAttribute('data-c')||'');var f=document.createElement('iframe');f.src=src;f.title=c.querySelector('.slbl')?c.querySelector('.slbl').textContent:'video';
  f.allow='autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';f.allowFullscreen=true;d.appendChild(f);
  var o=c.querySelector('.sopen'),w=document.createElement('p');w.className='extlink';if(o)w.appendChild(o);c.replaceWith(d);d.after(w)});
root.addEventListener('mouseover',function(e){
  if(!editing||prev||drag0())return;var n=pick(e.target);if(!n||n===sel||!n.isConnected){hv.hidden=true;return}
  var r=n.getBoundingClientRect();hv.hidden=false;hv.style.cssText='left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px'});
root.addEventListener('mouseleave',function(){hv.hidden=true});
function drag0(){return !!document.querySelector('.kb-ghost')}
/* drop image files from the desktop / paste images */
root.addEventListener('dragover',function(e){if(editing&&e.dataTransfer&&[].indexOf.call(e.dataTransfer.types,'Files')>-1)e.preventDefault()});
root.addEventListener('drop',async function(e){if(!editing||!e.dataTransfer||!e.dataTransfer.files.length)return;e.preventDefault();
  var d=target(e.clientX,e.clientY,null)||{cont:root,mode:'in'},im=await files2imgs(e.dataTransfer.files);im.forEach(function(i){dropAt(i,d);d={cont:i.parentElement,ref:i,before:false}});if(im.length){select(im[0]);snap()}});
document.addEventListener('paste',async function(e){if(!editing||txt||!e.clipboardData)return;var fl=[].filter.call(e.clipboardData.files||[],function(f){return /^image\//.test(f.type)});if(!fl.length)return;
  e.preventDefault();var im=await files2imgs(fl),d=defLoc();im.forEach(function(i){dropAt(i,d);d={cont:i.parentElement,ref:i,before:false}});if(im.length){select(im[0]);snap()}});
document.addEventListener('keydown',function(e){
  if(!editing)return;var k=e.key,c=e.ctrlKey||e.metaKey,tg=e.target;
  if(c&&k.toLowerCase()==='s'){e.preventDefault();save();return}
  if(txt){if(k==='Escape'){e.preventDefault();endText()}return}
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)||document.querySelector('.kb-md'))return;
  if(c&&k.toLowerCase()==='z'){e.preventDefault();go(e.shiftKey?1:-1);return}
  if(c&&k.toLowerCase()==='y'){e.preventDefault();go(1);return}
  if(!sel)return;
  if(c&&k.toLowerCase()==='d'){e.preventDefault();dup()}
  else if(k==='Delete'||k==='Backspace'){e.preventDefault();del()}
  else if(k==='Enter'||k==='F2'){e.preventDefault();startEdit(sel)}
  else if(k==='Escape'){var p=sel.parentElement;select(p&&p!==root?p:null)}
  else if(k==='ArrowUp'||k==='ArrowDown'){e.preventDefault();var d=k==='ArrowUp'?-1:1;if(e.altKey)mv(d);else{var s=sib(sel,d);if(s)select(s)}}
  else if(k==='ArrowRight'||k==='ArrowLeft'){var ch=sel.firstElementChild;if(k===(RTL?'ArrowLeft':'ArrowRight')&&ch&&isCont(sel)){e.preventDefault();select(ch)}else if(k===(RTL?'ArrowRight':'ArrowLeft')&&sel.parentElement!==root){e.preventDefault();select(sel.parentElement)}}
});
})();
