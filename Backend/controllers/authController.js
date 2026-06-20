import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const SECRET = process.env.JWT_SECRET || "mysecret";

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashed]
    );
    const user = result.rows[0];

    // businessId = userId (each user owns their own tenant)
    const token = jwt.sign(
      { userId: user.id, businessId: user.id },
      SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // ✅ Return user so Auth.jsx can store it in localStorage
    res.json({ message: "Signup success", user });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Signup failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Wrong password" });

    // businessId = userId
    const token = jwt.sign(
      { userId: user.id, businessId: user.id },
      SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // ✅ Return user so Auth.jsx can store it in localStorage
    res.json({
      message: "Login success",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Login failed" });
  }
};

export const logout = (req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ message: "Logged out" });
};

export const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.business_id, u.role,
              b.name AS business_name
       FROM users u
       LEFT JOIN businesses b ON b.id = u.business_id
       WHERE u.id = $1`,
      [req.user.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
 
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      businessId: user.business_id,
      businessName: user.business_name,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
};