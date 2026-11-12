"""AI 봇 차단 규칙 생성: tools/state/ai_bots.json → robots.txt 두 개, nginx 차단 map, API 워커 차단 정규식.

- html/robots.txt, html/type/robots.txt: 머리 주석과 `User-agent: *` 이후는 그대로 두고 그 사이 봇 규칙만 다시 쓴다.
- nginx/default.conf: `# >>> ai-bots` ~ `# <<< ai-bots` 사이의 map을 다시 쓴다. 목록의 User-Agent면 $ai_deny = 1
  (robots.txt만은 읽게 둔다). 각 server 블록의 `if ($ai_deny) { return 403; }`가 이것을 쓴다.
- worker/src/ai_bots.js: 같은 정규식(API 요청 403).
robots.txt는 지키는 봇에게만 통하고, User-Agent를 숨기는 봇은 서버 규칙으로도 못 막는다 — 그 부분은 Cloudflare의
AI 봇 차단(대시보드 설정)이 맡는다. 사용법: python3 -I tools/build_ai_block.py
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIST = ROOT / "tools/state/ai_bots.json"
ROBOTS = [ROOT / "html/robots.txt", ROOT / "html/type/robots.txt"]
NGINX = ROOT / "nginx/default.conf"
WORKER = ROOT / "worker/src/ai_bots.js"
BEGIN, END = "# >>> ai-bots (tools/build_ai_block.py가 생성 — 직접 고치지 말 것)", "# <<< ai-bots"


def main():
    groups = json.loads(LIST.read_text())["groups"]
    ua = [b for g in groups if not g.get("robots_only") for b in g["bots"]]
    pattern = "|".join(re.escape(b).replace("\\ ", " ") for b in ua)

    for path in ROBOTS:
        text = path.read_text()
        head = text[:text.index("\n\n") + 2]  # 맨 위 설명 주석 덩어리(빈 줄까지)만 — 첫 그룹 이름 주석은 body가 다시 쓴다
        tail = text[text.index("User-agent: *"):]
        body = "".join(f"# {g['label']}\n" + "".join(f"User-agent: {b}\nDisallow: /\n\n" for b in g["bots"]) for g in groups)
        path.write_text(head + body + tail)

    block = (f"{BEGIN}\n# 목록: tools/state/ai_bots.json. 목록의 봇은 robots.txt 말고는 403.\n"
             f"map $http_user_agent $ai_bot {{\n  default 0;\n  \"~*({pattern})\" 1;\n}}\n"
             f"map \"$ai_bot:$uri\" $ai_deny {{\n  default 0;\n  \"~^1:(?!/robots\\.txt$)\" 1;\n}}\n{END}\n")
    conf = NGINX.read_text()
    if BEGIN in conf:
        conf = conf[:conf.index(BEGIN)] + block + conf[conf.index(END) + len(END) + 1:]
    else:
        conf = block + "\n" + conf
    NGINX.write_text(conf)

    WORKER.write_text("// tools/build_ai_block.py가 생성 — 직접 고치지 말 것(목록: tools/state/ai_bots.json)\n"
                      f"export const AI_BOT_RE = /({pattern})/i;\n")
    print(f"AI 봇 {len(ua)}종(서버 차단) · robots.txt 전용 {sum(len(g['bots']) for g in groups if g.get('robots_only'))}종")


if __name__ == "__main__":
    main()
