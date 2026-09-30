#!/usr/bin/env python3
"""
Buduje data.js z vaulta Obsidiana (folder notatki).

Użycie:
    python3 build.py                 # vault domyślny: ../../notatki (Desktop/notatki)
    python3 build.py /sciezka/vault  # inny vault

Pomija: .obsidian, folder Prywatne, pliki nie-.md (PDF-y trafiają jako załączniki).
Treść notatek nie jest zmieniana — do data.js trafia surowy markdown.
"""
import json
import os
import re
import sys
import unicodedata
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
VAULT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "..", "notatki")
VAULT = os.path.abspath(VAULT)
OUT = os.path.join(HERE, "data.js")

SKIP_DIRS = {".obsidian", "Prywatne", ".trash", ".git"}
SKIP_FILES = {"Icon", ".DS_Store"}
ATTACH_EXT = {".pdf"}

# Załączniki skopiowane do assets/ (nazwa w vaulcie -> ścieżka w projekcie)
ATTACHMENTS = {
    "pan moj lucjusz.pdf": "assets/pan-moj-lucjusz.pdf",
}


def slugify(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("ł", "l").replace("Ł", "L")
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s or "x"


def parse_scalar(v):
    v = v.strip()
    if v == "" or v == "[]":
        return [] if v == "[]" else ""
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    if v.lower() in ("true", "false"):
        return v.lower() == "true"
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    return v


def parse_frontmatter(text):
    """Minimalny parser YAML: klucz: wartość, listy z myślnikiem, bloki |."""
    if not text.startswith("---"):
        return {}, text
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?", text, re.S)
    if not m:
        return {}, text
    block, body = m.group(1), text[m.end():]
    fm = {}
    lines = block.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        km = re.match(r"^([^\s:][^:]*):\s*(.*)$", line)
        if not km:
            i += 1
            continue
        key, val = km.group(1).strip(), km.group(2)
        if val.strip() in ("|", ">", "|-", ">-"):
            buf = []
            i += 1
            while i < len(lines) and (lines[i].startswith("  ") or lines[i].strip() == ""):
                buf.append(lines[i][2:] if lines[i].startswith("  ") else "")
                i += 1
            fm[key] = "\n".join(buf).rstrip()
            continue
        if val.strip() == "":
            items = []
            j = i + 1
            while j < len(lines) and re.match(r"^\s+-\s*", lines[j]):
                items.append(parse_scalar(re.sub(r"^\s+-\s*", "", lines[j])))
                j += 1
            if j > i + 1:
                fm[key] = items
                i = j
                continue
            fm[key] = ""
            i += 1
            continue
        if val.strip().startswith("[") and val.strip().endswith("]"):
            inner = val.strip()[1:-1].strip()
            fm[key] = [parse_scalar(x) for x in inner.split(",")] if inner else []
        else:
            fm[key] = parse_scalar(val)
        i += 1
    return fm, body


WIKI_RE = re.compile(r"\[\[([^\]]+?)\]\]")
HEAD_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$", re.M)
BLOCK_RE = re.compile(r"\s\^([A-Za-z0-9-]+)\s*$", re.M)
FENCE_RE = re.compile(r"```.*?```", re.S)
TAG_RE = re.compile(r"(?:^|(?<=\s))#([A-Za-zÀ-ɏ][\wÀ-ɏ/-]*)", re.M)


def strip_md(s):
    s = re.sub(r"```.*?```", "", s, flags=re.S)
    s = re.sub(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\\?\|([^\]]+))?\]\]", lambda m: m.group(2) or m.group(1), s)
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"[*_`>#|=~]+", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def first_paragraph(body):
    text = re.sub(r"```.*?```", "", body, flags=re.S)
    for para in re.split(r"\n\s*\n", text):
        p = para.strip()
        if not p or p.startswith("#") or p.startswith("|") or p.startswith("---") or p.startswith("- ") or p.startswith("1."):
            continue
        return strip_md(p)[:280]
    for para in re.split(r"\n\s*\n", text):
        p = para.strip()
        if p and not p.startswith("#"):
            return strip_md(p)[:280]
    return ""


def build_data(vault=VAULT):
    """Zwraca słownik z danymi vaulta (bez zapisu na dysk)."""
    global VAULT
    VAULT = vault
    notes = []
    attachments = []
    for root, dirs, files in os.walk(VAULT):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
        for fn in sorted(files):
            if fn in SKIP_FILES or fn.startswith("."):
                continue
            full = os.path.join(root, fn)
            rel = unicodedata.normalize("NFC", os.path.relpath(full, VAULT))
            stem, ext = os.path.splitext(unicodedata.normalize("NFC", fn))
            if ext.lower() in ATTACH_EXT:
                attachments.append({
                    "id": "att-" + slugify(rel),
                    "name": fn,
                    "stem": stem,
                    "path": rel,
                    "src": ATTACHMENTS.get(fn, ""),
                    "type": ext.lower()[1:],
                    "folder": os.path.dirname(rel),
                    "section": rel.split(os.sep)[0] if os.sep in rel else "",
                })
                continue
            if ext.lower() != ".md":
                continue
            with open(full, encoding="utf-8") as f:
                raw = f.read()
            fm, body = parse_frontmatter(raw)
            title_m = re.search(r"^#\s+(.+?)\s*$", body, re.M)
            title = title_m.group(1).strip() if title_m else stem
            aliases = fm.get("aliases", [])
            if isinstance(aliases, str):
                aliases = [aliases] if aliases else []
            tags = fm.get("tags", [])
            if isinstance(tags, str):
                tags = [tags] if tags else []
            tags = [str(t).lstrip("#") for t in tags]
            body_nofence = FENCE_RE.sub("", body)
            for m in TAG_RE.finditer(body_nofence):
                t = m.group(1)
                if t not in tags and not re.fullmatch(r"\d+", t):
                    tags.append(t)
            headings = [{"level": len(m.group(1)), "text": m.group(2).strip(), "slug": slugify(m.group(2))}
                        for m in HEAD_RE.finditer(body)]
            blocks = sorted(set(BLOCK_RE.findall(body_nofence)))
            words = len(re.findall(r"\w+", body_nofence, re.U))
            st = os.stat(full)
            notes.append({
                "id": slugify(rel[:-3]),
                "stem": stem,
                "title": title,
                "path": rel,
                "folder": os.path.dirname(rel),
                "section": rel.split(os.sep)[0] if os.sep in rel else "",
                "aliases": [str(a) for a in aliases],
                "tags": tags,
                "fm": fm,
                "headings": headings,
                "blocks": blocks,
                "words": words,
                "excerpt": first_paragraph(body),
                "mtime": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d"),
                "body": body,
                "_rawlinks": [m.group(1) for m in WIKI_RE.finditer(body_nofence)],
            })

    # Rozwiązywanie linków: po nazwie pliku (bez rozszerzenia), potem po aliasie, potem po ścieżce
    by_stem = {}
    by_alias = {}
    by_path = {}
    for n in notes:
        by_stem.setdefault(n["stem"].lower(), n["id"])
        by_path[n["path"][:-3].lower()] = n["id"]
        for a in n["aliases"]:
            by_alias.setdefault(a.lower(), n["id"])
    for a in attachments:
        by_stem.setdefault(a["name"].lower(), a["id"])
        by_stem.setdefault(a["stem"].lower(), a["id"])

    def resolve(target):
        t = unicodedata.normalize("NFC", target.strip()).replace('\\"', '"')
        if t.endswith(".md"):
            t = t[:-3]
        tl = t.lower()
        return by_stem.get(tl) or by_path.get(tl) or by_alias.get(tl) or None

    resolve_map = {}
    for n in notes:
        links = []
        for raw in n["_rawlinks"]:
            target = re.split(r"\\\||\|", raw)[0]
            target = target.split("#")[0]
            if not target.strip():
                continue
            rid = resolve(target)
            resolve_map[target.strip().lower()] = rid
            if rid and rid not in links and rid != n["id"]:
                links.append(rid)
        # linki z frontmattera (powiązane, poprzedni, następny)
        for key in ("powiązane", "poprzedni", "następny"):
            v = n["fm"].get(key)
            vals = v if isinstance(v, list) else ([v] if v else [])
            for item in vals:
                for m in WIKI_RE.finditer(str(item)):
                    target = re.split(r"\\\||\|", m.group(1))[0].split("#")[0]
                    rid = resolve(target)
                    resolve_map[target.strip().lower()] = rid
                    if rid and rid not in links and rid != n["id"]:
                        links.append(rid)
        n["links"] = links
        del n["_rawlinks"]

    backlinks = {n["id"]: [] for n in notes}
    for a in attachments:
        backlinks[a["id"]] = []
    for n in notes:
        for l in n["links"]:
            if l in backlinks and n["id"] not in backlinks[l]:
                backlinks[l].append(n["id"])
    for n in notes:
        n["backlinks"] = backlinks[n["id"]]
    for a in attachments:
        a["backlinks"] = backlinks[a["id"]]

    sections = []
    for n in notes:
        s = n["section"] or "(root)"
        if s not in sections:
            sections.append(s)

    data = {
        "built": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "vault": os.path.basename(VAULT),
        "notes": notes,
        "attachments": attachments,
        "resolve": {k: v for k, v in resolve_map.items()},
        "sections": sections,
    }
    return data


def vault_version(vault=VAULT):
    """Odcisk stanu vaulta: zmienia się, gdy jakikolwiek plik .md/.pdf zostanie dodany, usunięty albo zapisany."""
    import hashlib
    h = hashlib.md5()
    for root, dirs, files in os.walk(vault):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
        for fn in sorted(files):
            ext = os.path.splitext(fn)[1].lower()
            if ext != ".md" and ext not in ATTACH_EXT:
                continue
            full = os.path.join(root, fn)
            try:
                st = os.stat(full)
            except OSError:
                continue
            h.update(f"{fn}|{st.st_mtime_ns}|{st.st_size};".encode("utf-8"))
    return h.hexdigest()


def write_data_js(data, out=OUT):
    js = "window.VAULT_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n"
    with open(out, "w", encoding="utf-8") as f:
        f.write(js)


def main():
    data = build_data(VAULT)
    write_data_js(data)
    notes = data["notes"]
    total_links = sum(len(n["links"]) for n in notes)
    unresolved = sorted(k for k, v in data["resolve"].items() if v is None)
    print(f"OK: {len(notes)} notatek, {len(data['attachments'])} załączników, {total_links} linków, "
          f"{sum(n['words'] for n in notes)} słów -> {OUT} ({os.path.getsize(OUT)//1024} KB)")
    if unresolved:
        print("Nierozwiązane linki:", ", ".join(unresolved))


if __name__ == "__main__":
    main()
