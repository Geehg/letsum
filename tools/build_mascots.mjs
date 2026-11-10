// Production build of the mascot directory (/mascots/): the logo app with mascot data (tools/mascot-app/data) and wording.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildDirectory} from './build_directory.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
// Ordered text swaps: specific phrases first, then the generic word. Each must still exist in the app, or the build fails.
const swaps=[
 ['/logos/','/mascots/'],
 ['LOGO & IDENTITY DIRECTORY','MASCOT & CHARACTER DIRECTORY'],
 ['필요한 로고,<br>공식 출처에서','우리 동네 마스코트,<br>공식 출처에서'],
 ['공공기관부터 기업·대학까지.<br class="mobile-only"> 로고와 사용 안내를 함께 찾아보세요.','지자체·공공기관부터 기업·스포츠까지.<br class="mobile-only"> 캐릭터와 사용 안내를 함께 찾아보세요.'],
 ['<span>아이덴티티 정보</span>','<span>캐릭터 정보</span>'],
 ['로고·CI 둘러보기','마스코트 둘러보기'],
 ['로고·CI 찾기 | LETSUM 로고','마스코트 찾기 | LETSUM 마스코트'],
 ['LETSUM 로고·CI — 공식 자료 찾기','LETSUM 마스코트 — 공식 캐릭터 찾기'],
 ['공공기관·기업·대학의 공식 로고와 CI·사용 안내를 찾습니다.','지자체·공공기관·기업·스포츠의 공식 캐릭터와 마스코트, 사용 안내를 찾습니다.'],
 ['LETSUM 로고','LETSUM 마스코트'],
 ['>로고·CI</a>','>마스코트</a>'],
 ['로고·자료 안내','캐릭터·자료 안내'],
 ['아직 찾는 로고가 없나요?','아직 찾는 마스코트가 없나요?'],
 ['로고 찾기','마스코트 찾기'],
 ['로고 찾아보기','마스코트 찾아보기'],
 ['placeholder="기관명, 브랜드명, 초성으로 찾아보세요"','placeholder="기관명, 캐릭터 이름, 초성으로 찾아보세요"'],
 ['data-query="고양시">고양시</button>','data-query="수원">수원</button>'],
 ['data-query="서울대">서울대</button>','data-query="수호랑">수호랑</button>'],
 ['data-query="NAVER">NAVER</button>','data-query="펭수">펭수</button>'],
 ['data-query="AI">AI 파일 안내</button>','data-query="AI">AI 파일 있는 캐릭터</button>'],
 ['로고·CI','마스코트'],
 ['로고','캐릭터'],
];
await buildDirectory({project:path.join(root,'mascot-app'),base:'/mascots/',out:path.join(root,'../html/mascots'),label:'Mascot directory',menuLabel:'마스코트 메뉴',
 rights:'캐릭터와 마스코트의 권리는 각 권리자에게 있습니다. 미리보기는 식별용이며, 사용 전 공식 페이지의 이용 조건을 확인해 주세요.',geometryFile:'mascot-geometry.json',swaps});
