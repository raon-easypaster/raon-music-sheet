const express = require('express')
const router = express.Router()
const { signup, login, changePassword, checkEmail } = require('../controllers/authController')
const { protect } = require('../middleware/authMiddleware')

router.post('/signup', signup)
router.post('/login', login)
router.post('/check-email', checkEmail)
router.put('/change-password', protect, changePassword)

module.exports = router