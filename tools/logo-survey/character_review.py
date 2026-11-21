"""Apply source-checked character catalog decisions after the automated survey."""
import json
from pathlib import Path


def apply_review(records, sources, thumbs, downloads, groups, rank):
    review = json.loads((Path(__file__).parent / "data" / "mascot-catalog-review.json").read_text())
    excluded = review["excluded"]
    records[:] = [record for record in records if record["id"] not in excluded]
    referenced = {sid for record in records for sid in record["source_ids"]}
    sources[:] = [source for source in sources if source["id"] in referenced]
    for mapping in (thumbs, downloads, groups, rank):
        for rid in excluded:
            mapping.pop(rid, None)

    by_source = {source["id"]: source for source in sources}
    for record in records:
        rid = record["id"]
        edit = review["corrections"].get(rid)
        if not edit:
            continue
        if "record" in edit:
            record.update(edit["record"])
            record["review"]["checked_at"] = edit["checked_at"]
            source = by_source[rid + "-src"]
            source.update(title=record["name"] + " 공식 소개", publisher=record["organization_name"],
                          url=record["source_url"], observation=record["summary"], checked_at=edit["checked_at"],
                          language=edit.get("language", "ko"), note="공식 캐릭터 소개 자료를 대조했습니다.")
        if "thumbnail" in edit:
            if edit["thumbnail"] is None:
                if thumbs.get(rid, {}).get("source_url") == edit["rejected_image_url"]:
                    thumbs.pop(rid)
            else:
                thumbs[rid] = edit["thumbnail"]
        if edit.get("discard_imported_score"):
            rank[rid] = {"score": 0}
