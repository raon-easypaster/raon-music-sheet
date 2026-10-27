const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getSongs,
  getSongById,
  createSong,
  updateSong,
  deleteSong,
  setFavorite
} = require("../controllers/songController");

router.use(protect);

router.get("/", getSongs);
router.get("/:id", getSongById);
router.post("/", createSong);
router.put("/:id", updateSong);
router.put("/:id/favorite", setFavorite);
router.delete("/:id", deleteSong);

module.exports = router;
