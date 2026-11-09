# LETSUM Logo implementation contract

Version: 0.1.0 / 2026-11-09. This repository is an executable Codex handoff project. It uses dependency-free Node.js >=22 for build, local server, checks and tests, and browser-native HTML/CSS/JavaScript for the UI. The existing production repository has not been modified.

## Shared files and ownership

- Root: src/app.js, src/styles.css, src/shell.html, README.md, docs/CODEX_HANDOFF.md, docs/STATUS.md.
- Data agent: data/catalog.json and data/sources.json, docs/DATA_REVIEW.md only.
- Tooling agent: src/core.js, scripts/*, schemas/*, tests/*, package.json, package-lock.json, data/taxonomy.json only.
- Review UI agent: src/review.js, src/review.css, docs/REVIEW_WORKFLOW.md only.

## Dataset

`data/catalog.json` is an object `{schema_version:"1.0", version:"0.1.0", updated_at:"2026-11-09", scope_note:string, records:Record[]}`.

Record fields (all required unless nullable/optional indicated):

```json
{
  "id": "goyang-city-logo",
  "organization_id": "goyang-city",
  "organization_name": "고양특례시",
  "name": "고양특례시 시 로고",
  "name_en": null,
  "aliases": ["고양시"],
  "category": "local-government",
  "kind": "organization",
  "sectors": ["administration"],
  "country": "KR",
  "region": "경기",
  "summary": "공식 페이지에서 안내하는 시 로고와 색상·사용규정입니다.",
  "source_ids": ["goyang-ci"],
  "source_url": "https://www.goyang.go.kr/www/www05/www05_3/www05_3_10.jsp",
  "guideline_url": "https://www.goyang.go.kr/www/www05/www05_3/www05_3_10.jsp",
  "assets": [
    {"id":"goyang-logotype","label":"시 로고타입","form":"wordmark","listed_formats":["AI","PNG"],"verified_format":null,"size_bytes":null,"sha256":null,"download_url":null,"access":"public","source_id":"goyang-ci","file_verification":"page-listed"}
  ],
  "usage": {"summary":"영리 목적 물품·행사 이용 승인 안내가 있습니다.","approval":"conditional","redistribution":"unknown","preview":"unknown","policy_url":"https://www.goyang.go.kr/www/www05/www05_3/www05_3_10.jsp"},
  "version": {"status":"unconfirmed","introduced_at":null,"label":null},
  "review": {"status":"source-reviewed","checked_at":"2026-11-09","source_scope":"page"},
  "related_fonts": []
}
```

- Example is the schema shape; data agent verifies its factual values before inclusion.
- category: national-government / local-government / public-organization / education / business / nonprofit / intergovernmental.
- kind: organization / city-brand / product / service / campaign / anniversary.
- sector codes follow the preceding taxonomy document: administration, education, research-science, healthcare, welfare, culture-arts, tourism, sports, environment, transport-logistics, energy, finance, ict-digital, industry-manufacturing, agriculture-food, housing-construction, safety-defense, international-cooperation.
- asset form: symbol / wordmark / signature / emblem / slogan / character / guide.
- access: public / login / request / information / unknown. Public means the official page lists a publicly offered file, not a successful binary download.
- file_verification: page-listed / link-checked / file-verified / not-provided. Binary metadata is null unless file-verified. No file-verified seed is expected.
- page-listed may have listed_formats:[] when the official page offers a download without naming the format. Do not invent a format to satisfy a display label.
- usage approval: required / conditional / not-stated / unknown. Redistribution and preview: permitted / conditional / restricted / unknown. No preview images are included without a confirmed basis.
- version status: current / historical / unconfirmed. A live official URL alone does not establish current status.
- review status: source-reviewed / needs-review / draft / archived. Source-reviewed is research status, not an endorsement or production publication authorization.
- `source-reviewed` requires a checked_at date and a source_scope of page/search. `needs-review` and `draft` permit null checked_at/source_scope; meaningful edits must set both to null.
- country: ISO-like country code or null. region: short Korean region label or null, only when supported.
- related_fonts: `{name:string, source_url:string}`; relationship must be officially supported.
- No official source, policy, introduction date, file type or classification may be invented.
- `data/sources.json`: `{updated_at, sources:[{id,title,url,publisher,language,checked_at,scope:"page"|"search",observation,note}]}`.
- `data/taxonomy.json`: `{categories:[{id,label}], sectors:[{id,label}], asset_forms:[{id,label}], formats:[strings], access:[{id,label}], identity_kinds:[{id,label}]}`.

## Core API (tooling agent)

`src/core.js` exports: normalizeText(value), getChoseong(value), searchScore(record,query), filterRecords(records,filters), getFormats(record), summarize(records), validateCatalog(catalog,sources,taxonomy), escapeHtml(value), safeUrl(value).

- `filters`: `{q:"",category:"all",sector:"all",format:"all",region:"all",access:"all",includeHistorical:false,sort:"relevance"|"name"|"checked",savedOnly:false,savedIds:[]}`.
- filterRecords returns sorted Record[] and does not mutate records. Exclude draft/archived from the public list; needs-review stays visible with its badge. Historical records only with includeHistorical.
- Search supports exact name/alias/English, substring, Hangul initials and space-separated token AND; standalone format tokens such as AI/PNG/SVG can filter file formats. Do not interpret the AI substring in a name such as KAI as a file filter.
- getFormats returns unique listed format labels, not binary verification claims.
- summarize returns `{records:number,organizations:number,categories:number,formats:number}`.
- validateCatalog returns `{errors:string[],warnings:string[]}`. Enforce schema/reference/URL/status/file-metadata invariants with meaningful tests.
- safeUrl returns a http(s) URL string when safe, otherwise null. No javascript:, data:, credentials, fragments-only or control-character URLs.

## Frontend/bootstrap and build contract

- src/app.js uses ES imports from `./core.js` and `./review.js`. No third-party browser code.
- src/review.js can import core.js. It exports `renderReview({catalog,sources,taxonomy,catalogSha256})` (HTML string), and `bindReview({root,catalog,sources,taxonomy,catalogSha256,notify})` (bind handlers). It owns no global page routing and does not directly mutate seed catalog. Editing creates local patches and JSON export with original review metadata invalidated for meaningful changes.
- `window.__LETSUM_BOOTSTRAP__ = {catalog,sources,taxonomy,initialRoute:"/",version:"0.1.0",catalogSha256}`; `sources` is the whole sources document and catalogSha256 is SHA-256 over UTF-8 JSON.stringify(catalog). `#` routing: `/`, `/brand/{id}`, `/saved`, `/guide`, `/review`, `/suggest`.
- shell template placeholders: `__TITLE__`, `__DESCRIPTION__`, `__STYLE__`, `__DATA__` (JSON for bootstrap), `__SCRIPT__` (bundled module code), `__FALLBACK__` (escaped static fallback markup), `__CANONICAL__` (empty unless explicit deployed base URL configured).
- shell contains `<main id="app">__FALLBACK__</main>`, bootstrap inline script, module script, shared nav/footer supplied by root. Build must escape `<` in serialized JSON and guard closing script/style sequences.
- Scripts build emits `dist/index.html` (self-contained, works by file open), `dist/brands/{id}/index.html` with initialRoute and title/summary/source in actual fallback HTML, and `dist/review.html` with initialRoute `/review`. Also emit `dist/data/*.json`. Do not bundle review-only data from any private source; all seed data is public.
- Build concatenation order: core.js (strip named export declarations), review.js (strip relative import declarations and named export declarations), app.js (strip relative imports). This is a documented local compiler for these three files, not a general bundler. Support only known relative module imports and reject unrecognized imports.
- CSS = styles.css + review.css. Shell title/description escaped. No live site URL is asserted or invented.
- Local server bound to 127.0.0.1 by default, serves dist, sensible MIME, path traversal protection. No external API or file mutation endpoint.
- Link checker is read-only; classify redirects, 401/403/429, TLS/timeouts, soft failures independently. Never changes review state, source URLs, policies or file verification. Default checks official source pages, not binary assets; writes dated report only.
- Import review patches CLI validates base data hash/version, editable field allowlist, schema, and review invalidation; dry-run default, explicit `--write` for local data update. Do not auto-publish.
- Review patch contract: `{schema_version:"1.0",dataset_version:catalog.version,base_sha256:SHA256(JSON.stringify(catalog)),created_at,patches:[{id,changes,review_note}]}`. The hash uses parsed canonical JSON serialization, not raw JSON file bytes. Editable fields: name, name_en, aliases, category, kind, sectors, country, region, summary, source_url, guideline_url, usage.summary. No other usage fields or review/file/version status promotion is accepted. Meaningful edits force `review:{status:"needs-review",checked_at:null,source_scope:null}` during import.
- If a meaningfully edited record was current, import conservatively changes version.status to unconfirmed and records current_status_invalidated in the audit. Notes-only patches retain review and version state. This is invalidation, never automatic promotion.
- Root will provide the app shell and run end-to-end checks after integrating all files.

