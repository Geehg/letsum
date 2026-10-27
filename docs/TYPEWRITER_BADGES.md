# 투명 로고·엠블럼 (2026-10-27)

내장 image_gen 도구로 사용자 레퍼런스를 참조하여 세 모델의 전면 로고를 재생성했다. 공식 로고 벡터나 실물 스캔을 추출한 것이 아니므로 원본과 완전한 동일성을 주장하지 않는다. 생성된 PNG를 수정 없이 보관하고, 텍스처 UV에서 투명 여백만 제외한다. 이미지 크기는 모두 2172 × 724, RGBA이며 외곽과 Olympia 글자 사이에 투명 알파가 있다.

- `html/img/typewriters/badges/hermes3000-v1.png`: 금속 테두리와 HERMES 3000 양각 명판.
- `html/img/typewriters/badges/lettera32-v1.png`: 검정/은색 분할 olivetti / lettera 32 명판.
- `html/img/typewriters/badges/olympiasm3-v1.png`: 배경판 없는 Olympia 은색 필기체.

`typing-badges.js`가 기존 상판 위치·경사에 새 이미지를 부착한다. Olympia는 상판에 광선을 투사해 곡면을 샘플링한 분할 메시에 매핑한다. sRGB·비등방성 필터·알파 테스트를 적용하고 본체 포즈 변환을 함께 따른다. 이미지 로드 성공 후에만 기존 로고를 숨기며 실패 시 기존 로고와 필사 기능을 유지한다. 모델 교체 시 텍스처와 기하 자원을 해제하고 늦은 콜백이 화면을 되살리지 않는다.

검증: 세 모델의 기존 회귀 검사, 로고 이미지 로드 성공/실패/늦은 완료/중복 정리, 전체 validate 오류 0, 브라우저 정면·사선 및 실제 입력 화면 확인.

## 생성 프롬프트 원문

### Hermes 3000
Use case: product-mockup. Reference image: use ONLY the small physical HERMES 3000 badge on the FRONT of the actual sage typewriter, NOT the big infographic heading. Generate a high resolution isolated orthographic straight-on front facing texture asset of that exact rectangular badge alone. Exact text HERMES 3000: raised silver uppercase compact HERMES on the left, wide slanted futuristic 3000 on the right, in a narrow rounded rectangular chrome double rim with muted dark sage-gray enamel recessed interior. Match reference lettering and proportions faithfully. Entire physical badge width to height approximately 8:1. Restrained dark silver with crisp thin bright bevel highlights and dark inset edges, subtly tangible metal relief. No new design, no extra wording, no screws not seen in reference. Transparent background everywhere outside the badge with real alpha, no checkerboard, no body, no floor, no external drop shadow, no perspective. Center one badge occupying 90% of image width, high detail sharp legible text. This will be mapped onto an existing 3D typewriter.

### Olivetti Lettera 32
Use case: product-mockup. Reference image role: reproduce ONLY the physical split metal nameplate on the blue Olivetti Lettera 32 front cover (also shown enlarged in bottom left detail). Generate one high resolution straight-on orthographic isolated badge texture, actual alpha transparency outside the badge. Exact lowercase text: 'olivetti' in white on black left panel, 'lettera 32' in black on warm silver-white right panel. Closely match the reference original Olivetti custom rounded bold lowercase typography and spacing, no modern font substitute look. Both words on one baseline. Left panel about 44% width, right panel about 56%. Very thin brushed silver rectangular edging, nearly square tiny rounded corners, subtle real metal thickness and narrow bevel reflections. Badge overall width:height approximately 8:1. Clean preserved vintage object, not damaged/distressed. ONLY the nameplate, no blue body, no other text, no shadow outside object, no perspective, no checkerboard. Center full isolated badge with wide horizontal framing, 90% of image width. Asset will be applied to a 3D typewriter surface.

### Olympia SM3
Use case: product-mockup. Reference image role: the small physical chrome cursive Olympia emblem on the right of the olive typewriter front cover, including enlarged upper right detail. Generate ONLY that authentic connected script word as a high resolution isolated badge texture, straight-on orthographic front view. Exact case-sensitive text: 'Olympia'. Faithfully reproduce its compact vintage connected italic script: round capital O, looped tall l, descending y and p, compact linked m, small dotted i, rounded final a and short rising terminal. Match the reference silhouette; do not invent generic wedding calligraphy, huge swashes, underline, serif type or modern font. Low-relief cast solid chrome lettering, silver body with brighter narrow upper bevel and darker lower bevel, restrained realistic metal reflection; not white paint, not thin wire. Width:height around 4:1. Transparent background with real alpha all around AND inside letter counters and gaps; NO backing plate, no typewriter, no olive background, no cast shadow outside lettering, no checkerboard, no extra words. Horizontal composition, one centered logo filling 85% image width, generous clear padding without clipping descenders.
