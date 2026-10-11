-- 좋아요: 폰트 × 방문자(IP를 비밀 소금과 섞은 해시 — 원래 IP는 저장하지 않음)
CREATE TABLE IF NOT EXISTS likes (
  font_id TEXT NOT NULL,
  voter   TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (font_id, voter)
);
CREATE INDEX IF NOT EXISTS likes_font ON likes(font_id);

-- 댓글: 닉네임·본문만. 신고 3회면 자동 숨김, 관리자가 숨김/복구/삭제
CREATE TABLE IF NOT EXISTS comments (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  font_id TEXT NOT NULL,
  name    TEXT NOT NULL,
  body    TEXT NOT NULL,
  voter   TEXT NOT NULL,
  created INTEGER NOT NULL,
  hidden  INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS comments_font ON comments(font_id, hidden, created);
CREATE INDEX IF NOT EXISTS comments_voter ON comments(voter, created);

-- 신고 중복 방지
CREATE TABLE IF NOT EXISTS reports (
  comment_id INTEGER NOT NULL,
  voter      TEXT NOT NULL,
  PRIMARY KEY (comment_id, voter)
);
