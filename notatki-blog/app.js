/* ============================================================
   NOTATNIK — app.js
   Routing, markdown (Obsidian-flavored), graf, wyszukiwarka, animacje.
   Rzeczy do edycji "na szybko" są w CONFIG poniżej.
   ============================================================ */
(() => {
"use strict";

const CONFIG = {
  title: "notatnik",            // wielki napis na stronie startowej (wiersz 1)
  title2: "// vault",           // wiersz 2 (obrys)
  brand: "NOTATNIK",            // nazwa w górnym pasku
  subtitle: "Rozszerzony przewodnik po esejach, tezach, światach, prozie i systemach",
  elements: ["Id", "Tz", "Rpg", "Pr", "Lx"],   // "pierwiastki" pod tytułem, czysto dekoracyjne
  spec: [                        // spec-sheet na stronie startowej (//KLUCZ_ wartość)
    ["autorka", "Emilia"],
    ["miejsce", "Trójmiasto"],
    ["format", "Obsidian vault → HTML"],
    ["licencja", "prywatne"],
  ],
  sectionNames: { "Ja": "O mnie", "poems": "Twórczość", "(root)": "Start", "IdPol": "IdPol", "RPG": "RPG", "Terapia": "Terapia", "Kultura": "Kultura", "Linux": "Linux", "IVF": "IVF", "Kosmetyki": "Kosmetyki", "Projekty": "Projekty" },
  sectionColors: {
    "(root)": "#ffffff", "Ja": "#ffffff", "Terapia": "#f2a0b8", "IdPol": "#6b6beb", "RPG": "#b8ff2e", "poems": "#ff6a3d",
    "Linux": "#2ee6ff", "Projekty": "#ffb800", "Kultura": "#4fd1a5", "IVF": "#ff4fd8", "Kosmetyki": "#d4b0ff",
  },
  tagColors: {                   // kolory klastrów terapii — jak w grafie Obsidiana
    "terapia/rdzen": "#e5484d", "terapia/interes": "#f76b15", "terapia/emocje": "#d9a400", "terapia/cialo": "#46a758",
    "terapia/relacje": "#12a594", "terapia/kobiecosc": "#8e4ec6", "terapia/obcosc": "#3e63dd", "terapia/utopie": "#d6409f",
    "terapia/hub": "#e8e8e8", "terapia/sesja": "#ffffff", "terapia/dziennik": "#9a9a9a", "terapia/napiecie": "#e5484d",
  },
  bootLines: [
    "> NOTATNIK v2.6 // inicjalizacja",
    "> montowanie vaulta ............ OK",
    "> indeksowanie {N} notatek ....... OK",
    "> rozwiązywanie {L} linków ....... OK",
    "> budowa grafu wiedzy ........... OK",
    "> interfejs",
  ],
};

/* ---------- dane ---------- */
let D, NOTES, ATTS, ALL, byId, TAGS, TAGSET, start, sectionOrder, SECTIONS;
let LIVE = false;          // true, gdy strona chodzi na server.py (vault na żywo, edycja)
let VERSION = null;
function initData(data) {
  D = data; window.VAULT_DATA = data;
  NOTES = D.notes; ATTS = D.attachments; ALL = NOTES.concat(ATTS);
  byId = {}; ALL.forEach(n => byId[n.id] = n);
  NOTES.forEach((n, i) => n.num = i + 1);
  ATTS.forEach(a => { a.title = a.stem; a.tags = a.tags || []; a.links = []; a.fm = {}; a.headings = []; a.words = 0; a.excerpt = "Załącznik " + a.type.toUpperCase(); a.isAtt = true; a.mtime = ""; });
  TAGS = {};
  NOTES.forEach(n => n.tags.forEach(t => { (TAGS[t] = TAGS[t] || []).push(n.id); }));
  TAGSET = new Set(Object.keys(TAGS));
  start = NOTES.find(n => n.id === "start");
  sectionOrder = [];
  if (start) start.links.forEach(id => { const s = byId[id] && byId[id].section; if (s && !sectionOrder.includes(s)) sectionOrder.push(s); });
  D.sections.forEach(s => { if (s !== "(root)" && !sectionOrder.includes(s)) sectionOrder.push(s); });
  SECTIONS = sectionOrder.map(s => {
    const notes = NOTES.filter(n => n.section === s);
    const hub = notes.find(n => n.tags.includes("hub")) || notes[0];
    return { key: s, name: CONFIG.sectionNames[s] || s, color: CONFIG.sectionColors[s] || "#b8ff2e", notes, hub, words: notes.reduce((a, n) => a + n.words, 0) };
  });
  NOTES.forEach(n => { n._s = norm(n.title + " " + n.aliases.join(" ") + " " + n.tags.join(" ")); n._b = norm(n.body); });
}
const secColor = s => CONFIG.sectionColors[s] || CONFIG.sectionColors["(root)"];
const secName = s => CONFIG.sectionNames[s] || s || "Start";
function nodeColor(n) {
  for (const t of (n.tags || [])) if (CONFIG.tagColors[t] && t !== "terapia/napiecie") return CONFIG.tagColors[t];
  return secColor(n.section || "(root)");
}

/* ---------- utils ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nfc = s => s.normalize("NFC");
const deburr = s => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L");
const slug = s => deburr(s).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "x";
const norm = s => deburr(s).toLowerCase();
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const pad = (n, w = 3) => String(n).padStart(w, "0");
const readTime = w => Math.max(1, Math.round(w / 220));
const noteHref = (id, sub) => "#/n/" + id + (sub || "");
function resolveLink(target) {
  let t = nfc(target.trim());
  if (t.endsWith(".md")) t = t.slice(0, -3);
  const key = t.toLowerCase();
  if (key in D.resolve && D.resolve[key]) return D.resolve[key];
  const hit = ALL.find(n => n.stem.toLowerCase() === key || (n.aliases || []).some(a => a.toLowerCase() === key));
  return hit ? hit.id : null;
}
function stripMd(s) {
  return s.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\\?\|([^\]]+))?\]\]/g, (m, a, b) => b || a)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|=~]+/g, "").replace(/\s+\^[A-Za-z0-9-]+\s*$/g, "").replace(/\s+/g, " ").trim();
}
function linkify(str) { // wikilinki w wartościach frontmattera
  return esc(str).replace(/\[\[([^\]]+?)\]\]/g, (m, inner) => {
    inner = inner.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const parts = inner.split(/\\\||\|/); const t = parts[0].split("#")[0]; const label = parts[1] || parts[0];
    const id = resolveLink(t);
    return id ? `<a href="${noteHref(id)}" class="wl-fm" data-id="${id}">${esc(label)}</a>` : esc(label);
  });
}

/* ---------- boot ---------- */
function boot() {
  const el = $("#boot"), log = $("#boot-log"), fill = $("#boot-fill");
  if (sessionStorage.getItem("booted")) { el.classList.add("hide"); return; }
  const lines = CONFIG.bootLines.map(l => l.replace("{N}", NOTES.length).replace("{L}", NOTES.reduce((a, n) => a + n.links.length, 0)));
  let i = 0, done = false;
  const finish = () => { if (done) return; done = true; sessionStorage.setItem("booted", "1"); el.classList.add("hide"); };
  const step = () => {
    if (done) return;
    if (i < lines.length) { log.textContent += lines[i] + "\n"; fill.style.width = ((i + 1) / lines.length * 100) + "%"; i++; setTimeout(step, 140 + Math.random() * 220); }
    else setTimeout(finish, 350);
  };
  step();
  $("#boot-skip").onclick = finish; el.onclick = finish;
  document.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === "Escape") finish(); }, { once: true });
}

/* ---------- mermaid ---------- */
if (window.mermaid) mermaid.initialize({
  startOnLoad: false, theme: "base", securityLevel: "loose", fontFamily: "JetBrains Mono, monospace",
  themeVariables: {
    darkMode: true, background: "#000000", primaryColor: "#152007", primaryTextColor: "#e8ffc2", primaryBorderColor: "#b8ff2e",
    lineColor: "#b8ff2e", secondaryColor: "#2a1a22", tertiaryColor: "#111111", textColor: "#ececec", fontSize: "13px",
    edgeLabelBackground: "#000000", clusterBkg: "#0b0b0b", clusterBorder: "#f2a0b8", titleColor: "#ececec",
    pie1: "#b8ff2e", pie2: "#f2a0b8", pie3: "#6b6beb", pie4: "#2ee6ff", pie5: "#ffb800", pie6: "#ff6a3d", pie7: "#4fd1a5", pie8: "#d4b0ff",
    pie9: "#ff4fd8", pie10: "#7fb64a", pie11: "#ffffff", pie12: "#8a8f86",
    pieTitleTextColor: "#ececec", pieSectionTextColor: "#000000", pieLegendTextColor: "#ececec", pieStrokeColor: "#000000", pieOuterStrokeColor: "#b8ff2e", pieStrokeWidth: "1px",
  },
});

/* ---------- markdown (Obsidian flavour) ---------- */
const CALLOUT_RE = /^\[!([a-zA-Z]+)\]([+-]?)\s*(.*)$/;
marked.use({
  gfm: true, breaks: false,
  renderer: {
    heading({ tokens, depth, text }) {
      const s = slug(text);
      const inner = this.parser.parseInline(tokens);
      return `<h${depth} id="h-${s}"><span class="hl">#</span>${inner}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const ext = /^(https?:|file:|mailto:)/.test(href);
      return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}${ext ? ' class="ext" target="_blank" rel="noopener"' : ""}>${inner}</a>`;
    },
    code({ text, lang }) {
      lang = (lang || "").trim();
      if (lang === "mermaid") return `<div class="mermaid-wrap"><pre class="mermaid">${esc(text)}</pre></div>\n`;
      if (lang === "query") return renderQuery(text);
      return `<pre data-lang="${esc(lang)}"><code>${esc(text)}</code></pre>\n`;
    },
  },
});

function renderQuery(q) {
  q = q.trim();
  const conds = [];
  let rest = q;
  rest = rest.replace(/path:"([^"]+)"|path:(\S+)/g, (m, a, b) => { conds.push(n => n.path.startsWith(a || b)); return ""; });
  rest = rest.replace(/\[([^:\]]+):"([^"]*)"\]|\[([^:\]]+):([^\]]*)\]/g, (m, k1, v1, k2, v2) => { const k = k1 || k2, v = v1 || v2; conds.push(n => String(n.fm[k] ?? "") === v); return ""; });
  rest = rest.replace(/tag:#?(\S+)/g, (m, t) => { conds.push(n => n.tags.includes(t)); return ""; });
  rest = rest.replace(/-path:"([^"]+)"/g, (m, a) => { conds.push(n => !n.path.startsWith(a)); return ""; });
  rest.trim().split(/\s+/).filter(Boolean).forEach(w => { const nw = norm(w); conds.push(n => norm(n.title + " " + n.body).includes(nw)); });
  const hits = NOTES.filter(n => conds.every(c => c(n))).sort((a, b) => a.path.localeCompare(b.path, "pl"));
  const list = hits.length ? `<ul>${hits.map(n => `<li><a class="wl" data-id="${n.id}" href="${noteHref(n.id)}">${esc(n.title)}</a></li>`).join("")}</ul>` : `<div class="q-empty">brak wyników</div>`;
  return `<div class="query"><div class="q-head"><span>// zapytanie</span><code>${esc(q)}</code><span>${hits.length} wyn.</span></div>${list}</div>\n`;
}

function preprocess(md, note) {
  const fences = [];
  md = md.replace(/```[\s\S]*?```/g, m => { fences.push(m); return `\u0000F${fences.length - 1}\u0000`; });
  const codes = [];
  md = md.replace(/`[^`\n]+`/g, m => { codes.push(m); return `\u0000C${codes.length - 1}\u0000`; });

  // wikilinki
  md = md.replace(/\[\[([^\[\]]+?)\]\]/g, (m, inner) => {
    const parts = inner.split(/\\\||\|/);
    const tgtFull = parts[0], alias = parts.slice(1).join("|");
    const hashIdx = tgtFull.indexOf("#");
    const target = hashIdx >= 0 ? tgtFull.slice(0, hashIdx) : tgtFull;
    const sub = hashIdx >= 0 ? tgtFull.slice(hashIdx + 1) : "";
    const id = target.trim() ? resolveLink(target) : note.id;
    let label = alias || (sub ? `${target.trim() ? target : note.title} › ${sub.replace(/^\^/, "")}` : target);
    if (!id) return `<span class="wl-unresolved" title="nierozwiązany link">${esc(label)}</span>`;
    let href = noteHref(id);
    if (sub.startsWith("^")) href += "/b/" + encodeURIComponent(sub.slice(1));
    else if (sub) href += "/h/" + slug(sub);
    const cls = byId[id] && byId[id].isAtt ? "wl wl-att" : "wl";
    return `<a class="${cls}" data-id="${id}" href="${href}">${esc(label)}</a>`;
  });
  // identyfikatory bloków ^id
  md = md.replace(/^(.*\S)[ \t]+\^([A-Za-z0-9-]+)[ \t]*$/gm, (m, line, id) => `${line} <a class="bid" id="b-${id}" href="${noteHref(note.id)}/b/${id}">^${id}</a>`);
  md = md.replace(/^\^([A-Za-z0-9-]+)[ \t]*$/gm, (m, id) => `<span class="bid" id="b-${id}"></span>`);
  // ==highlight==
  md = md.replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
  // #tagi w tekście
  md = md.replace(/(^|[\s(])#([\p{L}][\p{L}\d/_-]*)/gmu, (m, pre, t) => TAGSET.has(t) ? `${pre}<a class="tag" href="#/tag/${encodeURIComponent(t)}" style="--tag-c:${CONFIG.tagColors[t] || "var(--acid)"}">${esc(t)}</a>` : m);

  md = md.replace(/\u0000C(\d+)\u0000/g, (m, i) => codes[i]);
  md = md.replace(/\u0000F(\d+)\u0000/g, (m, i) => fences[i]);
  return md;
}

function renderMarkdown(note) {
  const html = marked.parse(preprocess(note.body, note));
  const box = document.createElement("div");
  box.innerHTML = html;
  // pierwszy H1 równy tytułowi notatki jest już w nagłówku strony
  const h1 = box.querySelector("h1");
  if (h1 && h1 === box.firstElementChild && stripMd(h1.textContent.replace(/^#/, "")).trim() === stripMd(note.title).trim()) h1.classList.add("h1-dup");
  // callouty
  $$("blockquote", box).forEach(bq => {
    const p = bq.querySelector("p"); if (!p) return;
    const first = (p.firstChild && p.firstChild.nodeType === 3) ? p.firstChild.textContent : "";
    const m = first.match(CALLOUT_RE); if (!m) return;
    const type = m[1].toLowerCase();
    p.firstChild.textContent = m[3] || "";
    const title = document.createElement("div"); title.className = "co-title"; title.textContent = type + (m[3] ? "" : "");
    bq.classList.add("callout", type); bq.insertBefore(title, bq.firstChild);
    if (p.innerHTML.replace(/<br\s*\/?>/, "").trim() === "") p.remove();
    else p.innerHTML = p.innerHTML.replace(/^\s*<br\s*\/?>/, "");
  });
  return box;
}

/* ---------- sidebar tree ---------- */
function buildTree() {
  const root = { dirs: {}, files: [] };
  ALL.forEach(n => {
    const parts = n.path.split("/"); let cur = root;
    for (let i = 0; i < parts.length - 1; i++) cur = cur.dirs[parts[i]] = cur.dirs[parts[i]] || { dirs: {}, files: [] };
    cur.files.push(n);
  });
  const count = d => d.files.length + Object.values(d.dirs).reduce((a, x) => a + count(x), 0);
  const order = name => { const i = sectionOrder.indexOf(name); return i < 0 ? 99 : i; };
  const render = (d, depth, path) => {
    let h = "";
    const dirs = Object.keys(d.dirs).sort((a, b) => depth === 0 ? order(a) - order(b) : a.localeCompare(b, "pl"));
    dirs.forEach(name => {
      const sub = d.dirs[name];
      const p = path ? path + "/" + name : name;
      const col = depth === 0 ? secColor(name) : "";
      h += `<details data-path="${esc(p)}"${depth === 0 ? "" : ""}><summary${col ? ` style="--sc:${col}"` : ""}><span>${esc(depth === 0 ? secName(name) : name)}</span><span class="cnt">${count(sub)}</span></summary><div class="tree-children">${render(sub, depth + 1, p)}</div></details>`;
    });
    d.files.sort((a, b) => (b.tags.includes("hub") - a.tags.includes("hub")) || a.stem.localeCompare(b.stem, "pl", { numeric: true })).forEach(n => {
      const cls = ["leaf", n.tags.includes("hub") ? "hub" : "", n.isAtt ? "pdf" : ""].join(" ");
      h += `<a class="${cls}" data-id="${n.id}" href="${noteHref(n.id)}" title="${esc(n.path)}">${esc(n.isAtt ? n.stem : n.title)}</a>`;
    });
    return h;
  };
  $("#tree").innerHTML = render(root, 0, "");
  $("#side-count").innerHTML = `${NOTES.length} plików${LIVE ? ` · <a href="#" id="new-note" class="acid">+ nowa</a>` : ""}`;
  const nn = $("#new-note"); if (nn) nn.onclick = e => { e.preventDefault(); newNote(); };
  $("#build-info").innerHTML = `vault: ${esc(D.vault)}<br>${LIVE ? `<span class="live-dot"></span>na żywo · ${esc(D.built)}` : `zbudowano: ${esc(D.built)}`}`;
}
function highlightTree(id) {
  $$("#tree a.leaf").forEach(a => a.classList.toggle("active", a.dataset.id === id));
  const a = $(`#tree a.leaf[data-id="${id}"]`);
  if (a) { let p = a.parentElement; while (p && p.id !== "tree") { if (p.tagName === "DETAILS") p.open = true; p = p.parentElement; } a.scrollIntoView({ block: "nearest" }); }
}

/* ---------- router ---------- */
const main = $("#main");
let current = { view: null, id: null };
let activeGraph = null;
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  const parts = h.split("/").map(decodeURIComponent);
  return { name: parts[0] || "home", parts };
}
let editing = null;   // {id, dirty} gdy otwarty edytor
function rerender() { current = { view: null, id: null }; route(); }
function route() {
  const r = parseRoute();
  if (editing && !(r.name === "n" && r.parts[1] === editing.id)) { if (editing.dirty && !confirm("Niezapisane zmiany. Porzucić?")) { location.hash = noteHref(editing.id); return; } editing = null; }
  if (activeGraph) { activeGraph.destroy(); activeGraph = null; }
  $$(".top-nav a").forEach(a => a.classList.toggle("active", a.dataset.route === r.name || (r.name === "tag" && a.dataset.route === "tags") || (r.name === "dir" && a.dataset.route === "all")));
  closeSearch(); closeSidebar();
  if (r.name === "n" && r.parts[1]) {
    const id = r.parts[1]; const sub = r.parts[2], arg = r.parts[3];
    if (current.view === "note" && current.id === id && sub !== "edit") { scrollToTarget(sub, arg); return; }
    const n = byId[id];
    if (!n) { renderNotFound(id); return; }
    document.body.classList.remove("graph-mode");
    if (sub === "edit" && LIVE && !n.isAtt) { renderEditor(n); highlightTree(id); current = { view: "note", id }; window.scrollTo(0, 0); return; }
    n.isAtt ? renderAttachment(n) : renderNote(n);
    highlightTree(id);
    current = { view: "note", id };
    if (sub && sub !== "edit") scrollToTarget(sub, arg); else window.scrollTo(0, 0);
    return;
  }
  highlightTree(null);
  window.scrollTo(0, 0);
  document.body.classList.toggle("graph-mode", r.name === "graph");
  if (r.name === "graph") renderGraphView(r.parts[1]);
  else if (r.name === "tags") renderTags(null);
  else if (r.name === "tag") renderTags(r.parts[1]);
  else if (r.name === "all") renderIndex(null);
  else if (r.name === "dir") renderIndex(r.parts[1]);
  else renderHome();
  current = { view: r.name, id: r.parts[1] || null };
}
function scrollToTarget(sub, arg) {
  requestAnimationFrame(() => {
    let el = null;
    if (sub === "h") el = document.getElementById("h-" + arg);
    if (sub === "b") el = document.getElementById("b-" + arg);
    if (!el) return;
    const block = sub === "b" ? (el.closest("li, p, tr, blockquote, h1, h2, h3, h4") || el) : el;
    block.scrollIntoView({ block: "center", behavior: "smooth" });
    block.classList.remove("flash"); void block.offsetWidth; block.classList.add("flash");
  });
}
function setView(html) {
  main.innerHTML = `<div class="view">${html}</div>`;
  main.classList.remove("glitch-flash"); void main.offsetWidth; main.classList.add("glitch-flash");
  return main.firstElementChild;
}
function renderNotFound(id) { setView(`<h1 class="page-title">404</h1><p class="page-sub">nie ma takiej notatki: ${esc(id)}</p><a class="btn" href="#/">← start</a>`); }

/* ---------- HOME ---------- */
function renderHome() {
  const totalWords = NOTES.reduce((a, n) => a + n.words, 0), totalLinks = NOTES.reduce((a, n) => a + n.links.length, 0);
  const maxN = Math.max(...SECTIONS.map(s => s.notes.length));
  const recent = NOTES.slice().sort((a, b) => b.mtime.localeCompare(a.mtime)).slice(0, 8);
  const quoteNote = NOTES.filter(n => n.excerpt.length > 120 && (n.section === "IdPol" || n.section === "Terapia" || n.section === "poems"))[Math.floor(Math.random() * 1e9) % 1] ? null : null;
  const pool = NOTES.filter(n => n.excerpt.length > 120 && ["IdPol", "Terapia", "poems"].includes(n.section));
  const q = pool[Math.floor(Math.random() * pool.length)];
  const html = `
  <section class="hero">
    <div class="hero-left">
      <div class="hero-eyebrow"><span class="chip">///</span><span class="mono acid">system notatek</span><span class="mono dim">rev. ${esc(D.built.slice(0, 10))}</span></div>
      <h1 class="hero-title"><span class="l1">${esc(CONFIG.title)}</span><span class="l2">${esc(CONFIG.title2)}</span></h1>
      <p class="hero-sub">${esc(CONFIG.subtitle)}</p>
      <div class="hero-bars"><i></i><i></i><i></i><span class="acid mono">+</span><span class="hz"></span><span class="arrows">↗↗</span></div>
      <div class="hero-elements">${CONFIG.elements.map(e => `<b>${esc(e)}</b>`).join(" ")}</div>
      <div class="hero-actions"><a class="btn" href="#/graph">graf</a><a class="btn pink" href="#/all">indeks</a><a class="btn ghost" href="#" id="home-random">losowa</a></div>
    </div>
    <div class="hero-right bracket">
      <div class="hr-head"><span class="mono dim">// obiekt_ sfera danych</span><span class="mono acid">${NOTES.length} węzłów</span></div>
      <canvas id="sphere"></canvas>
      <div class="hr-foot">
        <div class="stat acid"><b>${NOTES.length}</b><span>notatek</span></div>
        <div class="stat"><b>${totalLinks}</b><span>linków</span></div>
        <div class="stat pink"><b>${fmt(Math.round(totalWords / 1000))}k</b><span>słów</span></div>
        <div class="stat"><b>${Object.keys(TAGS).length}</b><span>tagów</span></div>
      </div>
    </div>
  </section>
  <div class="hazard"></div>
  <div class="ticker"><div class="ticker-track">${[0, 1].map(() => SECTIONS.map(s => `<span style="color:${s.color}">■ ${esc(s.name.toUpperCase())} <i>${s.notes.length}</i></span>`).join("") + NOTES.filter(n => n.tags.includes("hub")).map(n => `<span>// ${esc(n.title.toUpperCase())}</span>`).join("")).join("")}</div></div>
  <div class="home-grid">
    <div>
      <div class="panel-title" style="margin-top:6px">// sekcje_</div>
      <div class="sections">
        ${SECTIONS.map((s, i) => `<a class="sec-card" href="${s.hub ? noteHref(s.hub.id) : "#/dir/" + encodeURIComponent(s.key)}" style="--sc:${s.color}"><span class="sw"></span><div class="num">${pad(i + 1, 2)} / ${esc(s.key.toUpperCase())}</div><div class="name">${esc(s.name)}</div><div class="desc">${esc(s.hub ? s.hub.excerpt : "")}</div><div class="meter"><i style="width:${Math.round(s.notes.length / maxN * 100)}%"></i></div><div class="meta"><span>${s.notes.length} not.</span><span>${fmt(s.words)} słów</span></div></a>`).join("")}
      </div>
      <div class="start-block panel bracket">
        <div class="panel-title">// start.md_</div>
        <div class="md" id="start-md"></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:20px">
      <div class="panel">
        <div class="panel-title">// spec_</div>
        <div class="spec">${CONFIG.spec.map(([k, v]) => `<div class="spec-row"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("")}
        <div class="spec-row"><span class="k">notatek</span><span class="v">${NOTES.length}</span></div>
        <div class="spec-row"><span class="k">zbudowano</span><span class="v">${esc(D.built)}</span></div></div>
      </div>
      <div class="panel">
        <div class="panel-title">// rozkład notatek_</div>
        <div class="barchart">${SECTIONS.map(s => `<a class="bar" href="#/dir/${encodeURIComponent(s.key)}" style="--sc:${s.color}" title="${esc(s.name)}: ${s.notes.length}"><i style="height:${Math.round(s.notes.length / maxN * 100)}%"></i><span>${esc(s.name)}</span></a>`).join("")}</div>
      </div>
      ${q ? `<div class="panel"><div class="panel-title">// fragment_</div><div class="quote-block">${esc(q.excerpt)}<a class="src" href="${noteHref(q.id)}">→ ${esc(q.title)}</a></div></div>` : ""}
      <div class="panel">
        <div class="panel-title">// ostatnio zmienione_</div>
        <ul class="list-plain">${recent.map(n => `<li style="--sc:${secColor(n.section)}"><span class="s">${esc(secName(n.section))}</span><a href="${noteHref(n.id)}">${esc(n.title)}</a><span class="d">${n.mtime}</span></li>`).join("")}</ul>
      </div>
    </div>
  </div>
  <div class="wire" style="margin-top:40px"></div>`;
  const v = setView(html);
  if (start) { const r = renderMarkdown(start); const el = $("#start-md", v); while (r.firstChild) el.appendChild(r.firstChild); }
  $("#home-random", v).onclick = e => { e.preventDefault(); gotoRandom(); };
  startSphere($("#sphere", v));
}

/* ---------- sfera z kropek (hero) ---------- */
function startSphere(canvas) {
  const ctx = canvas.getContext("2d");
  const N = 900, pts = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
    const h = Math.sin(i * 12.9898) * 43758.5453; const bright = (h - Math.floor(h)) > .7;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, b: bright });
  }
  let t = 0, raf;
  function frame() {
    if (!canvas.isConnected) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * 2 || canvas.height !== h * 2) { canvas.width = w * 2; canvas.height = h * 2; }
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * .36, cx = w / 2, cy = h / 2;
    t += .004;
    // pierścień orbitalny
    ctx.strokeStyle = "rgba(184,255,46,.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.25, R * .25, -.4, 0, Math.PI * 2); ctx.stroke();
    const cs = Math.cos(t), sn = Math.sin(t), tilt = .35;
    const proj = pts.map(p => { const x = p.x * cs - p.z * sn, z = p.x * sn + p.z * cs; const y = p.y * Math.cos(tilt) - z * Math.sin(tilt), z2 = p.y * Math.sin(tilt) + z * Math.cos(tilt); return { x: cx + x * R, y: cy + y * R, z: z2, b: p.b }; });
    proj.sort((a, b) => a.z - b.z);
    for (const p of proj) {
      const a = (p.z + 1) / 2; const s = .6 + a * 1.6;
      ctx.fillStyle = p.b ? `rgba(184,255,46,${.25 + a * .75})` : `rgba(236,236,236,${.08 + a * .5})`;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    // skaner
    const sy = cy - R + ((t * 60) % (R * 2));
    const g = ctx.createLinearGradient(0, sy - 30, 0, sy); g.addColorStop(0, "rgba(242,160,184,0)"); g.addColorStop(1, "rgba(242,160,184,.35)");
    ctx.fillStyle = g; ctx.fillRect(cx - R * 1.3, sy - 30, R * 2.6, 30);
    ctx.fillStyle = "rgba(242,160,184,.7)"; ctx.fillRect(cx - R * 1.3, sy, R * 2.6, 1);
    ctx.font = "9px JetBrains Mono, monospace"; ctx.fillStyle = "rgba(184,255,46,.6)"; ctx.textAlign = "left";
    ctx.fillText("LAT " + (Math.sin(t) * 90).toFixed(2), 12, h - 12); ctx.textAlign = "right"; ctx.fillText("ROT " + ((t * 57.3) % 360).toFixed(1) + "°", w - 12, h - 12);
    raf = requestAnimationFrame(frame);
  }
  frame();
}

/* ---------- NOTE ---------- */
function fmValue(v) {
  if (Array.isArray(v)) return v.map(x => linkify(String(x))).join(" · ");
  if (typeof v === "boolean") return v ? "tak" : "nie";
  return linkify(String(v));
}
function wikiTarget(v) { const m = String(v || "").match(/\[\[([^\]|#]+)/); return m ? resolveLink(m[1]) : null; }
function backlinkContext(src, target) {
  const names = [target.stem].concat(target.aliases || []).map(s => s.toLowerCase());
  const lines = src.body.split("\n");
  for (const line of lines) {
    const m = line.match(/\[\[([^\]|#\\]+)/g); if (!m) continue;
    if (m.some(x => names.includes(nfc(x.slice(2).trim()).toLowerCase()))) {
      const txt = stripMd(line).slice(0, 220);
      const label = esc(txt).replace(new RegExp(names.map(n => esc(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i"), s => `<mark>${s}</mark>`);
      return label;
    }
  }
  return esc(src.excerpt.slice(0, 160));
}
function renderNote(n) {
  const sec = SECTIONS.find(s => s.key === n.section);
  const crumbs = n.path.split("/").slice(0, -1);
  const prev = wikiTarget(n.fm["poprzedni"]), next = wikiTarget(n.fm["następny"]);
  const specKeys = Object.keys(n.fm).filter(k => !["tags", "aliases"].includes(k) && n.fm[k] !== "" && !(Array.isArray(n.fm[k]) && !n.fm[k].length));
  const outLinks = n.links.map(id => byId[id]).filter(Boolean);
  const backs = n.backlinks.map(id => byId[id]).filter(Boolean);
  const isPoetry = n.tags.some(t => t.startsWith("twórczość"));
  const html = `
  <div class="note-layout">
    <article>
      <header class="note-head">
        <div class="fx-band bracket"><canvas id="fx-canvas"></canvas><span class="fx-tag mono" style="color:${nodeColor(n)}">■ ${esc(secName(n.section))} · #${pad(n.num)}</span></div>
        <div class="crumbs"><a href="#/">start</a>${crumbs.map((c, i) => `<span class="sep">/</span>${i === 0 ? `<a href="#/dir/${encodeURIComponent(c)}">${esc(secName(c))}</a>` : `<span>${esc(c)}</span>`}`).join("")}<span class="sep">/</span><span>${esc(n.stem)}.md</span></div>
        <div class="note-id"><span>NOTE #${pad(n.num)}</span><span style="color:${nodeColor(n)}">■ ${esc(secName(n.section))}</span>${n.fm.status ? `<span class="dim">[${esc(n.fm.status)}]</span>` : ""}</div>
        <h1 class="note-title" id="note-title">${esc(n.title)}</h1>
        <div class="note-tags">${n.tags.map(t => `<a class="tag" href="#/tag/${encodeURIComponent(t)}" style="--tag-c:${CONFIG.tagColors[t] || "var(--acid)"}">${esc(t)}</a>`).join("")}</div>
        <div class="note-meta"><span>słów <b>${fmt(n.words)}</b></span><span>czytanie <b>~${readTime(n.words)} min</b></span><span>linki <b>${outLinks.length}</b> / wsteczne <b>${backs.length}</b></span><span>zmieniono <b>${n.mtime}</b></span>${LIVE ? `<a class="btn edit-btn" href="${noteHref(n.id)}/edit">✎ edytuj</a>` : ""}</div>
        ${specKeys.length || (n.aliases && n.aliases.length) ? `<div class="spec note-spec">${n.aliases && n.aliases.length ? `<div class="spec-row"><span class="k">aliasy</span><span class="v">${n.aliases.map(esc).join(" · ")}</span></div>` : ""}${specKeys.map(k => `<div class="spec-row"><span class="k">${esc(k)}</span><span class="v">${fmValue(n.fm[k])}</span></div>`).join("")}</div>` : ""}
      </header>
      <div class="md ${isPoetry ? "prose-poetry" : ""}" id="md"></div>
      ${prev || next ? `<nav class="prevnext">${prev ? `<a class="prev" href="${noteHref(prev)}"><span class="lbl">← poprzedni</span><span class="t">${esc(byId[prev].title)}</span></a>` : "<span></span>"}${next ? `<a class="next" href="${noteHref(next)}"><span class="lbl">następny →</span><span class="t">${esc(byId[next].title)}</span></a>` : ""}</nav>` : ""}
      <div class="wire" style="margin:30px 0 20px"></div>
      ${outLinks.length ? `<div class="panel-title">// linki wychodzące_ ${outLinks.length}</div><div class="out-links">${outLinks.map(l => `<a class="wl" data-id="${l.id}" href="${noteHref(l.id)}">${esc(l.title)}</a>`).join("")}</div>` : ""}
    </article>
    <aside class="rail">
      <div class="panel">
        <div class="panel-title">// graf lokalny_</div>
        <div class="mini-graph" id="mini-graph"><canvas></canvas><a class="btn ghost expand" href="#/graph/${n.id}" style="padding:4px 8px;font-size:9px">rozwiń ⤢</a></div>
      </div>
      ${n.headings.filter(h => h.level >= 2 && h.level <= 4).length ? `<div class="panel"><div class="panel-title">// spis treści_</div><ul class="toc">${n.headings.filter(h => h.level >= 2 && h.level <= 4).map(h => `<li class="l${h.level}"><a href="${noteHref(n.id)}/h/${h.slug}" data-h="h-${h.slug}">${esc(stripMd(h.text))}</a></li>`).join("")}</ul></div>` : ""}
      <div class="panel">
        <div class="panel-title">// linki wsteczne_ ${backs.length}</div>
        ${backs.length ? `<ul class="backlinks">${backs.map(b => `<li><a class="bl-t" href="${noteHref(b.id)}">${esc(b.title)}</a><div class="ctx">${backlinkContext(b, n)}</div></li>`).join("")}</ul>` : `<div class="mono dim">brak</div>`}
      </div>
    </aside>
  </div>`;
  const v = setView(html);
  const mdEl = $("#md", v); const rendered = renderMarkdown(n);
  while (rendered.firstChild) mdEl.appendChild(rendered.firstChild);
  decodeTitle($("#note-title", v));
  if (window.SectionFX) SectionFX.run(n.section || "(root)", $("#fx-canvas", v), secColor(n.section || "(root)"));
  if (window.mermaid && $(".mermaid", v)) mermaid.run({ nodes: $$(".mermaid", v) }).then(() => $$(".mermaid-wrap", v).forEach(m => m.classList.add("ready"))).catch(e => console.warn("mermaid", e));
  setupScrollSpy(v);
  activeGraph = new ForceGraph($("#mini-graph canvas", v), localGraphData(n.id, 1), { mini: true, focus: n.id });
}
async function renderEditor(n) {
  let raw;
  try { const r = await fetch("/api/raw?path=" + encodeURIComponent(n.path)); if (!r.ok) throw 0; raw = (await r.json()).content; }
  catch (e) { setView(`<div class="mono pink">nie udało się wczytać pliku</div>`); return; }
  editing = { id: n.id, dirty: false };
  const v = setView(`<div class="editor">
    <div class="ed-head"><div><div class="crumbs"><span class="mono acid">// edycja_</span><span>${esc(n.path)}</span></div><h1 class="note-title" style="font-size:clamp(22px,3vw,34px)">${esc(n.title)}</h1></div>
      <div class="ed-actions"><span id="ed-status" class="mono dim"></span><a class="btn ghost" href="${noteHref(n.id)}">anuluj</a><button class="btn" id="ed-save">zapisz <kbd>⌘S</kbd></button></div></div>
    <textarea id="ed-text" spellcheck="false"></textarea>
    <div class="ed-foot mono dim"><span id="ed-count"></span><span>zapis trafia do vaulta; Obsidian widzi zmianę od razu</span></div>
  </div>`);
  const ta = $("#ed-text", v), status = $("#ed-status", v), cnt = $("#ed-count", v);
  ta.value = raw;
  const count = () => cnt.textContent = `${fmt(ta.value.length)} znaków · ${fmt((ta.value.match(/\S+/g) || []).length)} słów`;
  count();
  ta.addEventListener("input", () => { editing.dirty = true; status.textContent = "niezapisane"; count(); });
  ta.addEventListener("keydown", e => { if (e.key === "Tab") { e.preventDefault(); const s0 = ta.selectionStart; ta.setRangeText("\t", s0, ta.selectionEnd, "end"); editing.dirty = true; } });
  const save = async () => {
    status.textContent = "zapisuję…";
    try {
      const r = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: n.path, content: ta.value }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      editing.dirty = false; status.textContent = "zapisano " + new Date().toLocaleTimeString("pl-PL");
      await refreshData(true);
    } catch (e) { status.textContent = "błąd zapisu: " + e.message; }
  };
  $("#ed-save", v).onclick = save;
  v.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } });
  ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; window.scrollTo(0, 0);
}
async function newNote() {
  const folders = [...new Set(NOTES.map(n => n.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pl"));
  const folder = prompt("Folder (pusty = główny):\n" + folders.join("\n"), folders[0] || "");
  if (folder === null) return;
  const name = prompt("Nazwa notatki (bez .md):"); if (!name) return;
  const path = (folder ? folder.replace(/\/+$/, "") + "/" : "") + name.trim() + ".md";
  const sec = folder.split("/")[0]; const hub = NOTES.find(n => n.section === sec && n.tags.includes("hub"));
  const content = `---\ntags:\n  - ${(hub ? hub.tags.find(t => t !== "hub") : "notatka") || "notatka"}\npowiązane:\n  - "[[${hub ? hub.stem : "Start"}]]"\n---\n\n# ${name.trim()}\n\n`;
  const r = await fetch("/api/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, content }) });
  const j = await r.json(); if (!r.ok) { alert(j.error || "błąd"); return; }
  await refreshData(true);
  const created = NOTES.find(n => n.path === path.normalize("NFC"));
  if (created) location.hash = noteHref(created.id) + "/edit";
}
function renderAttachment(a) {
  const backs = a.backlinks.map(id => byId[id]).filter(Boolean);
  setView(`<div class="note-head"><div class="crumbs"><a href="#/">start</a><span class="sep">/</span><span>${esc(a.path)}</span></div><div class="note-id"><span>ZAŁĄCZNIK</span><span class="pink">■ ${a.type.toUpperCase()}</span></div><h1 class="note-title">${esc(a.stem)}</h1>
  <div class="note-meta"><span>wsteczne: ${backs.map(b => `<a href="${noteHref(b.id)}">${esc(b.title)}</a>`).join(", ") || "brak"}</span> <a class="ext" href="${esc(a.src)}" target="_blank">otwórz w nowej karcie ↗</a></div></div>
  ${a.src ? `<iframe class="pdf-frame" src="${esc(a.src)}"></iframe>` : `<p class="mono dim">plik nie został skopiowany do assets/</p>`}`);
}
function decodeTitle(el) {
  const target = el.textContent; const glyphs = "░▒▓█▚▞╱╲/\\|#01ΞΔΣ";
  let frame = 0; const total = 22; el.classList.add("decoding");
  const tick = () => {
    frame++;
    const done = Math.floor(target.length * (frame / total));
    el.textContent = target.slice(0, done) + target.slice(done).split("").map(c => c === " " ? " " : glyphs[Math.floor(Math.random() * glyphs.length)]).join("");
    if (frame < total) requestAnimationFrame(tick); else { el.textContent = target; el.classList.remove("decoding"); }
  };
  tick();
}
function setupScrollSpy(v) {
  const links = $$(".toc a", v); if (!links.length) return;
  const map = {}; links.forEach(a => map[a.dataset.h] = a);
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { links.forEach(a => a.classList.remove("active")); const a = map[e.target.id]; if (a) a.classList.add("active"); } });
  }, { rootMargin: "-10% 0px -80% 0px" });
  $$("#md h2, #md h3, #md h4", v).forEach(h => obs.observe(h));
}

/* ---------- TAGS ---------- */
function renderTags(tag) {
  const tags = Object.keys(TAGS).sort((a, b) => TAGS[b].length - TAGS[a].length || a.localeCompare(b));
  const cloud = `<div class="tag-cloud">${tags.map(t => `<a class="tag" href="#/tag/${encodeURIComponent(t)}" style="--tag-c:${CONFIG.tagColors[t] || "var(--acid)"};${t === tag ? "background:var(--tag-c,var(--acid));color:#000" : ""}">${esc(t)}<b>${TAGS[t].length}</b></a>`).join("")}</div>`;
  let body = "";
  if (tag) {
    const notes = (TAGS[tag] || []).map(id => byId[id]);
    body = `<div class="page-sub">#${esc(tag)} · ${notes.length} notatek</div><div class="cards">${notes.map(cardHtml).join("")}</div>`;
  }
  setView(`<h1 class="page-title">${tag ? "#" + esc(tag) : "Tagi"}</h1><div class="page-sub">${tags.length} tagów w vaulcie</div>${cloud}${body}`);
}
function cardHtml(n) {
  return `<a class="card" href="${noteHref(n.id)}" style="--sc:${nodeColor(n)}"><span class="sw"></span><span class="c-sec">${esc(n.folder || "root")}</span><span class="c-title">${esc(n.title)}</span><span class="c-ex">${esc(n.excerpt)}</span><span class="c-meta"><span>#${pad(n.num || 0)}</span><span>${fmt(n.words)} słów</span><span>${n.mtime}</span></span></a>`;
}

/* ---------- INDEX ---------- */
function renderIndex(section) {
  const secs = section ? SECTIONS.filter(s => s.key === section) : SECTIONS;
  const rootNotes = section ? [] : NOTES.filter(n => !n.section);
  const html = `${section ? `<div class="fx-band tall bracket"><canvas id="fx-canvas"></canvas></div>` : ""}<h1 class="page-title">${section ? esc(secName(section)) : "Indeks"}</h1><div class="page-sub">${section ? (secs[0] ? secs[0].notes.length : 0) + " notatek" : NOTES.length + " notatek · " + SECTIONS.length + " sekcji"}</div>
  ${rootNotes.length ? `<div class="index-group"><h2>Start <span class="cnt">${rootNotes.length}</span></h2><div class="cards">${rootNotes.map(cardHtml).join("")}</div></div>` : ""}
  ${secs.map(s => `<div class="index-group"><h2 style="color:${s.color}">${esc(s.name)} <span class="cnt">${s.notes.length} · ${fmt(s.words)} słów</span></h2><div class="cards">${s.notes.slice().sort((a, b) => a.path.localeCompare(b.path, "pl", { numeric: true })).map(cardHtml).join("")}</div></div>`).join("")}`;
  const v = setView(html);
  if (section && window.SectionFX) SectionFX.run(section, $("#fx-canvas", v), secColor(section));
}

/* ---------- GRAPH DATA ---------- */
function fullGraphData() {
  const nodes = ALL.map(n => ({ id: n.id, label: n.title, color: nodeColor(n), section: n.section || "(root)", deg: 0 }));
  const idx = {}; nodes.forEach((n, i) => idx[n.id] = i);
  const seen = new Set(), edges = [];
  NOTES.forEach(n => n.links.forEach(l => { if (!(l in idx)) return; const k = n.id < l ? n.id + "|" + l : l + "|" + n.id; if (seen.has(k)) return; seen.add(k); edges.push({ a: n.id, b: l }); nodes[idx[n.id]].deg++; nodes[idx[l]].deg++; }));
  return { nodes, edges };
}
function localGraphData(id, depth) {
  const full = fullGraphData();
  const adj = {}; full.edges.forEach(e => { (adj[e.a] = adj[e.a] || new Set()).add(e.b); (adj[e.b] = adj[e.b] || new Set()).add(e.a); });
  const keep = new Set([id]); let frontier = [id];
  for (let d = 0; d < depth; d++) { const nf = []; frontier.forEach(x => (adj[x] || []).forEach(y => { if (!keep.has(y)) { keep.add(y); nf.push(y); } })); frontier = nf; }
  return { nodes: full.nodes.filter(n => keep.has(n.id)), edges: full.edges.filter(e => keep.has(e.a) && keep.has(e.b)) };
}

/* ---------- FORCE GRAPH ENGINE ---------- */
class ForceGraph {
  constructor(canvas, data, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.opts = opts;
    this.setData(data);
    this.scale = opts.mini ? .9 : 1; this.tx = 0; this.ty = 0; this.hover = null; this.drag = null; this.pan = null; this.alpha = 1;
    this.hidden = new Set(); this.filter = ""; this.packets = []; this.dead = false; this.labelMode = "auto";
    this.prerun(opts.mini ? 200 : 350); this.needFit = true;
    this.bind();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  prerun(n) { for (let i = 0; i < n; i++) this.step(); this.alpha = .6; }
  fitToNodes() {
    const ns = this.nodes.filter(n => this.visible(n)); if (!ns.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; ns.forEach(n => { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); });
    const w = this.c.clientWidth || 600, h = this.c.clientHeight || 400; const pad = this.opts.mini ? 40 : 140;
    const s = Math.min(3, Math.max(.15, Math.min((w - pad) / Math.max(60, x1 - x0), (h - pad) / Math.max(60, y1 - y0))));
    this.scale = s; this.tx = -((x0 + x1) / 2) * s + (this.opts.mini ? 0 : Math.min(120, w * .1)); this.ty = -((y0 + y1) / 2) * s;
  }
  setData(data) {
    const w = this.c.clientWidth || 600, h = this.c.clientHeight || 400;
    const groups = {}; data.nodes.forEach((n, i) => { groups[n.color] = groups[n.color] || []; groups[n.color].push(i); });
    const gkeys = Object.keys(groups); const gcenter = {};
    gkeys.forEach((k, gi) => { const a = gi / gkeys.length * Math.PI * 2; const R = this.opts.mini ? 60 : 380; gcenter[k] = { x: Math.cos(a) * R, y: Math.sin(a) * R }; });
    this.gcenter = gcenter;
    this.nodes = data.nodes.map((n, i) => { const c = gcenter[n.color]; const a = i * 2.4, r = Math.sqrt(i) * 6; return Object.assign({}, n, { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, vx: 0, vy: 0, r: (this.opts.mini ? 4 : 3.5) + Math.sqrt(n.deg || 0) * (this.opts.mini ? 1.6 : 2.4) }); });
    this.byId = {}; this.nodes.forEach(n => this.byId[n.id] = n);
    const top = this.nodes.slice().sort((a, b) => (b.deg || 0) - (a.deg || 0)).slice(0, 12); top.forEach(n => n.top = true);
    this.edges = data.edges.map(e => ({ a: this.byId[e.a], b: this.byId[e.b] })).filter(e => e.a && e.b);
    this.adj = {}; this.edges.forEach(e => { (this.adj[e.a.id] = this.adj[e.a.id] || new Set()).add(e.b.id); (this.adj[e.b.id] = this.adj[e.b.id] || new Set()).add(e.a.id); });
    if (this.opts.focus && this.byId[this.opts.focus]) { const f = this.byId[this.opts.focus]; f.x = 0; f.y = 0; f.r += 3; f.focus = true; }
    this.alpha = 1;
  }
  visible(n) { return !this.hidden.has(n.section); }
  bind() {
    const c = this.c;
    const pos = e => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    this.toWorld = p => ({ x: (p.x - c.clientWidth / 2 - this.tx) / this.scale, y: (p.y - c.clientHeight / 2 - this.ty) / this.scale });
    this.hit = p => { const w = this.toWorld(p); let best = null, bd = 1e9; for (const n of this.nodes) { if (!this.visible(n)) continue; const d = Math.hypot(n.x - w.x, n.y - w.y); if (d < Math.max(n.r + 4, 9) / Math.sqrt(this.scale) && d < bd) { best = n; bd = d; } } return best; };
    this.onDown = e => { const p = pos(e); const n = this.hit(p); if (n) { this.drag = { n, moved: false }; n.fx = n.x; n.fy = n.y; } else this.pan = { x: p.x, y: p.y, tx: this.tx, ty: this.ty, moved: false }; c.classList.add("dragging"); this.alpha = Math.max(this.alpha, .4); };
    this.onMove = e => {
      const p = pos(e);
      if (this.drag) { const w = this.toWorld(p); this.drag.n.fx = w.x; this.drag.n.fy = w.y; this.drag.moved = true; this.alpha = Math.max(this.alpha, .3); return; }
      if (this.pan) { this.tx = this.pan.tx + (p.x - this.pan.x); this.ty = this.pan.ty + (p.y - this.pan.y); if (Math.hypot(p.x - this.pan.x, p.y - this.pan.y) > 3) this.pan.moved = true; return; }
      const n = this.hit(p);
      if (n !== this.hover) { this.hover = n; c.style.cursor = n ? "pointer" : "grab"; if (this.opts.onHover) this.opts.onHover(n, e); }
    };
    this.onUp = e => {
      if (this.drag) { const n = this.drag.n; const moved = this.drag.moved; delete n.fx; delete n.fy; this.drag = null; if (!moved) this.open(n); }
      if (this.pan) { if (!this.pan.moved && this.opts.onHover) this.opts.onHover(null); this.pan = null; }
      c.classList.remove("dragging");
    };
    this.onWheel = e => { e.preventDefault(); const p = pos(e); const k = Math.exp(-e.deltaY * .0015); const ns = Math.min(4, Math.max(.15, this.scale * k)); const w = this.toWorld(p); this.scale = ns; this.tx = p.x - c.clientWidth / 2 - w.x * ns; this.ty = p.y - c.clientHeight / 2 - w.y * ns; };
    this.onLeave = () => { this.hover = null; if (this.opts.onHover) this.opts.onHover(null); };
    c.addEventListener("mousedown", this.onDown); window.addEventListener("mousemove", this.onMove); window.addEventListener("mouseup", this.onUp);
    c.addEventListener("wheel", this.onWheel, { passive: false }); c.addEventListener("mouseleave", this.onLeave);
    c.addEventListener("touchstart", e => { const t = e.touches[0]; this.onDown(t); }, { passive: true });
    c.addEventListener("touchmove", e => { const t = e.touches[0]; this.onMove(t); }, { passive: true });
    c.addEventListener("touchend", e => this.onUp(e));
  }
  open(n) { location.hash = noteHref(n.id); }
  destroy() { this.dead = true; window.removeEventListener("mousemove", this.onMove); window.removeEventListener("mouseup", this.onUp); }
  step() {
    const ns = this.nodes.filter(n => this.visible(n)); const mini = this.opts.mini;
    const rep = mini ? 900 : 5200, spring = mini ? .04 : .022, rest = mini ? 70 : 130, grav = mini ? .05 : .008, cluster = mini ? 0 : .018;
    if (cluster) { // przyciąganie do środka własnej grupy kolorów -> czytelne klastry
      const cx = {}, cy = {}, cn = {};
      for (const n of ns) { cx[n.color] = (cx[n.color] || 0) + n.x; cy[n.color] = (cy[n.color] || 0) + n.y; cn[n.color] = (cn[n.color] || 0) + 1; }
      for (const n of ns) { const k = n.color; n.vx += (cx[k] / cn[k] - n.x) * cluster; n.vy += (cy[k] / cn[k] - n.y) * cluster; }
    }
    for (let i = 0; i < ns.length; i++) { const a = ns[i]; for (let j = i + 1; j < ns.length; j++) { const b = ns[j]; let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx * dx + dy * dy + .01; if (d2 > 250000) continue; const f = rep / d2; const d = Math.sqrt(d2); dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; } }
    for (const e of this.edges) { if (!this.visible(e.a) || !this.visible(e.b)) continue; const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y; const d = Math.hypot(dx, dy) + .01; const f = (d - rest) * spring; e.a.vx += dx / d * f; e.a.vy += dy / d * f; e.b.vx -= dx / d * f; e.b.vy -= dy / d * f; }
    for (const n of ns) {
      n.vx -= n.x * grav; n.vy -= n.y * grav;
      if (n.fx !== undefined) { n.x = n.fx; n.y = n.fy; n.vx = n.vy = 0; continue; }
      if (n.focus && mini) { n.x *= .8; n.y *= .8; }
      n.vx *= .82; n.vy *= .82; n.x += n.vx * this.alpha; n.y += n.vy * this.alpha;
    }
    this.alpha = Math.max(.02, this.alpha * .985);
  }
  loop() {
    if (this.dead || !this.c.isConnected) return;
    const c = this.c, w = c.clientWidth, h = c.clientHeight; if (!w || !h) { requestAnimationFrame(this.loop); return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.step(); this.step();
    if (this.needFit) { this.needFit = false; this.fitToNodes(); }
    this.draw(w, h, dpr);
    requestAnimationFrame(this.loop);
  }
  draw(w, h, dpr) {
    const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const mini = this.opts.mini;
    if (!mini) { // siatka perspektywiczna w tle
      ctx.save(); ctx.strokeStyle = "rgba(184,255,46,.06)"; ctx.lineWidth = 1; const g = 60 * this.scale; const ox = ((this.tx + w / 2) % g + g) % g, oy = ((this.ty + h / 2) % g + g) % g;
      ctx.beginPath(); for (let x = ox; x < w; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, h); } for (let y = oy; y < h; y += g) { ctx.moveTo(0, y); ctx.lineTo(w, y); } ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(w / 2 + this.tx, h / 2 + this.ty); ctx.scale(this.scale, this.scale);
    const hov = this.hover, nb = hov ? this.adj[hov.id] || new Set() : null;
    const f = this.filter ? norm(this.filter) : "";
    const matches = n => !f || norm(n.label).includes(f);
    // krawędzie
    for (const e of this.edges) {
      if (!this.visible(e.a) || !this.visible(e.b)) continue;
      const lit = hov && (e.a === hov || e.b === hov);
      const dim = (hov && !lit) || (f && !(matches(e.a) && matches(e.b)));
      ctx.strokeStyle = lit ? e.a === hov ? e.b.color : e.a.color : "rgba(184,255,46,1)";
      ctx.globalAlpha = lit ? .9 : dim ? .04 : mini ? .35 : .13; ctx.lineWidth = lit ? 1.6 : .7;
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
    }
    // pakiety danych biegnące po krawędziach
    if (this.edges.length && Math.random() < (mini ? .03 : .12) && this.packets.length < (mini ? 3 : 14)) { const e = this.edges[Math.floor(Math.random() * this.edges.length)]; if (this.visible(e.a) && this.visible(e.b)) this.packets.push({ e, t: 0, dir: Math.random() < .5 ? 1 : -1, sp: .008 + Math.random() * .012 }); }
    this.packets = this.packets.filter(p => (p.t += p.sp) < 1);
    ctx.globalAlpha = 1;
    for (const p of this.packets) { const t = p.dir > 0 ? p.t : 1 - p.t; const x = p.e.a.x + (p.e.b.x - p.e.a.x) * t, y = p.e.a.y + (p.e.b.y - p.e.a.y) * t; ctx.fillStyle = "#f2a0b8"; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
    // węzły
    const t = performance.now() / 1000;
    for (const n of this.nodes) {
      if (!this.visible(n)) continue;
      const lit = hov && (n === hov || nb.has(n.id)); const dim = (hov && !lit) || (f && !matches(n));
      ctx.globalAlpha = dim ? .18 : 1;
      const r = n.r + (n === hov ? 3 : 0) + (n.focus ? Math.sin(t * 3) * 1.2 : 0);
      ctx.fillStyle = n.color; ctx.globalAlpha *= .18; ctx.beginPath(); ctx.arc(n.x, n.y, r * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = dim ? .25 : 1; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
      if (n === hov || n.focus || (f && matches(n))) { ctx.strokeStyle = n.color; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(1, r * .35), 0, Math.PI * 2); ctx.fill();
    }
    // etykiety
    const showAll = this.labelMode === "wszystkie" || this.scale > (mini ? 1.6 : 1.3);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    const placed = []; const overlaps = (x, y, w2, h2) => placed.some(b => Math.abs(b.x - x) < (b.w + w2) / 2 && Math.abs(b.y - y) < (b.h + h2) / 2);
    const order = this.nodes.slice().sort((a, b) => (b === hov) - (a === hov) || (b.focus || 0) - (a.focus || 0) || (b.deg || 0) - (a.deg || 0));
    for (const n of order) {
      if (!this.visible(n)) continue;
      const lit = hov && (n === hov || nb.has(n.id));
      const show = lit || n.focus || showAll || (!hov && !mini && n.top) || (mini && !hov && this.nodes.length <= 9) || (f && matches(n));
      if (this.labelMode === "brak" && !lit && !n.focus) continue;
      if (!show && this.labelMode !== "wszystkie") continue;
      const dim = (hov && !lit) || (f && !matches(n));
      const fs = (n === hov ? 12 : 10) / Math.max(.6, Math.sqrt(this.scale));
      ctx.font = `${n === hov || n.focus ? "700" : "500"} ${fs}px JetBrains Mono, monospace`;
      const label = n.label.length > 34 && n !== hov ? n.label.slice(0, 32) + "…" : n.label;
      const tw = ctx.measureText(label).width;
      const ly = n.y + n.r + 6 + fs / 2;
      if (!(lit || n === hov || n.focus) && overlaps(n.x, ly, tw + 8, fs + 6)) continue;
      placed.push({ x: n.x, y: ly, w: tw + 8, h: fs + 6 });
      ctx.globalAlpha = dim ? .15 : .95;
      ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.fillRect(n.x - tw / 2 - 3, n.y + n.r + 4, tw + 6, fs + 4);
      ctx.fillStyle = n === hov ? n.color : lit ? "#fff" : "#c8cbc4"; ctx.fillText(label, n.x, n.y + n.r + 6);
    }
    ctx.restore();
    if (!mini) { // celownik
      ctx.globalAlpha = .5; ctx.strokeStyle = "#b8ff2e"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w - 40, h - 60); ctx.lineTo(w - 20, h - 60); ctx.moveTo(w - 30, h - 70); ctx.lineTo(w - 30, h - 50); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  fit() { this.fitToNodes(); }
}

/* ---------- GRAPH VIEW ---------- */
function renderGraphView(focusId) {
  const secs = [...SECTIONS.map(s => ({ key: s.key, name: s.name, color: s.color, n: s.notes.length })), { key: "(root)", name: "Start", color: "#fff", n: NOTES.filter(n => !n.section).length }];
  main.innerHTML = `<div class="graph-view">
    <canvas id="graph-canvas"></canvas>
    <div class="graph-hud">
      <div class="panel"><div class="panel-title">// graf wiedzy_</div><input id="graph-filter" placeholder="filtruj węzły…" autocomplete="off"><div class="graph-controls" style="margin-top:10px"><button class="btn ghost" id="g-fit">wyśrodkuj</button><button class="btn ghost" id="g-labels">etykiety: auto</button>${focusId ? `<button class="btn ghost" id="g-all">cały graf</button>` : ""}${focusId ? `<button class="btn ghost" id="g-depth">głębokość: 1</button>` : ""}</div></div>
      <div class="panel"><div class="panel-title">// warstwy_</div><div class="legend">${secs.map(s => `<label style="--c:${s.color}" data-sec="${esc(s.key)}"><i></i>${esc(s.name)}<span class="cnt">${s.n}</span></label>`).join("")}</div></div>
    </div>
    <div class="graph-corner tr">${ALL.length} węzłów · ${NOTES.reduce((a, n) => a + n.links.length, 0)} linków</div>
    <div class="graph-info" id="graph-info"></div>
  </div>`;
  const canvas = $("#graph-canvas"); const info = $("#graph-info");
  let depth = 1;
  const data = () => focusId ? localGraphData(focusId, depth) : fullGraphData();
  const g = new ForceGraph(canvas, data(), {
    focus: focusId,
    onHover: (n) => {
      if (!n) { info.innerHTML = focusId && byId[focusId] ? infoHtml(byId[focusId], true) : ""; return; }
      info.innerHTML = infoHtml(byId[n.id]);
    },
  });
  activeGraph = g;
  function infoHtml(n, isFocus) {
    return `<div class="panel bracket"><div class="mono" style="color:${nodeColor(n)};margin-bottom:6px">■ ${esc(secName(n.section))}${isFocus ? " · fokus" : ""}</div><h3>${esc(n.title)}</h3><p>${esc(n.excerpt || "")}</p><div class="mono dim">${n.links.length} → · ← ${n.backlinks.length} · ${fmt(n.words)} słów</div><a class="btn" style="margin-top:10px;padding:6px 10px;font-size:10px" href="${noteHref(n.id)}">otwórz →</a></div>`;
  }
  if (focusId && byId[focusId]) info.innerHTML = infoHtml(byId[focusId], true);
  $("#graph-filter").oninput = e => { g.filter = e.target.value; };
  $("#g-fit").onclick = () => g.fit();
  const ga = $("#g-all"); if (ga) ga.onclick = () => { location.hash = "#/graph"; };
  const gl = $("#g-labels"); const modes = ["auto", "wszystkie", "brak"]; gl.onclick = () => { g.labelMode = modes[(modes.indexOf(g.labelMode) + 1) % 3]; gl.textContent = "etykiety: " + g.labelMode; };
  const gd = $("#g-depth"); if (gd) gd.onclick = () => { depth = depth === 1 ? 2 : depth === 2 ? 3 : 1; gd.textContent = "głębokość: " + depth; g.setData(data()); g.prerun(300); g.fit(); };
  $$(".legend label").forEach(l => l.onclick = () => { const s = l.dataset.sec; if (g.hidden.has(s)) g.hidden.delete(s); else g.hidden.add(s); l.classList.toggle("off", g.hidden.has(s)); g.alpha = .5; });
  window.addEventListener("keydown", function esc_(e) { if (e.key === "Escape" && parseRoute().name === "graph") { $("#graph-filter").value = ""; g.filter = ""; } if (parseRoute().name !== "graph") window.removeEventListener("keydown", esc_); });
}

/* ---------- SEARCH ---------- */
const overlay = $("#search"), sInput = $("#search-input"), sRes = $("#search-results");
let sel = 0, results = [];
function openSearch() { overlay.classList.add("open"); sInput.value = ""; sInput.focus(); runSearch(""); }
function closeSearch() { overlay.classList.remove("open"); }
function runSearch(q) {
  const nq = norm(q.trim());
  if (!nq) { results = NOTES.slice().sort((a, b) => b.mtime.localeCompare(a.mtime)).slice(0, 12); sel = 0; drawResults(nq, "ostatnio zmienione"); return; }
  const words = nq.split(/\s+/).filter(Boolean);
  results = NOTES.map(n => {
    let score = 0; let pos = -1;
    for (const w of words) { if (norm(n.title).includes(w)) score += 30; if (n._s.includes(w)) score += 12; const p = n._b.indexOf(w); if (p >= 0) { score += 4 + Math.min(20, (n._b.split(w).length - 1)); if (pos < 0) pos = p; } else score -= 15; }
    return { n, score, pos };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 40);
  sel = 0; drawResults(nq, null, words);
}
function drawResults(nq, label, words) {
  if (!results.length) { sRes.innerHTML = `<div class="empty">brak wyników dla „${esc(nq)}"</div>`; return; }
  const hi = s => { let h = esc(s); if (words) words.forEach(w => { if (w.length < 2) return; h = h.replace(new RegExp("(" + deburr(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>"); }); return h; };
  sRes.innerHTML = (label ? `<div class="mono dim" style="padding:8px 16px">// ${label}</div>` : "") + results.map((r, i) => {
    const n = r.n || r; let snip = n.excerpt;
    if (r.pos >= 0) { const raw = n.body; const p = Math.min(r.pos, raw.length); const a = Math.max(0, p - 80); snip = (a > 0 ? "…" : "") + stripMd(raw.slice(a, p + 140)) + "…"; }
    return `<a class="r ${i === sel ? "sel" : ""}" data-i="${i}" href="${noteHref(n.id)}" style="--sc:${nodeColor(n)}"><div class="rt"><span class="rs">${esc(n.folder || "root")}</span>${hi(n.title)}</div><div class="rx">${hi(snip)}</div></a>`;
  }).join("");
}
sInput.addEventListener("input", e => runSearch(e.target.value));
sInput.addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { sel = Math.min(results.length - 1, sel + 1); e.preventDefault(); }
  else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); e.preventDefault(); }
  else if (e.key === "Enter") { const r = results[sel]; if (r) { location.hash = noteHref((r.n || r).id); closeSearch(); } return; }
  else if (e.key === "Escape") { closeSearch(); return; }
  else return;
  $$(".r", sRes).forEach((a, i) => a.classList.toggle("sel", i === sel)); const s = $(".r.sel", sRes); if (s) s.scrollIntoView({ block: "nearest" });
});
overlay.addEventListener("click", e => { if (e.target === overlay) closeSearch(); });
$("#search-btn").onclick = openSearch;
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); overlay.classList.contains("open") ? closeSearch() : openSearch(); }
  else if (e.key === "Escape" && overlay.classList.contains("open")) closeSearch();
  else if (e.key === "/" && !overlay.classList.contains("open") && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
});

/* ---------- hover cards ---------- */
const hc = $("#hover-card"); let hcTimer;
document.addEventListener("mouseover", e => {
  const a = e.target.closest("a.wl, a.wl-fm, .tree a.leaf, .out-links a, .backlinks a.bl-t, .prevnext a");
  if (!a) return;
  const id = a.dataset.id || (a.getAttribute("href") || "").replace(/^#\/n\//, "").split("/")[0];
  const n = byId[id]; if (!n || n.isAtt) return;
  clearTimeout(hcTimer);
  hcTimer = setTimeout(() => {
    hc.innerHTML = `<div class="hc-sec" style="color:${nodeColor(n)}">■ ${esc(n.folder || "start")}</div><div class="hc-t">${esc(n.title)}</div><div class="hc-x">${esc(n.excerpt)}</div>`;
    const r = a.getBoundingClientRect(); let x = r.left, y = r.bottom + 8;
    if (x + 330 > innerWidth) x = innerWidth - 330; if (y + 180 > innerHeight) y = r.top - 170;
    hc.style.left = x + "px"; hc.style.top = y + "px"; hc.classList.add("show");
  }, 350);
  a.addEventListener("mouseleave", () => { clearTimeout(hcTimer); hc.classList.remove("show"); }, { once: true });
});

/* ---------- misc ---------- */
function gotoRandom() { const n = NOTES[Math.floor(Math.random() * NOTES.length)]; location.hash = noteHref(n.id); }
$("#random-btn").onclick = gotoRandom;
$("#brand-name").textContent = CONFIG.brand;
document.title = CONFIG.brand + " /// vault";
const sidebar = $("#sidebar"), backdrop = $("#sidebar-backdrop");
function closeSidebar() { sidebar.classList.remove("open"); backdrop.classList.remove("show"); }
$("#menu-btn").onclick = () => { sidebar.classList.toggle("open"); backdrop.classList.toggle("show", sidebar.classList.contains("open")); };
backdrop.onclick = closeSidebar;
window.addEventListener("scroll", () => { const h = document.documentElement; const p = h.scrollHeight - h.clientHeight; $("#progress").style.width = (p > 0 ? h.scrollTop / p * 100 : 0) + "%"; }, { passive: true });

/* ---------- start + vault na żywo ---------- */
async function refreshData(force) {
  try {
    const r = await fetch("/api/data", { cache: "no-store" }); if (!r.ok) throw 0;
    const j = await r.json();
    if (!force && j.version === VERSION) return;
    VERSION = j.version; initData(j.data); buildTree();
    if (!editing) rerender(); else highlightTree(editing.id);
  } catch (e) { /* tryb statyczny */ }
}
async function detectLive() {
  try {
    const r = await fetch("/api/version", { cache: "no-store" }); if (!r.ok) throw 0;
    const j = await r.json(); LIVE = !!j.live; VERSION = j.version; return true;
  } catch (e) { LIVE = false; return false; }
}
(async () => {
  initData(window.VAULT_DATA);
  boot();
  if (await detectLive()) {
    await refreshData(true);
    setInterval(async () => {
      try { const r = await fetch("/api/version", { cache: "no-store" }); const j = await r.json(); if (j.version !== VERSION) refreshData(); } catch (e) {}
    }, 2000);
  } else { buildTree(); }
  window.addEventListener("hashchange", route);
  route();
})();
})();
