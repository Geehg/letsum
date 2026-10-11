-- 이용 지표: 날짜·행동·폰트별 합계만. IP·방문자 식별값·검색어·입력 문장은 저장하지 않는다.
CREATE TABLE IF NOT EXISTS events (
  day  TEXT NOT NULL,          -- YYYY-MM-DD (한국 시간)
  name TEXT NOT NULL,          -- 허용 목록의 행동 이름
  font TEXT NOT NULL DEFAULT '', -- 폰트 id 또는 보기·용도 같은 짧은 값('' = 없음)
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name, font)
);
