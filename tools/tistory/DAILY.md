# 티스토리 로고 글 매일 게시 절차

블로그 https://leicax.tistory.com 의 '로고_Logo' 카테고리에 렛섬 로고 모음 글을 하루 20건씩 올린다.
2026-11-12 운영자 요청("매일 꾸준히 20건씩"). 첫 20건은 그날 직접 올렸다(posted.json).

## 원칙
- 하루 20건까지만. 글 사이 15초 이상 간격. 같은 기관을 두 번 올리지 않는다(posted.json 확인).
- 파일은 블로그에 올리지 않고 공식 배포처 링크만(초안이 그렇게 만들어져 있음). 본문은 초안 그대로.
- 공개 발행, 카테고리 '로고_Logo', 대표이미지(썸네일) = 그 글의 로고 이미지.
- 로그인은 운영자 몫. 로그인 화면이 나오면 멈추고 운영자에게 로그인을 부탁한다(비밀번호 입력 금지).
- 오류·화면 변경 등으로 절차가 안 맞으면 억지로 진행하지 말고 멈춰서 보고한다.

## 1. 오늘 묶음 만들기 (저장소 /Volumes/Works/LETSUM/letsum)
```bash
tools/run.sh start claude-tistory
python3 -I tools/tistory/build_drafts.py --next 20
git add tools/tistory/upload && git commit -m "티스토리 게시 묶음 $(date +%F)" && git push
```
(커밋 메시지 끝에 Co-Authored-By 줄. 잠금이 이미 있으면 다른 작업 중이니 멈추고 보고.)
push 후 `curl -sI https://raw.githubusercontent.com/Geehg/letsum/main/tools/tistory/upload/posts.json`이 200인지 확인.
남은 기관이 0이면 "모두 게시 완료"를 보고하고 끝낸다.

## 2. 브라우저로 게시 (Claude 앱 내장 브라우저, 운영자가 로그인해 둔 상태)
글쓰기 화면은 로컬 파일을 직접 못 올리므로, 화면 안 스크립트가 GitHub raw에서 이미지·본문을 읽어 티스토리에 붙인다.
창 크기는 1280x900으로 두면 버튼이 다 보인다.

글 n(0~19)마다:
1. `https://leicax.tistory.com/manage/newpost` 로 이동. 로그인 화면이면 멈춤.
2. 준비 스크립트 실행 — 카테고리 선택, 본문 대표 이미지 업로드, 본문 넣기, 제목 칸에 커서:
```js
const n=N; const sleep=t=>new Promise(s=>setTimeout(s,t)); const R='https://raw.githubusercontent.com/Geehg/letsum/main/tools/tistory/upload/';
const p=(await (await fetch(R+'posts.json')).json())[n]; const btn=document.querySelector('#category-btn'); btn.click(); await sleep(400);
[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.trim()==='로고_Logo').click(); await sleep(300);
const ed=tinymce.activeEditor; ed.setContent(''); let body=p.body.replace('<p>@@IMAGE@@</p>','');
if(p.image){ const b=await (await fetch(R+p.image)).blob(); const type=p.image.endsWith('.png')?'image/png':(p.image.endsWith('.gif')?'image/gif':'image/jpeg');
  const dt=new DataTransfer(); dt.items.add(new File([b],p.image,{type})); ed.focus();
  ed.getBody().dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
  let tok=null; for(let i=0;i<40&&!tok;i++){await sleep(500); const m=ed.getContent().match(/\[##_Image\|[^\]]*_##\]/); if(m) tok=m[0];}
  if(!tok) throw new Error('image upload failed'); body=p.body.replace('@@IMAGE@@',tok); }
ed.setContent(body); document.querySelector('[placeholder="제목을 입력하세요"]').focus();
({cat:btn.innerText.trim().split('\n')[0], title:p.title, tags:p.tags.join(','), image:p.image})
```
3. 제목을 키보드로 입력(스크립트 결과의 title 그대로).
4. `document.querySelector('[placeholder="태그입력"]').focus()` 후 태그를 쉼표로 이어 키보드로 입력하고 Enter(결과의 tags).
5. 발행 창 열기 + 공개 + 대표이미지 지정 + 확인:
```js
const n=N; const sleep=t=>new Promise(s=>setTimeout(s,t)); const R='https://raw.githubusercontent.com/Geehg/letsum/main/tools/tistory/upload/';
const p=(await (await fetch(R+'posts.json')).json())[n];
[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='완료').click(); await sleep(1200);
document.getElementById('open20').click(); await sleep(400); let thumb=false;
if(p.image){ const b=await (await fetch(R+p.image)).blob(); const type=p.image.endsWith('.png')?'image/png':(p.image.endsWith('.gif')?'image/gif':'image/jpeg');
  const dt=new DataTransfer(); dt.items.add(new File([b],p.image,{type})); const inp=document.querySelector('.box_thumb input[type=file]');
  inp.files=dt.files; inp.dispatchEvent(new Event('change',{bubbles:true}));
  for(let i=0;i<20&&!thumb;i++){await sleep(500); thumb=!!document.querySelector('.box_thumb .thumb_g');} }
({title:document.querySelector('[placeholder="제목을 입력하세요"]').value, want:p.title,
  tags:[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&/^#./.test(e.textContent)).length,
  cat:document.querySelector('#category-btn').innerText.split('\n')[0], open:document.getElementById('open20').checked, thumb,
  pub:!![...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='공개 발행')})
```
   title==want, cat=='로고_Logo', open, (이미지가 있으면) thumb, pub 가 모두 맞을 때만 다음으로.
6. 발행: `setTimeout(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='공개 발행').click(),50)` → 6초 기다림 → 15초 쉼.

## 3. 마무리
- 카테고리 목록(`/category/로고_Logo?page=1..`)에서 오늘 제목이 모두 있는지, 중복이 없는지 확인.
- 실제로 올라간 글의 id만: `python3 -I tools/tistory/build_drafts.py --mark-posted id1,id2,...`
- `tools/run.sh finish "티스토리 로고 글 게시 기록 $(date +%F) (N건)"` (Co-Authored-By 줄 포함)
- 보고: 올린 건수·제목, 실패/건너뛴 것과 이유, 남은 기관 수.
