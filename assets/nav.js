/* Builds the glass nav (pills + "All pages" dropdown) into every <nav data-nav> */
(function(){
var P=[
 ['index.html','Home','Home','assets/hero.webp','Back to the start','in'],
 ['fixed-rates.html','Fixed rates','Fixed rates sheets/offers','assets/fixed-rates.webp','Rate sheets and fixed offers','in'],
 ['current-offers.html','Current offers','Current offers','assets/current-offers.webp','Latest offers, blocks and seats','in'],
 ['https://travel-system.hadysu96.workers.dev/','Blocks tool','Salalah and Umrah blocks tool','assets/blocks-tool.webp','Group blocks and availability','out'],
 ['galileo-pnr.html','Galileo PNR','Galileo PNR entries','assets/galileo-pnr.webp','Galileo commands and PNR entries','in'],
 ['playbook.html','Playbook','Sales operations playbook','assets/playbook.webp','How we sell and handle clients','in'],
 ['umrah.html','Umrah','Umrah information','assets/umrah.webp','Requirements and key facts','in'],
 ['dictionary.html','Dictionary','KW-EG dictionary','assets/dictionary.svg','Egyptian and Kuwaiti words','in'],
 ['https://www.passportindex.org/passport/kuwait/','Visa index','Visa index','assets/visa-index.webp','Visa requirements by passport','out'],
 ['https://travelate-mu.vercel.app/travelate1.html','Travelate','Travelate','assets/travelate.webp','Our booking platform','out'],
 ['tourism.html','Tourism','Tourism information','assets/tourism.webp','Destinations and hotels','in']
];
var cur=(location.pathname.split('/').pop()||'index.html');if(cur==='')cur='index.html';
var chev='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>';
var ext='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h7v7M13 3L5 11"/></svg>';
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function attrs(p){return p[5]==='out'?' target="_blank" rel="noopener"':''}
function isOn(p){return p[5]==='in'&&p[0]===cur}
function item(p){return '<a role="menuitem" href="'+p[0]+'"'+attrs(p)+(isOn(p)?' class="on" aria-current="page"':'')+'><img alt="" src="'+p[3]+'"><span>'+esc(p[2])+'<small>'+esc(p[4])+'</small></span>'+(p[5]==='out'?ext:'')+'</a>'}
[].forEach.call(document.querySelectorAll('nav[data-nav]'),function(nav,n){
  var id='gm'+n;
  var pills=P.map(function(p){return '<a class="pill'+(isOn(p)?' on':'')+'" href="'+p[0]+'"'+attrs(p)+(isOn(p)?' aria-current="page"':'')+'>'+esc(p[1])+'</a>'}).join('');
  var inn=P.filter(function(p){return p[5]==='in'}),out=P.filter(function(p){return p[5]==='out'});
  nav.innerHTML='<button class="menu-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="'+id+'">All pages'+chev+'</button>'
   +'<div class="pillrow">'+pills+'</div>'
   +'<div class="gmenu" id="'+id+'" role="menu" hidden><h6>Pages in this site</h6>'+inn.map(item).join('')+'<h6>Tools and platforms (new tab)</h6>'+out.map(item).join('')+'</div>';
  var b=nav.querySelector('.menu-btn'),m=nav.querySelector('.gmenu');
  function set(o){m.hidden=!o;b.setAttribute('aria-expanded',o)}
  b.addEventListener('click',function(e){e.stopPropagation();set(m.hidden)});
  document.addEventListener('click',function(e){if(!nav.contains(e.target))set(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!m.hidden){set(false);b.focus()}});
  var on=nav.querySelector('.pill.on');if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest',inline:'center'});
});
})();
