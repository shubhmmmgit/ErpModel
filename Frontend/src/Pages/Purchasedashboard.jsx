// PurchaseDashboard.jsx
import { useState, useEffect } from "react";
import {apiFetch} from "../api.js";

const C = {
  yellow: "#fbbf24", green: "#34d399", red: "#f87171",
  blue: "#60a5fa", purple: "#a78bfa", cyan: "#22d3ee",
  bg: "#080b18", card: "#0e1124", border: "#1d2035",
  text: "#ccd6f6", muted: "#8892b0",
};

export default function PurchaseDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

  const fetchDashboard = async () => {

    try {

      setLoading(true);

      const dashboardData = await apiFetch(
        "/api/purchase/dashboard"
      );

      setData(dashboardData || {});

    } catch (err) {

      console.error(
        "PURCHASE DASHBOARD ERROR:",
        err
      );

      setData({});

    } finally {

      setLoading(false);
    }
  };

  fetchDashboard();

}, []);

  if (loading) return <LoadingState />;
  if (!data)   return <p style={{ color: C.muted }}>Failed to load dashboard.</p>;

 const {
  pr = {},
  po = {},
  invoice = {},
  returns = {},
  top_suppliers = [],
  recent_activity = [],
  monthly_spend = [],
} = data || {};

  // Bar chart scaling
  const maxSpend = Math.max(...(monthly_spend || []).map(m => parseFloat(m.spend)), 1);

  return (
    <div>
      <style>{`
        .dash-card { transition: transform 0.2s, box-shadow 0.2s; }
        .dash-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.4) !important; }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fade-up { animation: fadeUp 0.35s ease forwards; }
        .bar-fill { transition: height 0.6s cubic-bezier(.34,1.56,.64,1); }
      `}</style>

      {/* ── KPI CARDS ── */}
      <div style={grid4} className="fade-up">
        <KpiCard label="Total PO Value"     value={`₹${fmt(po.total_value|| 0)}`}    accent={C.yellow}  icon="💰" sub={`${po.total} orders total`} />
        <KpiCard label="Outstanding Payable" value={`₹${fmt(invoice?.total_outstanding || 0)}`} accent={C.red} icon="💳" sub={`${invoice.pending} invoices pending`} />
        <KpiCard label="Pending PRs"        value={pr?.pending || 0}                   accent={C.blue}    icon="📋" sub={`${pr?.total} total requisitions`} />
        <KpiCard label="Active Returns"     value={returns.total || 0}                accent={C.purple}  icon="↩️" sub={`₹${fmt(returns.total_value || 0)} value`} />
      </div>

      {/* ── PO STATUS + INVOICE ROW ── */}
      <div style={{ ...grid2, marginTop: "20px" }} className="fade-up">

        {/* PO Status Breakdown */}
        <div style={card} className="dash-card">
          <h3 style={cardTitle}>Purchase Order Status</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
            {[
              { label: "Sent",              count: po.sent,       color: C.blue,   pct: pct(po.sent, po.total) },
              { label: "Confirmed",         count: po.confirmed,  color: C.yellow, pct: pct(po.confirmed, po.total) },
              { label: "Received",          count: po.received,   color: C.green,  pct: pct(po.received, po.total) },
              { label: "Cancelled",         count: po.cancelled,  color: C.red,    pct: pct(po.cancelled, po.total) },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span style={{ color: C.text }}>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: "700" }}>{row.count}</span>
                </div>
                <div style={{ background: "#1d2035", borderRadius: "4px", height: "6px" }}>
                  <div style={{
                    width: `${row.pct}%`, height: "100%",
                    background: row.color, borderRadius: "4px",
                    transition: "width 0.8s ease"
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Summary */}
        <div style={card} className="dash-card">
          <h3 style={cardTitle}>Invoice Summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
            {[
              { label: "Total Invoiced",  value: `₹${fmt(invoice?.total_invoiced)}`,    color: C.text },
              { label: "Total Paid",      value: `₹${fmt(invoice?.total_paid)}`,         color: C.green },
              { label: "Outstanding",     value: `₹${fmt(invoice?.total_outstanding)}`,  color: C.red },
              { label: "Overdue",         value: invoice.overdue,                       color: C.red },
            ].map(item => (
              <div key={item.label} style={{ background: "#13172b", borderRadius: "10px", padding: "14px" }}>
                <p style={{ fontSize: "11px", color: C.muted, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {item.label}
                </p>
                <p style={{ fontSize: "20px", fontWeight: "800", color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MONTHLY SPEND CHART ── */}
      {monthly_spend?.length > 0 && (
        <div style={{ ...card, marginTop: "20px" }} className="fade-up dash-card">
          <h3 style={cardTitle}>Monthly Spend (last 6 months)</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "140px", marginTop: "20px" }}>
            {monthly_spend.map((m, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "10px", color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                  ₹{shortFmt(m.spend)}
                </span>
                <div
                  className="bar-fill"
                  style={{
                    width: "100%",
                    height: `${(parseFloat(m.spend) / maxSpend) * 100}px`,
                    minHeight: "4px",
                    background: `linear-gradient(180deg, ${C.yellow} 0%, rgba(251,191,36,0.3) 100%)`,
                    borderRadius: "6px 6px 0 0",
                  }}
                />
                <span style={{ fontSize: "10px", color: C.muted }}>{m.month.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TOP SUPPLIERS + ACTIVITY ── */}
      <div style={{ ...grid2, marginTop: "20px" }} className="fade-up">

        {/* Top Suppliers */}
        <div style={card} className="dash-card">
          <h3 style={cardTitle}>Top Suppliers</h3>
          <div style={{ marginTop: "14px" }}>
            {top_suppliers?.length ? top_suppliers.map((s, i) => (
              <div key={s.id} style={supplierRow}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: "rgba(251,191,36,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.yellow, fontWeight: "800", fontSize: "13px"
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: C.text }}>{s.name}</p>
                    <p style={{ fontSize: "11px", color: C.muted }}>{s.order_count} orders</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: C.green }}>₹{fmt(s.total_value || 0)}</p>
                  <p style={{ fontSize: "11px", color: C.yellow }}>★ {parseFloat(s.rating || 0).toFixed(1)}</p>
                </div>
              </div>
            )) : <p style={{ color: C.muted, fontSize: "13px" }}>No suppliers yet.</p>}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={card} className="dash-card">
          <h3 style={cardTitle}>Recent Activity</h3>
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {recent_activity?.length ? recent_activity.slice(0, 8).map((act, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: C.yellow, flexShrink: 0, marginTop: "5px"
                }} />
                <div>
                  <p style={{ fontSize: "12.5px", color: C.text }}>
  <strong style={{ textTransform: "capitalize" }}>
    {act.entity_type || "Activity"}
  </strong>{" "}
  {act.entity_id || "-"} — {(act.action || "created").replace(/_/g, " ")}
</p>
                  <p style={{ fontSize: "11px", color: C.muted }}>
                    {act.performed_by_name || "System"} · {new Date(act.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            )) : <p style={{ color: C.muted, fontSize: "13px" }}>No recent activity.</p>}
          </div>
        </div>
      </div>

      {/* ── PR QUICK STATS ── */}
      <div style={{ ...grid4, marginTop: "20px" }} className="fade-up">
        <MiniStat label="Total PRs"   value={pr.total}    color={C.text} />
        <MiniStat label="Approved"    value={pr.approved} color={C.green} />
        <MiniStat label="Rejected"    value={pr.rejected} color={C.red} />
        <MiniStat label="Converted"   value={pr.ordered}  color={C.yellow} />
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function KpiCard({ label, value, accent, icon, sub }) {
  return (
    <div style={{ ...card, borderTop: `3px solid ${accent}` }} className="dash-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: "11px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>{label}</p>
          <p style={{ fontSize: "26px", fontWeight: "800", color: accent, fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
          {sub && <p style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}>{sub}</p>}
        </div>
        <span style={{ fontSize: "24px", opacity: 0.6 }}>{icon}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ ...card, textAlign: "center" }} className="dash-card">
      <p style={{ fontSize: "28px", fontWeight: "800", color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
      <p style={{ fontSize: "12px", color: C.muted, marginTop: "4px" }}>{label}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px", color: C.muted }}>
      Loading dashboard…
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n) => parseFloat(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const shortFmt = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(0);
};
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

// ── Styles ────────────────────────────────────────────────────
const grid4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" };
const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" };

const card = {
  background: "#0e1124",
  border: "1px solid #1d2035",
  borderRadius: "14px",
  padding: "20px",
};

const cardTitle = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#e6f1ff",
  letterSpacing: "0.02em",
};

const supplierRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid #1d2035",
};