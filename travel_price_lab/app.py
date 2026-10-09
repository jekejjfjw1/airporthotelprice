from datetime import date, datetime, timedelta
import time
import zlib
from flask import Flask, request, render_template_string, url_for

app = Flask(__name__)

AIRPORTS = {
    "ICN": "인천(ICN)", "GMP": "김포(GMP)", "PUS": "부산/김해(PUS)",
    "NRT": "도쿄 나리타(NRT)", "KIX": "오사카 간사이(KIX)", "FUK": "후쿠오카(FUK)",
    "BKK": "방콕(BKK)", "TPE": "타이베이(TPE)"
}

FLIGHT_TEMPLATES = [
    {"id": "KE701", "airline": "Korea Demo Air", "number": "KD701", "from": "ICN", "to": "NRT", "depart": "08:20", "arrive": "10:45", "base": 318000},
    {"id": "OZ103", "airline": "Seoul Sample Airlines", "number": "SS103", "from": "ICN", "to": "NRT", "depart": "10:05", "arrive": "12:30", "base": 336000},
    {"id": "LJ205", "airline": "Blue Demo Jet", "number": "BD205", "from": "ICN", "to": "NRT", "depart": "13:40", "arrive": "16:05", "base": 289000},
    {"id": "TW221", "airline": "Travel Sample Air", "number": "TS221", "from": "ICN", "to": "KIX", "depart": "09:15", "arrive": "11:00", "base": 224000},
    {"id": "BX121", "airline": "Busan Demo Air", "number": "BD121", "from": "PUS", "to": "FUK", "depart": "11:25", "arrive": "12:30", "base": 176000},
    {"id": "ZE611", "airline": "Sample Island Airlines", "number": "SI611", "from": "GMP", "to": "TPE", "depart": "07:50", "arrive": "09:35", "base": 264000},
    {"id": "QX410", "airline": "World Demo Airways", "number": "WD410", "from": "ICN", "to": "BKK", "depart": "18:30", "arrive": "22:20", "base": 412000},
]

HOTELS = [
    {"id": "HT101", "name": "Tokyo Maple Hotel (Demo)", "city": "도쿄", "rating": 4.7, "base": 142000, "kind": "호텔", "closed_dates": []},
    {"id": "HT102", "name": "Nippori Budget Stay (Demo)", "city": "도쿄", "rating": 4.1, "base": 87000, "kind": "비즈니스 호텔", "closed_dates": []},
    {"id": "HT103", "name": "Asakusa Garden Inn (Demo)", "city": "도쿄", "rating": 4.5, "base": 119000, "kind": "게스트하우스", "closed_dates": []},
    {"id": "HT104", "name": "Shinjuku Sky Suites (Demo)", "city": "도쿄", "rating": 4.8, "base": 208000, "kind": "레지던스", "closed_dates": []},
    {"id": "HT201", "name": "Osaka Namba Stay (Demo)", "city": "오사카", "rating": 4.4, "base": 103000, "kind": "호텔", "closed_dates": []},
    {"id": "HT202", "name": "Osaka River House (Demo)", "city": "오사카", "rating": 4.6, "base": 158000, "kind": "펜션형 숙소", "closed_dates": []},
    {"id": "HT301", "name": "Fukuoka Harbor Hotel (Demo)", "city": "후쿠오카", "rating": 4.3, "base": 96000, "kind": "호텔", "closed_dates": []},
    {"id": "HT401", "name": "Taipei Lantern Inn (Demo)", "city": "타이베이", "rating": 4.5, "base": 112000, "kind": "호텔", "closed_dates": []},
]

BASE_HTML = """
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ title }} | 가상 여행 가격 실험실</title>
<style>
:root{font-family:Arial,'Malgun Gothic',sans-serif;color:#1d2733;background:#f4f7fb}body{margin:0}.top{background:#153a5b;color:white;padding:22px max(20px,calc((100% - 1080px)/2))}.top a{color:#dff2ff;margin-right:18px;text-decoration:none;font-weight:bold}.wrap{max-width:1080px;margin:24px auto;padding:0 18px}.panel,.card{background:#fff;border:1px solid #e1e7ef;border-radius:14px;padding:18px;margin:12px 0;box-shadow:0 2px 7px #172b3d0a}.form{display:flex;gap:12px;flex-wrap:wrap;align-items:end}.field{display:flex;flex-direction:column;gap:6px}.field label{font-size:13px;color:#536273}.field input,.field select{padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.btn{padding:11px 15px;border:0;border-radius:8px;background:#1273aa;color:white;font-weight:bold;cursor:pointer}.muted{color:#68778a;font-size:13px}.price{font-size:24px;font-weight:800;color:#0e6b9a}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.tag{display:inline-block;background:#eaf5ff;padding:4px 8px;border-radius:99px;font-size:12px;margin-right:5px}.nav{margin-top:10px}.notice{background:#fff8db;border:1px solid #f2dfa0;border-radius:10px;padding:12px;margin:12px 0}.card h3{margin:8px 0}.meta{display:flex;gap:12px;flex-wrap:wrap;color:#536273;font-size:14px}.price small{font-size:12px;font-weight:normal;color:#68778a}.inline{display:inline-block;margin-right:10px}
</style></head><body><header class="top"><strong>✈ 가상 여행 가격 실험실</strong><div class="nav"><a href="{{ url_for('index') }}">홈</a><a href="{{ url_for('flights') }}">항공편 검색</a><a href="{{ url_for('hotels') }}">호텔 검색</a></div></header>
<main class="wrap"><h1>{{ title }}</h1><p class="muted">학원 프로젝트용 가상 데이터입니다. 실제 항공사·호텔의 가격이나 예약 가능 여부가 아닙니다.</p>{{ body|safe }}</main></body></html>
"""


def page(title, body, **context):
    return render_template_string(BASE_HTML, title=title, body=body, **context)


def parse_iso(name, fallback):
    raw = request.args.get(name, "").strip()
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return fallback


def price_at(base_price, item_key):
    """Simulated price fluctuation: the displayed price changes every 12 seconds."""
    patterns = [0.00, -0.035, 0.025, -0.015, 0.055, -0.045, 0.012, -0.025]
    seed = zlib.crc32(item_key.encode("utf-8")) % len(patterns)
    tick = int(time.time() // 12)
    pct = patterns[(tick + seed) % len(patterns)]
    return int(round(base_price * (1 + pct) / 1000) * 1000)


def date_range(start, end):
    count = (end - start).days
    if count < 0:
        start, end = end, start
        count = (end - start).days
    # Keep demos bounded if user enters a very long date range.
    count = min(count, 14)
    return [start + timedelta(days=i) for i in range(count + 1)]


@app.route("/")
def index():
    today = date.today()
    start = today + timedelta(days=14)
    end = start + timedelta(days=2)
    body = f"""
    <div class='panel'><h2>프로젝트 데모</h2><p>가격이 약 12초마다 가상으로 바뀌도록 만들어 웹 크롤러가 같은 항목의 가격 변화를 기록할 수 있습니다.</p>
    <div class='grid'><div class='card'><h3>항공편 가격 수집</h3><p>기간 내 여러 날짜의 항공편 목록, 출발·도착 시각과 가격을 제공합니다.</p><a class='btn' href='{url_for('flights', origin='ICN', destination='NRT', start=start.isoformat(), end=end.isoformat())}'>항공편 보기</a></div>
    <div class='card'><h3>호텔 가격 수집</h3><p>도시, 체크인·체크아웃 날짜, 평점·가격순 정렬을 지원합니다.</p><a class='btn' href='{url_for('hotels', city='도쿄', checkin=start.isoformat(), checkout=(end+timedelta(days=1)).isoformat(), sort='price')}'>호텔 보기</a></div></div></div>
    <div class='notice'><b>시연 방법:</b> 사이트를 열어 가격을 확인한 뒤 크롤러를 5초 간격으로 실행하세요. 12초마다 표시 가격이 바뀌고, 조회 내역이 SQLite에 누적됩니다. 실제 여행 가격은 아닙니다.</div>
    <div class='panel'><h3>사이트 구조</h3><p><code>/flights?origin=ICN&destination=NRT&start=YYYY-MM-DD&end=YYYY-MM-DD</code></p><p><code>/hotels?city=도쿄&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&sort=price</code></p></div>
    """
    return page("홈", body)


@app.route("/flights")
def flights():
    today = date.today()
    default_start = today + timedelta(days=14)
    default_end = default_start + timedelta(days=2)
    start = parse_iso("start", default_start)
    end = parse_iso("end", default_end)
    origin = request.args.get("origin", "ICN").upper()
    destination = request.args.get("destination", "NRT").upper()
    dates = date_range(start, end)
    valid_templates = [f for f in FLIGHT_TEMPLATES if f["from"] == origin and f["to"] == destination]
    # Provide some relevant sample flights even when the combination was not pre-configured.
    if not valid_templates:
        valid_templates = [
            {"id": f"DM{origin}{destination}1", "airline": "Demo Connect Air", "number": "DC101", "from": origin, "to": destination, "depart": "09:00", "arrive": "11:30", "base": 245000},
            {"id": f"DM{origin}{destination}2", "airline": "Sample Budget Air", "number": "SB202", "from": origin, "to": destination, "depart": "14:20", "arrive": "16:50", "base": 198000},
            {"id": f"DM{origin}{destination}3", "airline": "Demo Skyways", "number": "DS303", "from": origin, "to": destination, "depart": "19:05", "arrive": "21:35", "base": 276000},
        ]
    items = []
    for travel_date in dates:
        for f in valid_templates:
            key = f'{f["id"]}|{travel_date.isoformat()}|{origin}|{destination}'
            items.append({**f, "travel_date": travel_date.isoformat(), "price": price_at(f["base"], key), "key": key})
    items.sort(key=lambda x: (x["travel_date"], x["price"]))
    options = "".join(f'<option value="{code}" {"selected" if code==origin else ""}>{label}</option>' for code,label in AIRPORTS.items())
    dest_options = "".join(f'<option value="{code}" {"selected" if code==destination else ""}>{label}</option>' for code,label in AIRPORTS.items())
    cards = "".join(f'''<article class="card flight-card" data-flight-id="{item['id']}" data-flight-key="{item['key']}" data-date="{item['travel_date']}" data-origin="{origin}" data-destination="{destination}" data-airline="{item['airline']}" data-price="{item['price']}">
      <span class="tag">{item['travel_date']}</span><span class="tag">{item['number']}</span><h3>{item['airline']}</h3><div class="meta"><span>{item['from']} {item['depart']}</span><span>→</span><span>{item['to']} {item['arrive']}</span><span>직항(예시)</span></div><p class="price">₩{item['price']:,} <small>1인 편도 예시 가격</small></p></article>''' for item in items)
    body = f'''<div class="panel"><form class="form" method="get"><div class="field"><label>출발 공항</label><select name="origin">{options}</select></div><div class="field"><label>도착 공항</label><select name="destination">{dest_options}</select></div><div class="field"><label>여행 시작일</label><input type="date" name="start" value="{start.isoformat()}" required></div><div class="field"><label>여행 종료일</label><input type="date" name="end" value="{end.isoformat()}" required></div><button class="btn">항공편 검색</button></form></div>
    <p class="muted">검색 결과 {len(items)}개 · 날짜 범위는 최대 15일로 제한됩니다. 실제 운항편 데이터가 아닌 데모 데이터입니다.</p><div class="grid">{cards}</div>'''
    return page("항공편 검색", body)


@app.route("/hotels")
def hotels():
    today = date.today()
    default_checkin = today + timedelta(days=14)
    default_checkout = default_checkin + timedelta(days=2)
    checkin = parse_iso("checkin", default_checkin)
    checkout = parse_iso("checkout", default_checkout)
    city = request.args.get("city", "도쿄")
    sort = request.args.get("sort", "price")
    if checkout <= checkin:
        body = "<div class='notice'>체크아웃은 체크인보다 뒤 날짜여야 합니다. 날짜를 다시 선택해 주세요.</div>"
        return page("호텔 검색", body), 400
    nights = (checkout - checkin).days
    # Sample availability: each demo hotel has dates where it is unavailable, to demonstrate date filtering.
    unavailable = {
        "HT102": {checkin.isoformat()} if checkin.day % 5 == 0 else set(),
        "HT201": {(checkin + timedelta(days=1)).isoformat()} if checkin.day % 4 == 0 else set(),
    }
    available = []
    for h in HOTELS:
        if h["city"] != city:
            continue
        dates = [checkin + timedelta(days=i) for i in range(nights)]
        if any(d.isoformat() in unavailable.get(h["id"], set()) for d in dates):
            continue
        per_night = price_at(h["base"], f'{h["id"]}|{checkin.isoformat()}|{checkout.isoformat()}')
        available.append({**h, "price_per_night": per_night, "total_price": per_night*nights, "checkin": checkin.isoformat(), "checkout": checkout.isoformat(), "nights": nights})
    if sort == "rating":
        available.sort(key=lambda x: (-x["rating"], x["total_price"]))
    else:
        available.sort(key=lambda x: (x["total_price"], -x["rating"]))
    city_options = "".join(f'<option value="{c}" {"selected" if c==city else ""}>{c}</option>' for c in ["도쿄","오사카","후쿠오카","타이베이"])
    cards = "".join(f'''<article class="card hotel-card" data-hotel-id="{h['id']}" data-hotel-key="{h['id']}|{h['checkin']}|{h['checkout']}" data-city="{h['city']}" data-rating="{h['rating']}" data-price-per-night="{h['price_per_night']}" data-total-price="{h['total_price']}" data-checkin="{h['checkin']}" data-checkout="{h['checkout']}">
      <span class="tag">{h['kind']}</span><span class="tag">{h['city']}</span><h3>{h['name']}</h3><div class="meta"><span>평점 ★ {h['rating']:.1f}</span><span>{nights}박</span><span>{h['checkin']} ~ {h['checkout']}</span></div><p class="price">₩{h['total_price']:,} <small>총액 예시</small></p><p class="muted">1박당 ₩{h['price_per_night']:,} · 데모상 예약 가능</p></article>''' for h in available)
    body = f'''<div class="panel"><form class="form" method="get"><div class="field"><label>도시</label><select name="city">{city_options}</select></div><div class="field"><label>체크인</label><input type="date" name="checkin" value="{checkin.isoformat()}" required></div><div class="field"><label>체크아웃</label><input type="date" name="checkout" value="{checkout.isoformat()}" required></div><div class="field"><label>정렬</label><select name="sort"><option value="price" {"selected" if sort=="price" else ""}>총액 낮은순</option><option value="rating" {"selected" if sort=="rating" else ""}>평점 높은순</option></select></div><button class="btn">숙소 검색</button></form></div>
    <p class="muted">검색 결과 {len(available)}개 · 가상 숙소 데이터이며 실제 예약 가능 여부는 아닙니다.</p><div class="grid">{cards or '<div class="notice">조건에 맞는 숙소가 없습니다. 다른 도시나 날짜를 선택해 주세요.</div>'}</div>'''
    return page("호텔 검색", body)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
