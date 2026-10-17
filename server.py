from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import json
import time
import random
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "site")
START_PRICES = [
    {"id": "tokyo", "name": "서울 → 도쿄", "kind": "항공권", "price": 238000, "step": 7000, "detail": "왕복 · 일반석 · 1인"},
    {"id": "osaka", "name": "서울 → 오사카", "kind": "항공권", "price": 215000, "step": 6500, "detail": "왕복 · 일반석 · 1인"},
    {"id": "bangkok", "name": "서울 → 방콕", "kind": "항공권", "price": 329000, "step": 9000, "detail": "왕복 · 일반석 · 1인"},
    {"id": "jeju", "name": "서울 → 제주", "kind": "항공권", "price": 49000, "step": 2500, "detail": "왕복 · 일반석 · 1인"},
    {"id": "tokyoh", "name": "도쿄 시티 호텔", "kind": "호텔", "price": 112000, "step": 5000, "detail": "1박 · 스탠다드룸 · 2인"},
    {"id": "osakah", "name": "오사카 센트럴 호텔", "kind": "호텔", "price": 89000, "step": 4500, "detail": "1박 · 더블룸 · 2인"},
]
# Stable price snapshots: one new snapshot every 12 seconds.
# The browser must fetch /api/prices to receive the next server response.
def snapshot():
    bucket = int(time.time() // 12)
    items = []
    for i, p in enumerate(START_PRICES):
        # Deterministic within each time bucket, so the response stays stable for 12 sec.
        wave = ((bucket * (i + 3) + i * 5) % 9) - 4
        price = max(15000, p["price"] + wave * p["step"])
        items.append({
            "id": p["id"], "name": p["name"], "kind": p["kind"],
            "detail": p["detail"], "price": price
        })
    return {
        "source": "TripSignal demo API",
        "updated_at": int(time.time()),
        "refresh_seconds": 12,
        "demo_data": True,
        "prices": items
    }

class Handler(BaseHTTPRequestHandler):
    def send_bytes(self, code, data, content_type):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/prices":
            payload = json.dumps(snapshot(), ensure_ascii=False).encode("utf-8")
            self.send_bytes(200, payload, "application/json; charset=utf-8")
            return
        if path == "/api/health":
            self.send_bytes(200, b'{"ok":true}', "application/json; charset=utf-8")
            return
        if path == "/":
            path = "/index.html"
        full = os.path.abspath(os.path.join(SITE, path.lstrip("/")))
        if not full.startswith(os.path.abspath(SITE) + os.sep) and full != os.path.join(os.path.abspath(SITE), "index.html"):
            self.send_bytes(403, b"Forbidden", "text/plain; charset=utf-8")
            return
        if not os.path.isfile(full):
            self.send_bytes(404, b"Not found", "text/plain; charset=utf-8")
            return
        ext = os.path.splitext(full)[1].lower()
        mime = {".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8"}.get(ext, "application/octet-stream")
        with open(full, "rb") as f:
            self.send_bytes(200, f.read(), mime)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

if __name__ == "__main__":
    host, port = "127.0.0.1", 8000
    print("TripSignal demo server running: http://127.0.0.1:8000")
    print("Network API endpoint: http://127.0.0.1:8000/api/prices")
    print("Stop with Ctrl+C.")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
