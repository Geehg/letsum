(()=>{'use strict';const D=__FEATURED_DATA__,themes={all:'전체',world:'해외 캐릭터',city:'도시의 얼굴',campus:'캠퍼스 친구들',daily:'일상 속 안내자',brand:'브랜드 아이콘'},videos={'mm-seoulmetro-ddota':{id:'Or5wErHf-i0',title:'서울교통공사 · 또타 팝업 현장'}};let theme='all',selected=0,video=true,videoFailure=null;
const motion=matchMedia('(prefers-reduced-motion: reduce)');let playing=!motion.matches,hero=null,timer=null,lastChange=Date.now(),hovered=false;
// One official player at a time; only play while more than half of it is visible.
let player=null,playerReady=false,videoObserver=null,videoVisible=false,resumeVideo=false,videoPaused=false,videoGeneration=0,youtubePromise;
function youtubeReady(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(youtubePromise)return youtubePromise;
 youtubePromise=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  const timeout=setTimeout(()=>reject(new Error('YouTube API unavailable')),15000);
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);if(typeof previous==='function')previous();resolve(window.YT)};
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timeout);reject(new Error('YouTube API unavailable'))};document.head.append(script);
 }).catch(error=>{youtubePromise=null;throw error});
 return youtubePromise;
}
function releaseVideo(){videoGeneration++;videoObserver?.disconnect();videoObserver=null;if(player)try{player.destroy()}catch{}player=null;playerReady=false;videoVisible=false;videoPaused=false;resumeVideo=false}
function syncVideo(){
 if(!playerReady)return;
 const allowed=videoVisible&&!document.hidden&&!document.querySelector('dialog[open]');
 if(!allowed){if(player.getPlayerState()===1){resumeVideo=true;player.pauseVideo()}return}
 if(resumeVideo){resumeVideo=false;player.playVideo()}
}
document.addEventListener('visibilitychange',syncVideo);
document.addEventListener('close',syncVideo,true);
function attachVideo(root,x,v){
 const iframe=root.querySelector('.cf-panel iframe'),generation=videoGeneration;
 const fail=()=>{if(generation!==videoGeneration||!root.isConnected)return;video=false;videoFailure=x.id;draw(root)};
 videoObserver=new IntersectionObserver(entries=>{videoVisible=entries[0].intersectionRatio>.5;syncVideo()},{threshold:[0,.51,1]});videoObserver.observe(iframe);
 youtubeReady().then(YT=>{
  if(generation!==videoGeneration||!iframe.isConnected)return;
  player=new YT.Player(iframe,{events:{
   onReady:event=>{if(generation!==videoGeneration)return;playerReady=true;event.target.mute();resumeVideo=!motion.matches;const b=root.querySelector('.cf-video-pause');if(b)b.disabled=false;syncVideo()},
   onStateChange:event=>{if(generation!==videoGeneration)return;const isPlaying=event.data===1;if(isPlaying)resumeVideo=false;if(videoVisible&&!document.hidden)videoPaused=event.data===2;const b=root.querySelector('.cf-video-pause');if(b)b.textContent=isPlaying?'영상 정지':'영상 재생';if(event.data===0){videoPaused=true;lastChange=Date.now();if(playing)advance(root)}},
   onAutoplayBlocked:()=>{if(generation!==videoGeneration)return;videoPaused=true;const b=root.querySelector('.cf-video-pause');if(b){b.disabled=false;b.textContent='영상 재생'}},
   onError:fail
  }});
 }).catch(fail);
}
function advance(root,delta=1){const a=list(),x=D.items[selected];selected=D.items.indexOf(a[(a.indexOf(x)+delta+a.length)%a.length]);video=true;videoFailure=null;draw(root)}
function tick(){syncVideo();if(!hero?.isConnected){releaseVideo();clearInterval(timer);timer=null;return}const blocked=!playing||document.hidden||hovered||hero.contains(document.activeElement)||document.querySelector('dialog[open]')||(player&&!videoVisible)||videoPaused||list().length<2;if(blocked){lastChange=Date.now();return}if(Date.now()-lastChange>=(video&&D.items[selected].video?(D.carousel?.videoIntervalMs||20000):(D.carousel?.intervalMs||7000)))advance(hero)}
motion.addEventListener('change',()=>{if(motion.matches){playing=false;video=false;if(hero?.isConnected)draw(hero)}});
const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function list(){return D.items.filter(x=>x.foregroundMode!=='photo'&&(theme==='all'||x.theme===theme))}
function mount(){const old=document.querySelector('.directory-hero');if(!old||old.classList.contains('character-feature'))return;old.className='character-feature';old.setAttribute('aria-label','캐릭터 슬라이드');old.setAttribute('aria-roledescription','캐러셀');hero=old;hovered=false;old.addEventListener('pointerenter',ev=>{if(ev.pointerType==='mouse')hovered=true});old.addEventListener('pointerleave',()=>{hovered=false;lastChange=Date.now()});clearInterval(timer);timer=setInterval(tick,500);draw(old)}
function draw(root){releaseVideo();lastChange=Date.now();const x=D.items[selected],available=list(),v=x.video||videos[x.id],picture=(src,cls='')=>`<img class="${cls}" src="${e(src)}" alt="" loading="lazy" decoding="async">`;root.style.setProperty('--feature-color',x.color);
root.innerHTML=`<div class="cf-top"><div><p class="cf-eyebrow">LETSUM CHARACTER EDIT</p><h1 id="page-heading">캐릭터, 한 장면의 주인공.</h1></div></div><div class="cf-themes" role="group" aria-label="캐릭터 소개 테마">${Object.entries(themes).map(([id,label])=>`<button type="button" data-theme-filter="${id}" aria-pressed="${theme===id}">${label}</button>`).join('')}</div><div class="cf-spread"><div class="cf-copy"><span class="cf-feature-label">CHARACTER SPOTLIGHT</span><p class="cf-theme">${themes[x.theme]}</p><h2>${e(x.name)}</h2><p class="cf-tagline">${e(x.copy)}</p><p class="cf-organization">${e(x.organization)}</p><p class="cf-reason">${e(x.reason)}</p>${videoFailure===x.id?'<p class="cf-video-status" role="status">영상을 재생할 수 없어 이미지로 표시합니다. 공식 영상 링크에서 확인해 주세요.</p>':''}<div class="cf-links"><a href="${x.detail}">캐릭터 알아보기 ↗</a><a href="${e(x.official)}" target="_blank" rel="noopener">공식 출처 ↗</a></div><div class="cf-arrows"><button type="button" class="cf-play" aria-label="${playing?'자동 슬라이드 정지':'자동 슬라이드 재생'}" aria-pressed="${playing}">${playing?'Ⅱ':'▶'}</button><button type="button" data-step="-1" aria-label="이전 캐릭터">←</button><span>${available.indexOf(x)+1} / ${available.length}</span><button type="button" data-step="1" aria-label="다음 캐릭터">→</button></div></div><div class="cf-art ${video&&v?'is-video':''}" aria-label="${e(x.name)} 캐릭터 소개 이미지"><div class="cf-comic ${video&&v?'with-video':''}">${[0,1,2,3,4,5].map((n)=>`<div class="cf-panel p${n}">${n===0&&video&&v?`<iframe title="${e(v.title)}" src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=0&mute=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}&playsinline=1&controls=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`:picture(n%3===2&&x.foregroundMode!=='photo'?x.image:x.panels[n%x.panels.length])}${n===0&&video&&v?'':`<span aria-hidden="true">${String(n+1).padStart(2,'0')}</span>`}</div>`).join('')}</div><img role="button" tabindex="0" aria-haspopup="dialog" aria-label="${e(x.name)} 상세 보기" data-preview-record="${x.id}" class="cf-star ${x.foregroundMode==='photo'?'is-photo':''}" src="${e(x.image)}" alt="${e(x.name)} 캐릭터 이미지" decoding="async"><span class="cf-stamp">CHARACTER<br><b>SPOTLIGHT</b></span><div class="cf-art-tools">${v?`<button type="button" class="cf-video" aria-pressed="${video}">${video?'이미지 배경':'영상 배경 · 2칸'}</button>${video?'<button type="button" class="cf-video-pause" disabled>영상 정지</button>':''}<a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">공식 영상 ↗</a>`:''}<button type="button" class="cf-credit">이미지 출처</button></div></div></div>`;
root.querySelectorAll('[data-theme-filter]').forEach(b=>b.onclick=()=>{theme=b.dataset.themeFilter;selected=D.items.indexOf(list()[0]);video=true;videoFailure=null;draw(root);root.querySelector(`[data-theme-filter="${theme}"]`)?.focus()});
root.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const step=b.dataset.step;advance(root,Number(step));root.querySelector(`[data-step="${step}"]`)?.focus()});
root.querySelector('.cf-play').onclick=()=>{playing=!playing;const b=root.querySelector('.cf-play');b.textContent=playing?'Ⅱ':'▶';b.setAttribute('aria-pressed',String(playing));b.setAttribute('aria-label',playing?'자동 슬라이드 정지':'자동 슬라이드 재생');lastChange=Date.now()};
root.querySelector('.cf-video')?.addEventListener('click',()=>{video=!video;videoFailure=null;draw(root);root.querySelector('.cf-video')?.focus()});
root.querySelector('.cf-credit')?.addEventListener('click',()=>showCredit(x));
if(video&&v)attachVideo(root,x,v);
root.querySelector('.cf-video-pause')?.addEventListener('click',()=>{if(!playerReady)return;if(player.getPlayerState()===1){player.pauseVideo()}else{resumeVideo=false;player.playVideo()}});

}
function showCredit(x){let dialog=document.getElementById('cf-credit-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='cf-credit-dialog';dialog.className='cf-dialog';document.body.append(dialog)}const c=x.imageCredit,f=x.foregroundCredit;dialog.innerHTML=`<button class="cf-close" type="button">닫기 ×</button><h2>${e(x.name)} 이미지 출처</h2>${f?`<h3>전면 캐릭터</h3><p>${e(f.author)} · <a href="${e(f.page_url)}" target="_blank" rel="noopener">공식 원본 출처 ↗</a></p><p>${e(f.note)}</p><h3>배경 프레임</h3>`:''}${c?`<p>${e(c.author)} · <a href="${e(c.page_url)}" target="_blank" rel="noopener">${e(c.license)} · 원본 및 이용조건 ↗</a></p><p>배경 프레임은 기존 견본을 흑백으로 표시하고 잘라 보여줍니다.</p>`:`<p><a href="${e(x.official)}" target="_blank" rel="noopener">${e(x.organization)} 공식 출처 ↗</a></p>`}<p>캐릭터의 권리는 각 권리자에게 있습니다. 이미지의 이용조건과 캐릭터 자체의 이용 허락은 별개이며, 사용 전 공식 안내를 확인해 주세요.</p>`;dialog.querySelector('button').onclick=()=>dialog.close();dialog.showModal()}
function init(){const app=document.getElementById('app');if(!app)return;new MutationObserver(()=>{mount();syncVideo()}).observe(app,{childList:true,subtree:true});mount()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();
