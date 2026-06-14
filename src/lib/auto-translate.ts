// Automatic full-app translator.
// Walks visible text nodes and translates them via Lovable AI when the
// selected UI language differs from the source language (Arabic).
// Translations are cached in localStorage so each phrase is translated once
// per language.

import { translateBatch } from "@/lib/translate.functions";

const SOURCE_LANG = "ar";
const CACHE_PREFIX = "giant.translate.v1:";
const PENDING_MARK = "data-gt-pending";
const ORIG_MARK = "data-gt-orig";

// Detect Arabic characters — only translate nodes that contain Arabic.
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

let currentLang = SOURCE_LANG;
let observer: MutationObserver | null = null;
let scheduled = false;
let cache: Record<string, string> = {};
let inFlight = new Set<string>();

function loadCache(lang: string) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang);
    cache = raw ? JSON.parse(raw) : {};
  } catch { cache = {}; }
}
function persistCache(lang: string) {
  try { localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(cache)); } catch {/* ignore quota */}
}

function isTranslatableNode(node: Node): node is Text {
  if (node.nodeType !== Node.TEXT_NODE) return false;
  const text = node.nodeValue ?? "";
  const trimmed = text.trim();
  if (trimmed.length < 1) return false;
  if (!ARABIC_RE.test(trimmed)) return false;
  const parent = node.parentElement;
  if (!parent) return false;
  const tag = parent.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "CODE" || tag === "PRE") return false;
  if (parent.closest("[data-gt-skip]")) return false;
  return true;
}

function collectTextNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (isTranslatableNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
}

function collectAttrTargets(root: Element): Array<{ el: Element; attr: string; value: string }> {
  const ATTRS = ["placeholder", "title", "aria-label"];
  const out: Array<{ el: Element; attr: string; value: string }> = [];
  const all = root.querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label]");
  all.forEach((el) => {
    if (el.closest("[data-gt-skip]")) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && ARABIC_RE.test(v)) out.push({ el, attr: a, value: v });
    }
  });
  return out;
}

function applyText(node: Text, original: string, translated: string) {
  const parent = node.parentElement;
  if (!parent) return;
  if (!parent.hasAttribute(ORIG_MARK + "-" + hashKey(original))) {
    // Store original on the text node via a custom property so we can restore on language switch.
    (node as Text & { __gtOrig?: string }).__gtOrig = original;
  }
  node.nodeValue = node.nodeValue?.replace(original, translated) ?? translated;
}

function hashKey(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

function restoreAllOriginals(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text & { __gtOrig?: string };
    if (t.__gtOrig) {
      t.nodeValue = t.__gtOrig;
      delete t.__gtOrig;
    }
  }
  const all = document.querySelectorAll<HTMLElement>("[data-gt-orig-attrs]");
  all.forEach((el) => {
    try {
      const map = JSON.parse(el.getAttribute("data-gt-orig-attrs") || "{}") as Record<string, string>;
      for (const [k, v] of Object.entries(map)) el.setAttribute(k, v);
      el.removeAttribute("data-gt-orig-attrs");
    } catch {/* ignore */}
  });
}

function scheduleScan() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    void scanAndTranslate();
  });
}

async function scanAndTranslate() {
  if (currentLang === SOURCE_LANG) return;
  const target = currentLang;

  const textNodes = collectTextNodes(document.body);
  const attrTargets = collectAttrTargets(document.body);

  // Unique phrases needing translation.
  const needed = new Set<string>();
  for (const node of textNodes) {
    const txt = (node.nodeValue ?? "").trim();
    if (!txt) continue;
    if (cache[txt]) {
      // Apply cached
      node.nodeValue = (node.nodeValue ?? "").replace(txt, cache[txt]);
      (node as Text & { __gtOrig?: string }).__gtOrig ??= txt;
    } else if (!inFlight.has(txt)) {
      needed.add(txt);
    }
  }
  for (const { el, attr, value } of attrTargets) {
    if (cache[value]) {
      const origMap = JSON.parse(el.getAttribute("data-gt-orig-attrs") || "{}");
      origMap[attr] = value;
      el.setAttribute("data-gt-orig-attrs", JSON.stringify(origMap));
      el.setAttribute(attr, cache[value]);
    } else if (!inFlight.has(value)) {
      needed.add(value);
    }
  }

  if (needed.size === 0) return;

  // Batch into groups of 40.
  const arr = [...needed];
  arr.forEach((s) => inFlight.add(s));
  const BATCH = 40;
  for (let i = 0; i < arr.length; i += BATCH) {
    const batch = arr.slice(i, i + BATCH);
    try {
      const res = await translateBatch({ data: { texts: batch, target, source: SOURCE_LANG } });
      const translations = (res as { translations: string[] }).translations;
      batch.forEach((src, idx) => {
        const tr = translations[idx];
        if (tr && tr !== src) cache[src] = tr;
        inFlight.delete(src);
      });
      persistCache(target);
      // Apply newly translated to current DOM.
      applyCacheToDom();
    } catch (e) {
      console.warn("[auto-translate] batch failed", e);
      batch.forEach((s) => inFlight.delete(s));
    }
  }
}

function applyCacheToDom() {
  const textNodes = collectTextNodes(document.body);
  for (const node of textNodes) {
    const txt = (node.nodeValue ?? "").trim();
    if (txt && cache[txt]) {
      (node as Text & { __gtOrig?: string }).__gtOrig ??= txt;
      node.nodeValue = (node.nodeValue ?? "").replace(txt, cache[txt]);
    }
  }
  const attrTargets = collectAttrTargets(document.body);
  for (const { el, attr, value } of attrTargets) {
    if (cache[value]) {
      const origMap = JSON.parse(el.getAttribute("data-gt-orig-attrs") || "{}");
      if (!origMap[attr]) origMap[attr] = value;
      el.setAttribute("data-gt-orig-attrs", JSON.stringify(origMap));
      el.setAttribute(attr, cache[value]);
    }
  }
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((muts) => {
    let dirty = false;
    for (const m of muts) {
      if (m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)) dirty = true;
      else if (m.type === "characterData") dirty = true;
      else if (m.type === "attributes") dirty = true;
      if (dirty) break;
    }
    if (dirty) scheduleScan();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "title", "aria-label"],
  });
}

export function setAutoTranslateLanguage(lang: string) {
  if (typeof document === "undefined") return;
  if (lang === currentLang) return;

  // Always restore originals first so a fresh language can be applied cleanly.
  restoreAllOriginals(document.body);
  currentLang = lang;
  inFlight = new Set();

  if (lang === SOURCE_LANG) {
    // Source language: just ensure observer is off.
    if (observer) { observer.disconnect(); observer = null; }
    return;
  }

  loadCache(lang);
  applyCacheToDom();
  scheduleScan();
  startObserver();
}
