# 초기 실데이터 검토 기록

버전: 0.1.0 · 확인일: 2026-11-09

- 기관/브랜드 레코드: 30개
- 고유 기관: 28개
- 출처 페이지: 36개
- 모든 시드 레코드는 공식 페이지 본문을 열람한 범위에 한해 작성했습니다.
- 원본 바이너리·해시·다운로드 성공·재배포 허가·미리보기 허가·현행 버전은 검증하지 않았습니다.
- 모든 버전 상태는 unconfirmed이며, 파일 직접 URL과 메타데이터는 null입니다.
- 페이지 표시 형식은 listed_formats에만 저장했습니다. 실제 파일 확장자·MIME·매직바이트가 검증된 것으로 취급하지 않습니다.
- public은 공식 페이지에서 파일 제공을 안내한다는 의미입니다. 이용허락 또는 파일 전송 성공 의미가 아닙니다.
- 기관 분류는 탐색용 분류입니다. 세부 법정 지정 유형·연도는 이 데이터가 확정하지 않습니다.
- 세 기관의 공식 배포 폰트 관계를 연결했습니다: 고양특례시, 서울특별시, NAVER. 각 폰트의 이용조건은 로고와 별개입니다.

## 분류별 레코드 수

- business: 11
- education: 6
- intergovernmental: 1
- local-government: 3
- national-government: 3
- nonprofit: 2
- public-organization: 4

## 편집상 주의 사항

- NAVER: 제3자 재배포·데이터셋·별도 다운로드 자료 제공을 금지하는 문구를 직접 확인하여 redistribution=restricted로 저장했습니다. 원본 이미지·미리보기는 포함하지 않습니다.
- 서울특별시: 기관 휘장과 SEOUL MY SOUL을 동일 organization_id의 별도 레코드로 구성했습니다.
- 서울대학교·POSTECH·MIT: 공개 페이지와 고해상도/구성원/외부 요청 경로를 구분했습니다.
- KAIST: 국문 경로에서 본문 설명이 안정적으로 추출되지 않아 영문 공식 UI 페이지를 사용했습니다. 국문 정책과 대조하기 전 외부 사용허락을 확정하지 않습니다.
- 중소벤처기업부: 백색 PANTONE 표기가 적색과 중복되어 원문 색상값을 확정 데이터로 복사하지 않았습니다.
- Samsung: 검토 페이지의 검정 HEX가 5자리로 표시되어 색상값을 자동 수집하지 않았습니다.
- 서울시 휘장의 페이지 공공누리 표시, Wikimedia 문서의 텍스트 라이선스를 모든 자산의 재배포·미리보기 허락으로 자동 승계하지 않았습니다.
- 관련 폰트 링크는 실제 폰트 파일을 패키지에 포함하지 않습니다. 기존 LETSUM 폰트 ID와의 매핑은 실제 운영 데이터 확인 후 진행해야 합니다.

## 제외하거나 대체한 경로

- https://www.yonsei.kr/sc/336/subview.do — 직접 열람에서 502. 공식 디자인센터 심벌·관리규정 경로로 대체.
- https://www.busan.go.kr/bhorgsymbol01 — 직접 열람 타임아웃. 검색 요약만으로 시드에 넣지 않음.
- https://www.busan.go.kr/bhorgsymbol01/view — 대체 공식 경로도 타임아웃. 미등록.
- https://www.jeju.go.kr/jeju/symbol/drapery/mark.htm — 도구 접근 불가. 미등록.
- https://www.gg.go.kr/contents/contents.do?ciIdx=677&menuId=2455 — 최초 본문 수집 이후 필요한 구간 재확인에서 타임아웃. 이 시드에서는 제외.
- https://www.redcross.or.kr/pub/basicSystem/index.jsp — 직접 열람 타임아웃. 미등록.
- https://www.un.org/en/about-us/un-emblem-and-flag/ — 직접 열람 403. 검색 요약만으로 시드에 넣지 않음.

## 레코드별 확인 내용

### 대한민국 정부상징 (gok-symbol)

정부상징과 정부기 제작 기준을 안내하는 행정안전부 공식 페이지입니다.

- 분류: national-government / organization
- 이용조건 관측: 이 페이지에서 일반적인 외부 이용허락 범위를 확인하지 못했습니다.
- [정부기·정부상징](https://www.mois.go.kr/frt/sub/a06/b08/nationalIcon_10/screen.do)
  - 직접 확인: 정부상징 파일 다운로드 표시, 정부기 제작 비례와 표준색도 설명 확인. 파일형식은 본문에서 확정하지 않음.

### 중소벤처기업부 MI (mss-mi)

정부상징과 기관명을 결합한 국문·영문 시그니처 및 색상 안내입니다.

- 분류: national-government / organization
- 이용조건 관측: 이 페이지에서 일반적인 외부 이용허락 범위를 확인하지 못했습니다.
- [중소벤처기업부 MI 소개](https://mss.go.kr/site/smba/contents/view.do?menuCd=20801030000002024122947&siteCd=smba)
  - 직접 확인: 로고·정부상징 가이드 내려받기, 국문·영문 시그니처와 색상 설명 확인. 백색 PANTONE 표기가 적색과 중복되어 색상값은 데이터화하지 않음.

### SEOUL MY SOUL (seoul-my-soul)

서울시 기관 휘장과 구분되는 도시브랜드의 의미와 조합형을 안내합니다.

- 분류: local-government / city-brand
- 이용조건 관측: 이 페이지에서 일반적인 외부 이용허락 범위를 확인하지 못했습니다.
- [서울 신규 브랜드 소개](https://www.seoul.go.kr/newbrand/)
  - 직접 확인: SEOUL MY SOUL 브랜드 의미, 국문·영문 기본형 및 가로·세로 활용 이미지 확인. 해당 페이지에서 원본 파일 다운로드 형식은 확인하지 못함.

### 고양특례시 시 로고 (goyang-city-logo)

시 로고타입의 가로·세로형과 전용색상·사용규정을 안내합니다.

- 분류: local-government / organization
- 이용조건 관측: 영리 목적 물품 제작·행사 이용은 사용신청과 승인이 필요하다는 안내가 있습니다.
- [고양특례시 시 로고](https://www.goyang.go.kr/www/www05/www05_3/www05_3_10.jsp)
  - 직접 확인: AI·PNG 파일 표시, 가로·세로 로고타입, 색상 및 영리 목적 물품·행사 사용승인 안내 확인.
- [고양시 전용서체—고양체](https://www.goyang.go.kr/www/www05/www05_3/www05_3_6/www05_3_6_tab1.jsp)
  - 직접 확인: 고양체의 공식 배포 및 사용조건·TTF·OTF 설치 안내 확인. 로고 이용조건과 서체 이용조건은 구분함.

### 서울대학교 정장·UI (snu-ui)

서울대학교 정장과 최소사용규정, 파일 접근 및 상표 사용 절차를 안내합니다.

- 분류: education / organization
- 이용조건 관측: 동문·외부인 사용에는 허가 안내가 있으며, 고해상도는 구성원 교육·행정 목적에 한합니다. 수주업체는 발주부서에 요청하고 작업 후 폐기하도록 안내합니다.
- [서울대학교 UI 사용 원칙—정장](https://identity.snu.ac.kr/ui/1)
  - 직접 확인: 정장·최소사용규정·일반 및 고해상도 파일 링크, 외부인 허가·고해상도 구성원 제공·수주업체 파일 폐기 안내 확인.

### 한국기술교육대학교 UI (koreatech-ui)

심벌마크와 로고타입의 공식 제공 형식·색상·사용 절차를 안내합니다.

- 분류: education / organization
- 이용조건 관측: 형태·색상 임의 변경을 제한합니다. 교내 행정부서 외 학생단체·외부업체의 홍보물·상품 제작은 담당부서에 시안을 보내 확인받도록 안내합니다.
- [한국기술교육대학교 심벌마크·로고타입](https://www.koreatech.ac.kr/menu.es?mid=a10101030100)
  - 직접 확인: 심벌 JPG·AI, 로고타입 PNG·AI 표시, 크기·색상 규정과 외부 제작물 시안 확인 안내 확인.

### 한국교육개발원 CI (kedi-ci)

교육 정책 연구기관의 심벌·시그니처와 전용색상 의미를 안내합니다.

- 분류: public-organization / organization
- 이용조건 관측: 사용 관련 문의 창구가 안내되어 있습니다. 일반적 상업 이용·재배포 허용 범위는 확인되지 않았습니다.
- [한국교육개발원 CI 소개](https://kedi.re.kr/khome/mobile2/intro/kedici.do)
  - 직접 확인: 심벌·국문/영문 시그니처, CI 다운로드 버튼, 전용색상 의미와 사용 관련 문의 안내 확인. 확장자는 본문에서 미확인.

### 국민건강보험공단 CI·캐릭터 (nhis-ci)

심벌·국문/영문 로고타입과 건이·강이 캐릭터 정보를 안내합니다.

- 분류: public-organization / organization
- 이용조건 관측: CI·캐릭터의 상표권 등록 및 무단 사용에 대한 조치 가능성을 안내합니다. 구체적 사용은 공식 문의가 필요합니다.
- [국민건강보험공단 CI 및 캐릭터 소개](https://www.nhis.or.kr/static/html/wbdf/a/wbdfa0502.html)
  - 직접 확인: 심벌·로고타입·캐릭터 소개 및 상표권 등록·무단사용 관련 고지 확인. 본문에서 파일 다운로드를 확인하지 못함.

### NAVER 로고·브랜드 가이드 (naver-brand)

네이버 로고타입·브랜드 컬러와 사용 시 유의사항을 안내합니다.

- 분류: business / organization
- 이용조건 관측: 로고 변형과 제휴 오인을 제한하며, 로고의 제3자 재배포·템플릿·데이터셋·별도 다운로드 자료 제공을 금지한다고 명시합니다.
- [NAVER 브랜드 리소스](https://www.navercorp.com/company/brandGuide)
  - 직접 확인: 로고타입·전체 다운로드·색상·변형 제한·법적 고지 확인. 제3자 재배포 및 템플릿·데이터셋·별도 다운로드 자료 제공 금지 문구 확인.
- [네이버 글꼴 모음](https://hangeul.naver.com/font)
  - 직접 확인: 네이버가 개발·배포한 나눔 글꼴, 마루 부리, 클로바 나눔손글씨와 관련 라이선스 안내 확인.

### 카카오 CI (kakao-ci)

공식 미디어 자료에 공개된 카카오 CI와 이용조건 안내입니다.

- 분류: business / organization
- 이용조건 관측: 이 게시물은 제공 이미지·영상·자료를 상업적으로 이용할 수 없다고 명시합니다.
- [카카오 CI](https://www.kakaocorp.com/page/detail/11340)
  - 직접 확인: 카카오 CI 게시물의 kakao.png 다운로드 표시 및 제공 자료의 상업적 이용 금지 문구 확인. 게시일을 로고 시행일로 사용하지 않음.

### 카카오뱅크 브랜드 리소스 (kakaobank-brand)

심볼·워드마크·시그니처를 구분하고 브랜드 가이드와 어셋 경로를 안내합니다.

- 분류: business / organization
- 이용조건 관측: 심볼과 워드마크의 크기 비례·간격을 변형할 수 없으며 시그니처는 가로형을 우선 사용하도록 안내합니다. 일반적 재배포 허락은 확인되지 않았습니다.
- [카카오뱅크 브랜드 리소스](https://www.kakaobank.com/view/about/brand/resource)
  - 직접 확인: 심볼·워드마크·시그니처 설명, 브랜드 가이드·어셋 다운로드 표시, 조합 비례·간격 변경 금지 및 가로형 우선 사용 안내 확인.

### 한국전력공사 CI (kepco-ci)

심볼·로고타입·레터마크·시그니처의 공식 파일 안내를 제공합니다.

- 분류: public-organization / organization
- 이용조건 관측: 이 페이지에서 일반적인 외부 이용허락 범위를 확인하지 못했습니다.
- [한국전력공사 CI](https://www.kepco.co.kr/home/about/introduce/ci/conts.do)
  - 직접 확인: 심볼·국문 로고타입·KEPCO 레터마크·시그니처 각각 JPG·AI 표시와 색상 안내 확인.

### 한국수력원자력 CI (khnp-ci)

심볼과 다국어 로고타입, 세 방향의 시그니처 조합을 안내합니다.

- 분류: public-organization / organization
- 이용조건 관측: 이 페이지에서 일반적인 외부 이용허락 범위를 확인하지 못했습니다.
- [한국수력원자력 CI](https://khnp.co.kr/main/contents.do?key=2238)
  - 직접 확인: 심볼·국/영/한문 로고타입·좌우/상하/세로 시그니처의 PNG·AI 표시, 색상체계 설명 확인.

### MIT 브랜드 가이드 (mit-brand)

MIT 로고·조합형의 형식과 구성원 로그인·외부 요청 경로를 안내합니다.

- 분류: education / organization
- 이용조건 관측: 다운로드는 MIT 구성원 로그인으로 제공하며 외부인은 담당 창구를 통해 파일을 요청하도록 안내합니다. 구체적 사용은 별도 로고·명칭 정책을 확인해야 합니다.
- [MIT Brand Guide—Downloads](https://brand.mit.edu/downloads)
  - 직접 확인: 구성원 Touchstone 로그인 다운로드·외부인 요청 안내, CMYK AI/JPG·PMS AI·RGB PNG/SVG 구성 설명 확인.

### KAIST UI (kaist-ui)

로고·엠블럼·시그니처와 기본 사용 기준을 안내하는 영문 공식 페이지입니다.

- 분류: education / organization
- 이용조건 관측: 영문 페이지에서 공개 다운로드 표시는 확인했으나 외부 이용허락의 세부 범위는 확인되지 않았습니다. 고해상도 및 외부 사용은 담당부서·국문 정책을 추가 확인해야 합니다.
- [KAIST Emblems/Symbols—UI](https://kaist.ac.kr/en/html/kaist/011901.html)
  - 직접 확인: 영문 UI 페이지에서 로고·엠블럼·시그니처 Download 표시와 그리드·최소크기·색상·모티프 안내 확인. 확장자와 일반 이용허락은 미확인.

### POSTECH 로고·UI (postech-ui)

POSTECH 워드마크·시그니처·색상과 외부 사용 절차를 안내합니다.

- 분류: education / organization
- 이용조건 관측: 상업적 무단 사용을 제한하며 수주업체는 발주부서에 파일을 요청해야 합니다. 제공 파일은 승인 용도로만 사용하고 작업 후 폐기하도록 안내합니다.
- [POSTECH University Identity—로고](https://www.postech.ac.kr/kor/university-introduction/logo.do)
  - 직접 확인: 워드마크·시그니처·전용색상·금지 사례 및 로고 다운로드 표시 확인. 상업적 무단 사용 제한·수주업체 파일 요청·승인 용도 사용·폐기 안내 확인.

### 연세대학교 심벌·UI (yonsei-ui)

연세대학교 심벌마크의 의미와 UI 관리규정을 함께 안내합니다.

- 분류: education / organization
- 이용조건 관측: UI 가이드에 따라 사용하고 임의로 변경할 수 없으며, 지침 밖의 응용은 관리부서를 경유하도록 규정합니다.
- [연세대학교 디자인센터—심벌마크](https://labor.yonsei.ac.kr/designcenter/intro/symbol.do)
  - 직접 확인: 심벌마크와 구성요소 의미 설명 확인. 이 페이지 본문에서 직접 다운로드 파일형식은 확인하지 못함.
- [연세대학교 UI 관리규정](https://labor.yonsei.ac.kr/designcenter/UI_mng/ui_mng.do)
  - 직접 확인: UI 정의·사용 가이드 준수·임의 변경 금지·지침 외 응용 시 관리부서 경유 규정 확인.

### 서울특별시 휘장·CI (seoul-city-emblem)

도시브랜드 SEOUL MY SOUL과 별개인 서울시 기관 휘장·CI입니다.

- 분류: local-government / organization
- 이용조건 관측: 로고타입 임의 변경을 금지합니다. 페이지의 공공누리 제4유형 표시와 별도 상징물 규정집을 함께 확인해야 하며 개별 파일의 적용 범위는 추가 확인이 필요합니다.
- [서울특별시 휘장](https://www.seoul.go.kr/seoul/emblem.do)
  - 직접 확인: 휘장·로고타입·엠블럼, AI·PNG 표시 및 상징물표준화규정집 링크 확인. 페이지에 공공누리 제4유형 표시가 있으나 파일별 적용 범위를 별도 확정하지 않음.
- [서울특별시 서울서체](https://www.seoul.go.kr/seoul/font.do)
  - 직접 확인: 서울한강·서울남산·서울알림체의 공식 소개, 다운로드 및 서체 이용조건 확인.

### Samsung 레터마크 (samsung-logo)

삼성 영문 레터마크와 적용 색상·보호공간을 안내합니다.

- 분류: business / organization
- 이용조건 관측: 이 페이지에서 일반적인 외부 이용허락 범위를 확인하지 못했습니다.
- [Samsung Brand Identity—Logo](https://www.samsung.com/us/about-us/brand-identity/logo/)
  - 직접 확인: 영문 Samsung 레터마크, 색상과 보호공간 설명 확인. 원본 파일 다운로드를 이 페이지에서 확인하지 못함.

### 현대자동차 CI (hyundai-ci)

심볼·워드마크 조합과 최소 공간·크기·색상 활용 기준을 안내합니다.

- 분류: business / organization
- 이용조건 관측: 로고의 규격·형태·컬러를 임의로 수정할 수 없으며 사용 환경에 맞는 공식 색상 버전을 적용하도록 안내합니다.
- [현대자동차 CI—로고타입](https://www.hyundai.com/kr/ko/info/ci)
  - 직접 확인: 워드마크·심볼 좌우조합 권장, 최소크기·보호공간, 색상별 사용범위와 임의 수정 금지 확인.

### GitHub 로고 가이드 (github-logo)

Invertocat과 워드마크 조합, 구형 로고 및 사용 조건을 안내합니다.

- 분류: business / organization
- 이용조건 관측: 링크·연동 소개·관련 보도 등 허용 사례와 함께 제휴 오인·변형 금지 및 서면 허가 관련 고지를 제시합니다. 실제 용도에 맞는 조건을 확인해야 합니다.
- [GitHub Brand Toolkit—Logo](https://brand.github.com/foundations/logo)
  - 직접 확인: Invertocat·워드마크 조합·공식 다운로드 표시·구형 로고 구분 및 사용 예시·금지사항·서면 허가 고지 확인. 다운로드 형식은 본문에서 미확인.

### UNESCO 로고·후원 사용 안내 (unesco-logo)

유네스코 명칭·로고 사용 허가와 공식 후원 신청 절차를 안내합니다.

- 분류: intergovernmental / organization
- 이용조건 관측: 명칭·약칭·로고 사용에는 사전 서면 승인이 필요하다고 명시하며, 상업·광고·마케팅·모금 활동은 후원 대상에서 제외한다고 안내합니다.
- [UNESCO Logo and Patronage](https://www.unesco.org/en/logo-patronage)
  - 직접 확인: 명칭·약칭·로고의 사전 서면 승인 원칙과 네트워크·공식 파트너·후원 신청 경로 확인.

### NASA 브랜드 가이드 (nasa-brand)

NASA의 인시그니아·워드마크·인장과 상품·미디어 이용 안내를 연결합니다.

- 분류: national-government / organization
- 이용조건 관측: NASA 식별자에는 별도 규정이 적용되며, 기관의 보증으로 오인시키는 사용을 제한합니다. 상품·광고·미디어 이용은 해당 지침과 승인 절차를 확인해야 합니다.
- [NASA Brand Center](https://www.nasa.gov/nasa-brand-center/)
  - 직접 확인: 정부기관 명시, Insignia·Logotype·Seal 그래픽 기준 및 상품·광고·미디어 사용 규정 연결, 로고·식별자 보호 고지 확인.

### Mozilla 상표·로고 사용 안내 (mozilla-trademarks)

Mozilla 재단이 게시한 로고·상표 이용 조건을 안내합니다.

- 분류: nonprofit / organization
- 이용조건 관측: 정확한 언급·해당 공식 서비스 링크 등 명시된 용도에는 사전 허가 예외가 있으며, 그 밖의 사용은 서면 허가가 필요하다고 안내합니다.
- [Mozilla Trademark Guidelines](https://www.mozilla.org/en-US/foundation/trademarks/policy/)
  - 직접 확인: 사실에 근거한 명칭·로고 언급 및 공식 서비스 링크 등 사전 허가 예외, 그 밖의 사용에 대한 서면 허가와 변형·제휴 오인 금지 확인.
- [Meet Mozilla Foundation](https://www.mozillafoundation.org/en/meet-mozilla/)
  - 직접 확인: Mozilla Foundation의 공식 소개 페이지에서 비영리 기관(non-profit) 명시와 Mozilla Project에 대한 역할을 확인하여 기관 분류와 정책 게시 주체를 연결함.

### NAVER API HUB BI (naver-api-hub-bi)

네이버 오픈 API 이용 서비스의 공식 BI 표시 방법을 안내합니다.

- 분류: business / service
- 이용조건 관측: 네이버 오픈 API를 이용하는 서비스는 기본 가이드와 특례의 모든 조건을 준수하면 사전 허가 없이 상표를 사용할 수 있다고 안내합니다. 일반 용도의 포괄 허락은 아닙니다.
- [NAVER API HUB 상표 및 BI 사용](https://guide.ncloud-docs.com/docs/apihub-brandguide)
  - 직접 확인: API 제공 주체 NAVER 명시, 오픈 API 특례·BI 사용 방식, AI·PNG 파일 표시 및 D2 Coding 권장 안내 확인.

### Microsoft 로고·브랜드 사용 안내 (microsoft-brand)

기업 로고와 제품별 로고·아이콘의 사용 조건을 안내합니다.

- 분류: business / organization
- 이용조건 관측: 그래픽 로고·앱/제품 아이콘 등에는 명시적 라이선스가 필요하다고 안내합니다. 단순 명칭 언급 조건을 로고 사용 허락으로 적용할 수 없습니다.
- [Microsoft Trademark and Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks)
  - 직접 확인: 기업 로고·제품 로고 조합·아이콘의 승인 요구 및 명칭의 사실적 언급과 그래픽 로고 사용의 구별 확인.

### Adobe 로고·상표 사용 안내 (adobe-brand)

Adobe 기업·제품 로고의 사용 승인 조건과 상표 표기 기준을 안내합니다.

- 분류: business / organization
- 이용조건 관측: 지정 라이선스 프로그램이나 동등한 승인이 없는 로고 사용을 허용하지 않는다고 안내합니다. 제품명 언급 규칙과 그래픽 로고 이용조건은 별도입니다.
- [Adobe General Trademark Guidelines](https://www.adobe.com/legal/permissions/trademarks.html)
  - 직접 확인: 로고를 제외한 명칭 인용과 로고·제품 아이콘 이용을 구분하고, 로고 이용에는 라이선스 프로그램 또는 동등한 승인이 필요함을 확인.

### Google 브랜드 사용 안내 (google-brand)

Google 로고·제품 아이콘·브랜드 요소의 용도별 이용 안내입니다.

- 분류: business / organization
- 이용조건 관측: 후원·제휴 오인과 상품 적용 등을 제한하며, 교육 자료 등 일부 용도는 조건 준수 시 별도 요청 없이 사용할 수 있다고 설명합니다. 용도별 세부 가이드를 확인해야 합니다.
- [Google Brand Resource Center—Guidance](https://about.google/brand-resource-center/guidance/)
  - 직접 확인: 허가 금지·사전 요청·요청 불필요 용도를 구분한 공식 안내 확인. 제휴 오인·상품 적용 제한 및 교육 자료 등의 예시 확인.

### 위키미디어 재단 로고 (wikimedia-foundation-mark)

위키미디어 재단 심볼·워드마크 조합과 시각 사용 기준을 안내합니다.

- 분류: nonprofit / organization
- 이용조건 관측: 정체성 변형을 제한하며 공동브랜딩에는 재단 승인이 필요하다고 안내합니다. 실제 사용 권한은 연결된 상표 정책까지 확인해야 합니다.
- [Wikimedia Visual Identity Guidelines](https://foundation.wikimedia.org/wiki/Wikimedia_visual_identity_guidelines)
  - 직접 확인: 재단의 원형 심볼·워드마크 조합과 가로/세로형, 보호공간·변형 제한·공동브랜딩 승인 안내 확인. 문서 텍스트 라이선스를 로고 자산 전체 허락으로 적용하지 않음.
- [Wikimedia Foundation Bylaws](https://foundation.wikimedia.org/wiki/Special:MyLanguage/Legal:Bylaws)
  - 직접 확인: 재단 자산의 자선 목적 귀속 및 비영리 목적 관련 정관을 확인하여 비영리 카테고리 근거로 연결.

### 카카오게임즈 CI (kakaogames-ci)

카카오게임즈의 CI 색상과 공식 다운로드 안내입니다.

- 분류: business / organization
- 이용조건 관측: 브랜드 가치를 담은 CI를 임의로 변형할 수 없으며 다운로드 후 규정에 따라 사용하도록 안내합니다.
- [카카오게임즈 회사소개—CI](https://www.kakaogamescorp.com/about/company?lang=ko)
  - 직접 확인: 회사소개 본문의 CI 색상·다운로드 표시·임의 변형 금지 확인. 파일 확장자 미확인.

