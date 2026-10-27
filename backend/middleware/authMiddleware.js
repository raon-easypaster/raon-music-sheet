const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

      return next();
    } catch (err) {
      return res.status(401).json({ message: "Not authorized" });
    }
  }

  return res.status(401).json({ message: "No token provided" });
};
