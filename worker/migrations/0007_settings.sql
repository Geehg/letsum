-- 관리자가 고치는 사이트 설정(키별 JSON 한 줄). 예: samples = 예시 문장 목록 [{ cat, t, src }]
CREATE TABLE IF NOT EXISTS settings (
  key     TEXT PRIMARY KEY,
  data    TEXT NOT NULL,
  updated INTEGER NOT NULL
);
