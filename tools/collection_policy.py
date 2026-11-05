"""Shared collection/publication exclusion policy; works under python -I via runpy."""
import json, re, unicodedata
from pathlib import Path
RULES = json.loads((Path(__file__).parent / 'state/collection_blocks.json').read_text())
def normalized(value):
    return re.sub(r'[^a-z0-9가-힣]', '', unicodedata.normalize('NFKC', value).casefold())
def blocked(record):
    text = normalized(json.dumps(record, ensure_ascii=False))
    return any(normalized(rule['token']) in text for rule in RULES)
