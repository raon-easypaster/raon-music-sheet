const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { requireOperator } = require('../utils/operator')
const c = require('../controllers/copyrightController')

// 누구나 (로그인 없이)
router.post('/requests', c.submit)
router.get('/operator', c.operatorInfo)

// 운영자만 (ADMIN_EMAILS)
router.use('/admin', protect, requireOperator)
router.get('/admin/requests', c.list)
router.get('/admin/requests/:id', c.detail)
router.patch('/admin/requests/:id', c.update)
router.post('/admin/requests/:id/lock-share', c.lockShare)
router.post('/admin/blocks', c.block)
router.delete('/admin/blocks/:fileId', c.unblock)

module.exports = router
