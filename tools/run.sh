#!/usr/bin/env bash
# LETSUM 수집·반영 파이프라인 — 정해진 순서로만 실행해 꼬임을 막는다.
# 사용: tools/run.sh <단계>     (단계 없이 실행하면 도움말)
#   start   <이름>  작업 시작: 최신 받기 + 잠금 획득 (다른 작업자가 잠가 두었으면 중단)
#   watch           배포처 수집(카탈로그 누적·뉴스·링크 점검)
#   dates           출시일 반영(출처 있는 것만)
#   pages           폰트별 페이지·sitemap 생성
#   verify          라이선스 원문 대조
#   check           검증(오류 0이어야 커밋 가능)
#   all             watch → dates → verify → pages → check
#   finish  "<메시지>"  검증 → 커밋 → 푸시 → 잠금 해제
#   unlock          잠금 강제 해제(작업자가 사라졌을 때만)
set -euo pipefail
cd "$(dirname "$0")/.."
LOCK=tools/state/LOCK
PY="python3 -I"

need_lock() {
  [ -f "$LOCK" ] || { echo "✗ 잠금이 없습니다. 먼저: tools/run.sh start <작업자 이름>"; exit 2; }
}
case "${1:-}" in
  start)
    who="${2:?작업자 이름이 필요합니다 (예: claude, gpt, muse, 사람이름)}"
    git pull --rebase --quiet
    if [ -f "$LOCK" ]; then echo "✗ 다른 작업이 진행 중입니다:"; cat "$LOCK"; echo "끝난 작업이면 tools/run.sh unlock"; exit 2; fi
    printf '작업자: %s\n시작: %s\n' "$who" "$(date '+%Y-%m-%d %H:%M')" > "$LOCK"
    git add "$LOCK" && git commit -q -m "chore: 작업 잠금 ($who)" && git push -q
    echo "✓ 잠금 획득 ($who). 끝나면 tools/run.sh finish \"메시지\"" ;;
  watch)  need_lock; $PY tools/watch_sources.py || true; $PY tools/review_list.py ;;
  dates)  need_lock; $PY tools/release_dates.py ;;
  verify) need_lock; $PY tools/verify_licenses.py ;;
  pages)  need_lock; node tools/build_pages.js ;;
  check)  $PY tools/validate.py ;;
  all)    need_lock; $PY tools/watch_sources.py || true; $PY tools/review_list.py; $PY tools/release_dates.py; $PY tools/verify_licenses.py; node tools/build_pages.js; $PY tools/validate.py ;;
  finish)
    need_lock; msg="${2:?커밋 메시지가 필요합니다}"
    $PY tools/validate.py
    git rm -q --cached "$LOCK" 2>/dev/null || true; rm -f "$LOCK"
    git add -A && git commit -q -m "$msg" && git pull --rebase --quiet && git push -q
    echo "✓ 커밋·푸시 완료, 잠금 해제. NAS 패널에서 '받아와 재배포'를 누르세요." ;;
  unlock) rm -f "$LOCK"; git rm -q --cached "$LOCK" 2>/dev/null || true; git commit -q -m "chore: 작업 잠금 강제 해제" && git push -q; echo "✓ 잠금 해제" ;;
  *) sed -n '2,13p' "$0" ;;
esac
