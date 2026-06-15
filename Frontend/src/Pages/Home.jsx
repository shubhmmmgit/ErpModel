import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../api.js";


export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [picMenuOpen, setPicMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  // Load user info + profile pic from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("erpUser");
    if (stored) setUser(JSON.parse(stored));

    const pic = localStorage.getItem("erpProfilePic");
    if (pic) setProfilePic(pic);
  }, []);

  // Close avatar menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setPicMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

 const handleLogout = async () => {
  await apiFetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  });
  localStorage.removeItem("erpUser");
  localStorage.removeItem("erpProfilePic");
  navigate("/auth");
};

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      setProfilePic(base64);
      localStorage.setItem("erpProfilePic", base64);
      setPicMenuOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePic = () => {
    setProfilePic(null);
    localStorage.removeItem("erpProfilePic");
    setPicMenuOpen(false);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div style={{ background: "#F4F6F8", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── GOOGLE FONT ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');

        * { box-sizing: border-box; }

        .module-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.10) !important;
        }
        .logout-btn:hover {
          background: #e53e3e !important;
        }
        .avatar-wrap:hover {
          opacity: 0.88;
        }
        .pic-menu-item:hover {
          background: #f3f4f6;
        }
      `}</style>

      {/* ── HERO ── */}
      <div style={heroStyle}>

        {/* Top bar */}
        <div style={topBar}>
          <span style={brandLabel}>SmartERP</span>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>

            {user ? (
              <>
                {/* Greeting */}
                <span style={greetingStyle}>
                  Hello, <strong>{user.name}</strong> 👋
                </span>

                {/* Logout */}
                <button
                  className="logout-btn"
                  onClick={handleLogout}
                  style={logoutBtnStyle}
                >
                  Logout
                </button>

                {/* Avatar with dropdown */}
                <div ref={menuRef} style={{ position: "relative" }}>
                  <div
                    className="avatar-wrap"
                    onClick={() => setPicMenuOpen(!picMenuOpen)}
                    style={avatarStyle}
                    title="Change profile picture"
                  >
                    {profilePic ? (
                      <img
                        src={profilePic}
                        alt="Profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                      />
                    ) : (
                      <span style={{ fontSize: "15px", fontWeight: "700", color: "#264653" }}>
                        {getInitials(user.name)}
                      </span>
                    )}
                  </div>

                  {/* Dropdown menu */}
                  {picMenuOpen && (
                    <div style={picMenuStyle}>
                      <p style={picMenuHeader}>{user.name}</p>
                      <p style={picMenuSub}>{user.email}</p>
                      <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />

                      <button
                        className="pic-menu-item"
                        onClick={() => fileInputRef.current.click()}
                        style={picMenuItem}
                      >
                        📷 {profilePic ? "Change Photo" : "Upload Photo"}
                      </button>

                      {profilePic && (
                        <button
                          className="pic-menu-item"
                          onClick={handleRemovePic}
                          style={{ ...picMenuItem, color: "#e53e3e" }}
                        >
                          🗑 Remove Photo
                        </button>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handlePicChange}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link to="/auth" style={signInBtn}>Sign In</Link>
            )}
          </div>
        </div>

        {/* Hero text */}
        <div style={{ marginTop: "48px" }}>
          <h1 style={headingStyle}>SmartERP Dashboard</h1>
          <p style={subText}>
            Manage your business, products, and operations in one place.
          </p>
        </div>

        {/* Wave */}
        <div style={waveContainer}>
          <svg viewBox="0 0 1440 200" style={{ width: "100%", display: "block" }}>
            <path fill="#F4F6F8" d="M0,160 C360,80 1080,240 1440,120 L1440,200 L0,200 Z" />
          </svg>
        </div>
      </div>

      {/* ── MODULES ── */}
      <div style={moduleSection}>
  <h2 style={modulesHeading}>Modules</h2>

  <div style={moduleGrid}>
    
    <Link to="/products" className="module-card" style={cardStyle}>
      <div style={cardIcon}>📦</div>
      <h3 style={cardTitle}>Products</h3>
      <p style={cardDesc}>Manage your product inventory</p>
    </Link>

    <Link to="/purchase" className="module-card" style={cardStyle}>
      <div style={cardIcon}>🛒</div>
      <h3 style={cardTitle}>Purchase</h3>
      <p style={cardDesc}>
        Procurement, suppliers & inventory purchasing
      </p>
    </Link>

    <Link to="/orders" className="module-card" style={cardStyle}>
      <div style={cardIcon}>🧾</div>
      <h3 style={cardTitle}>Orders</h3>
      <p style={cardDesc}>
        Track and manage customer orders
      </p>
    </Link>

    <Link to="/crm" className="module-card" style={cardStyle}>
      <div style={cardIcon}>👥</div>
      <h3 style={cardTitle}>CRM</h3>
      <p style={cardDesc}>
        Customers, leads & follow-ups
      </p>
    </Link>
    <Link>
      <div className="module-card" style={cardStyle}>
            <div style={cardIcon}>📊</div>
            <h3 style={cardTitle}>Reports</h3>
            <p style={cardDesc}>Coming soon</p>
          </div>
          <div>
            
          </div>
    </Link>

    

  </div>
</div>
      </div>

   
  );
}

// ── STYLES ──────────────────────────────────────────────────

const heroStyle = {
  background: "linear-gradient(135deg, #2A9D8F 0%, #264653 100%)",
  color: "#fff",
  padding: "28px 40px 120px",
  position: "relative"
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const brandLabel = {
  fontFamily: "'Syne', sans-serif",
  fontSize: "22px",
  fontWeight: "800",
  letterSpacing: "0.5px",
  color: "#fff"
};

const greetingStyle = {
  fontSize: "14px",
  color: "#e0f2f1"
};

const logoutBtnStyle = {
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.3)",
  padding: "6px 14px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "'DM Sans', sans-serif",
  transition: "background 0.2s"
};

const avatarStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  background: "#e0f2f1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  border: "2px solid rgba(255,255,255,0.5)",
  overflow: "hidden",
  flexShrink: 0
};

const picMenuStyle = {
  position: "absolute",
  top: "48px",
  right: 0,
  background: "#fff",
  borderRadius: "10px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  padding: "12px",
  minWidth: "190px",
  zIndex: 100
};

const picMenuHeader = {
  margin: "0 0 2px 0",
  fontWeight: "700",
  fontSize: "14px",
  color: "#1f2937"
};

const picMenuSub = {
  margin: 0,
  fontSize: "12px",
  color: "#6b7280"
};

const picMenuItem = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  padding: "8px 10px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "13px",
  color: "#374151",
  fontFamily: "'DM Sans', sans-serif",
  transition: "background 0.15s"
};

const headingStyle = {
  fontFamily: "'Syne', sans-serif",
  fontSize: "42px",
  fontWeight: "800",
  marginBottom: "10px",
  letterSpacing: "-0.5px"
};

const subText = {
  fontSize: "17px",
  color: "#b2dfdb",
  maxWidth: "480px"
};

const waveContainer = {
  position: "absolute",
  bottom: "-1px",
  left: 0,
  width: "100%",
  pointerEvents: "none"
};

const moduleSection = {
  padding: "40px",
  marginTop: "-20px"
};

const modulesHeading = {
  color: "#264653",
  fontFamily: "'Syne', sans-serif",
  fontSize: "22px",
  fontWeight: "800",
  marginBottom: "20px"
};

const moduleGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "20px",
  alignItems: "stretch"
};

const cardStyle = {
  background: "#fff",
  padding: "24px 20px",
  borderRadius: "14px",
  textDecoration: "none",
  color: "#264653",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  transition: "transform 0.2s, box-shadow 0.2s",
  cursor: "pointer",

  minHeight: "140px",

  display: "flex",
  flexDirection: "column",
  justifyContent: "center"
};

const cardIcon = {
  fontSize: "28px",
  marginBottom: "10px"
};

const cardTitle = {
  fontFamily: "'Syne', sans-serif",
  fontWeight: "700",
  fontSize: "17px",
  margin: "0 0 6px 0"
};

const cardDesc = {
  fontSize: "13px",
  color: "#6b7280",
  margin: 0
};

const signInBtn = {
  background: "#264653",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: "6px",
  textDecoration: "none",
  fontSize: "14px"
};