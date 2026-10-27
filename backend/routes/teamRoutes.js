const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const {
  createTeam,
  getMyTeams,
  joinTeam,
  getTeamById,
  leaveTeam,
  deleteTeam,
  moveMyItemsToTeam,
  resetMemberPassword,
} = require('../controllers/teamController')

router.use(protect)

router.get('/', getMyTeams)
router.post('/', createTeam)
router.post('/join', joinTeam)
router.get('/:id', getTeamById)
router.post('/:id/move-my-items', moveMyItemsToTeam)
router.post('/:id/members/:userId/reset-password', resetMemberPassword)
router.delete('/:id/leave', leaveTeam)
router.delete('/:id', deleteTeam)

module.exports = router
