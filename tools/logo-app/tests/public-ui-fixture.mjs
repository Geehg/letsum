/* A deliberately small DOM/event fixture for the actual public app module.
 * It does not replace browser integration tests. It observes rendered HTML,
 * bookmarks, events and download failures without external packages or network.
 */
import vm from 'node:vm';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import * as core from '../src/core.js';
import { bundleModule } from '../scripts/build.mjs';
import { PROJECT_ROOT, canonicalSha256 } from '../scripts/lib.mjs';
const decode = value => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function parseAttributes(source) {
  const result = {};
  for (const match of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) result[match[1]] = decode(match[2] ?? match[3] ?? match[4] ?? '');
  return result;
}
export async function runPublicUi(data, { route = '/', saved = [], downloadFailure = null } = {}) {
  const windowListeners = new Map(), documentListeners = new Map(), downloads = [], objectUrls = [], revokedUrls = [];
  const storageKey = 'letsum-logo:saved:v1';
  const storage = new Map([[storageKey, JSON.stringify(saved)]]);
  let document;
  class FixtureElement {
    constructor(tag = 'div', attributes = {}) {
      this.tagName = tag.toUpperCase(); this.attributes = {}; this.dataset = {}; this.listeners = new Map(); this.nodes = []; this.textContent = ''; this._html = ''; this.parentElement = null;
      const classes = new Set();
      this.classList = { add: (...values) => values.forEach(value => classes.add(value)), remove: (...values) => values.forEach(value => classes.delete(value)), contains: value => classes.has(value), toggle: (value, force) => { const enable = force === undefined ? !classes.has(value) : Boolean(force); if (enable) classes.add(value); else classes.delete(value); return enable; }, toString: () => [...classes].join(' ') };
      for (const [name, value] of Object.entries(attributes)) this.setAttribute(name, value);
      this.value ??= ''; this.type ??= this.tagName === 'INPUT' ? 'text' : ''; this.checked ??= false; this.disabled ??= false;
    }
    setAttribute(name, value) {
      value = String(value); this.attributes[name] = value;
      if (name === 'id') this.id = value;
      if (name === 'class') { this.className = value; value.split(/\s+/).filter(Boolean).forEach(item => this.classList.add(item)); }
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      if (['value', 'type', 'name', 'href', 'download'].includes(name)) this[name] = value;
      if (name === 'checked') this.checked = true;
      if (name === 'disabled') this.disabled = true;
    }
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
    removeAttribute(name) { delete this.attributes[name]; }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
      this._html = String(value); this.nodes = [];
      for (const match of this._html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
        const attrs = parseAttributes(match[2]);
        const node = match[1].toLowerCase() === 'input' ? new FixtureInput(attrs) : new FixtureElement(match[1], attrs);
        node.parentElement = this; this.nodes.push(node);
      }
    }
    matches(selector) {
      if (selector.includes(',')) return selector.split(',').some(part => this.matches(part.trim()));
      if (selector.startsWith('#')) return this.id === selector.slice(1);
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      const attr = selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
      if (attr) return Object.prototype.hasOwnProperty.call(this.attributes, attr[1]) && (attr[2] === undefined || this.attributes[attr[1]] === attr[2]);
      return this.tagName.toLowerCase() === selector.toLowerCase();
    }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    querySelectorAll(selector) { return this.nodes.filter(node => node.matches(selector)); }
    addEventListener(type, listener) { const listeners = this.listeners.get(type) ?? []; listeners.push(listener); this.listeners.set(type, listeners); }
    removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== listener)); }
    dispatch(type, extra = {}) {
      const event = { type, currentTarget: this, target: this, preventDefault() { this.defaultPrevented = true; }, ...extra };
      for (const listener of this.listeners.get(type) ?? []) listener(event);
      return event;
    }
    click() {
      if (this.disabled) return;
      if (this.tagName === 'A' && this.download) {
        if (downloadFailure === 'click') throw new Error('Synthetic download click failure');
        downloads.push({ filename: this.download, href: this.href });
      }
      this.dispatch('click');
    }
    append(node) { node.parentElement = this; this.nodes.push(node); }
    appendChild(node) { this.append(node); return node; }
    remove() { if (this.parentElement) this.parentElement.nodes = this.parentElement.nodes.filter(node => node !== this); this.removed = true; }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    showModal() { this.open = true; }
  }
  class FixtureInput extends FixtureElement { constructor(attributes) { super('input', attributes); this.selectionStart = 0; this.selectionEnd = 0; } }
  const app = new FixtureElement('main', { id: 'app' });
  const toast = new FixtureElement('div', { id: 'toast' });
  const savedCount = new FixtureElement('span', { id: 'saved-count' });
  const skip = new FixtureElement('a', { class: 'skip-link', href: '#main-content' });
  const navs = ['search', 'saved', 'guide'].map(nav => new FixtureElement('a', { 'data-nav': nav }));
  const body = new FixtureElement('body');
  const fixed = [app, toast, savedCount, skip, ...navs];
  body.nodes = [...fixed]; fixed.forEach(node => { node.parentElement = body; });
  const allNodes = () => [...fixed, ...app.nodes, ...body.nodes.filter(node => !fixed.includes(node))];
  document = {
    body, title: '', activeElement: body,
    querySelector: selector => allNodes().find(node => node.matches(selector)) ?? null,
    querySelectorAll: selector => allNodes().filter(node => node.matches(selector)),
    getElementById: id => allNodes().find(node => node.id === id) ?? null,
    createElement: tag => tag.toLowerCase() === 'input' ? new FixtureInput({}) : new FixtureElement(tag),
    addEventListener(type, listener) { const list = documentListeners.get(type) ?? []; list.push(listener); documentListeners.set(type, list); }
  };
  class FixtureURL extends URL {
    static createObjectURL(blob) {
      if (downloadFailure === 'create') throw new Error('Synthetic object URL failure');
      const url = `blob:letsum-test/${objectUrls.length}`; objectUrls.push({ url, blob }); return url;
    }
    static revokeObjectURL(url) { revokedUrls.push(url); }
  }
  class FixtureFormData {
    constructor(form) { this.values = new Map(Object.entries(form.formValues ?? {})); }
    get(key) { return this.values.get(key) ?? null; }
    entries() { return this.values.entries(); }
    [Symbol.iterator]() { return this.values[Symbol.iterator](); }
  }
  const context = {
    ...core, console, document, URL: FixtureURL, URLSearchParams, Blob, FormData: FixtureFormData, HTMLInputElement: FixtureInput,
    location: { hash: `#${route}` }, navigator: {},
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    setTimeout: () => 1, clearTimeout() {},
    renderReview: () => '', bindReview: () => null,
    scrollTo() {},
    addEventListener(type, listener) { const list = windowListeners.get(type) ?? []; list.push(listener); windowListeners.set(type, list); },
    __LETSUM_BOOTSTRAP__: { ...structuredClone(data), initialRoute: route, version: '0.1.0', catalogSha256: canonicalSha256(data.catalog) }
  };
  context.window = context;
  const appCode = await readFile(path.join(PROJECT_ROOT, 'src/app.js'), 'utf8');
  vm.runInNewContext(bundleModule(appCode, 'app.js'), context, { filename: 'actual-public-app.js', timeout: 3000 });
  return { app, toast, savedCount, storage, storageKey, downloads, objectUrls, revokedUrls, document, context, dispatchWindow(type, event) { for (const listener of windowListeners.get(type) ?? []) listener(event); } };
}
