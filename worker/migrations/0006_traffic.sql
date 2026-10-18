-- 방문 통계(자체 집계): 날짜·항목·값별 합계만. IP·쿠키·방문자 식별값·전체 유입 주소는 저장하지 않는다.
-- dim 예: pv(페이지뷰) · visit(방문) · hour(시간대 00~23, 한국 시간) · path(본 페이지) · land(첫 페이지)
--         src(유입 채널) · ref(유입 사이트 주소의 호스트) · kw(외부 검색어 '엔진|검색어') · sq(사이트 내 검색어) · sq0(결과 없는 검색어)
--         country · dev(기기) · br(브라우저) · os · utm('source / medium / campaign') · err(스크립트 오류 요약) · bot(검색 로봇)
CREATE TABLE IF NOT EXISTS traffic (
  day TEXT NOT NULL,
  dim TEXT NOT NULL,
  key TEXT NOT NULL DEFAULT '',
  n   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, dim, key)
);
CREATE INDEX IF NOT EXISTS traffic_dim ON traffic(dim, day);
