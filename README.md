# RAON music sheet

라온동행교회 찬양팀 악보 & 콘티 관리 앱

**앱 주소**: https://raon-music-sheet.vercel.app  
**사용법 가이드**: https://raon-easypaster.github.io/raon-music-sheet/

---

## 주요 기능

- 찬양곡 악보 등록 (Key · BPM · YouTube · PDF · 악보 이미지)
- 주일 예배 콘티 작성 및 드래그 순서 변경
- 로그인 없이 열람 가능한 콘티 공유 링크
- 찬양팀 멤버 관리
- 곡 제목으로 구글 악보 검색
- 비밀번호 변경

---

## 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| 프론트엔드 | React 19, Vite 7, React Router 7 |
| 백엔드 | Node.js, Express 4 |
| 데이터베이스 | MongoDB Atlas, Mongoose 8 |
| 인증 | JWT (jsonwebtoken), bcryptjs |
| 프론트 배포 | Vercel |
| 백엔드 배포 | Railway |
| 사용법 가이드 | GitHub Pages |

---

## 프로젝트 구조

```
콘티연습실/
├── frontend/          # React + Vite 앱
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/
│   │   └── context/
│   └── public/
│       └── guide.html  # 사용법 정적 페이지
├── backend/           # Express REST API
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   └── routes/
└── docs/              # GitHub Pages 사용법 가이드
```

---

## 로컬 실행

### 백엔드

```bash
cd backend
npm install
# .env 파일 생성 (아래 환경 변수 참고)
npm run dev
```

### 프론트엔드

```bash
cd frontend
npm install
# .env 파일 생성 (아래 환경 변수 참고)
npm run dev
```

### 환경 변수

**backend/.env**
```
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=8080
```

**frontend/.env**
```
VITE_API_URL=http://localhost:8080/api
```

---

## 출처 및 참고

이 프로젝트의 백엔드 구조는 아래 오픈소스 프로젝트를 기반으로 합니다.

- **SetlistLab Backend** by [Tom Rhys Jones](https://github.com/tomrhysjones)  
  https://github.com/tomrhysjones/setlistlab-backend  
  License: MIT

원본 프로젝트에서 가져온 부분:
- Express + Mongoose 기반 REST API 구조
- User · Song · Setlist 데이터 모델 설계
- JWT 인증 미들웨어 (`protect`)
- bcryptjs 비밀번호 해싱 방식

라온동행교회 맞춤으로 추가·변경한 부분:
- 한국어 UI 전체 번역
- 공유 토큰(`shareToken`) 기반 공개 콘티 공유 기능
- 찬양팀 멤버 관리(`TeamPanel`)
- 드래그 앤 드롭 콘티 순서 변경
- 구글 찬양 악보 검색 버튼
- 비밀번호 변경 기능
- 그린 계열 디자인 테마
- Vercel + Railway 배포 설정

---

## 라이선스

MIT License — 원본 프로젝트의 라이선스를 따릅니다.
