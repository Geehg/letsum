// Shared editorial classification for home search and generated topic pages.
(function(root) {
  const traditional = new Set(['k-yisunshin','k-chusalove','k-chosun-gungseo','k-yeongjuseonbi','k-jeonju-wanpanbon-gak','k-jeonju-wanpanbon-sun','k-yydimibang','k-js-arirang-ppuri','k-js-arirang-hon','k-js-arirang','k-jejuhallasan']);
  const strong = new Set(['dokdo','east-sea-dokdo','yeon-sung','kirang-haerang','k-mapohongdaefreedom','k-makgeolli','k-kccahnjunggeun','k-sumunjang-title','k-inje-haneulnaerin']);
  const groups = [
    {slug:'traditional-calligraphy-fonts',name:'전통 서예·궁서',terms:['서예','서예체','전통서예','궁서','궁서체']},
    {slug:'emotional-calligraphy-fonts',name:'감성 캘리그라피',terms:['감성캘리','감성캘리그라피','감성캘리그래피']},
    {slug:'bold-brush-fonts',name:'강한 붓글씨·제목용',terms:['강한붓글씨','붓글씨제목','제목용붓글씨']}
  ];
  const allTerms = ['캘리','캘리그라피','캘리그래피','붓','붓글씨','붓펜','calligraphy'];
  function group(f) {
    if (f.id === 'k-sumunjang-body') return null; // 본문용 고딕: 전통 태그만으로 붓글씨로 분류하지 않음
    if (traditional.has(f.id)) return groups[0];
    if (strong.has(f.id)) return groups[2];
    return (f.tags || []).some(t => /캘리|붓|육필|전통/.test(t)) ? groups[1] : null;
  }
  const normalize = q => String(q).toLowerCase().replace(/\s/g,'').replace(/^(상업용)?무료/,'').replace(/(무료)?(폰트|글꼴)$/,'');
  function matches(f,q) { const g=group(f), key=normalize(q); return !!g && (allTerms.includes(key) || g.terms.includes(key)); }
  function hanja(f,coverage) { const c=coverage && coverage[f.id]; const v=c && typeof c.hanja==='boolean' ? c.hanja : f.hanja; return v===true ? '한자 지원' : v===false ? '한자 지원 제한' : '한자 미확인'; }
  const note='한자 지원은 확인한 폰트 파일의 실제 한자 50자 이상 기준입니다. 지원 제한은 미수록 또는 50자 미만이며, 지원 표시도 모든 한자를 보장하지 않습니다. 사용할 문장을 미리보기로 확인하세요.';
  const api={groups,group,matches,hanja,note};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.FontTaxonomy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
