

import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "mysecret";

// ── Core auth middleware ─────────────────────────────────────
export const authMiddleware = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    // Support both architectures:
    //   Old tokens: { userId }          → businessId defaults to userId
    //   New tokens: { userId, businessId, role }
    if (!req.user.businessId) {
      req.user.businessId = req.user.userId;
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ── Role-based guard factory ─────────────────────────────────
// Usage: roleGuard("admin","manager")
export const roleGuard = (...allowedRoles) => (req, res, next) => {
  const role = req.user?.role || "employee";
  if (allowedRoles.length && !allowedRoles.includes(role)) {
    return res.status(403).json({ error: "Forbidden: insufficient role" });
  }
  next();
};