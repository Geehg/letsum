# Cloudflare 방화벽(WAF) 규칙 — 대시보드에 붙여 넣기

모두 **무료 플랜**에서 됩니다. 위치: Cloudflare 대시보드 → letsum.app → **Security(보안) → WAF**.
코드(Worker)에 이미 들어간 것: `/api/*` IP별 10초 40회 한도, 관리자 API 1분 30회 한도, robots.txt AI 수집 금지.

규칙을 넣은 뒤 꼭 확인할 것
1. 카카오톡에 `https://letsum.app/font/jua.html` 을 보내 미리보기 카드가 뜨는지
2. 사이트를 평소처럼 둘러보기(피드 스크롤·상세 열기)
문제가 생기면 그 규칙만 끄면(토글) 바로 원래대로 돌아갑니다.

---

## 규칙 1. 수집 도구 차단 (Custom rules → Create rule)

- 이름: `수집 도구 차단`
- **Edit expression** 을 눌러 아래를 그대로 붙여 넣기:

```
(http.user_agent eq "" or lower(http.user_agent) contains "python-requests" or lower(http.user_agent) contains "python-urllib" or lower(http.user_agent) contains "aiohttp" or lower(http.user_agent) contains "httpx" or lower(http.user_agent) contains "scrapy" or lower(http.user_agent) contains "curl/" or lower(http.user_agent) contains "wget" or lower(http.user_agent) contains "go-http-client" or lower(http.user_agent) contains "node-fetch" or lower(http.user_agent) contains "axios" or lower(http.user_agent) contains "okhttp" or lower(http.user_agent) contains "libwww-perl" or lower(http.user_agent) contains "headlesschrome" or lower(http.user_agent) contains "phantomjs") and not cf.client.bot
```

- Action: **Block**
- 뜻: 브라우저가 아닌 수집 프로그램(파이썬·curl 등)과 이름을 숨긴 요청을 막습니다. 구글·네이버·카카오 같은 확인된 봇(`cf.client.bot`)은 제외.

## 규칙 2. AI 수집 봇 차단 (Custom rules → Create rule)

robots.txt를 무시하는 AI 학습용 수집기까지 막습니다. (Security → Bots 의 **Block AI bots** 스위치가 보이면 그것을 켜도 같습니다.)

```
(cf.verified_bot_category eq "AI Crawler")
```

- Action: **Block**

## 규칙 3. 관리자 페이지 해외 접속 확인 (Custom rules → Create rule)

```
(http.request.uri.path eq "/admin.html" and ip.geoip.country ne "KR")
```

- Action: **Managed Challenge** (사람이면 클릭 한 번으로 통과, 봇은 막힘)

## 규칙 4. 사이트 전체 과다 요청 (Rate limiting rules → Create rule)

무료 플랜은 1개까지. 페이지·이미지를 아주 빠르게 긁어 가는 IP를 10초 동안 막습니다.

- 이름: `과다 요청`
- If incoming requests match: **Custom filter expression** →
```
(not cf.client.bot and not starts_with(http.request.uri.path, "/img/") and not starts_with(http.request.uri.path, "/css/") and not starts_with(http.request.uri.path, "/js/") and not starts_with(http.request.uri.path, "/data/") and not starts_with(http.request.uri.path, "/fonts-hosted/"))
```
- Same characteristics: IP
- When rate exceeds: **100 requests / 10 seconds**
- Action: **Block**, Duration: **10 seconds**

---

### 함께 켜면 좋은 것 (Security → Bots)
- **Bot Fight Mode**: 켠 뒤 카카오톡 미리보기를 한 번 확인. 미리보기가 안 뜨면 끄세요.
