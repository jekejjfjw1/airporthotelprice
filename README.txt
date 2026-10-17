TripSignal Network 데모 (Windows)

1. ZIP 압축을 풉니다.
2. start_server.bat 을 더블클릭합니다.
3. 검은 창을 닫지 않은 상태에서 Chrome으로 http://127.0.0.1:8000 을 엽니다.
4. Chrome에서 F12 -> Network 탭 -> Fetch/XHR 선택.
5. /api/prices 요청을 클릭하고 Response 탭을 보면 서버가 반환한 JSON 가격을 볼 수 있습니다.
6. 12초마다 /api/prices 요청이 다시 생기고 응답 가격이 바뀝니다.
7. 종료할 때 서버 창에서 Ctrl+C를 누릅니다.

중요:
- index.html 파일을 더블클릭(file://)해서 열지 마세요. 서버 주소로 접속해야 API 요청이 됩니다.
- 이 예제는 학습용 가상 가격을 로컬 Python 서버에서 반환합니다. 실제 항공권/호텔 가격이 아닙니다.
- Python이 설치되어 있어야 하며, Windows에서 `py` 명령이 동작해야 합니다.
