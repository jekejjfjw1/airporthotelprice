# TripSignal — GitHub Pages 여행 가격 추적 데모

이 버전은 **GitHub Pages에서 별도 서버 설치 없이 실행되는 정적 웹사이트**입니다.

## 포함 기능
- 항공편: 출발/도착 공항, 날짜 범위, 여러 항공편 카드
- 숙소: 도시, 체크인/체크아웃, 가격순/평점순 정렬
- 데모 가격은 브라우저 화면에서 약 12초 주기로 변동
- 새로 조회할 때 가격을 기록하고 변동 그래프 표시
- 목표 가격을 저장하고, 목표가 이하가 되면 화면 알림 표시
- 가격 기록은 현재 브라우저의 `localStorage`에 보관
- 모바일/PC 반응형 화면

> **중요:** 모든 상품·가격·평점은 가상 데모 데이터이며 실제 항공편/숙소 가격이 아닙니다. 실제 여행사 데이터와 예약 가능 여부를 표시하지 않습니다.

## GitHub에 게시하는 방법
1. 이 폴더의 `index.html`, `style.css`, `app.js`, `README.md`, `.nojekyll`, `.gitignore` 파일을 GitHub 저장소 **최상위(root)** 에 올립니다. `travel_price_lab` 같은 하위 폴더 안에만 넣으면 Pages의 루트 배포에서는 홈페이지가 바로 열리지 않을 수 있습니다.
2. GitHub 저장소에서 **Settings → Pages** 로 이동합니다.
3. **Build and deployment → Deploy from a branch** 를 선택합니다.
4. Branch는 `main`, folder는 `/(root)`로 설정하고 **Save** 를 누릅니다.
5. 배포가 끝나면 Settings → Pages에 표시되는 주소를 엽니다. 주소는 보통 `https://사용자명.github.io/저장소이름/` 형식입니다.

## 로컬에서 확인하기
HTML 파일을 더블클릭해서 열어도 대부분의 기능이 동작합니다. 개발용으로 로컬 정적 서버를 사용하려면 프로젝트 폴더에서 다음 명령을 실행할 수 있습니다.

```bash
py -m http.server 8000
```

그리고 `http://127.0.0.1:8000` 을 엽니다.

## GitHub Pages와 Requests/BeautifulSoup의 차이
GitHub Pages는 HTML/CSS/JavaScript 같은 정적 파일을 제공하며 Python Flask 서버를 실행하지 않습니다. 이 웹사이트의 데모 가격은 **브라우저의 JavaScript에서** 바뀌므로, `requests`는 서버가 전송한 원본 HTML만 가져오고 브라우저에서 바뀐 가격을 읽을 수 없습니다. 따라서 이 Pages 버전에서 가격 변동 그래프는 브라우저 안에서 작동합니다.

과제에서 `requests`와 `BeautifulSoup`으로 실제로 변하는 가격을 크롤링하는 것이 필수라면, Python으로 가격 HTML을 동적으로 생성하는 Flask 사이트를 Render 같은 Python 서버 호스팅에 배포해야 합니다. 그 경우 GitHub는 코드를 저장하고, 별도의 서버가 사이트를 실행하게 됩니다.

## 저장 데이터
가격 기록과 목표 가격은 브라우저별 `localStorage`에 저장됩니다. 다른 컴퓨터/브라우저와 자동으로 공유되거나 GitHub에 업로드되지 않습니다.
