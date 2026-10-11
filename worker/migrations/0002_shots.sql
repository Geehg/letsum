-- 사용 사례 사진: 방문자가 올리면 pending, 관리자가 승인하면 approved로 공개. 거절은 즉시 삭제.
-- 이미지는 브라우저에서 줄인 WebP/JPEG(최대 700KB)를 D1에 그대로 저장(무료 5GB 한도 안).
CREATE TABLE IF NOT EXISTS shots (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  font_id  TEXT NOT NULL,
  name     TEXT NOT NULL,
  caption  TEXT NOT NULL DEFAULT '',
  mime     TEXT NOT NULL,
  bytes    INTEGER NOT NULL,
  data     BLOB NOT NULL,
  voter    TEXT NOT NULL,
  created  INTEGER NOT NULL,
  status   TEXT NOT NULL DEFAULT 'pending',
  approved INTEGER
);
CREATE INDEX IF NOT EXISTS shots_font ON shots(font_id, status, id);
CREATE INDEX IF NOT EXISTS shots_status ON shots(status, created);
CREATE INDEX IF NOT EXISTS shots_voter ON shots(voter, created);
