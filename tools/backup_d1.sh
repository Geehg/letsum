#!/bin/sh
# LETSUM 댓글·좋아요·사진·이용 지표(Cloudflare D1) 백업 — NAS 작업 스케줄러에서 주 1회 실행.
# 개인정보 성격의 데이터(IP 해시·닉네임·사진)가 있으므로 공개 저장소가 아니라 NAS 안에만 보관한다.
# 준비: 같은 폴더에 .letsum_admin_key 파일(내용 = Worker의 ADMIN_KEY, 권한 600)
# 사용: sh /volume1/docker/letsum/tools/backup_d1.sh   → /volume1/docker/letsum-backup/letsum-d1-YYYY-MM-DD.json.gz (최근 12주 보관)
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
KEY_FILE="${LETSUM_KEY_FILE:-$DIR/.letsum_admin_key}"
OUT="${LETSUM_BACKUP_DIR:-/volume1/docker/letsum-backup}"
[ -r "$KEY_FILE" ] || { echo "관리자 키 파일 없음: $KEY_FILE"; exit 1; }
mkdir -p "$OUT"
F="$OUT/letsum-d1-$(date +%F).json"
curl -fsS --max-time 120 -H "authorization: Bearer $(cat "$KEY_FILE")" https://letsum.app/api/admin/export -o "$F.tmp"
grep -q '"exported"' "$F.tmp" || { echo "응답이 백업 형식이 아님"; rm -f "$F.tmp"; exit 1; }
mv "$F.tmp" "$F" && gzip -f "$F"
ls -1t "$OUT"/letsum-d1-*.json.gz | tail -n +13 | xargs -r rm -f
echo "백업 완료: $F.gz ($(du -h "$F.gz" | cut -f1))"
