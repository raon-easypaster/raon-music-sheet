const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ensureUserCookie } = require("../utils/sheetAccess");

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      req.user = user;

      if (user.mustChangePassword && !req.originalUrl.startsWith("/api/auth/change-password")) {
        return res.status(403).json({
          message: "비밀번호를 먼저 변경해 주세요",
          code: "MUST_CHANGE_PASSWORD",
        });
      }

      // 악보 파일(<img>)은 로그인 헤더를 못 붙이므로, 악보 주소 전용 쿠키를 맞춰 둔다
      ensureUserCookie(req, res, user);
      return next();
    } catch (err) {
      return res.status(401).json({ message: "Not authorized" });
    }
  }

  return res.status(401).json({ message: "No token provided" });
};
