import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "mysecret";

export const authMiddleware = (req, res, next) => {
  // Check Authorization header first (token-based)
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies?.token; // fallback for localhost
 
  if (!token) return res.status(401).json({ error: "No token" });
 
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
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

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  next();
};

