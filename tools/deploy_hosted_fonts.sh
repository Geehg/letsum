#!/usr/bin/env bash
# 재배포가 금지된(화면 표시만 허용된) 라이선스의 웹폰트를 letsum.app 서버(NAS)에만 올린다.
# 이 파일들은 공개 GitHub 저장소·미러에 올리지 않는다(.gitignore: html/fonts-hosted/).
# 원본: tools/archive/hosted/<폴더>/<굵기>.woff2  (배포처가 제공한 WOFF2를 그대로 — 변환·수정 없음)
# 대상: NAS /volume1/docker/letsum/html/fonts-hosted/<폴더>/  → https://letsum.app/fonts-hosted/<폴더>/<굵기>.woff2
# 사용: tools/deploy_hosted_fonts.sh            (운영 서버에 쓰는 작업이므로 운영자가 직접 실행하거나 허락한 뒤 실행)
set -euo pipefail
cd "$(dirname "$0")/.."
NAS="${LETSUM_NAS:-interq4@192.168.219.103}"
DEST=/volume1/docker/letsum/html/fonts-hosted
for d in tools/archive/hosted/*/; do
  name=$(basename "$d")
  ssh -o BatchMode=yes "$NAS" "mkdir -p '$DEST/$name'"
  scp -q -O "$d"*.woff2 "$NAS:$DEST/$name/"
  echo "✓ $name → https://letsum.app/fonts-hosted/$name/"
done
for f in tools/archive/hosted/*/*.woff2; do
  rel=${f#tools/archive/hosted/}
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "https://letsum.app/fonts-hosted/$rel")" "$rel"
done
