import sqlite3
import pandas as pd
import streamlit as st

DB_PATH = "travel_prices.db"
st.set_page_config(page_title="여행 가격 변동 대시보드", layout="wide")
st.title("✈ 여행 가격 변동 대시보드")
st.caption("직접 만든 가상 여행 사이트에서 requests + BeautifulSoup으로 수집한 실습 기록")

try:
    with sqlite3.connect(DB_PATH) as con:
        flights = pd.read_sql_query("SELECT * FROM flight_prices ORDER BY observed_at", con)
        hotels = pd.read_sql_query("SELECT * FROM hotel_prices ORDER BY observed_at", con)
except Exception:
    flights, hotels = pd.DataFrame(), pd.DataFrame()

if flights.empty and hotels.empty:
    st.info("아직 기록이 없습니다. Flask 사이트와 crawler.py를 먼저 실행해 주세요.")
    st.stop()

tab_flight, tab_hotel = st.tabs(["항공편 가격", "호텔 가격"])
with tab_flight:
    if flights.empty:
        st.info("항공편 기록이 없습니다.")
    else:
        flights["observed_at"] = pd.to_datetime(flights["observed_at"], utc=True).dt.tz_convert(None)
        flight_options = flights[["flight_key", "flight_id", "travel_date", "airline"]].drop_duplicates("flight_key")
        choice = st.selectbox("항공편 선택", flight_options["flight_key"].tolist(), format_func=lambda k: (lambda r: f"{r.flight_id} | {r.travel_date} | {r.airline}")(flight_options[flight_options.flight_key == k].iloc[0]))
        hist = flights[flights["flight_key"] == choice].sort_values("observed_at")
        latest = hist.iloc[-1]
        prev = hist.iloc[-2]["price"] if len(hist) > 1 else None
        st.metric("최근 가격", f"₩{int(latest['price']):,}", delta=(f"₩{int(latest['price']-prev):+,}" if prev is not None else None), delta_color="inverse")
        st.line_chart(hist.set_index("observed_at")["price"])
        st.dataframe(hist[["observed_at", "travel_date", "airline", "price"]].sort_values("observed_at", ascending=False), use_container_width=True)
with tab_hotel:
    if hotels.empty:
        st.info("호텔 기록이 없습니다.")
    else:
        hotels["observed_at"] = pd.to_datetime(hotels["observed_at"], utc=True).dt.tz_convert(None)
        hotel_options = hotels[["hotel_key", "hotel_name", "checkin", "checkout"]].drop_duplicates("hotel_key")
        choice = st.selectbox("호텔 선택", hotel_options["hotel_key"].tolist(), format_func=lambda k: (lambda r: f"{r.hotel_name} | {r.checkin} ~ {r.checkout}")(hotel_options[hotel_options.hotel_key == k].iloc[0]))
        hist = hotels[hotels["hotel_key"] == choice].sort_values("observed_at")
        latest = hist.iloc[-1]
        prev = hist.iloc[-2]["total_price"] if len(hist) > 1 else None
        st.metric("최근 숙박 총액", f"₩{int(latest['total_price']):,}", delta=(f"₩{int(latest['total_price']-prev):+,}" if prev is not None else None), delta_color="inverse")
        col1, col2 = st.columns(2)
        col1.metric("평점", f"★ {latest['rating']:.1f}")
        col2.metric("1박 가격", f"₩{int(latest['price_per_night']):,}")
        st.line_chart(hist.set_index("observed_at")["total_price"])
        st.dataframe(hist[["observed_at", "hotel_name", "rating", "price_per_night", "total_price"]].sort_values("observed_at", ascending=False), use_container_width=True)

st.caption("참고: 실제 예약 사이트의 데이터가 아니며, 예제 가격은 약 12초 단위로 변하도록 만든 가상 값입니다.")
