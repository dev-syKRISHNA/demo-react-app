"use strict";var DAP=(()=>{var D=Object.defineProperty;var le=Object.getOwnPropertyDescriptor;var de=Object.getOwnPropertyNames;var se=Object.prototype.hasOwnProperty;var ce=(e,t)=>{for(var o in t)D(e,o,{get:t[o],enumerable:!0})},pe=(e,t,o,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of de(t))!se.call(e,a)&&a!==o&&D(e,a,{get:()=>t[a],enumerable:!(n=le(t,a))||n.enumerable});return e};var ue=e=>pe(D({},"__esModule",{value:!0}),e);var Ye={};ce(Ye,{init:()=>re});async function M(e,t,o={}){let n=(o.method||"GET").toUpperCase(),a={"X-Api-Key":e.apikey,...o.includeHostHeader&&o.hostBase?{"X-Host-Url":o.hostBase}:{},...o.headers||{}},r;n!=="GET"&&o.body!==void 0&&(a["Content-Type"]=a["Content-Type"]||"application/json",r=JSON.stringify(o.body));let d=me(t)?t:new URL(t,location.origin).toString(),i=new AbortController,l=setTimeout(()=>i.abort(),o.timeoutMs??15e3),s;try{s=await fetch(d,{method:n,headers:a,body:r,signal:i.signal,credentials:"omit",cache:"no-cache"})}catch(p){throw clearTimeout(l),p}if(clearTimeout(l),!s.ok){let p=new Error(`HTTP ${s.status}`);p.status=s.status;try{p.body=await s.text()}catch{}throw p}let c=s.headers.get("content-type")||"";return c.includes("application/json")?s.json():c.startsWith("text/")?s.text():s}function me(e){return/^https?:\/\//i.test(e)||e.startsWith("blob:")||e.startsWith("data:")}async function j(e,t){let o=V(e.apiurl,`iap-experience/${e.organizationid}/${e.siteid}/visible-flows`);try{let n=await M(e,o,{method:"POST",hostBase:t,includeHostHeader:!0,body:{hostname:t}});return Array.isArray(n)?n:[]}catch(n){if(n&&n.status===405){let a=`${o}?hostname=${encodeURIComponent(t)}`,r=await M(e,a,{method:"GET",hostBase:t,includeHostHeader:!0});return Array.isArray(r?.flowIds)?r.flowIds:[]}throw n}}async function W(e,t,o){let n=V(e.apiurl,`iap-experience/${e.organizationid}/${e.siteid}/flows/${o}`);return M(e,n,{method:"GET",hostBase:t,includeHostHeader:!0})}function Y(e){let t={steps:[],startAt:0},o=Array.isArray(e?.steps)?e.steps:[];for(let n of o){let a=n?.uxExperience;if(!a)continue;let r=String(a.uxExperienceType||"").toLowerCase();if(r==="tooltip"||a?.content?.componentType==="Tooltip"){let d={targetSelector:a.elementSelector||"",text:a?.content?.text||"",placement:a?.content?.placement||"auto",trigger:K(a.elementTrigger)};t.steps.push({kind:"tooltip",tooltip:d,title:a?.name||"Tip"});continue}if(r==="popover"||a?.content?.componentType==="Popover"){let d={title:a?.content?.title||a?.name||"Info",body:a?.content?.body||"",bodyBlocks:Array.isArray(a?.content?.bodyBlocks)?a.content.bodyBlocks:void 0,targetSelector:a?.elementSelector||"",placement:a?.content?.placement||"auto",trigger:K(a.elementTrigger),showArrow:a?.content?.showArrow!==!1};t.steps.push({kind:"popover",popover:d,title:d.title});continue}if(r==="modal"||a?.content?.componentType==="Modal"){let d=[];if(a?.content?.body&&d.push({kind:"text",html:String(a.content.body)}),a?.modalContent?.contentType==="KnowledgeBase"){let i={kind:"kb",title:a?.content?.header||a?.name||"Knowledge Base",items:be(a?.modalContent?.contentData)};d.push(i)}else{let i=a?.modalContent;if(i){let l=i.presignedUrl||i.contentData||"",s=String(i.contentType||"").toLowerCase();s==="link"?X(l)?d.push({kind:"youtube",href:l,title:i.contentName||"YouTube"}):A(l)&&d.push({kind:"link",href:l,label:i.contentName||l}):s==="video"?A(l)&&d.push({kind:"video",sources:[{src:l}]}):s==="image"?A(l)&&d.push({kind:"image",url:l,alt:i.contentName||""}):s==="article"&&A(l)&&d.push({kind:"article",url:l,fileName:i.contentData||void 0,mime:/\.pdf(\?|#|$)/i.test(l)?"application/pdf":/\.docx(\?|#|$)/i.test(l)?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":void 0})}}t.steps.push({kind:"modal",title:a?.content?.header||a?.name||"Info",footerText:a?.content?.footer||"",body:d})}}return t}function K(e){let t=String(e||"").toLowerCase();return t.includes("click")?"click":t.includes("focus")?"focus":"hover"}function A(e){try{let t=new URL(e,location.origin);return/^https?:$/i.test(t.protocol)}catch{return!1}}function X(e){try{let o=new URL(e,location.origin).hostname.toLowerCase();return/(^|\.)youtube\.com$/.test(o)||/(^|\.)youtu\.be$/.test(o)||/(^|\.)youtube-nocookie\.com$/.test(o)}catch{return!1}}function fe(e,t){let o=(e||"").toLowerCase();return o==="link"?X(t)?"youtube":"link":o==="video"?"video":o==="image"?"image":o==="article"?"article":"link"}function be(e){if(!Array.isArray(e))return[];let t=[];for(let o of e){let n=o?.presignedUrl||o?.contentData||"";n&&t.push({kind:"kb-item",itemType:fe(o?.contentType,n),title:o?.contentName||"",description:o?.contentDescription||"",url:n,fileName:o?.contentData||void 0,mime:/\.pdf(\?|#|$)/i.test(n)?"application/pdf":/\.docx(\?|#|$)/i.test(n)?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":void 0})}return t}function V(e,t){let o=(e||"").replace(/\/+$/,""),n=(t||"").replace(/^\/+/,"");return`${o}/${n}`}function k(e){let t=document.createElement("div");t.innerHTML=e||"";let o=t.querySelectorAll("*");for(let n=0;n<o.length;n++){let a=o[n],r=a.nodeName.toLowerCase();if(!he.has(r)){let i=document.createTextNode(a.textContent||""),l=a.parentNode;l&&l.replaceChild(i,a);continue}let d=a.attributes;for(let i=d.length-1;i>=0;i--){let l=d[i],s=l.name.toLowerCase(),c=l.value;if(!ge.has(s)){a.removeAttribute(l.name);continue}if(s==="href"||s==="src"){if(!w(c)){a.removeAttribute(l.name);continue}s==="href"&&ye(c)&&(a.getAttribute("rel")||a.setAttribute("rel","noopener noreferrer"),a.getAttribute("target")||a.setAttribute("target","_blank"))}}}return t.innerHTML}var he=new Set(["b","strong","i","em","u","span","p","br","ul","ol","li","a","code","pre","small","div","h1","h2","h3","h4","h5","h6","table","thead","tbody","tr","td","th"]),ge=new Set(["href","target","rel","class","style","src","alt","title","aria-label","colspan","rowspan","scope"]);function w(e){if(!e)return!1;try{let t=new URL(e,location.origin);return t.protocol==="http:"||t.protocol==="https:"}catch{return!1}}function ye(e){try{let t=new URL(e,location.origin);return t.protocol==="http:"||t.protocol==="https:"}catch{return!1}}var I=`
:root {
  --dap-z: 2147483640;
  --dap-overlay: rgba(17, 24, 39, .48);
  --dap-panel-bg: #fff;
  --dap-fg: #111827;
  --dap-muted: #6b7280;
  --dap-border: 1px solid rgba(0,0,0,.08);
  --dap-radius: 14px;
  --dap-shadow: 0 24px 64px rgba(0,0,0,.22);
  --dap-cta: #0b6bcb;
  --dap-cta-fg: #fff;
  --dap-cta-hover: #095aa7;
  --dap-secondary: #e5e7eb;
}

*, *::before, *::after { box-sizing: border-box; }
.dap-modal-wrap, .dap-modal { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

/* Overlay (no flex; we center the panel via translate) */
.dap-modal-wrap {
  position: fixed;
  inset: 0;
  background: var(--dap-overlay);
  z-index: var(--dap-z);
  pointer-events: auto;
}

/* Panel */
.dap-modal {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%,-50%);
  background: var(--dap-panel-bg);
  color: var(--dap-fg);
  border: var(--dap-border);
  border-radius: var(--dap-radius);
  box-shadow: var(--dap-shadow);
  width: clamp(720px, 78vw, 980px);
  max-height: min(88vh, 900px);
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
}

/* Header */
.dap-header-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 20px; border-bottom: var(--dap-border);
  user-select: none; cursor: grab;
}
.dap-modal-header { font-weight: 700; font-size: 17px; }
.dap-stepper { color: var(--dap-muted); font-size: 12px; }
.dap-close {
  appearance: none; border: 0; background: transparent;
  font-size: 22px; line-height: 1; color: #374151;
  width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
}
.dap-close:hover { background: #f3f4f6; }

/* Body */
.dap-modal-body {
  overflow: auto;
  padding: 20px;
  scroll-behavior: smooth;
}

/* Footer */
.dap-footer {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-top: var(--dap-border);
  background: #fafafa;
}
.dap-footer-text { font-size: 12px; color: var(--dap-muted); margin-right: auto; }

/* Buttons */
.dap-nav .dap-cta, .dap-block-file .dap-cta {
  appearance: none; border: 0; background: var(--dap-cta); color: var(--dap-cta-fg);
  border-radius: 10px; padding: 9px 16px; font-weight: 600; cursor: pointer;
  text-decoration: none; display: inline-flex; align-items: center; justify-content: center;
}
.dap-nav .dap-cta:hover, .dap-block-file .dap-cta:hover { background: var(--dap-cta-hover); }
.dap-secondary {
  appearance: none; border: 0; background: var(--dap-secondary);
  color: #111827; border-radius: 10px; padding: 9px 14px; font-weight: 600; cursor: pointer;
}

/* Blocks */
.dap-block-text { font-size: 14px; line-height: 1.55; }
.dap-block-text p { margin: 0 0 10px 0; }

.dap-image-wrap { width: 100%; min-height: 200px; background: #f8f9fb; border-radius: 12px; overflow: hidden; position: relative; margin: 10px 0; }
.dap-block-image { display: block; width: 100%; height: auto; }
.dap-skeleton {
  height: 260px; background: #eee;
  background-image: linear-gradient(100deg, #eee 8%, #f5f5f5 18%, #eee 33%);
  background-size: 200% 100%; animation: dapPulseSk 1.2s ease-in-out infinite; border-radius: 12px;
}
@keyframes dapPulseSk { 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }

.dap-block-video { display: block; width: 100%; max-height: 60vh; border-radius: 12px; background: #000; }

.dap-block-youtube {
  display: grid; grid-template-columns: 220px 1fr; gap: 14px; align-items: center;
  text-decoration: none; color: inherit; border: var(--dap-border); border-radius: 12px;
  overflow: hidden; background: #fff; margin: 10px 0; padding-right: 12px;
}
.dap-block-youtube img { width: 100%; height: auto; display: block; }
.dap-yt-meta strong { font-size: 15px; }

.dap-block-link { display: inline-block; color: #0b6bcb; text-decoration: underline; margin: 6px 0; word-break: break-all; }

/* Article (PDF/DOCX) */
.dap-article-wrap { position: relative; display: flex; flex-direction: column; gap: 10px; }
.dap-article-embed { width: 100%; min-height: 64vh; background: #fff; border: var(--dap-border); border-radius: 12px; overflow: hidden; }
.dap-fab {
  display: flex; justify-content: flex-end; position: sticky; top: 0; padding: 8px 0;
  background: linear-gradient(#ffffff, #ffffffcc 60%, #ffffff00); z-index: 2;
}

/* Download card fallback */
.dap-block-file {
  display: grid; grid-template-columns: 64px 1fr auto; gap: 12px; align-items: center;
  border: var(--dap-border); border-radius: 12px; padding: 12px; background: #fff;
}
.dap-file-icon { width: 64px; height: 64px; border-radius: 12px; background: #eef2ff; color: #3730a3; display: grid; place-items: center; font-weight: 800; }
.dap-file-meta { min-width: 0; }
.dap-file-name { font-weight: 700; }
.dap-file-type { font-size: 12px; color: var(--dap-muted); }

/* --- spinner for modal content loading --- */
.dap-spinner-wrap{
  display: grid;
  place-items: center;
  min-height: 140px;              /* gives the body some breathing room while loading */
}
.dap-spinner{
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid #e3e8ef;
  border-top-color: #0b6bcb;
  animation: dapSpin .8s linear infinite;
}
@keyframes dapSpin{ to { transform: rotate(360deg); } }

/* --- Knowledge Base layout --- */
.dap-kb{
  display:grid;
  grid-template-columns: 280px 1fr;
  gap:16px;
  min-height: 360px;
}
@media (max-width: 720px){
  .dap-kb{ grid-template-columns: 1fr; }
}

.dap-kb-list{
  background:#fff;
  border:1px solid rgba(0,0,0,.08);
  border-radius:12px;
  padding:10px;
  display:grid;
  grid-template-rows: auto 1fr;
  gap:10px;
  min-height: 320px;
}
.dap-kb-search input[type="search"]{
  width:100%;
  border:1px solid rgba(0,0,0,.15);
  border-radius:10px;
  padding:8px 10px;
  font-size:13px;
}
.dap-kb-items{
  overflow:auto;
  display:grid;
  gap:8px;
}
.dap-kb-item{
  text-align:left;
  border:1px solid rgba(0,0,0,.08);
  border-radius:10px;
  padding:10px;
  background:#fff;
  cursor:pointer;
  display:grid;
  gap:4px;
}
.dap-kb-item:hover{ background:#f7f9fc; }
.dap-kb-item.is-active{ outline:2px solid #0b6bcb22; background:#f3f8ff; }
.dap-kb-title{ font-weight:600; font-size:13px; color:#111; }
.dap-kb-desc{ font-size:12px; color:#555; }
.dap-kb-badge{ justify-self:start; font-size:11px; color:#0b6bcb; background:#eef4ff; padding:2px 8px; border-radius:999px; }

.dap-kb-preview{
  border:1px solid rgba(0,0,0,.08);
  border-radius:12px;
  padding:12px;
  background:#fff;
  min-height: 320px;
  display:grid;
  grid-template-rows: auto 1fr;
  gap:10px;
}
.dap-kb-head{ font-size:14px; color:#111; }
.dap-kb-sub{ font-size:12px; color:#666; margin-top:2px; }
.dap-kb-region{ overflow:auto; }

/* --- KB tiles polish --- */
.dap-kb-items{ gap:10px; padding-right:4px; }
.dap-kb-items::-webkit-scrollbar{ width:8px; }
.dap-kb-items::-webkit-scrollbar-thumb{ background:#d6dde7; border-radius:6px; }
.dap-kb-items::-webkit-scrollbar-thumb:hover{ background:#c6cfdb; }

.dap-kb-item{
  position:relative;
  display:grid;
  grid-template-columns: 28px 1fr auto;
  align-items:center;
  gap:10px;
  padding:10px 12px;
  border-radius:12px;
  border:1px solid rgba(0,0,0,.08);
  background:#fff;
  box-shadow:0 1px 0 rgba(0,0,0,.02);
  cursor:pointer;
  transition:transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease;
  text-align:left;
}
.dap-kb-item:hover{
  transform: translateY(-1px);
  box-shadow:0 6px 14px rgba(0,0,0,.06);
  background:#f9fbff;
}
.dap-kb-item.is-active{
  outline:2px solid #0b6bcb22;
  background:#f3f8ff;
  border-color:#b6d4ff;
}
.dap-kb-item:focus-visible{
  outline:2px solid #0b6bcb;
  outline-offset:2px;
}

.dap-kb-icon{
  width:22px; height:22px; border-radius:6px;
  background:#a3bffa; /* default */
}
.dap-kb-item[data-type="youtube"] .dap-kb-icon{ background:#ff6363; }
.dap-kb-item[data-type="video"]   .dap-kb-icon{ background:#6bc2ff; }
.dap-kb-item[data-type="image"]   .dap-kb-icon{ background:#68d391; }
.dap-kb-item[data-type="article"] .dap-kb-icon{ background:#c084fc; }
.dap-kb-item[data-type="link"]    .dap-kb-icon{ background:#f6ad55; }

.dap-kb-text{ display:grid; gap:3px; }
.dap-kb-title{
  font-weight:600; font-size:13px; color:#111; line-height:1.3;
  display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;
}
.dap-kb-desc{
  font-size:12px; color:#555; line-height:1.35;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
}

.dap-kb-badge{
  margin-left:8px; justify-self:end;
  font-size:11px; color:#0b6bcb; background:#eef4ff;
  padding:2px 8px; border-radius:999px; white-space:nowrap;
}

@media (prefers-color-scheme: dark){
  .dap-kb-item{ background:#0f1115; border-color:#222; box-shadow:none; }
  .dap-kb-item:hover{ background:#111419; }
  .dap-kb-item.is-active{ background:#0f1724; border-color:#244c8a; outline-color:#153e7a66; }
  .dap-kb-title{ color:#e8ebf0; }
  .dap-kb-desc{ color:#b7c0cc; }
  .dap-kb-badge{ color:#a0c8ff; background:#0b2b57; }
  .dap-kb-items::-webkit-scrollbar-thumb{ background:#2a2f38; }
  .dap-kb-items::-webkit-scrollbar-thumb:hover{ background:#353b46; }
}

@media (prefers-reduced-motion: reduce){
  .dap-kb-item{ transition:none; }
}


`;async function J(e){let{payload:t}=e;if(!t||!Array.isArray(t.steps)||t.steps.length===0)return;let o=document.activeElement,n=matchMedia("(max-width: 640px)").matches,a=t.steps.length>1,r=null,d=null,i=null,l=null,s=null,c=f=>{f.key==="Escape"?h():f.key==="ArrowRight"?g():f.key==="ArrowLeft"?m():f.key==="Tab"&&r&&Fe(f,r.dlg)};document.addEventListener("keydown",c,!0);let p=Ke(t.startAt??0,0,t.steps.length-1);u(p);function m(){p>0&&(p--,u(p))}function g(){p<t.steps.length-1?(p++,u(p)):h()}function h(){document.removeEventListener("keydown",c,!0),y(),d?.(),d=null,i?.(),i=null,l?.(),l=null,s?.(),s=null,o?.focus?.()}function u(f){d?.(),d=null,i?.(),i=null,l?.(),l=null,s?.(),s=null;let b=t.steps[f];if(b?.kind==="tooltip"&&b.tooltip){y(),G();let E=b.tooltip;a?d=we(E,{title:b.title??"Tip",index:f,total:t.steps.length,onPrev:m,onNext:g,onClose:h,showNav:!0}):i=ke(E,{title:b.title??"Tip"});return}if(b?.kind==="popover"&&b.popover){y(),G();let E=b.popover;a?l=Ee(E,{index:f,total:t.steps.length,onPrev:m,onNext:g,onClose:h,showNav:!0}):s=Ce(E);return}if(v(),!r)return;let{titleEl:x,stepper:C,body:T,footer:_,prevBtn:U,nextBtn:ie}=r;x.textContent=b?.title??"",C.textContent=`Step ${f+1} of ${t.steps.length}`,T.replaceChildren();let F=R(T,250),O=b?.body;if(O?.length?Ue(T,O).finally(()=>F()):F(),_.querySelector(".dap-footer-text")?.remove(),b?.footerText){let E=document.createElement("div");E.className="dap-footer-text",E.innerHTML=k(b.footerText),_.insertBefore(E,U)}U.disabled=f===0,ie.textContent=f===t.steps.length-1?"Finish":"Next",f+1<t.steps.length&&xe(t.steps[f+1])}function v(){if(r)return;r=Le(t.theme),r.dlg.style.left="50%",r.dlg.style.top="50%",r.dlg.style.transform="translate(-50%, -50%)",r.dlg.classList.remove("dragging"),n||Oe(r.dlg,r.headerBar);let f=r.wrap,b=r.prevBtn,x=r.nextBtn,C=r.closeBtn;f.addEventListener("click",T=>{T.target===f&&h()}),b.addEventListener("click",m),x.addEventListener("click",g),C.addEventListener("click",h),setTimeout(()=>r&&r.dlg.focus(),0)}function y(){r?.wrap.remove(),r=null}}var z=new Map;function ve(e){try{let t="dap-preload-"+e;if(document.getElementById(t))return;let o=document.createElement("link");o.id=t,o.rel="preload",o.as="image",o.href=e,o.crossOrigin="anonymous",document.head.appendChild(o)}catch{}}async function Z(e,t="high"){let o=z.get(e);if(o)return o;ve(e);let n=new Image;n.fetchpriority=t,n.decoding="async",n.crossOrigin="anonymous",n.referrerPolicy="no-referrer";let a=new Promise((r,d)=>{n.addEventListener("load",()=>r(),{once:!0}),n.addEventListener("error",()=>d(new Error("image load error")),{once:!0})});return n.src=e,await a,z.set(e,n),n}function xe(e){let t=e?.body;if(Array.isArray(t))for(let o of t)o&&o.kind==="image"&&w(o.url)&&Z(o.url,"high").catch(()=>{})}function we(e,t){let o=B(e.targetSelector);o&&o.setAttribute("data-dap-spotlight","on");let n=ne({title:t.title||"Tip",text:e.text||"Tip",showNav:t.showNav,index:t.index,total:t.total,onPrev:t.onPrev,onNext:t.onNext,onClose:t.onClose});document.body.appendChild(n.el);let a=e.placement?S(e.placement):null,r=()=>{o?N(o,n.el,a):te(n.el)};Q(r);let d=ee(r),i=()=>r(),l=()=>r();return window.addEventListener("scroll",i,!0),window.addEventListener("resize",l,!0),()=>{o&&o.removeAttribute("data-dap-spotlight"),n.el.remove(),d(),window.removeEventListener("scroll",i,!0),window.removeEventListener("resize",l,!0)}}function ke(e,t){let o=B(e.targetSelector);if(!o)return()=>{};let n=o;n.setAttribute("data-dap-spotlight","on");let a=ne({title:t.title||"Tip",text:e.text||"Tip",showNav:!1}).el,r=e.placement?S(e.placement):null,d=ae(n,a,r),i=[],l=(p,m,g,h)=>{p.addEventListener(m,g,h),i.push(()=>p.removeEventListener(m,g,h))},s=(e.trigger||"hover").toLowerCase();if(s==="hover"){"onpointerenter"in window?(l(n,"pointerenter",d.enterTarget),l(n,"pointerleave",d.leaveTarget),l(a,"pointerenter",d.enterBubble),l(a,"pointerleave",d.leaveBubble)):(l(n,"mouseenter",d.enterTarget),l(n,"mouseleave",d.leaveTarget),l(a,"mouseenter",d.enterBubble),l(a,"mouseleave",d.leaveBubble)),l(n,"focus",d.enterTarget,!0),l(n,"blur",d.leaveTarget,!0),l(n,"touchstart",p=>{p.stopPropagation(),d.toggle()},{passive:!0});try{n.matches?.(":hover")&&d.show()}catch{}}else s==="focus"?(n.hasAttribute("tabindex")||n.setAttribute("tabindex","0"),l(n,"focus",d.show,!0),l(n,"blur",d.hide,!0)):s==="click"?(l(n,"click",p=>{p.stopPropagation(),d.toggle()}),l(document,"click",p=>{if(!d.isShown())return;let m=p.target;m!==n&&!a.contains(m)&&d.hide()},!0),l(n,"touchstart",p=>{p.stopPropagation(),d.toggle()},{passive:!0})):(l(n,"mouseenter",d.enterTarget),l(n,"mouseleave",d.leaveTarget));let c=()=>{d.isShown()&&N(n,a,r)};return l(window,"scroll",c,!0),l(window,"resize",c,!0),a.addEventListener("click",p=>p.stopPropagation()),()=>{for(n.removeAttribute("data-dap-spotlight"),d.destroy();i.length;)i.pop()()}}function Ee(e,t){let o=B(e.targetSelector);o&&o.setAttribute("data-dap-spotlight","on");let n=oe({title:e.title||"Info",bodyHtml:k(e.body||""),showArrow:e.showArrow!==!1,showNav:t.showNav,index:t.index,total:t.total,onPrev:t.onPrev,onNext:t.onNext,onClose:t.onClose});document.body.appendChild(n.el);let a=e.placement&&e.placement!=="auto"?S(e.placement):null,r=()=>{o?N(o,n.el,a):te(n.el)};Q(r);let d=ee(r),i=()=>r(),l=()=>r();return window.addEventListener("scroll",i,!0),window.addEventListener("resize",l,!0),()=>{o&&o.removeAttribute("data-dap-spotlight"),n.el.remove(),d(),window.removeEventListener("scroll",i,!0),window.removeEventListener("resize",l,!0)}}function Ce(e){let t=B(e.targetSelector);if(!t)return()=>{};let o=t;o.setAttribute("data-dap-spotlight","on");let n=oe({title:e.title||"Info",bodyHtml:k(e.body||""),showArrow:e.showArrow!==!1,showNav:!1}).el,a=e.placement&&e.placement!=="auto"?S(e.placement):null,r=ae(o,n,a),d=[],i=(c,p,m,g)=>{c.addEventListener(p,m,g),d.push(()=>c.removeEventListener(p,m,g))},l=(e.trigger||"hover").toLowerCase();l==="hover"?("onpointerenter"in window?(i(o,"pointerenter",r.enterTarget),i(o,"pointerleave",r.leaveTarget),i(n,"pointerenter",r.enterBubble),i(n,"pointerleave",r.leaveBubble)):(i(o,"mouseenter",r.enterTarget),i(o,"mouseleave",r.leaveTarget),i(n,"mouseenter",r.enterBubble),i(n,"mouseleave",r.leaveBubble)),i(o,"focus",r.enterTarget,!0),i(o,"blur",r.leaveTarget,!0),i(o,"touchstart",c=>{c.stopPropagation(),r.toggle()},{passive:!0})):l==="focus"?(o.hasAttribute("tabindex")||o.setAttribute("tabindex","0"),i(o,"focus",r.show,!0),i(o,"blur",r.hide,!0)):l==="click"?(i(o,"click",c=>{c.stopPropagation(),r.toggle()}),i(document,"click",c=>{if(r.isShown()){let p=c.target;p!==o&&!n.contains(p)&&r.hide()}},!0),i(o,"touchstart",c=>{c.stopPropagation(),r.toggle()},{passive:!0})):(i(o,"mouseenter",r.enterTarget),i(o,"mouseleave",r.leaveTarget));let s=()=>{r.isShown()&&N(o,n,a)};return i(window,"scroll",s,!0),i(window,"resize",s,!0),n.addEventListener("click",c=>c.stopPropagation()),()=>{for(o.removeAttribute("data-dap-spotlight"),r.destroy();d.length;)d.pop()()}}function G(){let e=document.getElementById("dap-spot-style");return e||(e=document.createElement("style"),e.id="dap-spot-style",e.textContent=`
    :root{
      --dap-tip-bg:#fff; --dap-tip-fg:#111; --dap-tip-link:#0b6bcb; --dap-tip-muted:#666;
      --dap-tip-shadow:0 14px 36px rgba(0,0,0,.22); --dap-tip-radius:12px; --dap-tip-border:1px solid rgba(0,0,0,.08);
      --dap-spot-outline:3px solid #40a0ff;
      --dap-pop-bg:#fff; --dap-pop-fg:#111; --dap-pop-border:1px solid rgba(0,0,0,.1);
    }
    @keyframes dapPulse{0%{box-shadow:0 0 0 0 rgba(64,160,255,.6);}70%{box-shadow:0 0 0 10px rgba(64,160,255,0);}100%{box-shadow:0 0 0 0 rgba(64,160,255,0);}}
    [data-dap-spotlight="on"]{outline:var(--dap-spot-outline)!important;outline-offset:2px!important;border-radius:6px!important;animation:dapPulse 1.6s ease-out infinite;}

    .dap-inline-bubble{
      position:fixed;max-width:320px;background:var(--dap-tip-bg);color:var(--dap-tip-fg);
      border-radius:12px;box-shadow:var(--dap-tip-shadow);border:var(--dap-tip-border);
      padding:12px 14px;z-index:2147483642;pointer-events:auto;line-height:1.35;
    }
    .dap-inline-bubble .dap-tip-title{font-weight:600;margin:0 0 6px 0;font-size:14px;}
    .dap-inline-bubble .dap-tip-text{margin:0 0 8px 0;font-size:13px;color:#222;}
    .dap-inline-bubble .dap-tip-nav{display:flex;justify-content:space-between;align-items:center;gap:8px;}
    .dap-inline-bubble .dap-tip-nav a{color:#0b6bcb;text-decoration:underline;font-size:13px;}
    .dap-inline-bubble .dap-tip-nav .muted{color:#666;text-decoration:none;margin-left:12px;}
    .dap-inline-bubble::after{content:"";position:absolute;width:0;height:0;border:8px solid transparent;}
    .dap-inline-bubble[data-placement="right"]::after{right:100%;top:50%;transform:translateY(-50%);border-right-color:#fff;border-left:0;}
    .dap-inline-bubble[data-placement="left"]::after{left:100%;top:50%;transform:translateY(-50%);border-left-color:#fff;border-right:0;}
    .dap-inline-bubble[data-placement="top"]::after{top:100%;left:50%;transform:translateX(-50%);border-top-color:#fff;border-bottom:0;}
    .dap-inline-bubble[data-placement="bottom"]::after{bottom:100%;left:50%;transform:translateX(-50%);border-bottom-color:#fff;border-top:0;}

    .dap-popover{
      position:fixed;max-width:420px;background:var(--dap-pop-bg);color:var(--dap-pop-fg);
      border-radius:12px;box-shadow:0 18px 48px rgba(0,0,0,.24);border:var(--dap-pop-border);
      padding:14px 16px;z-index:2147483643;pointer-events:auto;line-height:1.45;
    }
    .dap-pop-title{font-weight:700;margin:0 0 8px 0;font-size:15px;}
    .dap-pop-body{font-size:14px;color:#222;}
    .dap-pop-nav{display:flex;justify-content:flex-end;gap:12px;margin-top:10px;}
    .dap-pop-nav a{color:#0b6bcb;text-decoration:underline;font-size:13px;}
    .dap-popover::after{content:"";position:absolute;width:0;height:0;border:10px solid transparent;}
  
      /* Buttons */
  .dap-btn{
    appearance:none;border:0;border-radius:10px;padding:8px 12px;
    font-size:13px;font-weight:600;cursor:pointer;
  }
  .dap-btn-primary{background:#0b6bcb;color:#fff;}
  .dap-btn-primary:hover{background:#095aa7;}
  .dap-btn-secondary{background:#eef2f6;color:#0b6bcb;}
  .dap-btn-secondary:hover{background:#e5eaf0;}
  .dap-btn-danger{background:#d64545;color:#fff;}
  .dap-btn-danger:hover{background:#b83a3a;}

  /* Forms */
  .dap-pop-form{display:grid;gap:10px;margin-top:6px;}
  .dap-form-row{display:grid;gap:6px;}
  .dap-form-row > label{font-size:12px;color:#444;}
  .dap-pop-form input[type="text"],
  .dap-pop-form input[type="email"],
  .dap-pop-form input[type="number"],
  .dap-pop-form textarea,
  .dap-pop-form select{
    border:1px solid rgba(0,0,0,.15);border-radius:8px;padding:8px 10px;font-size:13px;
  }
  .dap-check{display:flex;align-items:center;gap:8px;}
  .dap-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px;}
  .dap-pop-img{max-width:100%;height:auto;border-radius:10px;box-shadow:0 6px 16px rgba(0,0,0,.08);}
  .dap-pop-link{color:#0b6bcb;text-decoration:underline;display:inline-block;margin:6px 0;}
  .dap-pop-txt{font-size:13px;color:#222;line-height:1.45;margin:4px 0;}
`,document.head.appendChild(e),e)}function S(e){let t=(e||"").toLowerCase();return t.startsWith("top")?t.includes("left")?"top-left":t.includes("right")?"top-right":"top":t.startsWith("bottom")?t.includes("left")?"bottom-left":t.includes("right")?"bottom-right":"bottom":t.startsWith("right")?"right":t.startsWith("left")?"left":"top-right"}function Q(e){requestAnimationFrame(()=>requestAnimationFrame(e))}function ee(e){let t=new ResizeObserver(()=>e()),o=new MutationObserver(()=>e());return t.observe(document.documentElement),o.observe(document.body,{childList:!0,subtree:!0}),()=>{t.disconnect(),o.disconnect()}}function te(e){let t=window.innerWidth;e.style.left=`${Math.max(8,Math.min(t-8,t/2))}px`,e.style.top="24px",e.setAttribute("data-placement","top-right")}function N(e,t,o){let n=t.style.display,a=t.style.visibility;t.parentNode||document.body.appendChild(t),t.style.visibility="hidden",t.style.display="block";let r=e.getBoundingClientRect(),{left:d,top:i,placement:l}=Te(r,t,o);t.style.left=`${d}px`,t.style.top=`${i}px`,t.setAttribute("data-placement",l),t.style.visibility=a||"",t.style.display=n||""}function Te(e,t,o){let n=window.innerWidth,a=window.innerHeight,r=14,d=8,i=t.offsetWidth||320,l=t.offsetHeight||80,s={left:e.left,right:n-e.right,top:e.top,bottom:a-e.bottom},c=s.right>=s.left,p=s.bottom>=s.top,m=c&&p?["right","bottom-right","top-right","bottom","top","bottom-left","top-left","left"]:c&&!p?["right","top-right","bottom-right","top","bottom","top-left","bottom-left","left"]:!c&&p?["left","bottom-left","top-left","bottom","top","bottom-right","top-right","right"]:["left","top-left","bottom-left","top","bottom","top-right","bottom-right","right"],g=o?[o,...m].filter((b,x,C)=>C.indexOf(b)===x):m,h=b=>{switch(b){case"right":return{left:e.right+r,top:e.top+(e.height-l)/2};case"left":return{left:e.left-i-r,top:e.top+(e.height-l)/2};case"top":return{left:e.left+(e.width-i)/2,top:e.top-l-r};case"bottom":return{left:e.left+(e.width-i)/2,top:e.bottom+r};case"top-right":return{left:e.right-i,top:e.top-l-r};case"top-left":return{left:e.left,top:e.top-l-r};case"bottom-right":return{left:e.right-i,top:e.bottom+r};case"bottom-left":return{left:e.left,top:e.bottom+r}}},u=(b,x)=>b>=d&&b+i<=n-d&&x>=d&&x+l<=a-d;for(let b of g){let x=h(b);if(u(x.left,x.top))return{left:x.left,top:x.top,placement:b}}let v=h(g[0]),y=Math.min(Math.max(d,v.left),n-d-i),f=Math.min(Math.max(d,v.top),a-d-l);return{left:y,top:f,placement:g[0]}}function Le(e){let t=Pe(),o=document.createElement("div");o.className="dap-modal-wrap",o.setAttribute("role","dialog"),o.setAttribute("aria-modal","true"),o.style.pointerEvents="auto";let n=document.createElement("div");if(n.className="dap-modal",n.tabIndex=-1,e)for(let[g,h]of Object.entries(e))n.style.setProperty(g,h);let a=document.createElement("div");a.className="dap-header-bar";let r=document.createElement("div");r.className="dap-modal-header";let d=document.createElement("div");d.className="dap-stepper";let i=document.createElement("button");i.className="dap-close",i.setAttribute("aria-label","Close"),i.innerHTML="\xD7";let l=document.createElement("div");l.style.display="flex",l.style.alignItems="center",l.style.gap="8px",l.appendChild(d),l.appendChild(i),a.appendChild(r),a.appendChild(l);let s=document.createElement("div");s.className="dap-modal-body";let c=document.createElement("div");c.className="dap-footer dap-nav";let p=document.createElement("button");p.className="dap-secondary",p.type="button",p.textContent="Previous";let m=document.createElement("button");return m.className="dap-cta",m.type="button",m.textContent="Next",c.appendChild(p),c.appendChild(m),n.appendChild(a),n.appendChild(s),n.appendChild(c),t.node.appendChild(o),o.appendChild(n),{wrap:o,dlg:n,headerBar:a,titleEl:r,stepper:d,body:s,footer:c,prevBtn:p,nextBtn:m,closeBtn:i}}function Pe(){if(!!HTMLElement.prototype.attachShadow){let o=document.querySelector("dap-root");o||(o=document.createElement("dap-root"),o.style.position="fixed",o.style.zIndex="2147483640",o.style.inset="0",o.style.pointerEvents="none",document.documentElement.appendChild(o));let n=o.shadowRoot??o.attachShadow({mode:"open"});if(!n.getElementById("dap-modal-style")){let d=document.createElement("style");d.id="dap-modal-style",d.textContent=I,n.appendChild(d)}let a=document.createElement("div");a.className="dap-modal",a.style.position="absolute",a.style.opacity="0",a.style.pointerEvents="none",n.appendChild(a);let r=getComputedStyle(a).borderRadius;if(a.remove(),r&&r!=="0px")return{node:n,isShadow:!0}}let t=document.getElementById("dap-root-fallback");if(t||(t=document.createElement("div"),t.id="dap-root-fallback",t.style.position="fixed",t.style.zIndex="2147483640",t.style.inset="0",t.style.pointerEvents="none",document.body.appendChild(t)),!document.getElementById("dap-modal-style-global")){let o=document.createElement("style");o.id="dap-modal-style-global",o.textContent=I,document.head.appendChild(o)}return{node:t,isShadow:!1}}function Ne(e){try{let o=new URL(e,location.origin),n=o.hostname.replace(/^www\./,"").toLowerCase();if(n==="youtu.be"){let a=o.pathname.split("/").filter(Boolean)[0];if(a)return a}if(n.endsWith("youtube.com")||n.endsWith("youtube-nocookie.com")){let a=o.searchParams.get("v");if(a)return a;let r=o.pathname.split("/").filter(Boolean),d=r.indexOf("embed");if(d>=0&&r[d+1])return r[d+1];let i=r.indexOf("shorts");if(i>=0&&r[i+1])return r[i+1]}}catch{}let t=/([A-Za-z0-9_-]{11})/.exec(e);return t?t[1]:null}function Me(e,t,o,n){if(!w(t))return Promise.resolve();let a=n?.includes("pdf")||/\.pdf(\?|#|$)/i.test(t),r=n?.includes("officedocument.wordprocessingml.document")||/\.docx(\?|#|$)/i.test(t);return a?He(e,t,o):r?Se(e,t,o).catch(()=>{e.appendChild(P(t,o,"application/vnd.openxmlformats-officedocument.wordprocessingml.document"))}):(e.appendChild(P(t,o,n||"Document")),Promise.resolve())}async function Ae(e,t=15e3){try{let o=new AbortController,n=window.setTimeout(()=>o.abort(),t),a=await fetch(e,{mode:"cors",credentials:"omit",signal:o.signal});if(clearTimeout(n),!a.ok)return null;let r=await a.arrayBuffer().catch(()=>null);if(!r)return null;let d=new Blob([r],{type:"application/pdf"});return URL.createObjectURL(d)}catch{return null}}async function He(e,t,o){let n=document.createElement("div");n.className="dap-article-wrap",e.appendChild(n),n.appendChild(H(t,o,"Download PDF"));let a=await Ae(t,15e3).catch(()=>null);if(!a){n.replaceChildren(P(t,o,"application/pdf"));return}let r=document.createElement("embed");r.className="dap-article-embed",r.type="application/pdf",r.src=a;let d=H(t,o,"Download PDF");n.replaceChildren(d,r)}async function Se(e,t,o){let n=document.createElement("div");n.className="dap-article-wrap",e.appendChild(n),n.appendChild(H(t,o,"Download DOCX"));let a=null;try{a=await De(t,2e4,20*1024*1024)}catch{a=null}let r=await Ie();if(!a||!r){n.replaceChildren(P(t,o,"application/vnd.openxmlformats-officedocument.wordprocessingml.document"));return}try{let d=await r.convertToHtml({arrayBuffer:a}),i=String(d?.value||"").trim();if(!i)throw new Error("empty");let l=document.createElement("div");l.className="dap-article-embed",l.style.overflow="auto",l.style.padding="12px",l.innerHTML=k(i),Be(l);let s=H(t,o,"Download DOCX");n.replaceChildren(s,l)}catch{n.replaceChildren(P(t,o,"application/vnd.openxmlformats-officedocument.wordprocessingml.document"))}}function Be(e){for(let t of Array.from(e.querySelectorAll("a"))){let o=document.createElement("span");o.textContent=t.textContent||"",(t.style.textDecoration||/underline/i.test(t.className))&&(o.style.textDecoration="underline"),t.replaceWith(o)}}async function De(e,t=2e4,o){let n=new AbortController,a=window.setTimeout(()=>n.abort(),t),r=await fetch(e,{mode:"cors",credentials:"omit",signal:n.signal});if(clearTimeout(a),!r.ok)throw new Error("http");let d=parseInt(r.headers.get("content-length")||"0",10);if(o&&d&&d>o)throw new Error("too-big");return await r.arrayBuffer()}async function Ie(){let e=window;if(e.mammoth)return e.mammoth;let t=["https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js","https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js"];for(let o of t)try{if(await new Promise((n,a)=>{let r=document.createElement("script");r.src=o,r.async=!0,r.crossOrigin="anonymous",r.addEventListener("load",()=>n(),{once:!0}),r.addEventListener("error",()=>a(new Error("script")),{once:!0}),document.head.appendChild(r)}),e.mammoth)return e.mammoth}catch{}return null}function H(e,t,o){let n=document.createElement("div");n.className="dap-fab";let a=document.createElement("a");return a.className="dap-cta",a.href=e,a.download=t||"",a.target="_blank",a.rel="noopener noreferrer",a.textContent=o,n.appendChild(a),n}function P(e,t,o){let n=document.createElement("div");n.className="dap-block-file";let a=document.createElement("div");a.className="dap-file-icon",a.textContent=$e(e).toUpperCase();let r=document.createElement("div");r.className="dap-file-meta";let d=document.createElement("div");d.className="dap-file-name",d.textContent=t||ze(e);let i=document.createElement("div");i.className="dap-file-type",i.textContent=o||"Document",r.appendChild(d),r.appendChild(i);let l=document.createElement("a");return l.className="dap-cta",l.href=e,l.download=t||"",l.target="_blank",l.rel="noopener noreferrer",l.textContent="Download",n.appendChild(a),n.appendChild(r),n.appendChild(l),n}function $e(e){return/\.([a-z0-9]+)(\?|#|$)/i.exec(e)?.[1]||"file"}function ze(e){try{return decodeURIComponent(new URL(e,location.origin).pathname.split("/").pop()||"document")}catch{return"document"}}function ne(e){let t=document.createElement("div");t.className="dap-inline-bubble",t.setAttribute("data-placement","top-right");let o=document.createElement("div");o.className="dap-tip-title",o.textContent=e.title||"Tip";let n=document.createElement("div");if(n.className="dap-tip-text",n.innerHTML=k(e.text||""),t.appendChild(o),t.appendChild(n),e.showNav){let a=document.createElement("div");a.className="dap-tip-nav";let r=document.createElement("div");r.className="muted",r.textContent=`Step ${(e.index??0)+1} of ${e.total??1}`;let d=document.createElement("div");d.style.display="flex",d.style.gap="12px";let i=document.createElement("a");i.href="#",i.textContent="Previous",i.addEventListener("click",c=>{c.preventDefault(),e.onPrev&&e.onPrev()});let l=document.createElement("a");l.href="#",l.textContent=(e.index??0)+1>=(e.total??1)?"Finish":"Next",l.addEventListener("click",c=>{c.preventDefault(),e.onNext&&e.onNext()});let s=document.createElement("a");s.href="#",s.textContent="Close",s.addEventListener("click",c=>{c.preventDefault(),e.onClose&&e.onClose()}),d.appendChild(i),d.appendChild(l),d.appendChild(s),a.appendChild(r),a.appendChild(d),t.appendChild(a)}return{el:t}}function oe(e){let t=document.createElement("div");if(t.className="dap-popover",t.setAttribute("data-placement","top-right"),t.setAttribute("data-arrow",String(!!e.showArrow)),e.title){let n=document.createElement("div");n.className="dap-pop-title",n.textContent=e.title,t.appendChild(n)}let o=document.createElement("div");if(o.className="dap-pop-body",e.blocks&&e.blocks.length?Re(o,e.blocks):e.bodyHtml&&(o.innerHTML=k(e.bodyHtml)),t.appendChild(o),e.showNav){let n=document.createElement("div");n.className="dap-pop-nav";let a=document.createElement("a");a.href="#",a.textContent="Previous",a.addEventListener("click",i=>{i.preventDefault(),e.onPrev&&e.onPrev()});let r=document.createElement("a");r.href="#",r.textContent=(e.index??0)+1>=(e.total??1)?"Finish":"Next",r.addEventListener("click",i=>{i.preventDefault(),e.onNext&&e.onNext()});let d=document.createElement("a");d.href="#",d.textContent="Close",d.addEventListener("click",i=>{i.preventDefault(),e.onClose&&e.onClose()}),n.appendChild(a),n.appendChild(r),n.appendChild(d),t.appendChild(n)}return{el:t}}function Re(e,t){for(let o of t)switch(o.kind){case"text":{let n=document.createElement("div");n.className="dap-pop-txt",n.innerHTML=k(o.html),e.appendChild(n);break}case"link":{if(!w(o.href))break;let n=document.createElement("a");n.className="dap-pop-link",n.href=o.href,n.target="_blank",n.rel="noopener noreferrer",n.textContent=o.label||o.href,e.appendChild(n);break}case"button":{let n=document.createElement("button");n.type="button",n.className="dap-btn "+(o.variant?`dap-btn-${o.variant}`:"dap-btn-primary"),n.textContent=o.label,n.addEventListener("click",()=>$(o.action)),e.appendChild(n);break}case"image":{if(!w(o.url))break;let n=document.createElement("img");n.className="dap-pop-img",n.src=o.url,n.alt=o.alt||"",o.width&&(n.width=o.width),o.height&&(n.height=o.height),n.decoding="async",n.loading="lazy",e.appendChild(n);break}case"form":{let n=document.createElement("form");n.className="dap-pop-form",n.noValidate=!0;for(let i of o.fields){let l=document.createElement("div");if(l.className="dap-form-row","label"in i&&i.label){let s=document.createElement("label");s.textContent=i.label,s.htmlFor=`${o.id}__${i.name}`,l.appendChild(s)}if(i.type==="textarea"){let s=document.createElement("textarea");s.id=`${o.id}__${i.name}`,s.name=i.name,s.rows=i.rows||3,i.placeholder&&(s.placeholder=i.placeholder),i.required&&(s.required=!0),l.appendChild(s)}else if(i.type==="select"){let s=document.createElement("select");s.id=`${o.id}__${i.name}`,s.name=i.name,i.required&&(s.required=!0);for(let c of i.options){let p=document.createElement("option");p.value=c.value,p.textContent=c.label,s.appendChild(p)}l.appendChild(s)}else if(i.type==="checkbox"){let s=document.createElement("div");s.className="dap-check";let c=document.createElement("input");c.type="checkbox",c.id=`${o.id}__${i.name}`,c.name=i.name,i.required&&(c.required=!0);let p=document.createElement("label");p.htmlFor=c.id,p.textContent=i.label,s.appendChild(c),s.appendChild(p),l.appendChild(s)}else{let s=document.createElement("input");s.type=i.type,s.id=`${o.id}__${i.name}`,s.name=i.name,i.placeholder&&(s.placeholder=i.placeholder),i.required&&(s.required=!0),l.appendChild(s)}n.appendChild(l)}let a=document.createElement("div");a.className="dap-form-actions";let r=document.createElement("button");r.type="submit",r.className="dap-btn dap-btn-primary",r.textContent=o.submitLabel||"Submit";let d=document.createElement("button");d.type="button",d.className="dap-btn dap-btn-secondary",d.textContent=o.cancelLabel||"Cancel",d.addEventListener("click",()=>$("form_cancel")),a.appendChild(d),a.appendChild(r),n.appendChild(a),n.addEventListener("submit",i=>{i.preventDefault();let l=qe(new FormData(n));$("form_submit",l)}),e.appendChild(n);break}}}function $(e,t){if(window.dispatchEvent(new CustomEvent("dap:action",{detail:{source:"popover",action:e,payload:t}})),e==="btn_next"){let o=new CustomEvent("dap:flow-next",{bubbles:!0});window.dispatchEvent(o)}else if(e==="btn_close"){let o=new CustomEvent("dap:flow-close",{bubbles:!0});window.dispatchEvent(o)}}function qe(e){let t={};return e.forEach((o,n)=>{t[n]!==void 0?(Array.isArray(t[n])||(t[n]=[t[n]]),t[n].push(o)):t[n]=o}),t}function ae(e,t,o){let n=!1,a=null,r=()=>{a!=null&&(window.clearTimeout(a),a=null)},d=()=>{r(),n||(document.body.appendChild(t),t.style.display="block",N(e,t,o),n=!0)},i=()=>{r(),a=window.setTimeout(()=>{t.style.display="none",n=!1},120)};return{show:d,hide:i,toggle:()=>{n?i():d()},enterTarget:()=>d(),leaveTarget:()=>i(),enterBubble:()=>d(),leaveBubble:()=>i(),isShown:()=>n,destroy:()=>{r(),t.remove()}}}async function _e(e,t){let o=document.createElement("div");o.className="dap-kb";let n=document.createElement("aside");n.className="dap-kb-list";let a=document.createElement("section");a.className="dap-kb-preview";let r=document.createElement("div");r.className="dap-kb-search";let d=document.createElement("input");d.type="search",d.placeholder="Search knowledge base\u2026",d.setAttribute("aria-label","Search knowledge base"),r.appendChild(d);let i=document.createElement("div");i.className="dap-kb-items",n.appendChild(r),n.appendChild(i),o.appendChild(n),o.appendChild(a),e.appendChild(o);let l=Array.isArray(t.items)?t.items.slice():[],s=0;function c(){if(i.replaceChildren(),!l.length){let u=document.createElement("div");u.className="dap-kb-empty",u.textContent="No results",i.appendChild(u),a.replaceChildren();return}l.forEach((u,v)=>{let y=document.createElement("button");y.type="button",y.className="dap-kb-item"+(v===s?" is-active":""),y.dataset.type=u.itemType,y.setAttribute("aria-current",v===s?"true":"false"),y.innerHTML=`
      <div class="dap-kb-icon" aria-hidden="true"></div>
      <div class="dap-kb-text">
        <div class="dap-kb-title">${h(u.title||g(u))}</div>
        ${u.description?`<div class="dap-kb-desc">${h(u.description)}</div>`:""}
      </div>
      <div class="dap-kb-badge">${h(u.itemType)}</div>
    `,y.addEventListener("click",async()=>{s=v,c(),await m(l[s]);let f=i.querySelector(".dap-kb-item.is-active");f&&f.scrollIntoView({block:"nearest"})}),i.appendChild(y)})}let p=R(a,200);c(),l[s]&&await m(l[s]),p(),d.addEventListener("input",()=>{let u=d.value.trim().toLowerCase();l=(t.items||[]).filter(v=>[v.title,v.description,v.itemType,v.fileName,v.url].filter(Boolean).map(y=>String(y).toLowerCase()).some(y=>y.includes(u))),s=0,c(),l[0]?m(l[0]):a.replaceChildren()}),d.addEventListener("keydown",u=>{l.length&&(u.key==="ArrowDown"&&(s=Math.min(l.length-1,s+1),u.preventDefault(),c(),m(l[s])),u.key==="ArrowUp"&&(s=Math.max(0,s-1),u.preventDefault(),c(),m(l[s])))});async function m(u){a.replaceChildren();let v=R(a,150),y=document.createElement("div");y.className="dap-kb-head",y.innerHTML=`<strong>${h(u.title||g(u))}</strong>`+(u.description?`<div class="dap-kb-sub">${h(u.description)}</div>`:""),a.appendChild(y);let f=document.createElement("div");f.className="dap-kb-region",a.appendChild(f);try{switch(u.itemType){case"image":{w(u.url)&&await L(f,{kind:"image",url:u.url,alt:u.title||""});break}case"video":{await L(f,{kind:"video",sources:[{src:u.url}]});break}case"article":{await L(f,{kind:"article",url:u.url,fileName:u.fileName,mime:u.mime});break}case"youtube":{await L(f,{kind:"youtube",href:u.url,title:u.title});break}case"link":default:{if(!w(u.url))break;let b=document.createElement("p");b.innerHTML=k(`<a class="dap-block-link" target="_blank" rel="noopener noreferrer" href="${h(u.url)}">${h(u.title||u.url)}</a>`),f.appendChild(b);break}}}finally{v()}}function g(u){switch(u.itemType){case"image":return"Image";case"video":return"Video";case"article":return u.mime?.includes("pdf")?"PDF":"Document";case"youtube":return"YouTube";default:return"Link"}}function h(u){return String(u).replace(/[&<>"']/g,v=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[v])}}function R(e,t=250){let o=!1,n=document.createElement("div");n.className="dap-spinner-wrap",n.innerHTML='<div class="dap-spinner" role="status" aria-label="Loading"></div>';let a=window.setTimeout(()=>{o=!0,e.firstChild||e.appendChild(n)},t);return()=>{window.clearTimeout(a),o&&n.remove()}}async function Ue(e,t){let o=[];for(let n of t)o.push(L(e,n));await Promise.allSettled(o)}function L(e,t){let o=t.kind;if(o==="text"||o==="link"||o==="video"||o==="youtube"||o==="kb"){switch(o){case"text":{let n=document.createElement("div");n.className="dap-block-text",n.innerHTML=k(t.html),e.appendChild(n);break}case"link":{let n=t.href;if(!w(n))break;let a=document.createElement("a");a.className="dap-block-link",a.href=n,a.target="_blank",a.rel="noopener noreferrer",a.textContent=t.label||n,e.appendChild(a);break}case"kb":{_e(e,t);break}case"video":{let n=document.createElement("video");n.className="dap-block-video",n.controls=!0,n.playsInline=!0;for(let a of t.sources||[]){if(!w(a.src))continue;let r=document.createElement("source");r.src=a.src,a.type&&(r.type=a.type),n.appendChild(r)}e.appendChild(n);break}case"youtube":{let n=t.href??"";if(!w(n))break;let a=t.id||Ne(n),r=document.createElement("a");r.href=n,r.target="_blank",r.rel="noopener noreferrer",r.className="dap-block-youtube",r.setAttribute("aria-label",t.title?`Open YouTube: ${t.title}`:"Open YouTube");let d=document.createElement("img");d.alt=t.title??"YouTube video",d.decoding="async",d.loading="eager",d.src=t.thumbnail?t.thumbnail:a?`https://i.ytimg.com/vi/${encodeURIComponent(a)}/hqdefault.jpg`:"https://i.ytimg.com/vi/INVALID/hqdefault.jpg";let i=document.createElement("div");i.className="dap-yt-meta",i.innerHTML=k(`<strong>${je(t.title??"Watch on YouTube")}</strong>`),r.appendChild(d),r.appendChild(i),e.appendChild(r);break}}return Promise.resolve()}if(o==="image"){let n=t.url;if(!w(n))return Promise.resolve();let a=document.createElement("div");a.className="dap-image-wrap";let r=document.createElement("div");r.className="dap-skeleton",a.appendChild(r),e.appendChild(a);let d=l=>{let s=l.cloneNode(!0);s.className="dap-block-image",s.alt=t.alt??"",s.decoding="async",s.fetchpriority="high",a.replaceChildren(s)},i=z.get(n);return i?(d(i),Promise.resolve()):Z(n,"high").then(d).catch(()=>{let l=document.createElement("div");l.className="dap-skeleton",l.style.display="grid",l.style.placeItems="center",l.style.fontSize="12px",l.style.color="#555",l.textContent="Image failed to load",a.replaceChildren(l)}).then(()=>{})}if(o==="article"){let n=t.url,a=t.fileName,r=t.mime;return Me(e,n,a,r)}return Promise.resolve()}function Fe(e,t){let o=Array.from(t.querySelectorAll('a,button,input,textarea,select,details,[tabindex]:not([tabindex="-1"])')).filter(r=>!r.hasAttribute("disabled"));if(!o.length)return;let n=o[0],a=o[o.length-1];e.shiftKey&&document.activeElement===n?(a.focus(),e.preventDefault()):!e.shiftKey&&document.activeElement===a&&(n.focus(),e.preventDefault())}function Oe(e,t){let o=0,n=0,a=0,r=0,d=!1;t.style.cursor="grab",t.addEventListener("pointerdown",l=>{d=!0,t.style.cursor="grabbing",e.classList.add("dragging"),l.target?.setPointerCapture?.(l.pointerId);let s=e.getBoundingClientRect();a=s.left,r=s.top,e.style.left=`${a}px`,e.style.top=`${r}px`,e.style.transform="none",o=l.clientX,n=l.clientY,l.preventDefault()}),window.addEventListener("pointermove",l=>{if(!d)return;let s=l.clientX-o,c=l.clientY-n,p=window.innerWidth,m=window.innerHeight,g=e.offsetWidth,h=e.offsetHeight,u=Math.min(Math.max(0,a+s),p-g),v=Math.min(Math.max(0,r+c),m-h);e.style.left=`${u}px`,e.style.top=`${v}px`});let i=()=>{d&&(d=!1,t.style.cursor="grab",e.classList.remove("dragging"))};window.addEventListener("pointerup",i),window.addEventListener("pointercancel",i)}function Ke(e,t,o){return Math.max(t,Math.min(o,e))}function je(e){return String(e).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function B(e){if(!e)return null;try{let t=document.querySelector(e);if(t)return t}catch{}try{return document.evaluate(e,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue||null}catch{return null}}var q=(...e)=>window.__DAP_DEBUG__?console.log("[DAP]",...e):void 0;async function re(e){let{configUrl:t,debug:o}=e||{};if(window.__DAP_DEBUG__=!!o,!t)throw new Error("DAP.init: configUrl is required");let n=await We(t),a=location.origin;q("Loaded config",{cfg:n,hostBase:a});let r=await j(n,a);q("Visible flow IDs",r);for(let d of r)try{let i=await W(n,a,d),l=Y(i);q("Normalized flow",l),J({id:`flow:${d}`,type:"modalSequence",payload:l});break}catch(i){console.error("[DAP] Failed to load flow",d,i)}}async function We(e){let t=await fetch(e,{credentials:"omit",cache:"no-cache"});if(!t.ok)throw new Error(`Failed to load config ${e}: ${t.status}`);let o=await t.json();for(let n of["organizationid","siteid","apikey","apiurl"])if(!o?.[n])throw new Error(`Config missing field: ${n}`);return o}typeof window<"u"&&(window.DAP={init:re});return ue(Ye);})();
//# sourceMappingURL=index.global.js.map