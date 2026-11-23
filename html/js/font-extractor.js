(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const input = byId('documents'), drop = byId('drop'), status = byId('status');
  const filesList = byId('file-list'), results = byId('results'), groups = byId('groups');
  const batch = byId('download-fonts'), downloadStatus = byId('download-status');
  const MB = 1024*1024;
  let catalogue, findings = [], busy = false, ready = [];
  const element = (tag, text) => Object.assign(document.createElement(tag), {textContent:text});
  const norm = s => s.normalize('NFKC').toLowerCase().replace(/[\s._-]+/g,'');
  const variants = name => {
    const n = norm(name);
    // PostScript foundry/style suffixes appear frequently in PDFs and PSDs.
    return [...new Set([n,n.replace(/(?:psmt|mt)$/,''),n.replace(/(?:ps)?(?:extrabold|semibold|demibold|bold|light|medium|regular|black|thin)?(?:italic|oblique)?(?:psmt|mt)?$/,'')])].filter(Boolean);
  };
  function addLink(parent,text,href) {
    if (!href) return;
    const url = new URL(href,location.href);
    if (url.protocol!=='https:' && url.origin!==location.origin) return;
    const link = element('a',text); link.href=url.href; link.target='_blank'; link.rel='noopener noreferrer'; parent.append(link);
  }
  async function loadCatalogue() {
    async function get(url) {
      const version=document.querySelector('.extractor').dataset.catalogVersion;
      const res=await fetch(url+'?v='+version,{cache:'force-cache'}); if (!res.ok) throw Error('카탈로그를 불러오지 못했습니다.');
      return res.json();
    }
    const [data,paid]=await Promise.all([get('/data/extractor-catalog.json'),get('/data/paid_fonts.json')]);
    const names = new Map();
    for (const f of data.fonts) f.note=data.notes[f.n];
    for (const f of data.fonts) for (const a of [f.name,...f.aliases]) {
      const k=norm(a); if (!k) continue;
      if (!names.has(k)) names.set(k,new Set());
      names.get(k).add(f);
    }
    const rules = paid.rules.map(r=>({...r,pattern:new RegExp(r.re,'i')}));
    for (const entry of paid.bundleGuidance.patterns.filter(e=>e.id!=='software')) {
      const src=paid.bundleGuidance.sources[entry.id==='microsoft'?1:0];
      rules.push({pattern:new RegExp(entry.re,'i'),note:'제품에 포함될 수 있는 글꼴입니다. 보유한 제품과 사용 목적에 따라 허용 범위가 달라집니다.',vendor:src.label,url:src.url});
    }
    return {...data,names,rules,notices:paid.notices};
  }
  function identify(name) {
    if (!catalogue) return {group:'확인 필요',note:'카탈로그를 불러오지 못했습니다.'};
    const keys=variants(name);
    for (const k of keys) {
      const matches=catalogue.names.get(k);
      if (!matches) continue;
      if (matches.size>1 && !(new Set([...matches].map(f=>f.bundle || f.id)).size===1)) return {group:'확인 필요',note:'같은 이름의 카탈로그 항목이 여러 개입니다.'};
      const [font]=matches;
      return {group:font.verified?'무료 · 이용조건 확인':'확인 필요',font,note:font.note || font.license};
    }
    const rule=catalogue.rules.find(r=>keys.some(k=>r.pattern.test(k)));
    if (rule) return {group:'유료·번들 확인',note:rule.id==='myfonts'
      ? '상용 서체 계열에 해당하는 이름입니다. 보유한 라이선스와 문서·웹·앱 등 사용 범위를 확인하세요.' : rule.note,rule};
    const notice=catalogue.notices.find(r=>keys.some(k=>new RegExp(r.re,'i').test(k)));
    return {group:'확인 필요',note:notice?.note || '렛섬에서 이용조건을 확인한 이름과 일치하지 않습니다.'};
  }
  function render() {
    groups.replaceChildren();
    const rows = new Map();
    for (const f of findings) for(const ref of f.fonts || []) {
      const result=identify(ref.name);
      const key=result.font?.id || norm(ref.name);
      if (!rows.has(key)) rows.set(key,{...result,names:new Set(),refs:[]});
      const row=rows.get(key);
      row.names.add(ref.name);
      if (ref.refs.some(x=>!/ (마스터|레이아웃|테마 후보)$/.test(x))) row.documentRef=true;
      row.refs.push(f.name+' · '+ref.refs.join(', ')+(ref.count>ref.refs.length?' 외 '+(ref.count-ref.refs.length)+'곳':''));
    }
    ready = [];
    for (const group of ['무료 · 이용조건 확인','유료·번들 확인','확인 필요']) {
      const list=[...rows.values()].filter(r=>r.group===group);
      if (!list.length) continue;
      const section=element('section','');
      section.append(element('h3',group+' ('+list.length+')'));
      for (const row of list) {
        const card=element('article',''), meta=element('div',''), links=element('div','');
        card.append(element('h4',row.font?.name || [...row.names][0]));
        meta.className='ex-meta'; meta.textContent=[row.font?.license,...row.names].filter(Boolean).join(' · ');
        if (!row.documentRef) meta.textContent+=' · 테마·레이아웃·마스터에서만 확인';
        card.append(meta,element('p',row.note));
        if (row.font?.bundle) { ready.push(row.font); links.append(element('span','ZIP 포함')); }
        addLink(links,'사용 조건',row.font?.detail); addLink(links,row.rule?.vendor || '공식 배포처',row.rule?.url || row.font?.source);
        links.className='ex-links'; card.append(links);
        const refs=element('details',''); refs.append(element('summary','문서 내 참조 위치'));
        for (const where of row.refs) refs.append(element('p',where));
        card.append(refs); section.append(card);
      }
      groups.append(section);
    }
    results.hidden=!findings.length;
    batch.disabled=!ready.length;
    batch.textContent='무료 폰트 일괄받기 ('+ready.length+')';
  }
  let worker;
  function releaseWorker() {
    if (worker) worker.terminate();
    worker=null;
  }
  function inspect(file) {
    return new Promise(resolve=>{
      worker ||= new Worker('/js/font-extractor-worker.js?v=1');
      const finish=result=>{clearTimeout(timeout);resolve(result);};
      const timeout=setTimeout(()=>{releaseWorker();finish({error:'분석 시간이 초과되었습니다. 문서를 나누어 다시 시도해 주세요.'});},45000);
      worker.onmessage=e=>finish(e.data);
      worker.onerror=()=>{releaseWorker();finish({error:'분석기를 실행할 수 없습니다. 새로고침 후 다시 시도해 주세요.'});};
      worker.postMessage({file});
    });
  }
  function lock(on) {
    busy=on; input.disabled=on; byId('clear-files').disabled=on;
    drop.setAttribute('aria-busy',String(on));
  }
  async function analyze(files) {
    if (busy || !files.length) return;
    if (files.length>12) {status.textContent='한 번에 12개까지 선택해 주세요.';return;}
    lock(true); findings=[];filesList.replaceChildren();render();downloadStatus.textContent='';
    try {

      status.textContent='문서의 글꼴 참조를 읽고 있습니다…';
      for (const file of files) {
        const li=element('li',file.name+' · 분석 중'); filesList.append(li);
        let result;
        if (!/\.(?:psd|pptx?|pdf)$/i.test(file.name)) result={error:'지원하지 않는 파일 형식입니다.'};
        else if (file.size>100*MB) result={error:'파일당 최대 100 MB까지 분석할 수 있습니다.'};
        else result=await inspect(file);
        findings.push({name:file.name,...result});
        li.textContent=file.name+' · '+(result.error || (result.fonts.length ? '글꼴 이름 '+result.fonts.length+'개' : '읽을 수 있는 글꼴 이름이 없습니다.'));
      }
      releaseWorker();
      const hasNames=findings.some(r=>r.fonts?.length);
      if (hasNames && !catalogue) {try {catalogue=await loadCatalogue();} catch {}}
      render();status.textContent='분석 완료'+(catalogue || !hasNames?'':' · 카탈로그 조회 실패. 다시 시도해 주세요.');
    } catch {status.textContent='분석을 마치지 못했습니다. 파일을 다시 선택해 주세요.';render();}
    finally {releaseWorker();lock(false);input.value='';}
  }
  async function download() {
    if (busy || !ready.length) return;
    lock(true); batch.disabled=true;
    try {
      if (!window.JSZip) await import('/js/jszip.min.js');
      const zip=new JSZip(), failed=[]; let included=0, total=0;
      for (const font of ready) {
        const files=catalogue.bundles[font.bundle];
        const size=Object.values(files).reduce((a,b)=>a+b,0);
        if (total+size>150*MB) {failed.push(font.name+' (150 MB 한도)');continue;}
        downloadStatus.textContent=font.name+' 원본과 라이선스를 받는 중…';
        const contents=[];
        try {
          for (const [file,expected] of Object.entries(files)) {
            const base=catalogue.directBases[font.bundle] || 'https://raw.githubusercontent.com/google/fonts/'+catalogue.revision+'/ofl/'+font.bundle+'/';
            const url=base+file.split('/').map(encodeURIComponent).join('/');
            const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});
            if (!response.ok) throw Error();
            const bytes=await response.arrayBuffer();
            if (bytes.byteLength!==expected) throw Error();
            contents.push([file,bytes]);
          }
          for (const [name,bytes] of contents) zip.file(font.bundle+'/'+name.split('/').pop(),bytes);
          included++;total+=size;
        } catch {failed.push(font.name+' (공식 원본 수신 실패)');}
      }
      if (included) {
        const blob=await zip.generateAsync({type:'blob',compression:'STORE'});
        const url=URL.createObjectURL(blob), link=document.createElement('a');
        link.download='LETSUM-fonts.zip'; link.href=url; document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
      }
      downloadStatus.textContent=(included?'ZIP 생성 완료 · '+included+'종':'ZIP을 만들 수 없습니다.')+(failed.length?' · 제외 '+failed.join(', '):'');
    } catch {downloadStatus.textContent='ZIP 생성에 실패했습니다. 공식 배포처 링크를 이용해 주세요.';}
    finally {lock(false);batch.disabled=!ready.length;}
  }
  input.onchange=()=>analyze([...input.files]);
  for(const evt of ['dragover','dragenter']) drop.addEventListener(evt,e=>{e.preventDefault();drop.dataset.drag='on';});
  drop.ondragleave=()=>delete drop.dataset.drag;
  drop.ondrop=e=>{e.preventDefault();delete drop.dataset.drag;analyze([...e.dataTransfer.files]);};
  byId('clear-files').onclick=()=>{if(busy)return; findings=[];filesList.replaceChildren();input.value='';status.textContent='';downloadStatus.textContent='';render();};
  batch.onclick=download;
})();
