// Production build of the logo directory (/logos/); see build_directory.mjs.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildDirectory} from './build_directory.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
await buildDirectory({project:path.join(root,'logo-app'),base:'/logos/',out:path.join(root,'../html/logos'),label:'Logo directory',menuLabel:'로고모음 메뉴',rights:'상표와 로고의 권리는 각 권리자에게 있습니다. 공식 페이지의 이용 조건을 확인해 주세요.'});
