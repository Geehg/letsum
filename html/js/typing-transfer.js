(()=>{'use strict';
const OLD='https://type.letsum.app',NEW='https://type.goyoseoga.com',core=window.TypingTransfer,$=id=>document.getElementById(id),status=$('transferStatus');
const source=location.origin===OLD, destination=location.origin===NEW;
if(!source&&!destination){status.textContent='공식 필사독서 주소에서 열어 주세요.';return;}
let peer=null,nonce='',pending=null;const setStatus=s=>status.textContent=s;
const hash=location.hash.startsWith('#/read/')||['#/','#/studio','#/dot-retro'].includes(location.hash)?location.hash:'#/';
$('continue').href=NEW+'/'+hash;$('oldBack').href=OLD+'/'+hash;
$('sourcePanel').hidden=!source;$('destinationPanel').hidden=!destination;
function download(data,name){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function backup(){download(core.snapshot(localStorage),'typing-records-'+new Date().toISOString().slice(0,10)+'.json');}
$('backup').onclick=()=>{try{backup();setStatus('기록 백업 다운로드를 시작했습니다. 파일에는 직접 가져온 글도 포함될 수 있으니 개인적으로 보관해 주세요.');}catch(e){setStatus(e.message);}};
function preview(data){core.validate(data);pending=data;const entries=Object.keys(data.records);$('summary').textContent=`진행 기록 ${entries.filter(k=>k.startsWith('typebook-v1:progress:')).length}개 · 전체 ${entries.length}개 항목. 기존 주소의 기록은 삭제하지 않습니다.`;$('apply').hidden=false;setStatus('기록을 받았습니다. 아래 버튼을 눌러 새 주소의 기록과 합쳐 주세요.');}
$('openSource').onclick=()=>{nonce=crypto.randomUUID();peer=window.open(OLD+'/transfer.html?request='+encodeURIComponent(nonce),'goyo-typing-transfer','popup,width=680,height=800');setStatus(peer?'이전 주소의 창에서 내용을 확인한 뒤 기록 보내기를 눌러 주세요.':'팝업이 차단됐습니다. 팝업을 허용하거나 아래 백업 파일 방식으로 옮겨 주세요.');};
addEventListener('message',e=>{if(destination&&peer&&e.source===peer&&e.origin===OLD&&e.data?.type==='goyo-typing-records'&&e.data.nonce===nonce){try{preview(e.data.payload);}catch(err){setStatus(err.message);}}if(source&&e.source===window.opener&&e.origin===NEW&&e.data?.type==='goyo-typing-saved')setStatus('고요서가에 복사했습니다. 이 창을 닫고 새 주소에서 이어 쓰세요. 원본 기록은 그대로 남아 있습니다.');});
$('send').onclick=()=>{if(!window.opener){setStatus('새 주소의 기록 가져오기 버튼에서 이 창을 열거나, 백업 파일을 이용해 주세요.');return;}const n=new URLSearchParams(location.search).get('request');if(!/^[\da-f-]{36}$/.test(n||'')){setStatus('새 주소에서 기록 가져오기를 다시 시작해 주세요.');return;}try{const payload=core.snapshot(localStorage);core.validate(payload);window.opener.postMessage({type:'goyo-typing-records',nonce:n,payload},NEW);setStatus('새 주소로 기록을 보냈습니다. 새 창에서 기록 합치기를 눌러 마무리해 주세요.');}catch(e){setStatus(e.message);}};
$('file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>8*1024*1024)throw Error('8MB 이하의 기록 파일만 열 수 있습니다.');preview(JSON.parse(await f.text()));}catch(err){setStatus(err.message);}};
$('apply').onclick=()=>{if(!pending)return;try{const n=core.apply(localStorage,pending);pending=null;$('apply').hidden=true;setStatus(`${n}개 항목을 복사·병합했습니다. 고요서가에서 이어 쓰기를 눌러 확인하세요.`);peer?.postMessage({type:'goyo-typing-saved'},OLD);}catch(e){setStatus(e.message);}};
try{const s=core.snapshot(localStorage);$('localCount').textContent=`현재 주소에 저장된 진행 기록 ${Object.keys(s.records).filter(k=>k.startsWith('typebook-v1:progress:')).length}개`; }catch(e){setStatus('브라우저 저장소를 사용할 수 없습니다. 일반 브라우저 창에서 다시 열어 주세요.');}
})();
