# 신규 배포 후보 — 확인 진행표 (사람·AI가 갱신)

뉴스 수집(watch_sources.py 📰)으로 감지한 2026년 신규 배포. **라이선스 원문을 확인하기 전에는 등록하지 않는다.**
상태: ✅ 등록 / 📋 소개 전용(미리보기 없이 정보·링크만, AGENTS.md 4-2) / ⏸ 보류(사유) / 🔍 확인 필요

| 폰트 | 배포 | 발표일 | 원 배포처 | 라이선스 확인 결과 | 상태 |
|---|---|---|---|---|---|
| 원주체 | 원주시 | 2026-08-31 | https://www.wonju.go.kr/www/contents.do?key=6554 | 원주시 가이드라인 PDF 28쪽: SIL OFL 1.1 | ✅ 등록(k-wonju) |
| GS혜자로운체 | GS리테일 | 2026-10-08 | https://hyejaroun.com/ (GS Retail 저작권 표기, Bold 1종) | 보도: 상업 이용 가능, **수정·재배포 금지**, 소프트웨어 포함 시 사전 허가 → 웹폰트 변환 불가 | 📋 소개 전용(k-gs-hyejaroun) — 2026-10-12 라이선스 PDF 확인(웹폰트 탑재 O, 수정·재배포 X). 원본 TTF를 변환 없이 letsum.app 서버에서만 제공하면 미리보기 가능 → 운영자 허락 대기 |
| HS효성체 | HS효성 | 2026-10-07 | https://www.hshyosung.com/kr/about/ci | 공식 페이지: 상업 이용·웹폰트 서버 등록/표시 허용, 로고(CI·BI)·수정 재배포·단독 판매 금지, 앱 내장은 협의. **'다운로드 시 라이선스 동의 간주'** | ✅ 등록(k-hs-hyosung) — 운영자 허락 후 다운로드. 가이드 PDF상 재배포 금지라 **공개 미러 대신 letsum.app 서버에만** 배치(tools/deploy_hosted_fonts.sh) |
| 부산단디체(고딕·명조 각 3굵기, 손글씨) | 부산시 | 2026-10-11 | https://www.busan.go.kr/bhbusan/font | 공식 페이지 '부산시 전용서체의 저작권': 누구나 허가 없이 무료 사용, 유료 판매·대가 수수 금지 | ✅ 등록(k-busan-dandi-*) |
| 빗썸고딕(Original·Basic) | 빗썸 | 2026-10-08 | https://www.bithumbcorp.com/ko/promotion/font.php | 공식 페이지: SIL OFL 1.1 | ✅ 등록(k-bithumb-gothic-*) |
| 부산교육다함께고은체 | 부산시교육청 | 2026-10-06 | https://blog.naver.com/with_pen/224432897441 | 공식 블로그: 무료·CI/BI 포함 자유 사용, 유료 양도·판매 금지 | ✅ 등록(k-busan-goeun) |
| 온글잎 범준필기체 | 부산시교육청 · VoyagerX | 2026-10-06 | https://blog.naver.com/with_pen/224432892423 | 블로그는 자유 사용이나 **폰트 파일에 '수정 시 VoyagerX 사전 서면 허락 필요'** 표기 → 형식 변환도 수정에 해당할 수 있음 | 📋 소개 전용(k-ownglyph-beomjun) + 원본으로 렌더링한 견본 이미지 |
| 이옥선체 · 길원옥체 | (주)붉다 외(나눔의집 등) | 2026 | 공유마당 wrtSn=13388291 / 13388290 | 공유마당 '기증저작물 자유이용' — 기증 저작물 이용 조건(재배포·변경) 원문 확인 필요 | 📋 소개 전용(k-leeoksun·k-gilwonok) — 공유마당 동의 후 받는 파일이라 자동 수집 안 함 |

## 확인 절차
1. 원 배포처 페이지 → 내려받은 ZIP 안의 라이선스 파일·가이드 PDF·약관을 읽는다(기사만으로 판단하지 않는다).
2. OFL 또는 공공누리 제1유형 → 웹폰트 변환 가능. 그 외 → 등록 보류(미리보기 불가)하고 사유를 이 표에 적는다.
3. 등록 시: 미러에 WOFF2 업로드 → data.js 항목 추가 → `license_manual.json`에 근거 → `release_overrides.json`에 발표일·출처 → `tools/run.sh all`.

## SD CU 좋은친구 (BGF리테일 × 산돌, 2026-10-09 공개) — 제외
- 배포: 산돌구름에서만 다운로드, **3개월 한시 무료**(영구 무료 아님) → '상업용 무료 폰트' 기준 미충족
- 산돌구름은 수집 금지 대상(AGENTS.md 2-6). 근거 기사: https://www.businessplus.kr/news/articleView.html?idxno=117783 , https://www.sentv.co.kr/article/view/sentv202610070022
- 재검토 조건: BGF리테일이 영구 무료·자체 배포로 바꾸면 다시 확인 (확인 2026-10-11, claude)

## 기존 배포 폰트 보강 (2026-10-13, claude) — 228종 → 360종
| 묶음 | 결과 | 근거·방식 |
|---|---|---|
| 프리텐다드·수트 | ✅ 등록 | GitHub LICENSE OFL · 공식 README의 jsDelivr 웹폰트 그대로 |
| 나눔스퀘어 네오·마루부리·나눔휴먼·나눔바른고딕/나눔명조 옛한글·클로바 나눔손글씨 109종 | ✅ 등록(113종) | hangeul.naver.com/font 저작권 안내(마루부리·클로바 나눔손글씨도 같은 오픈 라이선스) · 네이버 공식 웹폰트(hangeul.pstatic.net, CORS 허용) 그대로. 강인한 위로는 .woff가 깨져 있어 공식 .ttf 사용 |
| G마켓 산스 | ✅ 등록 | 공식 페이지 OFL + 파일 RFN <Gmarket Sans Font> → 공식 원본 TTF 무변환으로 미러 |
| 카페24 15종(23개 파일) | ✅ 등록 | 배포 묶음 라이선스 PDF 23개 모두 OFL·전 범위 가능 대조 · 묶음의 공식 webfont WOFF2 무변환 미러 |
| 에스코어 드림 | ⏸ 보류 | 자체 라이선스 '배포되는 파일 형태 그대로 사용'(변환 불가)·웹폰트/BI 조항 불명확 → 소개 전용 후보. 라이선스 문의처: 공식 페이지 |
| 넥슨 Lv.1/Lv.2·메이플스토리 등, 여기어때 잘난체, 쿠키런, 제주 서체 | ⏸ 보류 | 현재 공식 배포가 산돌구름 무료 폰트 페이지로 옮겨져 있음 → 수집 금지 대상(2-6). 제작사 자체 배포처·원문을 찾으면 재검토. 넥슨 일부 서체는 비상업 조건 보도 있음 |
| 리디바탕 | 🔍 확인 필요 | ridicorp.com 403 · 공식 라이선스 원문 미확인(제3자 npm의 MIT 표기는 근거 아님) |
| 공공 안심글꼴 묶음 | 소진 | 묶음 365종 중 매칭 가능분은 이미 등록. 남은 131 패밀리는 묶음에 파일 없음(공유마당 개별 동의 다운로드 필요 → 자동화 금지) |

## 2차 보강 (2026-10-13, claude) — 360종 → 379종
단서 출처: 공개 Homebrew 폰트 탭(Xvezda/homebrew-kr-fonts, Sn-Kinos/homebrew-korea-fonts)의 공식 다운로드 주소 · GitHub 검색. **등록 근거는 모두 제작사 원문**(동종 사이트 데이터 미사용).
| 폰트 | 결과 | 근거·방식 |
|---|---|---|
| 넥슨 10종(Lv.1/Lv.2 고딕·배찌·풋볼고딕·메이플스토리·던파 비트비트 v2·연단된 칼날·워헤이븐·카트 고딕·마비옛체) | ✅ | brand.nexon.com Typeface FAQ: 무료·상업·배포 가능, 수정 재배포 금지 → 공식 OTF 무변환 미러. 유료 KlavikaNX 제외 |
| 페이퍼로지·프리젠테이션 | ✅ | GitHub OFL license.txt · 공식 CSS의 jsDelivr 경로(커밋 고정) |
| D2Coding | ✅ | naver/d2-coding-font OFL(RFN D2Coding) → 저장소 site/fonts 공식 woff2 무변환 |
| LINE Seed KR | ✅ | seed.line.me 저작권 안내 OFL → 배포 묶음 Web/woff2 무변환 |
| 이롭게 바탕체 | ✅ | GitHub README OFL(RFN) → 저장소 공식 woff 무변환 |
| 여기어때 잘난체2·잘난체 고딕 | ✅ | gccompany.co.kr/font 라이선스 가이드 PDF: 무료·상업·임베딩·재배포 가능, 수정 재배포·판매 금지, CI·BI 상표 등록 불가 → 공식 OTF 무변환 |
| KBL 점프체·코트체 | ✅ | kbl.or.kr/intro/font: 자유 배포·상업 이용 가능, 판매 금지 → 공식 OTF(공식 'WOFF2'는 Type1 PFB라 사용 불가) |
| 넷마블체 | ⏸ | 공식 조항 5: 번들·임베디드 사용은 사전 허가 필요 → 웹 미리보기 불가, 소개 전용 후보 |
| NHN 고도체·고도마음체 | 🔍 | 공식 페이지·폰트 파일 어디에도 이용 조건 원문 없음 → 문의 필요 |
