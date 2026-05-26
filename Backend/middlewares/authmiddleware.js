import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "mysecret";

export const authMiddleware = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = {
      userId:     decoded.userId,
      businessId: decoded.businessId,
      role:       decoded.role
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: "Insufficient permissions" });
  next();
};