# 문의 직접 전송

- `/contact.html` → `POST /api/contact` → Cloudflare 무료 Email Routing의 검증 수신처 `interq4@naver.com`.
- 표시 받는이: 렛섬운영 담당자. 고정 발신 `contact@letsum.app`; Reply-To는 검증한 작성자 이메일. 사용자 입력으로 수신처·CC·BCC 변경 불가.
- `worker/wrangler.toml`의 CONTACT_ENABLED와 CONTACT_EMAIL 바인딩으로 제어. 유료 Email Sending 플랜 가입 불필요. 2026-11-06 라우팅/DNS ready 및 수신처 인증 확인.
- 이름 60자, 제목 100자, 본문 10~5,000자, 요청 24KiB 제한. 이메일·헤더 개행 검사, 정확한 Origin, 빈칸 함정, 기존 IP 속도 제한과 D1 원자적 10분 3회/24시간 10회, 전체 24시간 100회 한도.
- D1은 접수 UUID, IP 해시, 비밀값을 결합한 내용 해시, pending/sent, 시각만 7일 보관. 원본 IP·본문·이메일 미저장. 일일 cron과 접수 시 만료 정리.
- 동일 UUID의 성공 요청은 재발송하지 않고 성공 응답. 미확정 상태는 자동 재전송하지 않으며 화면에서 접수 번호와 작성 내용 보존을 안내. 메일 전송과 D1 갱신은 하나의 트랜잭션이 아니므로 미확정 사례는 Cloudflare 메일 로그와 수신함을 수동 대조해야 함.
- 검증: `node tools/check_contact.mjs` (Node 22+ 내장 sqlite), Wrangler dry-run, 실제 브라우저 폼·모바일·운영 전송 확인.
- 메일함 기록은 개인정보처리방침대로 운영자가 삭제(문의 처리 완료 후 1년/권리자 기록 3년). 본문 로그 출력 금지. 과다 접수 제한 변경 시 무료 한도와 스팸 상태 확인.
- 폼 전송 성공은 메일 서비스 접수 성공을 뜻하며 최종 수신함 도착·스팸 분류까지 보장하지 않음.
