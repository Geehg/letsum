-- 히어로 브랜드 테마(관리자가 승인한 것만). data = JSON { bg, fg, ac, acInk, style, split, line[], src }
CREATE TABLE IF NOT EXISTS brand_themes (
  font_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL
);
