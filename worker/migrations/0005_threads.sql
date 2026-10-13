-- 리뷰 대화: 답글(한 단계) · 댓글 좋아요 · (나중) 회원 연결 칸
ALTER TABLE comments ADD COLUMN parent_id INTEGER;
ALTER TABLE comments ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS comments_parent ON comments(parent_id);
CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id INTEGER NOT NULL,
  voter      TEXT NOT NULL,
  created    INTEGER NOT NULL,
  PRIMARY KEY (comment_id, voter)
);
CREATE INDEX IF NOT EXISTS comment_likes_voter ON comment_likes(voter, created);
