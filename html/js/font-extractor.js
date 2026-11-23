(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const input = byId('documents'), drop = byId('drop'), status = byId('status');
  const filesList = byId('file-list'), results = byId('results'), groups = byId('groups');
  const batch = byId('download-fonts'), downloadStatus = byId('download-status');
  const formatCards = [...document.querySelectorAll('.ex-format[data-format]')];
  const formats = new Set(formatCards.map(card => card.dataset.format));
  const extensionOf = file => /\.([^.]+)$/.exec(file.name)?.[1].toLowerCase();
  const wrongFormat = '카드와 다른 형식입니다. 맞는 카드를 선택하거나 여러 형식 함께 스캔을 이용하세요.';
  const MB = 1024*1024;
  let catalogue, findings = [], busy = false;
  const detected = new Map();
  const selected = new Map();
  const element = (tag, text) => Object.assign(document.createElement(tag), {textContent:text});
  const norm = s => s.normalize('NFKC').toLowerCase().replace(/[\s._-]+/g,'');
  // Some real font files use placeholders or only a style in their name table.
  const placeholder = /^(?:untitled(?:font)?\d*|unknown(?:font)?|unnamed(?:font)?|newfont\d*|font\d*|(?:extra|ultra|semi|demi)?(?:bold|light)|regular|medium|italic|oblique|bolditalic|thin|normal|black|book|보통|굵게|기본)$/;
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
      const k=norm(a); if (!k || placeholder.test(k)) continue;
      if (!names.has(k)) names.set(k,new Set());
      names.get(k).add(f);
    }
    const rules = paid.rules.map(r=>({...r,pattern:new RegExp(r.re,'i')}));
    for (const entry of paid.bundleGuidance.patterns.filter(e=>e.id!=='software')) {
      const src=paid.bundleGuidance.sources[entry.id==='microsoft'?1:0];
      rules.push({id:entry.id,pattern:new RegExp(entry.re,'i'),note:'제품에 포함될 수 있는 글꼴입니다. 보유한 제품과 사용 목적에 따라 허용 범위가 달라집니다.',vendor:src.label,url:src.url});
    }
    const byFontId = new Map(data.fonts.map(font => [font.id, font]));
    const alternatives = (data.alternatives || []).map(group => ({
      ...group,
      pattern: group.re && new RegExp(group.re, 'i'),
      fonts: group.ids.map(id => byFontId.get(id)).filter(font => font?.verified && data.bundles[font.bundle])
    }));
    return {...data,names,rules,alternatives,notices:paid.notices};
  }
  function identify(name) {
    if (!catalogue) return {group:'확인 필요',note:'카탈로그를 불러오지 못했습니다.'};
    const keys=variants(name);
    for (const k of keys) {
      const entries=catalogue.names.get(k);
      if (!entries) continue;
      const matches = k === keys[0] ? entries : new Set([...entries].filter(f => !f.exactOnly));
      if (!matches.size) continue;
      if (matches.size>1 && !(new Set([...matches].map(f=>f.bundle || f.id)).size===1)) return {group:'확인 필요',note:'같은 이름의 카탈로그 항목이 여러 개입니다.'};
      const [font]=matches;
      return {group:font.verified?'무료 · 이용조건 확인':'확인 필요',font,note:font.note || font.license};
    }
    const rule=catalogue.rules.find(r=>keys.some(k=>r.pattern.test(k)));
    if (rule) return {group:'유료·번들 확인',note:rule.id==='myfonts'
      ? '상용 서체 계열에 해당하는 이름입니다. 보유한 라이선스와 문서·웹·앱 등 사용 범위를 확인하세요.' : rule.note,rule};
    const notice=catalogue.notices.find(r=>keys.some(k=>new RegExp(r.re,'i').test(k)));
    return {group:'확인 필요',note:notice?.note || '문서에서 이 글꼴 이름을 읽었습니다. 대응하는 서체와 이용조건을 확인할 자료가 아직 없습니다.'};
  }
  function syncDownload() {
    const total = detected.size + selected.size;
    batch.disabled = busy || total === 0;
    batch.textContent = '무료 폰트 일괄받기 (' + total + ')';
    byId('download-count').textContent = '일괄받기 가능한 문서 글꼴 ' + detected.size + '종 · 선택한 대체 글꼴 ' + selected.size + '종';
    for (const box of groups.querySelectorAll('input[data-bundle]')) {
      const included = detected.has(box.dataset.bundle);
      box.checked = included || selected.has(box.dataset.bundle);
      box.disabled = busy || included;
    }
  }

  function showAlternatives(card, row) {
    const name = [...row.names][0];
    const options = catalogue.alternatives;
    const fallback = row.rule.id === 'myfonts' ? 'general-en' : 'general-ko';
    const group = options.find(g => g.pattern && g.pattern.test(norm(name))) || options.find(g => g.id === fallback);
    if (!group?.fonts.length) return;

    const panel = element('fieldset', '');
    panel.className = 'ex-alternatives';
    const legend = element('legend', '상업용 무료 대체 폰트');
    legend.setAttribute('aria-label', name + '의 상업용 무료 대체 폰트');
    panel.append(legend, element('p', group.reason));
    for (const font of group.fonts) {
      const option = element('div', '');
      option.className = 'ex-option';
      const label = element('label', '');
      const box = element('input', '');
      box.type = 'checkbox';
      box.dataset.bundle = font.bundle;
      box.addEventListener('change', () => {
        if (box.checked) selected.set(font.bundle, font);
        else selected.delete(font.bundle);
        downloadStatus.textContent = '';
        syncDownload();
      });
      label.append(box, element('span', font.name));
      if (detected.has(font.bundle)) label.append(element('small', '이미 ZIP에 포함'));
      option.append(label);
      addLink(option, '견본·이용조건', font.detail);
      panel.append(option);
    }
    card.classList.add('ex-with-alternatives');
    card.append(panel);
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
    detected.clear();
    for (const {font} of rows.values()) {
      if (font?.bundle) detected.set(font.bundle, font);
    }
    for (const group of ['무료 · 이용조건 확인','유료·번들 확인','확인 필요']) {
      const list=[...rows.values()].filter(r=>r.group===group);
      if (!list.length) continue;
      const section=element('section','');
      section.append(element('h3',group+' ('+list.length+')'));
      for (const row of list) {
        const card=element('article',''), meta=element('div',''), links=element('div','');
        const info=element('div','');
        const title = row.font?.name || [...row.names][0];
        info.append(element('h4',title));
        const documentNames = [...row.names].filter(name => name !== title);
        const metadata = [row.font?.license];
        if (documentNames.length) metadata.push('문서 표기 '+documentNames.join(' · '));
        if (!row.documentRef) metadata.push('테마·레이아웃·마스터에서만 확인');
        meta.className='ex-meta'; meta.textContent=metadata.filter(Boolean).join(' · ');
        if (meta.textContent) info.append(meta);
        info.append(element('p',row.note));
        if (row.font?.bundle) links.append(element('span','ZIP 포함'));
        addLink(links,'사용 조건',row.font?.detail); addLink(links,row.rule?.vendor || '공식 배포처',row.rule?.url || row.font?.source);
        links.className='ex-links'; info.append(links);
        const refs=element('details',''); refs.append(element('summary','문서 내 참조 위치'));
        for (const where of row.refs) refs.append(element('p',where));
        info.append(refs); card.append(info);
        if (row.rule) showAlternatives(card, row);
        section.append(card);
      }
      groups.append(section);
    }
    results.hidden=!findings.length;
    syncDownload();
  }
  let worker;
  function releaseWorker() {
    if (worker) worker.terminate();
    worker=null;
  }
  function inspect(file) {
    return new Promise(resolve=>{
      worker ||= new Worker('/js/font-extractor-worker.js?v=3');
      const finish=result=>{clearTimeout(timeout);resolve(result);};
      const timeout=setTimeout(()=>{releaseWorker();finish({error:'분석 시간이 초과되었습니다. 문서를 나누어 다시 시도해 주세요.'});},120000);
      worker.onmessage=e=>{
        if (file.size > 8*MB) releaseWorker();
        finish(e.data);
      };
      worker.onerror=()=>{releaseWorker();finish({error:'분석기를 실행할 수 없습니다. 새로고침 후 다시 시도해 주세요.'});};
      worker.postMessage({file});
    });
  }
  function lock(on) {
    busy=on; input.disabled=on; byId('clear-files').disabled=on;
    for (const card of formatCards) card.querySelector('input').disabled = on;
    drop.setAttribute('aria-busy',String(on));
    syncDownload();
  }
  async function analyze(files, format) {
    if (busy || !files.length) return;
    if (files.length>12) {status.textContent='한 번에 12개까지 선택해 주세요.';return;}
    if (format && files.every(file => extensionOf(file) !== format)) {
      status.textContent = wrongFormat;
      return;
    }
    lock(true); selected.clear();findings=[];filesList.replaceChildren();render();downloadStatus.textContent='';
    try {

      status.textContent='문서의 글꼴 참조를 읽고 있습니다…';
      for (const file of files) {
        const li=element('li',file.name+' · 분석 중'); filesList.append(li);
        let result;
        const extension = extensionOf(file);
        if (format && extension !== format) result = {error:wrongFormat};
        else if (!formats.has(extension)) result={error:'지원하지 않는 파일 형식입니다.'};
        else if (file.size > 2048*MB) result={error:'파일당 최대 2 GB까지 분석할 수 있습니다.'};
        else result=await inspect(file);
        findings.push({name:file.name,...result});
        li.textContent=file.name+' · '+(result.error || (result.fonts.length ? '글꼴 이름 '+result.fonts.length+'개' : '읽을 수 있는 글꼴 이름이 없습니다.'));
      }
      releaseWorker();
      const hasNames=findings.some(r=>r.fonts?.length);
      if (hasNames && !catalogue) {try {catalogue=await loadCatalogue();} catch {}}
      render();status.textContent='분석 완료'+(catalogue || !hasNames?'':' · 카탈로그 조회 실패. 다시 시도해 주세요.');
    } catch {status.textContent='분석을 마치지 못했습니다. 파일을 다시 선택해 주세요.';render();}
    finally {releaseWorker();lock(false);}
  }
  async function download() {
    const ready = [...detected.values(), ...selected.values()];
    if (busy || !ready.length) return;
    lock(true);
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
    finally {lock(false);}
  }
  function bindFileZone(zone, picker, format) {
    picker.addEventListener('change', () => {
      const files = [...picker.files];
      picker.value = '';
      analyze(files, format);
    });
    for (const type of ['dragenter', 'dragover']) {
      zone.addEventListener(type, event => {
        event.preventDefault();
        if (!busy) zone.dataset.drag = 'on';
      });
    }
    zone.addEventListener('dragleave', event => {
      if (!zone.contains(event.relatedTarget)) delete zone.dataset.drag;
    });
    zone.addEventListener('drop', event => {
      event.preventDefault();
      delete zone.dataset.drag;
      analyze([...event.dataTransfer.files], format);
    });
  }
  input.accept = [...formats].map(format => '.' + format).join(',');
  bindFileZone(drop, input);
  for (const card of formatCards) bindFileZone(card, card.querySelector('input'), card.dataset.format);
  byId('clear-files').onclick=()=>{if(busy)return; selected.clear();findings=[];filesList.replaceChildren();input.value='';status.textContent='';downloadStatus.textContent='';render();};
  batch.onclick=download;
})();
