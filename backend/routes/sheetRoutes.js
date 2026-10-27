const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { uploadSheet, getSheet } = require('../controllers/sheetController')

router.post('/', protect, uploadSheet)
router.get('/:id', getSheet)

module.exports = router
