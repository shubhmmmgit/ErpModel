// PurchaseModule.jsx  — Main hub: renders sub-views via internal routing
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

// ── Sub-view imports ─────────────────────────────────────────
import PurchaseDashboard   from "./Purchasedashboard.jsx";
import SupplierManagement  from "./Suppliermanagement.jsx";
import PurchaseRequisition from "./PurchaseRequisition.jsx";
import RFQModule           from "./RFQModule.jsx";
import PurchaseOrders      from "./PurchaseOrder.jsx";
import GoodsReceipt        from "./GoodsReceipt.jsx";
import PurchaseInvoice     from "./PurchaseInvoice.jsx";
import PurchaseReturn      from "./PurchaseReturn.jsx";

// ── Constants ────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",    label: "Dashboard",     icon: "📊" },
  { id: "suppliers",    label: "Suppliers",     icon: "🏭" },
  { id: "requisitions", label: "Requisitions",  icon: "📋" },
  { id: "rfq",          label: "RFQ",           icon: "📩" },
  { id: "orders",       label: "Purchase Orders", icon: "🛒" },
  { id: "grn",          label: "Goods Receipt", icon: "📦" },
  { id: "invoices",     label: "Invoices",      icon: "🧾" },
  { id: "returns",      label: "Returns",       icon: "↩️" },
];

export default function PurchaseModule() {
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  // Minimal auth guard
  useEffect(() => {
    fetch("/api/purchase/dashboard", { credentials: "include" })
      .then(r => { if (r.status === 401) navigate("/auth"); });
  }, [navigate]);

  const renderView = () => {
    switch (activeView) {
      case "dashboard":    return <PurchaseDashboard />;
      case "suppliers":    return <SupplierManagement />;
      case "requisitions": return <PurchaseRequisition />;
      case "rfq":          return <RFQModule />;
      case "orders":       return <PurchaseOrders />;
      case "grn":          return <GoodsReceipt />;
      case "invoices":     return <PurchaseInvoice />;
      case "returns":      return <PurchaseReturn />;
      default:             return <PurchaseDashboard />;
    }
  };

  return (
    <div style={shell}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .nav-item { transition: background 0.15s, color 0.15s; }
        .nav-item:hover { background: rgba(251,191,36,0.12) !important; color: #fbbf24 !important; }
        .nav-item.active { background: rgba(251,191,36,0.18) !important; color: #fbbf24 !important; border-left: 3px solid #fbbf24; }

        .pmod-btn { transition: opacity 0.15s, transform 0.1s; }
        .pmod-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .pmod-btn:active { transform: translateY(0); }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0c0f1a; }
        ::-webkit-scrollbar-thumb { background: #2d3147; border-radius: 4px; }
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{ ...sidebar, width: sidebarOpen ? "220px" : "64px" }}>
        {/* Brand */}
        <div style={brand}>
          <span style={brandIcon}>⚡</span>
          {sidebarOpen && <span style={brandText}>Purchase</span>}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {NAV.map(item => (
            <button
              key={item.id}
              className={`nav-item${activeView === item.id ? " active" : ""}`}
              onClick={() => setActiveView(item.id)}
              style={{
                ...navItem,
                justifyContent: sidebarOpen ? "flex-start" : "center",
                paddingLeft: sidebarOpen ? "20px" : "0",
                color: activeView === item.id ? "#fbbf24" : "#8892b0",
                borderLeft: activeView === item.id ? "3px solid #fbbf24" : "3px solid transparent",
              }}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span style={{ fontSize: "16px", flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={navLabel}>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: "12px", borderTop: "1px solid #1d2035" }}>
          <Link to="/" style={{ ...homeLink, justifyContent: sidebarOpen ? "flex-start" : "center" }}>
            <span>🏠</span>
            {sidebarOpen && <span style={{ marginLeft: "8px", fontSize: "13px" }}>Home</span>}
          </Link>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={mainContent}>
        {/* Top bar */}
        <div style={topBar}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className="pmod-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={menuToggle}
              title="Toggle sidebar"
            >☰</button>
            <div>
              <h1 style={pageTitle}>
                {NAV.find(n => n.id === activeView)?.icon}{" "}
                {NAV.find(n => n.id === activeView)?.label}
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={moduleTag}>Purchase Module</span>
          </div>
        </div>

        {/* View content */}
        <div style={viewContent}>{renderView()}</div>
      </main>
    </div>
  );
}

// ── STYLES ───────────────────────────────────────────────────
const shell = {
  display: "flex",
  height: "100vh",
  background: "#080b18",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "#ccd6f6",
  overflow: "hidden",
};

const sidebar = {
  background: "#0c0f1a",
  borderRight: "1px solid #1d2035",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  transition: "width 0.2s",
  overflow: "hidden",
};

const brand = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "20px 16px",
  borderBottom: "1px solid #1d2035",
  flexShrink: 0,
};

const brandIcon = { fontSize: "20px" };
const brandText = {
  fontWeight: "800",
  fontSize: "16px",
  color: "#fbbf24",
  whiteSpace: "nowrap",
  letterSpacing: "0.5px",
};

const navItem = {
  width: "100%",
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "11px 0",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: "13.5px",
  color: "#8892b0",
  textAlign: "left",
};

const navLabel = { whiteSpace: "nowrap", overflow: "hidden" };

const homeLink = {
  display: "flex",
  alignItems: "center",
  color: "#8892b0",
  textDecoration: "none",
  fontSize: "13px",
  padding: "6px 4px",
  borderRadius: "6px",
};

const mainContent = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 24px",
  borderBottom: "1px solid #1d2035",
  background: "#0c0f1a",
  flexShrink: 0,
};

const menuToggle = {
  background: "none",
  border: "none",
  color: "#8892b0",
  fontSize: "20px",
  cursor: "pointer",
  padding: "4px 8px",
  borderRadius: "6px",
};

const pageTitle = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#e6f1ff",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const moduleTag = {
  background: "rgba(251,191,36,0.1)",
  color: "#fbbf24",
  border: "1px solid rgba(251,191,36,0.25)",
  borderRadius: "20px",
  padding: "4px 12px",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const viewContent = {
  flex: 1,
  overflowY: "auto",
  padding: "24px",
};