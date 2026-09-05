#!/usr/bin/env python3
"""Локальный сервер разработки drennydrop без кэширования.
Запуск:  python3 dev.py  →  http://localhost:8000
Все файлы отдаются с no-store: Safari/Chrome всегда видят свежую версию."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    addr = ("", 8000)
    print("drennydrop dev server → http://localhost:8000/upgrade.html  (Ctrl+C — стоп)")
    ThreadingHTTPServer(addr, NoCacheHandler).serve_forever()
