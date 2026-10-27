# RAON music sheet — 작업 규칙

## 사용설명서 동시 업데이트 (필수)
앱 기능을 추가·변경·삭제해서 배포할 때마다, 같은 작업 안에서 사용설명서도 함께 고쳐서 push한다.

- 사용설명서 저장소: https://github.com/raon-easypaster/raon-music-sheet-guide (로컬: `~/Documents/raon-music-sheet-guide`, `index.html` 한 파일)
- 바뀐 기능의 설명, 목차, 권한 표(`#roles`), 자주 묻는 질문을 실제 동작에 맞게 고친다.
- 맨 위·맨 아래 "앱 바로가기"와 "하루 30곡 업데이트" 공지는 유지하고, 안내서의 "기준 날짜"를 배포한 날로 바꾼다.
- 앱 저장소 push와 사용설명서 저장소 push를 둘 다 마쳐야 작업이 끝난 것이다.

## 배포
- main에 push하면 Vercel이 자동 배포한다 (화면 `frontend/`, 서버는 `frontend/api/index.js` → `backend/app.js`).
- 운영 환경 변수 `MONGO_URI`, `JWT_SECRET`은 사람이 직접 넣는 값이다. 대신 입력하지 않는다.
