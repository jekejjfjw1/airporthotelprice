# 여행 가격 변동 크롤링 실습실

실제 Expedia/항공사/호텔 예약 사이트를 크롤링하지 않고, 팀이 직접 만든 가상 여행 사이트를 `requests`와 `BeautifulSoup`으로 수집하는 교육용 프로젝트입니다.

## 기능
- 항공편: 출발지·도착지와 여행 날짜 범위로 여러 항공편 검색
- 호텔: 도시, 체크인·체크아웃, 평점순/가격순 정렬
- 가상 가격은 약 12초마다 변함
- 크롤러는 사이트에서 읽은 가격을 SQLite에 매 조회 저장
- Streamlit 대시보드에서 항공편·호텔별 가격 기록과 그래프 확인

> 모든 상품·평점·가격·운항편은 데모용 가상 데이터입니다. 실제 예약 정보가 아닙니다.

## 설치
Python 3.10 이상을 권장합니다.

```bash
python -m venv .venv
```

Windows:
```bat
.venv\Scripts\activate
```

macOS/Linux:
```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
```

## 실행 방법
세 개의 터미널을 사용합니다. 먼저 `travel_price_lab` 폴더로 이동합니다.

### 터미널 1 — 가상 여행 사이트
```bash
python app.py
```
브라우저에서 http://127.0.0.1:5000 을 엽니다.

### 터미널 2 — 크롤러
```bash
python crawler.py --origin ICN --destination NRT --start 2026-11-01 --end 2026-11-03 --city 도쿄 --checkin 2026-11-01 --checkout 2026-11-04 --interval 5
```
`--interval 5`는 5초마다 페이지를 다시 요청한다는 뜻입니다. 12초마다 가상 가격이 바뀌므로 몇 차례 조회하면 가격 변동 기록을 볼 수 있습니다.

한 번만 실행하려면:
```bash
python crawler.py --once
```

### 터미널 3 — 가격 그래프
```bash
streamlit run dashboard.py
```

## URL 구조
- 항공편: `/flights?origin=ICN&destination=NRT&start=YYYY-MM-DD&end=YYYY-MM-DD`
- 호텔: `/hotels?city=도쿄&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&sort=price`
- 호텔 평점순: `sort=rating`

## 크롤링 코드에서 볼 핵심
- `requests.Session().get(...)`: HTML 페이지 요청
- `BeautifulSoup(response.text, "html.parser")`: HTML 파싱
- `soup.select("article.flight-card")`: 항공편 카드 여러 개 선택
- `card.get("data-price")` 또는 `.select_one(".price")`: 카드에서 가격 읽기
- `sqlite3`: 시각별 결과 누적 저장

## 주의
- 크롤러는 이 프로젝트의 로컬 사이트에만 요청을 보냅니다.
- 실서비스에 적용할 때는 사이트 이용약관, robots.txt, 허가 범위를 먼저 확인하고, 접근 제한을 우회하지 마세요.
- `observed_at`은 UTC로 저장합니다.
