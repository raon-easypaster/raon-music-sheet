const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const {
  loadTeam,
  listAssignments,
  createAssignment,
  deleteAssignment,
  respondAssignment,
  myAssignments,
  listUnavailability,
  addUnavailability,
  deleteUnavailability,
  listPosts,
  getUnread,
  markPostsSeen,
  createPost,
  deletePost,
  pinPost,
  togglePray,
  listAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
} = require('../controllers/teamExtrasController')

// 팀 소식(배정·못 나오는 날·공지·기도제목·출석): 모두 /api/team-extras/:teamId/... 이고 팀원만 쓸 수 있다
router.use(protect)
router.use('/:teamId', loadTeam)

router.get('/:teamId/assignments', listAssignments)
router.post('/:teamId/assignments', createAssignment)
router.delete('/:teamId/assignments/:id', deleteAssignment)
router.put('/:teamId/assignments/:id/respond', respondAssignment)
router.get('/:teamId/my-assignments', myAssignments)

router.get('/:teamId/unavailability', listUnavailability)
router.post('/:teamId/unavailability', addUnavailability)
router.delete('/:teamId/unavailability/:id', deleteUnavailability)

router.get('/:teamId/unread', getUnread)
router.get('/:teamId/posts', listPosts)
router.post('/:teamId/posts', createPost)
router.post('/:teamId/posts/seen', markPostsSeen)
router.delete('/:teamId/posts/:id', deletePost)
router.put('/:teamId/posts/:id/pin', pinPost)
router.put('/:teamId/posts/:id/pray', togglePray)

router.get('/:teamId/attendance', listAttendance)
router.post('/:teamId/attendance', createAttendance)
router.put('/:teamId/attendance/:id', updateAttendance)
router.delete('/:teamId/attendance/:id', deleteAttendance)

module.exports = router
