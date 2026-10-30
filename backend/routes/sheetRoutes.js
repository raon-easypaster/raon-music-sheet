const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { uploadSheet, getAgreement, agree, getSheet, clearSession } = require('../controllers/sheetController')

router.get('/agreement', protect, getAgreement)
router.post('/agreement', protect, agree)
router.post('/', protect, uploadSheet)
router.delete('/session', clearSession)
router.get('/:id', getSheet)

module.exports = router
