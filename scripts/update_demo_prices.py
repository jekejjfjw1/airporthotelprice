"""Move the current demo prices in the HTML. Run manually or from GitHub Actions."""
from pathlib import Path
import random
import re
from datetime import datetime, timezone

HTML_PATH = Path(__file__).resolve().parents[1] / "site" / "index.html"
PRICE_RE = re.compile(
    r'(?P<before><strong class="price-value" data-product-id="(?P<product>[^\"]+)" data-price-value=")'
    r'(?P<price>\d+)'
    r'(?P<after>">)₩(?P<display>[\d,]+)(?P<close></strong>)'
)

# Stable randomness within a run, changing between runs.
seed = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
rng = random.Random(seed)

html = HTML_PATH.read_text(encoding="utf-8")
count = 0

def move_price(match: re.Match) -> str:
    global count
    count += 1
    old_price = int(match.group("price"))
    percent = rng.choice([-0.04, -0.025, -0.01, 0.01, 0.025, 0.04])
    step = 1000
    new_price = max(30000, int(round(old_price * (1 + percent) / step) * step))
    return (
        match.group("before") + str(new_price) + match.group("after")
        + f"₩{new_price:,}" + match.group("close")
    )

updated_html = PRICE_RE.sub(move_price, html)
if count == 0:
    raise SystemExit("No price elements found; expected .price-value strong tags with data-price-value.")
HTML_PATH.write_text(updated_html, encoding="utf-8")
print(f"Updated {count} demo prices in {HTML_PATH}")
