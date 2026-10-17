# TripSignal 무료 서버 시연 프로젝트

GitHub에 코드를 보관하고 Render의 무료 웹 서비스에 배포하는 학습용 예제입니다.

## 기능
- 서버 API(`/api/prices`)가 항공권·호텔의 **가상 가격**을 제공합니다.
- 가격은 12초 단위 시간 구간을 기준으로 계산하므로 같은 시각 구간에 접속한 방문자에게 같은 값이 나옵니다.
- 웹 페이지는 12초마다 서버에 요청합니다.
- 가격은 실제 항공권·호텔 판매 가격이 아닙니다.

## GitHub에 올리기
1. GitHub에서 새 저장소(repository)를 만듭니다.
2. ZIP을 풀고 `app.py`, `requirements.txt`, `render.yaml`, `site` 폴더 등을 저장소에 업로드합니다.
3. 저장소가 Public/Private 어느 쪽이든 Render 계정에서 연결 권한이 있어야 합니다.

## Render에 배포하기
1. Render 계정에 로그인합니다.
2. **New + → Blueprint**를 선택합니다.
3. 이 프로젝트를 올린 GitHub 저장소를 연결합니다.
4. `render.yaml`을 확인하고 배포합니다.
5. 배포가 완료되면 Render가 제공하는 `https://...onrender.com` 주소를 엽니다.

Blueprint 메뉴가 보이지 않으면 **New + → Web Service**를 선택해 저장소를 연결하고 아래 값을 입력하세요.
- Runtime: Python
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`
- Health Check Path(가능한 경우): `/api/health`

## 알아둘 점
- 무료 서비스는 비활성 상태에서 잠들 수 있으며, 다시 접속할 때 첫 요청이 느릴 수 있습니다. 따라서 무료 요금제로 24시간 무중단 실행을 보장할 수는 없습니다.
- 페이지가 열려 있는 브라우저는 12초마다 서버를 확인합니다. 브라우저를 닫아도 서버가 매초 백그라운드에서 작업해야 하는 구조는 아닙니다. 가격은 API 요청 시 현재 시간 구간을 바탕으로 계산됩니다.
- 이 데모는 서버에서 가격을 제공하므로, 사이트를 여는 사람마다 따로 가격이 만들어지지 않습니다.
- 실서비스 가격 수집은 항공사·호텔 사이트의 이용약관과 robots 정책을 확인하고, 허용된 API나 데이터 소스를 사용하세요.
