import bcrypt from "bcrypt";
import jwt    from "jsonwebtoken";
import pool   from "../config/db.js";

const SECRET = process.env.JWT_SECRET || "mysecret";

// ─── SIGNUP — creates business + owner user atomically ───────
export const signup = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, password, businessName } = req.body;

    // Validation
    if (!name?.trim())         return res.status(400).json({ error: "Name is required" });
    if (!email?.trim())        return res.status(400).json({ error: "Email is required" });
    if (!password?.trim())     return res.status(400).json({ error: "Password is required" });
    if (!businessName?.trim()) return res.status(400).json({ error: "Business name is required" });

    // Check duplicate email
    const existing = await client.query(
      "SELECT id FROM users WHERE email = $1", [email.trim()]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "An account with this email already exists" });

    await client.query("BEGIN");

    // 1. Create the business first
    const bizResult = await client.query(
      "INSERT INTO businesses (name) VALUES ($1) RETURNING *",
      [businessName.trim()]
    );
    const business = bizResult.rows[0];

    // 2. Create owner user linked to that business
    const hashed = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (name, email, password, business_id, role)
       VALUES ($1, $2, $3, $4, 'owner')
       RETURNING id, name, email, role, business_id`,
      [name.trim(), email.trim(), hashed, business.id]
    );
    const user = userResult.rows[0];

    await client.query("COMMIT");

    // 3. JWT carries userId + businessId + role — all three required
    const token = jwt.sign(
      { userId: user.id, businessId: business.id, role: user.role },
      SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure:   true,   // set true in production with HTTPS
      sameSite: "none",
      path:     "/",
      maxAge:   7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      message: "Signup success",
      user: {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        businessId:   business.id,
        businessName: business.name
      }
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Signup failed" });
  } finally {
    client.release();
  }
};


// ─── LOGIN ───────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim())    return res.status(400).json({ error: "Email is required" });
    if (!password?.trim()) return res.status(400).json({ error: "Password is required" });

    // Fetch user AND their business in one query
    const result = await pool.query(
      `SELECT u.*, b.name AS business_name
       FROM users u
       JOIN businesses b ON b.id = u.business_id
       WHERE u.email = $1`,
      [email.trim()]
    );

    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "No account found with this email" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Incorrect password" });

    // JWT carries userId + businessId + role
    const token = jwt.sign(
      { userId: user.id, businessId: user.business_id, role: user.role },
      SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure:   false,
      sameSite: "lax",
      path:     "/",
      maxAge:   7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: "Login success",
      user: {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        businessId:   user.business_id,
        businessName: user.business_name
      }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Login failed" });
  }
};


// ─── LOGOUT ──────────────────────────────────────────────────
export const logout = (req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ message: "Logged out" });
};