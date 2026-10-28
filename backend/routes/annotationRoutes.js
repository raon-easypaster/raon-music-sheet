const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const {
  getPublicAnnotation,
  getAnnotation,
  saveAnnotation,
  clearAnnotation,
} = require('../controllers/annotationController')

// Public route (공유 링크 + 비밀번호) — 보기만
router.get('/public/:token/:songId', getPublicAnnotation)

// Protected routes — 콘티에 접근할 수 있는 팀원만
router.get('/:setlistId/:songId', protect, getAnnotation)
router.put('/:setlistId/:songId', protect, saveAnnotation)
router.delete('/:setlistId/:songId', protect, clearAnnotation)

module.exports = router
