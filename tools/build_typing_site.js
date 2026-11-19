const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../html'),OLD='https://type.letsum.app',NEW='https://type.goyoseoga.com';
exports.build=function(){
 const p=path.join(root,'type/index.html');let base=fs.readFileSync(p,'utf8');
 const style='<link rel="stylesheet" href="/css/typing-migration.css?v=1">';
 const transfer=fs.readFileSync(path.join(__dirname,'typing_transfer.html'),'utf8');fs.writeFileSync(path.join(root,'type/transfer.html'),transfer);
 // Keep the original origin available for unsynced drafts and OAuth callbacks. No forced redirect.
 base=base.replace(/(<link rel="canonical" href=")[^"]+/,`$1${NEW}/`).replace('</head>',style+'</head>').replace('</header>','</header><aside class="tb-migration" aria-label="서비스 이전 안내"><strong>필사독서가 고요서가로 이전했습니다.</strong><a id="goyoContinue" href="'+NEW+'/">새 서가로 이동 →</a><a href="'+NEW+'/transfer.html">기존 기록 옮기기</a><span>이 주소의 기록은 그대로 보관됩니다.</span></aside>');
 base=base.replace('</body>','<script>function updateGoyoLink(){document.getElementById("goyoContinue").href='+JSON.stringify(NEW+'/')+'+location.search+location.hash;}updateGoyoLink();addEventListener("hashchange",updateGoyoLink);</script></body>');fs.writeFileSync(p,base);
};
