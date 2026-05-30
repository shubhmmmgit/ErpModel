import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "mysecret";

export const authMiddleware = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, SECRET);

    // decoded = { userId: 5, iat: ... }
    // Normalize so both field names always resolve to the same tenant ID
    req.user = {
      ...decoded,
      userId:     decoded.userId,          // already in token
      businessId: decoded.userId,          // alias — same value
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Optional role guard factory (used by purchase module)
// Usage: router.post("/approve", authMiddleware, roleGuard("manager","admin"), handler)
export const roleGuard = (...allowedRoles) => (req, res, next) => {
  const role = req.user?.role || "admin"; // default to admin until role system is added
  if (allowedRoles.length && !allowedRoles.includes(role)) {
    return res.status(403).json({ error: "Forbidden: insufficient permissions" });
  }
  next();
};
