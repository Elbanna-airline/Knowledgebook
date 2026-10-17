/* Page editor: edit text, add cards / images / videos. Saves to /api/page (Vercel Blob). */
(function(){
var root=document.querySelector('.page');if(!root)return;
var slug=(location.pathname.split('/').pop()||'').replace('.html',''),API='/api/page?slug='+encodeURIComponent(slug),
pw=sessionStorage.getItem('kb_pw')||'',backup='',sel=null;
var IF=/^(https:\/\/(www\.youtube-nocookie\.com\/embed\/|drive\.google\.com\/file\/d\/[\w-]+\/preview)|\.\.\/assets\/)/;
function clean(h){
  var box=new DOMParser().parseFromString('<div>'+h+'</div>','text/html').body.firstChild;
  box.querySelectorAll('script,style,object,embed,link,meta,form').forEach(function(n){n.remove()});
  box.querySelectorAll('iframe').forEach(function(f){if(!IF.test(f.getAttribute('src')||''))f.remove()});
  box.querySelectorAll('*').forEach(function(n){[].slice.call(n.attributes).forEach(function(a){
    if(/^on/i.test(a.name)||(/^(href|src)$/i.test(a.name)&&/^\s*javascript:/i.test(a.value)))n.removeAttribute(a.name)})});
  return box.innerHTML}
fetch(API).then(function(r){return r.json()}).then(function(d){if(d&&d.html)root.innerHTML=clean(d.html)}).catch(function(){});

var st=document.createElement('style');st.textContent=
'.kb-fab{position:fixed;left:16px;bottom:16px;z-index:50;border:0;border-radius:999px;padding:11px 18px;background:#f5891f;color:#06335c;font:700 .9rem Cairo,sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.3)}'+
'.kb-bar{position:sticky;top:0;z-index:60;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 12px;background:#06335c;border-bottom:3px solid #f5891f;direction:rtl}'+
'.kb-bar button,.kb-bar label{border:1px solid rgba(255,255,255,.35);background:#0860aa;color:#fff;border-radius:8px;padding:6px 10px;font:700 .8rem Cairo,sans-serif;cursor:pointer;line-height:1.2}'+
'.kb-bar button:hover{background:#f5891f}.kb-bar .sv{background:#1e8e5a}.kb-bar .cn{background:#d1343c}.kb-bar input[type=color]{width:34px;height:30px;padding:2px;border-radius:8px;border:0}'+
'.kb-bar i{flex:1}.kb-on{outline:2px dashed #f5891f;outline-offset:-6px;min-height:60vh}.kb-on img,.kb-on .card,.kb-on .video{cursor:pointer}'+
'.kb-on .video iframe,.kb-on .video video,.kb-on iframe.frame{pointer-events:none}.kb-sel{outline:3px solid #f5891f!important;outline-offset:2px}'+
'.kb-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1e8e5a;color:#fff;padding:10px 20px;border-radius:10px;font:700 .9rem Cairo,sans-serif;z-index:90}';
document.head.appendChild(st);

function mk(t,title,fn,cls){var b=document.createElement('button');b.type='button';b.textContent=t;b.title=title||t;if(cls)b.className=cls;
  b.onmousedown=function(e){e.preventDefault()};b.onclick=fn;return b}
function ex(c,v){document.execCommand(c,false,v||null)}
function put(el){var t=sel&&root.contains(sel)?sel:root.lastElementChild;t?t.after(el):root.appendChild(el)}
function toast(m){var t=document.createElement('div');t.className='kb-toast';t.textContent=m;document.body.appendChild(t);setTimeout(function(){t.remove()},2200)}
function shrink(f){return new Promise(function(ok,no){var m=new Image();m.onload=function(){var s=Math.min(1,1600/m.width),c=document.createElement('canvas');
  c.width=Math.round(m.width*s);c.height=Math.round(m.height*s);c.getContext('2d').drawImage(m,0,0,c.width,c.height);c.toBlob(function(b){b?ok(b):no()},'image/jpeg',.85)};
  m.onerror=no;m.src=URL.createObjectURL(f)})}
function addImg(){var i=document.createElement('input');i.type='file';i.accept='image/*';i.multiple=true;
  i.onchange=async function(){for(var k=0;k<i.files.length;k++){var f=i.files[k];try{
    var r=await fetch('/api/upload?name='+encodeURIComponent(f.name),{method:'POST',headers:{'x-admin-password':pw,'Content-Type':'application/octet-stream'},body:await shrink(f)});
    var j=await r.json();if(!r.ok)throw new Error(j.error||r.status);var im=document.createElement('img');im.src=j.url;im.alt=f.name.replace(/\.\w+$/,'');im.loading='lazy';put(im)
  }catch(e){alert('فشل رفع '+f.name+'\n'+(e.message||''))}}};i.click()}
function addVid(){var u=(prompt('الصق رابط الفيديو (YouTube أو Google Drive أو mp4 مباشر):')||'').trim();if(!u)return;
  var d=document.createElement('div'),m;d.className='video';
  if(m=u.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/))d.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+m[1]+'" title="فيديو" allowfullscreen loading="lazy"></iframe>';
  else if(m=u.match(/drive\.google\.com\/file\/d\/([\w-]+)/))d.innerHTML='<iframe src="https://drive.google.com/file/d/'+m[1]+'/preview" title="فيديو" allowfullscreen loading="lazy"></iframe>';
  else if(/^https:\/\/\S+\.(mp4|webm)(\?\S*)?$/i.test(u)){var v=document.createElement('video');v.controls=true;v.preload='metadata';v.src=u;d.appendChild(v)}
  else return alert('الرابط غير مدعوم');
  put(d)}
function addCard(){var d=document.createElement('div');d.className='card';d.innerHTML='<h2>عنوان جديد</h2><p>اكتب هنا...</p>';put(d)}
function del(){if(sel&&root.contains(sel)&&confirm('حذف العنصر المحدد؟')){sel.remove();sel=null}}
function mv(d){if(!sel)return;var s=d<0?sel.previousElementSibling:sel.nextElementSibling;if(s)d<0?s.before(sel):s.after(sel)}
function link(){var u=prompt('الرابط (https://...):');if(u&&/^(https?:|mailto:|tel:)/i.test(u))ex('createLink',u)}
function exit(){root.contentEditable='false';root.classList.remove('kb-on');if(sel)sel.classList.remove('kb-sel');sel=null;bar.hidden=true;fab.hidden=false}
async function save(){
  var t=root.cloneNode(true);t.querySelectorAll('.kb-sel').forEach(function(n){n.classList.remove('kb-sel')});
  t.removeAttribute('contenteditable');t.classList.remove('kb-on');var html=clean(t.innerHTML);
  try{var r=await fetch(API,{method:'PUT',headers:{'x-admin-password':pw,'Content-Type':'application/json'},body:JSON.stringify({html:html})});
    if(!r.ok){var j={};try{j=await r.json()}catch(x){}throw new Error(j.error||('HTTP '+r.status))}root.innerHTML=html;exit();toast('تم الحفظ ✓')}catch(e){alert('فشل الحفظ:\n'+(e.message||e))}}
async function enter(){
  if(!pw){pw=prompt('كلمة سر التعديل:')||'';if(!pw)return}
  var r;try{r=await fetch(API,{method:'POST',headers:{'x-admin-password':pw}})}catch(e){r={ok:false,status:0}}
  if(!r.ok){pw='';sessionStorage.removeItem('kb_pw');var m='';try{m=(await r.json()).error}catch(x){}return alert(m||(r.status==404?'فولدر api مش مرفوع على GitHub':'السيرفر مش جاهز (HTTP '+r.status+')'))}
  sessionStorage.setItem('kb_pw',pw);backup=root.innerHTML;root.contentEditable='true';root.classList.add('kb-on');bar.hidden=false;fab.hidden=true}

var bar=document.createElement('div');bar.className='kb-bar';bar.hidden=true;
var col=document.createElement('input');col.type='color';col.value='#d1343c';col.title='لون الخط';col.oninput=function(){ex('foreColor',col.value)};
[mk('B','عريض',function(){ex('bold')}),mk('I','مائل',function(){ex('italic')}),mk('عنوان','عنوان',function(){ex('formatBlock','h2')}),mk('فقرة','فقرة',function(){ex('formatBlock','p')}),
 mk('• قائمة','قائمة',function(){ex('insertUnorderedList')}),mk('🔗','رابط',link),col,
 mk('🖼 صورة','إضافة صور',addImg),mk('🎬 فيديو','إضافة فيديو',addVid),mk('➕ كارت','كارت جديد',addCard),
 mk('⬆','تحريك لفوق',function(){mv(-1)}),mk('⬇','تحريك لتحت',function(){mv(1)}),mk('🗑 حذف','حذف المحدد',del)
].forEach(function(b){bar.appendChild(b)});
bar.appendChild(document.createElement('i'));
bar.appendChild(mk('💾 حفظ','',save,'sv'));bar.appendChild(mk('إلغاء','',function(){root.innerHTML=backup;exit()},'cn'));
document.body.insertBefore(bar,document.body.firstChild);
var fab=mk('✏️ تعديل الصفحة','',enter,'kb-fab');document.body.appendChild(fab);

root.addEventListener('click',function(e){if(root.contentEditable!=='true')return;
  if(e.target.closest('a'))e.preventDefault();
  var n=e.target.closest('.card,.video,img');if(sel)sel.classList.remove('kb-sel');sel=n;if(n)n.classList.add('kb-sel')});
})();
