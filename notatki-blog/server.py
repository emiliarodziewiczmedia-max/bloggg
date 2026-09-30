#!/usr/bin/env python3
"""
Serwer bloga: serwuje pliki strony i daje jej dostęp do vaulta na żywo.

    python3 server.py                # vault domyślny (Desktop/notatki), port 8765
    python3 server.py /inny/vault    # inny vault
    PORT=9000 python3 server.py

API (używane przez app.js):
    GET  /api/version        odcisk stanu vaulta — strona odpytuje co 2 s i przeładowuje dane po zmianie
    GET  /api/data           dane wszystkich notatek (to samo, co data.js, ale świeże)
    GET  /api/raw?path=...   surowa treść pliku .md (do edytora)
    POST /api/save           {"path": "...", "content": "..."} — zapis pliku .md w vaulcie
    POST /api/new            {"path": "Folder/Nazwa.md", "content": "..."} — nowy plik (nie nadpisuje istniejącego)

Zapis trafia prosto do pliku w vaulcie, więc Obsidian widzi zmianę od razu; i odwrotnie —
zapis w Obsidianie zmienia odcisk i strona sama się odświeża.
"""
import json
import os
import sys
import unicodedata
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import build

HERE = os.path.dirname(os.path.abspath(__file__))
VAULT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else build.VAULT
PORT = int(os.environ.get("PORT", "8765"))

_cache = {"version": None, "data": None}


def current_data():
    v = build.vault_version(VAULT)
    if v != _cache["version"]:
        _cache["data"] = build.build_data(VAULT)
        _cache["version"] = v
        try:
            build.write_data_js(_cache["data"])
        except OSError:
            pass
    return _cache["data"], v


def safe_path(rel):
    """Ścieżka względna z API -> bezwzględna w vaulcie, albo None gdy niedozwolona."""
    rel = unicodedata.normalize("NFC", rel or "").replace("\\", "/").lstrip("/")
    if not rel.endswith(".md") or ".." in rel.split("/"):
        return None
    top = rel.split("/")[0]
    if top in build.SKIP_DIRS or top.startswith("."):
        return None
    full = os.path.abspath(os.path.join(VAULT, rel))
    if not full.startswith(VAULT + os.sep):
        return None
    return full


def find_existing(full):
    """Pliki na macOS bywają zapisane w NFD — znajdź faktyczny wpis na dysku."""
    if os.path.exists(full):
        return full
    d, fn = os.path.split(full)
    if not os.path.isdir(d):
        d_nfd = unicodedata.normalize("NFD", d)
        if os.path.isdir(d_nfd):
            d = d_nfd
        else:
            return None
    want = unicodedata.normalize("NFC", fn)
    for name in os.listdir(d):
        if unicodedata.normalize("NFC", name) == want:
            return os.path.join(d, name)
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def log_message(self, fmt, *args):
        if "/api/version" in (args[0] if args else ""):
            return
        super().log_message(fmt, *args)

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8") or "{}")

    def end_headers(self):
        if self.path.split("?")[0].endswith((".js", ".css", ".html")):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/api/version":
            return self.send_json({"version": build.vault_version(VAULT), "vault": VAULT, "live": True})
        if url.path == "/api/data":
            data, v = current_data()
            return self.send_json({"version": v, "data": data})
        if url.path == "/api/raw":
            q = urllib.parse.parse_qs(url.query)
            full = safe_path(q.get("path", [""])[0])
            real = find_existing(full) if full else None
            if not real:
                return self.send_json({"error": "nie ma takiego pliku"}, 404)
            with open(real, encoding="utf-8") as f:
                return self.send_json({"path": q["path"][0], "content": f.read()})
        return super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        if url.path in ("/api/save", "/api/new"):
            try:
                body = self.read_body()
            except (ValueError, json.JSONDecodeError):
                return self.send_json({"error": "zły JSON"}, 400)
            full = safe_path(body.get("path", ""))
            if not full:
                return self.send_json({"error": "niedozwolona ścieżka"}, 400)
            content = body.get("content", "")
            if not isinstance(content, str):
                return self.send_json({"error": "treść musi być tekstem"}, 400)
            real = find_existing(full)
            if url.path == "/api/new":
                if real:
                    return self.send_json({"error": "plik już istnieje"}, 409)
                os.makedirs(os.path.dirname(full), exist_ok=True)
                real = full
            elif not real:
                return self.send_json({"error": "nie ma takiego pliku"}, 404)
            tmp = real + ".tmp~"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(content)
            os.replace(tmp, real)
            return self.send_json({"ok": True, "version": build.vault_version(VAULT)})
        return self.send_json({"error": "nieznane API"}, 404)


if __name__ == "__main__":
    if not os.path.isdir(VAULT):
        sys.exit(f"Nie ma vaulta: {VAULT}")
    current_data()
    print(f"vault: {VAULT}\nblog:  http://localhost:{PORT}/")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
