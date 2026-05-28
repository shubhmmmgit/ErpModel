// purchaseShared.jsx  — shared primitives (colors, Modal, Badge, Table, Toast, etc.)
import { useState, useEffect, useCallback } from "react";

// ── Design tokens ─────────────────────────────────────────────
export const C = {
  bg: "#080b18", card: "#0e1124", cardHover: "#111529",
  border: "#1d2035", border2: "#252840",
  text: "#ccd6f6", textMid: "#a8b2d8", muted: "#8892b0",
  yellow: "#fbbf24", green: "#34d399", red: "#f87171",
  blue: "#60a5fa", purple: "#a78bfa", cyan: "#22d3ee",
  orange: "#fb923c",
};

// ── Status configs ────────────────────────────────────────────
export const PR_STATUS = {
  draft:     { label: "Draft",     bg: "#1d2035",                color: C.muted   },
  pending:   { label: "Pending",   bg: "rgba(251,191,36,0.12)",  color: C.yellow  },
  approved:  { label: "Approved",  bg: "rgba(52,211,153,0.12)",  color: C.green   },
  rejected:  { label: "Rejected",  bg: "rgba(248,113,113,0.12)", color: C.red     },
  ordered:   { label: "Ordered",   bg: "rgba(96,165,250,0.12)",  color: C.blue    },
  cancelled: { label: "Cancelled", bg: "rgba(248,113,113,0.08)", color: "#e57878" },
};

export const PO_STATUS = {
  draft:               { label: "Draft",                bg: "#1d2035",                color: C.muted   },
  sent:                { label: "Sent",                 bg: "rgba(96,165,250,0.12)",  color: C.blue    },
  confirmed:           { label: "Confirmed",            bg: "rgba(52,211,153,0.12)",  color: C.green   },
  partially_received:  { label: "Partially Received",   bg: "rgba(251,191,36,0.12)",  color: C.yellow  },
  received:            { label: "Received",             bg: "rgba(52,211,153,0.18)",  color: "#5af0b0" },
  cancelled:           { label: "Cancelled",            bg: "rgba(248,113,113,0.08)", color: C.red     },
  closed:              { label: "Closed",               bg: "#1d2035",               color: C.muted   },
};

export const INV_STATUS = {
  draft:            { label: "Draft",            bg: "#1d2035",                color: C.muted   },
  pending:          { label: "Pending",          bg: "rgba(251,191,36,0.12)",  color: C.yellow  },
  approved:         { label: "Approved",         bg: "rgba(52,211,153,0.12)",  color: C.green   },
  partially_paid:   { label: "Partially Paid",   bg: "rgba(96,165,250,0.12)",  color: C.blue    },
  paid:             { label: "Paid",             bg: "rgba(52,211,153,0.18)",  color: "#5af0b0" },
  overdue:          { label: "Overdue",          bg: "rgba(248,113,113,0.12)", color: C.red     },
  disputed:         { label: "Disputed",         bg: "rgba(167,139,250,0.12)", color: C.purple  },
  cancelled:        { label: "Cancelled",        bg: "rgba(248,113,113,0.08)", color: "#e57878" },
};

export const RET_STATUS = {
  draft:     { label: "Draft",     bg: "#1d2035",                color: C.muted  },
  pending:   { label: "Pending",   bg: "rgba(251,191,36,0.12)",  color: C.yellow },
  approved:  { label: "Approved",  bg: "rgba(52,211,153,0.12)",  color: C.green  },
  shipped:   { label: "Shipped",   bg: "rgba(96,165,250,0.12)",  color: C.blue   },
  completed: { label: "Completed", bg: "rgba(52,211,153,0.18)",  color: "#5af0b0"},
  cancelled: { label: "Cancelled", bg: "rgba(248,113,113,0.08)", color: C.red    },
};

// ── StatusBadge ───────────────────────────────────────────────
export function StatusBadge({ status, map }) {
  const s = map[status] || { label: status, bg: "#1d2035", color: C.muted };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "3px 10px", borderRadius: "20px",
      fontSize: "11px", fontWeight: "700",
      letterSpacing: "0.04em", textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = "580px" }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div
        style={{ ...modal, maxWidth: width }}
        onClick={e => e.stopPropagation()}
      >
        <div style={modalHeader}>
          <h2 style={modalTitle}>{title}</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ overflowY: "auto", maxHeight: "calc(90vh - 80px)", padding: "0 24px 24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── FormInput ─────────────────────────────────────────────────
export function FormInput({ label, required, children, style }) {
  return (
    <div style={{ marginBottom: "14px", ...style }}>
      {label && (
        <label style={{ display: "block", fontSize: "11px", fontWeight: "700",
          color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
          {label}{required && <span style={{ color: C.red, marginLeft: "3px" }}>*</span>}
        </label>
      )}
      {children}
    </div>
  );
}

export const inputStyle = {
  width: "100%",
  background: "#080b18",
  border: `1px solid ${C.border}`,
  borderRadius: "8px",
  padding: "9px 12px",
  color: C.text,
  fontSize: "13.5px",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  outline: "none",
};

export const selectStyle = { ...inputStyle, cursor: "pointer" };

// ── Button ────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = "primary", disabled, type = "button", style: extra }) {
  const variants = {
    primary:   { background: C.yellow, color: "#000" },
    secondary: { background: "#1d2035", color: C.text, border: `1px solid ${C.border}` },
    danger:    { background: "rgba(248,113,113,0.12)", color: C.red, border: `1px solid ${C.red}` },
    ghost:     { background: "none", color: C.muted, border: `1px dashed ${C.border}` },
    success:   { background: "rgba(52,211,153,0.12)", color: C.green, border: `1px solid ${C.green}` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnBase, ...variants[variant],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...extra
      }}
    >
      {children}
    </button>
  );
}

// ── Table ─────────────────────────────────────────────────────
export function Table({ headers, children, empty }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && (
        <p style={{ textAlign: "center", color: C.muted, padding: "40px", fontSize: "14px" }}>{empty}</p>
      )}
    </div>
  );
}

export const Td = ({ children, style }) => (
  <td style={{ padding: "13px 16px", fontSize: "13px", color: C.textMid,
    borderBottom: `1px solid ${C.border}`, ...style }}>
    {children}
  </td>
);

export const Tr = ({ children, onClick }) => (
  <tr
    onClick={onClick}
    style={{ background: C.card, transition: "background 0.15s", cursor: onClick ? "pointer" : "default" }}
    onMouseEnter={e => onClick && (e.currentTarget.style.background = "#111529")}
    onMouseLeave={e => (e.currentTarget.style.background = C.card)}
  >
    {children}
  </tr>
);

// ── Toast ─────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const ToastContainer = () => (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "8px" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "error" ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)",
          border: `1px solid ${t.type === "error" ? C.red : C.green}`,
          color: t.type === "error" ? C.red : C.green,
          padding: "10px 16px", borderRadius: "8px",
          fontSize: "13px", fontWeight: "600",
          backdropFilter: "blur(8px)",
          animation: "fadeUp 0.25s ease",
          maxWidth: "320px",
        }}>
          {t.type === "error" ? "✕ " : "✓ "}{t.msg}
        </div>
      ))}
    </div>
  );

  return { toast, ToastContainer };
}

// ── SearchBar ─────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = "Search…" }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: "14px" }}>🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: "32px", width: "220px" }}
      />
    </div>
  );
}

// ── FilterSelect ──────────────────────────────────────────────
export function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...selectStyle, width: "auto", minWidth: "130px" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Section card ──────────────────────────────────────────────
export const cardStyle = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: "14px",
  padding: "20px",
  marginBottom: "20px",
};

export const sectionTitle = {
  fontSize: "15px", fontWeight: "700", color: "#e6f1ff",
  marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px"
};

export const monoStyle = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "12px",
  color: C.muted,
};

// ── Helpers ───────────────────────────────────────────────────
export const fmtCurrency = (n) =>
  `₹${parseFloat(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ── Private styles ─────────────────────────────────────────────
const overlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000, padding: "20px",
};

const modal = {
  background: C.card, border: `1px solid ${C.border}`,
  borderRadius: "16px", width: "100%",
  maxHeight: "90vh", overflow: "hidden",
};

const modalHeader = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
};

const modalTitle = {
  fontSize: "17px", fontWeight: "800", color: "#e6f1ff",
};

const closeBtn = {
  background: "#13172b", border: "none", color: C.muted,
  cursor: "pointer", borderRadius: "6px", padding: "6px 10px",
  fontSize: "15px",
};

const btnBase = {
  padding: "8px 18px", borderRadius: "8px", border: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: "700",
  fontSize: "13px", cursor: "pointer", transition: "opacity 0.15s, transform 0.1s",
};

const th = {
  padding: "11px 16px", textAlign: "left", fontSize: "11px",
  fontWeight: "700", color: C.muted, textTransform: "uppercase",
  letterSpacing: "0.08em", borderBottom: `1px solid ${C.border}`,
  background: "#0c0f1a",
};