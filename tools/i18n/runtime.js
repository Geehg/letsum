// Generated together with the reviewed dictionary by tools/build_ui_language.js.
// UI language is independent of LS_LANG (the Korean/Latin/dingbat font catalogue).
(function () {
  "use strict";
  if (window.LSUI) return;
  const words = /* UI_DICTIONARY */ {};
  const valid = value => value === "ko" || value === "en";
  const read = (storage, key) => { try { return window[storage].getItem(key); } catch (_) { return null; } };
  const write = (storage, key, value) => { try { window[storage].setItem(key, value); } catch (_) {} };
  const requested = new URL(location.href).searchParams.get("ui");
  let preference = valid(requested) ? requested : read("localStorage", "ls_ui_language");
  if (valid(requested)) write("localStorage", "ls_ui_language", requested);
  let cached = null;
  try { cached = JSON.parse(read("sessionStorage", "ls_ui_region")); } catch (_) {}
  if (!cached || !valid(cached.language) || !Number.isFinite(cached.time) || cached.time > Date.now() || Date.now() - cached.time > 30 * 60e3) cached = null;
  const fallback = /^ko(?:-|$)/i.test(navigator.languages?.[0] || navigator.language || "en") ? "ko" : "en";
  let language = valid(preference) ? preference : cached?.language || fallback;
  const attributes = ["title", "placeholder", "aria-label", "alt"];
  // Specimens, user text, code, installed font names and attribution remain verbatim.
  const excluded = 'script,style,code,pre,textarea,[contenteditable], [translate="no"], [data-ui-original], .r-pv,.g-pv,.pv,.pv-big,.t-pv,.mock,.fx [data-t],.sp-type,.sp-title,.sp-marquee,.sp-loupe,.ig-pv,.ig-sample,.ig-weights b,.fp-t,.fp-book p,.wc-pv,.c-pv,.rv-b>p,.ig-rtx,.pj-note,.sample';
  const textRecords = new WeakMap(), attrRecords = new WeakMap();
  let observer, ready = false;

  function english(value) {
    const s = String(value), key = s.trim();
    let translated = words[key];
    if (translated == null) {
      const rules = [
        [/^(.+)의 (산세리프|세리프|디스플레이|손글씨|고정폭) 서체\. (\d+)가지 굵기(\(가변 폰트\))?에 (.+) 문자를 지원하며, (.+)$/, (_, maker, style, n, variable, scripts, use) => `A ${english(style).toLowerCase()} typeface by ${maker}, with ${n} weights${variable ? ' (variable font)' : ''} and support for ${english(scripts)}. ${english(use)}`],
        [/^인도 타입 파운드리\(ITF\)가 Fontshare에서 OFL로 공개한 (산세리프|세리프|디스플레이|손글씨|고정폭) 서체\. (\d+)가지 굵기로, (.+)$/, (_, style, n, use) => `A ${english(style).toLowerCase()} typeface released by Indian Type Foundry (ITF) on Fontshare under the OFL, with ${n} weights. ${english(use)}`],
        [/^(.+) ×$/, (_, label) => `${english(label)} ×`],
        [/^무료 (한글|영문|딩벳) 폰트 · 상업용 무료 폰트 ([\d,]+)종 다운로드 — 라이선스 확인 \| LETSUM\(렛섬\)$/, (_, kind, n) => `${n} free ${kinds[kind]} fonts for commercial use | LETSUM`],
        [/^(.+) · 무료 폰트 다운로드 · 라이선스 확인 — LETSUM\(렛섬\)$/, (_, name) => `${name} · Free font downloads & license | LETSUM`],
        [/^(.+) 출시( ·)?$/, (_, date, dot) => `Released ${english(date)}${dot || ""}`],
        [/^([\d,]+)종 · (.+)$/, (_, n, weights) => `${n} weights · ${weights}`],
        [/^([\d,]+) \/ ([\d,]+)종$/, (_, n, total) => `${n} / ${total} fonts`],
        [/^굵기 ([\d,]+)종 중 일부$/, (_, n) => `Selection of ${n} weights`],
        [/^아이콘 ([\d,]+)개$/, (_, n) => `${n} icons`],
        [/^서로 다른 글자 ([\d,]+)자$/, (_, n) => `${n} unique characters`],
        [/^(.+)를 써 본 이야기$/, (_, name) => `Reviews of ${name}`],
        [/^(.+)에서 파일 바로 받기$/, (_, source) => `Download directly from ${source}`],
        [/^원 배포처 페이지\((.+)\)$/, (_, source) => `Official source (${source})`],
        [/^원 배포처\((.+)\)$/, (_, source) => `the official source (${source})`],
        [/^(.+) · 자동 다운로드 시작 · TTF\/OTF 설치용$/, (_, source) => `${source} · Automatic download · TTF/OTF for installation`],
        [/^(.+) — 사용 범위 보기$/, (_, license) => `${english(license)} — View permissions`],
        [/^원문 대조 완료 · 최근 확인일 (.+)$/, (_, date) => `Checked against the original · Last checked ${date}`],
        [/^굵기 밀도 (.+)% · 너비 (.+)em · 획 대비 (.+)$/, (_, d, w, c) => `Density ${d}% · Width ${w}em · Stroke contrast ${c}`],
        [/^— (.+)$/, (_, note) => words[note] ? `— ${words[note]}` : `— ${note}`],
        [/^(.+)·분위기에 어울리는 효과를 골라 이 글꼴로 바로 그렸습니다\. 포토샵·피그마·캔바의 외곽선·그림자·그라데이션 설정으로 비슷하게 만들 수 있습니다\.$/, () => 'Effects selected for this font’s style and mood. Recreate them using outlines, shadows and gradients in Photoshop, Figma or Canva.'],
        [/^무료 (한글|영문|딩벳) 폰트\s*$/, (_, kind) => `Free ${kinds[kind]} fonts `],
        [/^무료 (한글|영문|딩벳) 폰트 ([\d,]+)종$/, (_, kind, n) => `${n} free ${kinds[kind]} fonts`],
        [/^전체 (한글|영문|딩벳) 폰트 이름으로 찾기 \(([\d,]+)종\)$/, (_, kind, n) => `Browse all ${n} ${kinds[kind]} fonts by name`],
        [/^(가장 )?최근 출시된 (한글|영문|딩벳) 무료 폰트$/, (_, most, kind) => `Latest free ${kinds[kind]} fonts`],
        [/^이번 주 출시 ([\d,]+)종$/, (_, n) => `${n} releases this week`],
        [/^이번 주 출시된 (한글|영문|딩벳) 무료 폰트 ([\d,]+)종$/, (_, kind, n) => `${n} new ${kinds[kind]} fonts this week`],
        [/^좋아요 ([\d,]+)개$/, (_, n) => `${n} likes`],
        [/^댓글 ([\d,]+)개( 모두 보기)?$/, (_, n) => `View all ${n} comments`],
        [/^([\d,]+)종$/, (_, n) => `${n} fonts`],
        [/^\/ ([\d,]+)종$/, (_, n) => `/ ${n} fonts`],
        [/^굵기 ([\d,]+)종$/, (_, n) => `${n} weights`],
        [/^([\d,]+)개$/, (_, n) => n],
        [/^([\d,]+)장$/, (_, n) => `${n} images`],
        [/^([\d,]+)자$/, (_, n) => `${n} characters`],
        [/^(\d{4})년(?: (\d{1,2})월)?$/, (_, y, m) => m ? `${y}-${m.padStart(2, "0")}` : y],
        [/^— 출처:\s*(.*)$/, (_, source) => `— Source: ${source}`],
        [/^한글 ([\d,]+)자(.*)$/, (_, n, rest) => `${n} Hangul characters${rest}`],
        [/^(.+) 설치 방법 · (.+)$/, (_, name, os) => `Installing ${name} · ${os}`],
      ];
      for (const [pattern, replacement] of rules) if (pattern.test(key)) { translated = key.replace(pattern, replacement); break; }
      // UI metadata uses explicit separators; never replace arbitrary Korean substrings.
      if (translated == null && key.includes("·")) translated = key.split(/(\s*·\s*)/).map(part => part.includes("·") ? part : english(part)).join("");
      if (translated == null && /^#[^#]+(?:\s+#[^#]+)*$/.test(key)) translated = key.replace(/#([^\s#]+)/g, (_, tag) => "#" + (words[tag] || tag).replace(/\s+/g, ""));
    }
    return translated == null ? s : s.replace(key, translated);
  }
  const kinds = { 한글: "Korean", 영문: "Latin", 딩벳: "dingbat" };
  function textNode(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    let record = textRecords.get(node);
    if (!record || (node.data !== record.original && node.data !== record.translated)) {
      record = { original: node.data, translated: english(node.data) };
      // Editorial descriptions stay wholly in the original language until translated.
      if (node.parentElement.closest("[data-ui-editorial]") && /[가-힣]/.test(record.translated)) record.translated = record.original;
      textRecords.set(node, record);
    }
    const next = language === "en" ? record.translated : record.original;
    if (node.data !== next) {
      // An option without value uses its label as its value. Keep filter semantics stable.
      const option = node.parentElement;
      if (option.tagName === "OPTION" && !option.hasAttribute("value")) option.value = option.textContent;
      node.data = next;
    }
  }
  function element(node) {
    if (node.closest(excluded) && !node.matches("textarea,[contenteditable]")) return;
    if (node.hasAttribute("data-ui-editorial")) {
      const original = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => textRecords.get(child)?.original || child.data).join("");
      node.lang = /[가-힣]/.test(english(original)) ? "ko" : language;
    }
    for (const attr of attributes) if (node.hasAttribute(attr)) {
      let records = attrRecords.get(node);
      if (!records) { records = {}; attrRecords.set(node, records); }
      const current = node.getAttribute(attr);
      let r = records[attr];
      if (!r || (current !== r.original && current !== r.translated)) r = records[attr] = { original: current, translated: english(current) };
      const next = language === "en" ? r.translated : r.original;
      if (current !== next) node.setAttribute(attr, next);
    }
  }
  function translate(root) {
    if (root.nodeType === Node.TEXT_NODE) { textNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;
    if (root.nodeType === Node.ELEMENT_NODE) element(root);
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(excluded)) { element(node); return NodeFilter.FILTER_REJECT; }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walk.nextNode())) node.nodeType === Node.TEXT_NODE ? textNode(node) : element(node);
  }
  function connect() {
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
  }
  function apply() {
    document.documentElement.lang = language;
    document.documentElement.dataset.uiLanguage = language;
    if (!ready) return;
    observer.disconnect();
    translate(document);
    document.querySelectorAll("[data-ui-choice]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.uiChoice === language)));
    connect();
    document.dispatchEvent(new CustomEvent("ls:ui-language", { detail: { language } }));
  }
  function choose(next) {
    if (!valid(next)) return;
    language = preference = next;
    write("localStorage", "ls_ui_language", next);
    const url = new URL(location.href); url.searchParams.set("ui", next);
    history.replaceState(history.state, "", url);
    apply();
  }
  function localURL(value) {
    const url = new URL(value, document.baseURI);
    if (valid(preference) && url.origin === location.origin) url.searchParams.set("ui", preference);
    return url.href;
  }
  window.LSUI = { get language() { return language; }, t: s => language === "en" ? english(s) : s, english, choose, localURL };
  apply();
  if (!valid(preference) && !cached) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    fetch("/api/locale", { signal: controller.signal, cache: "no-store", credentials: "omit" })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (!valid(result?.language)) return;
        write("sessionStorage", "ls_ui_region", JSON.stringify({ language: result.language, time: Date.now() }));
        if (!valid(preference)) { language = result.language; apply(); }
      }).catch(() => {}).finally(() => clearTimeout(timer));
  }
  function init() {
    const header = document.querySelector("header .hd");
    if (header) {
      const control = document.createElement("div"); control.className = "ui-language";
      control.setAttribute("role", "group"); control.setAttribute("aria-label", "Language / 언어");
      control.setAttribute("translate", "no");
      for (const [value, label] of [["ko", "한국어"], ["en", "English"]]) {
        const button = document.createElement("button"); button.type = "button";
        button.lang = value; button.textContent = label; button.dataset.uiChoice = value;
        button.addEventListener("click", () => choose(value)); control.appendChild(button);
      }
      header.appendChild(control);
    }
    observer = new MutationObserver(records => {
      observer.disconnect();
      const roots = new Set();
      for (const record of records) {
        if (record.type === "childList") record.addedNodes.forEach(node => roots.add(node));
        else roots.add(record.target);
      }
      for (const node of roots) if (node.isConnected) translate(node);
      connect();
    });
    ready = true; apply();
    // Preserve a manual choice through same-origin navigation even if storage is blocked.
    document.addEventListener("click", event => {
      const a = event.target.closest?.("a[href]");
      if (!a || !valid(preference) || a.hasAttribute("download") || a.getAttribute("href").startsWith("#")) return;
      const url = new URL(a.href);
      if (url.origin === location.origin && !/^\/(api|admin|type)(\/|\.|$)/.test(url.pathname) && /(?:\/|\.html)$/.test(url.pathname)) {
        url.searchParams.set("ui", preference); a.href = url.href;
      }
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
