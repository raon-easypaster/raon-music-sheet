// Vercel 서버리스 함수: /api/* 요청을 backend의 Express 앱으로 넘긴다
// (vercel.json의 rewrite가 /api/* 를 이 함수로 보내고, 원래 경로는 그대로 유지된다)
import app from '../../backend/app.js'

export default app
