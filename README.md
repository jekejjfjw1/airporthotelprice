# FareLab — 여행 가격 크롤링 실습실

항공편·숙소의 **합성 모의 가격 데이터**를 보고, 브라우저 개발자도구 Network 탭에서 JSON 응답을 관찰하는 정적 웹 실습 사이트입니다. 실제 상품 공급자·예약·결제·개인정보 입력과 연결되지 않습니다.

## GitHub Pages 배포

별도의 빌드·설치나 비밀 키 없이 배포할 수 있습니다.

1. GitHub에서 새 저장소를 만듭니다.
2. 제공된 ZIP을 먼저 로컬에서 푼 다음, 압축 안의 파일 전체를 저장소 `main` 브랜치 루트에 올립니다. ZIP 파일만 올리면 Pages가 사이트를 자동으로 풀어주지 않습니다. `index.html`, `sw.js`, `api-engine.js`, `app.js`, `styles.css`, `data/`, `api/`가 같은 폴더 단계에 있어야 합니다.
3. 저장소의 **Settings → Pages**에서 **Deploy from a branch**, branch `main`, folder `/(root)`를 선택하고 저장합니다.
4. 잠시 후 표시된 `https://<사용자명>.github.io/<저장소명>/` 주소를 엽니다. GitHub Pages는 HTTPS로 제공되어 Service Worker가 동작합니다.

프로젝트 경로(`/저장소명/`)로 배포되어도 Service Worker와 API URL은 현재 설치 경로에 맞춰 처리됩니다. GitHub Pages 외에 정적 호스팅을 사용하는 경우에도 서비스워커와 HTTPS를 지원해야 합니다.

### 로컬에서 열기

`file://`로 직접 열면 Service Worker가 차단되므로 로컬 HTTP 서버를 사용합니다. Node.js 18 이상이면 의존성 설치 없이 실행할 수 있습니다.

```bash
node server.js
```

그 후 `http://localhost:3000/`을 엽니다. `PORT=8080 node server.js`처럼 포트를 지정할 수 있습니다. 내장 Node 서버는 브라우저 밖의 Python/Playwright 스크립트가 읽을 수 있는 동적 API도 제공합니다. GitHub Pages에서는 별도 백엔드 프로세스를 실행할 수 없으므로, 실습 페이지가 Service Worker로 모의 API 응답을 생성합니다. 따라서 일반 `requests.get()`은 실행 중인 Service Worker를 호출하지 않습니다. 페이지 안에서 fetch를 실행하거나 Playwright 같은 브라우저 자동화로 관찰하세요.

## Network 탭에서 확인하기

1. 페이지에서 `F12`를 눌러 개발자도구를 엽니다.
2. **Network → Fetch/XHR**를 선택합니다.
3. `products.json`, `detail.json`, `prices.json` 요청을 열어 **Headers**와 **Response/Preview**를 확인합니다.
4. **가격 다시 가져오기**를 누르거나 15초 기다립니다. 요청 URL의 `tick`, JSON의 `meta.tick`, 가격/갱신 시각이 바뀝니다.
5. 검색어, 유형, 정렬을 바꾸고 요청 쿼리와 응답이 어떻게 달라지는지 살펴봅니다.

### 읽기 전용 엔드포인트

| 메서드 | 경로 | 용도 |
| --- | --- | --- |
| `GET` | `/api/v1/products.json?type=flight` | 항공편 목록 |
| `GET` | `/api/v1/products.json?type=stay` | 숙소 목록 |
| `GET` | `/api/v1/detail.json?id=flight-seoul-tokyo` | 한 상품의 상세 정보 |
| `GET` | `/api/v1/prices.json?id=flight-seoul-tokyo&window=24h` | 24개 가격 이력 샘플 |

응답은 `{ "apiVersion": "1.0", "meta": { "generatedAt": "…", "tick": 123, "source": "…" }, "data": ... }` 형태입니다. 상품 목록 `data`는 배열이며, `price`, `previousPrice`, `changeAmount`, `changePercent`, `currency`, `lastUpdated` 등의 일관된 필드를 포함합니다. 오류 응답에는 `error.code`와 `error.message`가 있습니다.

## Playwright 예제 — 브라우저에서 모의 API 읽기

```python
from playwright.sync_api import sync_playwright

site = "https://<사용자명>.github.io/<저장소명>/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    api_responses = []
    page.on("response", lambda response: api_responses.append(response)
            if "/api/v1/" in response.url else None)
    page.goto(site)
    page.wait_for_timeout(1200)
    for response in api_responses:
        print(response.status, response.url)
        print(response.json())
    browser.close()
```

Playwright 예제에는 실제 배포 주소를 넣으세요. 실습 UI 안의 **예제 복사** 버튼은 현재 페이지 URL을 사용합니다.

일반 Python `requests`로 직접 HTTP JSON을 읽어보고 싶다면 먼저 로컬에서 `node server.js`를 실행한 뒤 다음처럼 요청합니다. 같은 URL 형식에서 tick을 바꿔 모의 가격이 재현 가능하게 바뀌는지 비교할 수 있습니다.

```python
import requests

api = "http://localhost:3000/api/v1/detail.json"
for tick in (100, 101):
    product = requests.get(api, params={"id": "flight-seoul-tokyo", "tick": tick}, timeout=5).json()["data"]
    print(tick, product["price"], product["currency"])
```

## 폴더 구조

```text
.
├── index.html
├── styles.css
├── app.js
├── api-engine.js
├── sw.js
├── server.js
├── data/catalog.json
├── api/v1/products.json
├── tests/api.test.js
└── manus-routes.json
```

- `app.js`: 목록·상세·가격 이력 fetch와 UI 렌더링.
- `sw.js`: same-origin `/api/v1/` 요청에 동적 JSON 응답을 반환하는 서비스워커.
- `api-engine.js`: tick 기반 가격 변동 및 공통 API 응답 생성 로직.
- `server.js`: 선택 사항인 Node.js 내장 HTTP 서버. GitHub Pages 배포에는 필요하지 않습니다.
- `data/catalog.json`: 합성 상품 입력 데이터.
- `api/v1/products.json`: 정적 호스팅에서 직접 내려받을 수 있는 기본 목록 스냅샷.

## 데이터·제약 안내

가격은 학습 목적의 결정적 시뮬레이션입니다. 상품명, 운항 정보, 숙소, 가격은 모두 가상입니다. 구매, 예약, 로그인, 결제, 개인정보 수집 또는 실제 여행사 크롤링을 수행하지 않습니다. GitHub Pages 정적 파일로는 서버 측 API를 실행할 수 없습니다. Service Worker API는 웹페이지가 열린 브라우저 내부에서 동작하며, 일반 외부 HTTP 클라이언트는 이 동적 응답을 직접 실행하지 않습니다. 별도 API 호출이 필요한 브라우저 외 크롤링 연습은 로컬에서 `node server.js`로 제공하는 API를 사용하세요.
