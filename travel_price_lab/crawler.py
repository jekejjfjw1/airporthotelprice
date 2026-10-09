"""Crawler for the companion demo travel website. All pages are locally owned demo pages."""
import argparse
import sqlite3
import time
from datetime import date, timedelta, datetime, timezone
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

DB_PATH = "travel_prices.db"


def default_dates():
    start = date.today() + timedelta(days=14)
    return start.isoformat(), (start + timedelta(days=2)).isoformat(), (start + timedelta(days=3)).isoformat()


def init_db(db_path=DB_PATH):
    with sqlite3.connect(db_path) as con:
        con.execute("""CREATE TABLE IF NOT EXISTS flight_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            observed_at TEXT NOT NULL,
            flight_key TEXT NOT NULL,
            flight_id TEXT NOT NULL,
            travel_date TEXT NOT NULL,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            airline TEXT NOT NULL,
            price INTEGER NOT NULL,
            UNIQUE(observed_at, flight_key)
        )""")
        con.execute("""CREATE TABLE IF NOT EXISTS hotel_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            observed_at TEXT NOT NULL,
            hotel_key TEXT NOT NULL,
            hotel_id TEXT NOT NULL,
            hotel_name TEXT NOT NULL,
            city TEXT NOT NULL,
            rating REAL NOT NULL,
            checkin TEXT NOT NULL,
            checkout TEXT NOT NULL,
            price_per_night INTEGER NOT NULL,
            total_price INTEGER NOT NULL,
            UNIQUE(observed_at, hotel_key)
        )""")


def get_soup(session, base_url, path, params):
    url = f"{base_url.rstrip('/')}{path}"
    response = session.get(url, params=params, timeout=10)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def parse_int(value):
    digits = "".join(ch for ch in value if ch.isdigit())
    if not digits:
        raise ValueError(f"가격에서 숫자를 읽을 수 없습니다: {value!r}")
    return int(digits)


def scrape_flights(session, base_url, origin, destination, start, end):
    soup = get_soup(session, base_url, "/flights", {
        "origin": origin, "destination": destination, "start": start, "end": end
    })
    results = []
    for card in soup.select("article.flight-card"):
        price_el = card.select_one(".price")
        if not price_el:
            continue
        results.append({
            "flight_key": card.get("data-flight-key", "").strip(),
            "flight_id": card.get("data-flight-id", "").strip(),
            "travel_date": card.get("data-date", "").strip(),
            "origin": card.get("data-origin", "").strip(),
            "destination": card.get("data-destination", "").strip(),
            "airline": card.get("data-airline", "").strip(),
            "price": parse_int(price_el.get_text(" ", strip=True)),
        })
    return results


def scrape_hotels(session, base_url, city, checkin, checkout, sort):
    soup = get_soup(session, base_url, "/hotels", {
        "city": city, "checkin": checkin, "checkout": checkout, "sort": sort
    })
    results = []
    for card in soup.select("article.hotel-card"):
        results.append({
            "hotel_key": card.get("data-hotel-key", "").strip(),
            "hotel_id": card.get("data-hotel-id", "").strip(),
            "hotel_name": card.select_one("h3").get_text(" ", strip=True),
            "city": card.get("data-city", "").strip(),
            "rating": float(card.get("data-rating", "0")),
            "checkin": card.get("data-checkin", "").strip(),
            "checkout": card.get("data-checkout", "").strip(),
            "price_per_night": int(card.get("data-price-per-night", "0")),
            "total_price": int(card.get("data-total-price", "0")),
        })
    return results


def save_records(flights, hotels, db_path=DB_PATH):
    observed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with sqlite3.connect(db_path) as con:
        con.executemany("""INSERT OR IGNORE INTO flight_prices
            (observed_at, flight_key, flight_id, travel_date, origin, destination, airline, price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", [
            (observed_at, x["flight_key"], x["flight_id"], x["travel_date"], x["origin"], x["destination"], x["airline"], x["price"])
            for x in flights
        ])
        con.executemany("""INSERT OR IGNORE INTO hotel_prices
            (observed_at, hotel_key, hotel_id, hotel_name, city, rating, checkin, checkout, price_per_night, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", [
            (observed_at, x["hotel_key"], x["hotel_id"], x["hotel_name"], x["city"], x["rating"], x["checkin"], x["checkout"], x["price_per_night"], x["total_price"])
            for x in hotels
        ])
    return observed_at


def main():
    d_start, d_end, d_checkout = default_dates()
    parser = argparse.ArgumentParser(description="가상 항공편·호텔 사이트 가격 크롤러")
    parser.add_argument("--base-url", default="http://127.0.0.1:5000", help="데모 사이트 주소")
    parser.add_argument("--origin", default="ICN")
    parser.add_argument("--destination", default="NRT")
    parser.add_argument("--start", default=d_start, help="여행 시작일 YYYY-MM-DD")
    parser.add_argument("--end", default=d_end, help="여행 종료일 YYYY-MM-DD")
    parser.add_argument("--city", default="도쿄")
    parser.add_argument("--checkin", default=d_start)
    parser.add_argument("--checkout", default=d_checkout)
    parser.add_argument("--interval", type=int, default=5, help="반복 조회 간격(초, 최소 2초)")
    parser.add_argument("--once", action="store_true", help="한 번만 수집 후 종료")
    parser.add_argument("--db", default=DB_PATH, help="SQLite 파일 경로")
    args = parser.parse_args()
    args.interval = max(2, args.interval)

    init_db(args.db)
    session = requests.Session()
    session.headers.update({"User-Agent": "TravelPriceLab-StudentProject/1.0"})
    print("데모 사이트:", args.base_url)
    print("실제 여행 사이트가 아니라 직접 만든 실습 페이지를 크롤링합니다.")
    while True:
        try:
            flights = scrape_flights(session, args.base_url, args.origin, args.destination, args.start, args.end)
            hotels = scrape_hotels(session, args.base_url, args.city, args.checkin, args.checkout, "price")
            observed_at = save_records(flights, hotels, args.db)
            print(f"[{observed_at}] 항공편 {len(flights)}개, 호텔 {len(hotels)}개 저장")
            if flights:
                cheapest = min(flights, key=lambda x: x["price"])
                print(f"  최저 항공편: {cheapest['flight_id']} {cheapest['travel_date']} ₩{cheapest['price']:,}")
            if hotels:
                cheapest_hotel = min(hotels, key=lambda x: x["total_price"])
                print(f"  최저 호텔: {cheapest_hotel['hotel_name']} ₩{cheapest_hotel['total_price']:,}")
        except requests.RequestException as exc:
            print("사이트 요청 실패. Flask 사이트가 실행 중인지 확인하세요:", exc)
        except Exception as exc:
            print("수집 오류:", repr(exc))
        if args.once:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
