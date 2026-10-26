-- 필사독서(type.letsum.app) 선택 회원 — 2026-11-02 시행
-- 회원: 로그인 서비스 이름 + 회원 고유번호의 HMAC 해시(원래 번호는 저장하지 않음). 이메일·이름 없음
CREATE TABLE IF NOT EXISTS tb_users (
  id        TEXT PRIMARY KEY,
  provider  TEXT NOT NULL,
  sub_hash  TEXT NOT NULL,
  nickname  TEXT,
  created   INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  UNIQUE (provider, sub_hash)
);
CREATE INDEX IF NOT EXISTS tb_users_seen ON tb_users(last_seen);

-- 로그인 유지: 쿠키 값의 SHA-256 해시만
CREATE TABLE IF NOT EXISTS tb_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created    INTEGER NOT NULL,
  expires    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tb_sessions_user ON tb_sessions(user_id);
CREATE INDEX IF NOT EXISTS tb_sessions_exp ON tb_sessions(expires);

-- 동기화한 필사 기록: 키(progress:<책>, days, prefs, shelf, keys …) × 값(JSON 문자열). 합치기는 브라우저가 한다
CREATE TABLE IF NOT EXISTS tb_data (
  user_id TEXT NOT NULL,
  k       TEXT NOT NULL,
  v       TEXT NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (user_id, k)
);
CREATE INDEX IF NOT EXISTS tb_data_upd ON tb_data(user_id, updated);
