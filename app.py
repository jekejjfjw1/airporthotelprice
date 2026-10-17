import os
import time
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder="site", static_url_path="")
CORS(app)

# Demo prices are shared by all visitors. A new price set is calculated every 12 seconds.
# No background loop is needed; prices are derived from the current 12-second time window.
DESTINATIONS = [
    {"id": "tokyo", "name": "도쿄", "kind": "항공권", "base": 238000, "step": 7000},
    {"id": "osaka", "name": "오사카", "kind": "항공권", "base": 215000, "step": 6500},
    {"id": "bangkok", "name": "방콕", "kind": "항공권", "base": 329000, "step": 9000},
    {"id": "jeju", "name": "제주", "kind": "항공권", "base": 49000, "step": 2500},
    {"id": "tokyo-hotel", "name": "도쿄 호텔 1박", "kind": "호텔", "base": 112000, "step": 5000},
    {"id": "osaka-hotel", "name": "오사카 호텔 1박", "kind": "호텔", "base": 89000, "step": 4500},
]

def get_prices():
    # All clients in the same 12-second bucket receive the same demo prices.
    bucket = int(time.time() // 12)
    results = []
    for i, item in enumerate(DESTINATIONS):
        # Deterministic variation: same time bucket -> same price for every visitor.
        # Use a simple bounded cycle, avoiding random per-request differences.
        variation_steps = ((bucket + i * 3) % 9) - 4
        price = max(10000, item["base"] + variation_steps * item["step"])
        results.append({
            "id": item["id"],
            "name": item["name"],
            "kind": item["kind"],
            "price": price,
            "currency": "KRW",
            "updated_bucket": bucket,
        })
    return {"updated_at": int(time.time()), "refresh_seconds": 12, "demo": True, "prices": results}

@app.get("/api/prices")
def prices():
    return jsonify(get_prices())

@app.get("/api/health")
def health():
    return jsonify({"ok": True})

@app.get("/")
def index():
    return send_from_directory("site", "index.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port)
