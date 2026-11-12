const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ensureUserCookie } = require("../utils/sheetAccess");

// 로그인이 만료됐거나 더 이상 쓸 수 없는 토큰 → 화면이 알아서 로그아웃하고 로그인 화면으로 보낸다
const expired = (res) =>
  res.status(401).json({ message: "로그인이 만료되었습니다. 다시 로그인해 주세요", code: "AUTH_EXPIRED" });

exports.protect = async (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    return expired(res); // 기간이 지났거나 서버 비밀값이 바뀐 토큰
  }
  // 악보 파일 전용 쿠키(aud: sheets)는 로그인 토큰으로 쓸 수 없다
  if (decoded.aud) return expired(res);

  try {
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return expired(res); // 지워진 계정

    req.user = user;

    if (user.mustChangePassword && !req.originalUrl.startsWith("/api/auth/change-password")) {
      return res.status(403).json({
        message: "비밀번호를 먼저 변경해 주세요",
        code: "MUST_CHANGE_PASSWORD",
      });
    }

    // 악보 파일(<img>)은 로그인 헤더를 못 붙이므로, 악보 주소 전용 쿠키를 맞춰 둔다
    ensureUserCookie(req, res, user);
  } catch (err) {
    // 데이터베이스 문제 등은 로그인 만료가 아니므로 로그아웃시키지 않는다
    return res.status(500).json({ message: err.message });
  }
  return next();
};
