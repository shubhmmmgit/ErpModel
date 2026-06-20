import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api.js";

export default function Auth() {
  const [isLogin, setIsLogin]   = useState(true);
  const [loading, setLoading]   = useState(false);
  const [form, setForm]         = useState({
    name: "", email: "", password: "", businessName: ""
  });
  const navigate = useNavigate();

const handleSubmit = async (e) => {
  e.preventDefault();

  if (loading) return;

  setLoading(true);

  try {

    const url = isLogin
      ? "/api/auth/login"
      : "/api/auth/signup";

    const data = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify(form)
    });

    // Save authenticated user
     if (data?.user) {
      localStorage.setItem("erpUser", JSON.stringify(data.user));
      if (onLogin) onLogin(data.user);  // ← add this
    }
    navigate("/");

  } catch (err) {

    console.error("AUTH ERROR:", err);

    alert(err.message || "Authentication failed");

  } finally {

    setLoading(false);
  }
};

  return (
    <div style={container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        .auth-input:focus { outline: none; border-color: #2A9D8F; box-shadow: 0 0 0 3px rgba(42,157,143,0.15); }
        .auth-btn:hover   { background: #21867a !important; }
        .switch-link:hover { text-decoration: underline; }
      `}</style>

      <div style={card}>
        <div style={logoMark}>⚡</div>
        <h2 style={title}>{isLogin ? "Welcome back" : "Create account"}</h2>
        <p style={subtitle}>{isLogin ? "Sign in to SmartERP" : "Get started with SmartERP"}</p>

        <form onSubmit={handleSubmit}>

          {/* Name — signup only */}
          {!isLogin && (
            <div style={fieldWrap}>
              <label style={labelStyle}>Full Name</label>
              <input
                className="auth-input"
                placeholder="Your name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                style={input}
                required
              />
            </div>
          )}

          {/* Business Name — signup only */}
          {!isLogin && (
            <div style={fieldWrap}>
              <label style={labelStyle}>Business Name</label>
              <input
                className="auth-input"
                placeholder="Your business or company name"
                value={form.businessName}
                onChange={e => setForm({ ...form, businessName: e.target.value })}
                style={input}
                required
              />
            </div>
          )}

          {/* Email */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Email</label>
            <input
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              style={input}
              required
            />
          </div>

          {/* Password */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Password</label>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              style={input}
              required
            />
          </div>

          <button className="auth-btn" style={button} disabled={loading}>
            {loading ? "Please wait…" : isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <p
          className="switch-link"
          onClick={() => setIsLogin(!isLogin)}
          style={switchText}
        >
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <strong style={{ color: "#2A9D8F" }}>
            {isLogin ? "Sign Up" : "Sign In"}
          </strong>
        </p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const container = {
  minHeight:      "100vh",
  background:     "linear-gradient(135deg, #2A9D8F 0%, #264653 100%)",
  display:        "flex",
  justifyContent: "center",
  alignItems:     "center",
  fontFamily:     "'DM Sans', sans-serif",
  padding:        "20px"
};

const card = {
  background:   "#fff",
  padding:      "40px 36px",
  borderRadius: "16px",
  width:        "100%",
  maxWidth:     "400px",
  boxShadow:    "0 20px 60px rgba(0,0,0,0.15)"
};

const logoMark = { fontSize: "28px", marginBottom: "12px" };

const title = {
  fontFamily:   "'Syne', sans-serif",
  fontWeight:   "800",
  fontSize:     "26px",
  color:        "#1f2937",
  margin:       "0 0 4px 0"
};

const subtitle = {
  fontSize: "14px",
  color:    "#6b7280",
  margin:   "0 0 24px 0"
};

const fieldWrap = { marginBottom: "16px" };

const labelStyle = {
  display:       "block",
  fontSize:      "13px",
  fontWeight:    "600",
  color:         "#374151",
  marginBottom:  "6px"
};

const input = {
  width:        "100%",
  padding:      "10px 12px",
  borderRadius: "8px",
  border:       "1.5px solid #e5e7eb",
  fontSize:     "14px",
  fontFamily:   "'DM Sans', sans-serif",
  transition:   "border-color 0.2s, box-shadow 0.2s",
  background:   "#fafafa"
};

const button = {
  width:        "100%",
  padding:      "12px",
  background:   "#2A9D8F",
  color:        "#fff",
  border:       "none",
  borderRadius: "8px",
  cursor:       "pointer",
  fontSize:     "15px",
  fontWeight:   "600",
  fontFamily:   "'DM Sans', sans-serif",
  marginTop:    "8px",
  transition:   "background 0.2s"
};

const switchText = {
  cursor:    "pointer",
  color:     "#6b7280",
  marginTop: "16px",
  fontSize:  "13px",
  textAlign: "center"
};