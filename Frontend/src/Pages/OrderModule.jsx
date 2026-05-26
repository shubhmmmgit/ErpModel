import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api.js";

// STATUS CONFIG 
const STATUS = {
  pending:   { label: "Pending",   color: "#f59e0b", bg: "#fef3c7" },
  confirmed: { label: "Confirmed", color: "#3b82f6", bg: "#dbeafe" },
  shipped:   { label: "Shipped",   color: "#8b5cf6", bg: "#ede9fe" },
  delivered: { label: "Delivered", color: "#10b981", bg: "#d1fae5" },
  cancelled: { label: "Cancelled", color: "#ef4444", bg: "#fee2e2" },
};

const STATUS_FLOW = ["pending", "confirmed", "shipped", "delivered"];

export default function OrderModule() {
  const navigate = useNavigate();

  //  State
  const [orders, setOrders]         = useState([]);
  const [products, setProducts]     = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilter]   = useState("all");
  const [showForm, setShowForm]     = useState(false);
  const [detailOrder, setDetail]    = useState(null);   // order detail modal
  const [submitting, setSubmitting] = useState(false);

  // new order form state
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    notes: "",
    items: [{ product_id: "", quantity: 1 }]
  });

  // ── Fetch ────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes, summaryRes] = await Promise.all([
        apiFetch("/api/orders", { credentials: "include" }),
        apiFetch("/api/products", { credentials: "include" }),
        apiFetch("/api/orders/summary", { credentials: "include" })
      ]);

      if (ordersRes.status === 401 || productsRes.status === 401) {
        navigate("/auth");
        return;
      }

      const ordersData   = await ordersRes.json();
      const productsData = await productsRes.json();
      const summaryData  = await summaryRes.json();

      setOrders(ordersData.orders || []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setSummary(summaryData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Form helpers ─────────────────────────────────────────
  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { product_id: "", quantity: 1 }] }));

  const removeItem = (i) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const updateItem = (i, field, value) => {
    const items = [...form.items];
    items[i][field] = value;
    setForm((f) => ({ ...f, items }));
  };

  const resetForm = () => {
    setForm({ customer_name: "", customer_email: "", notes: "", items: [{ product_id: "", quantity: 1 }] });
    setShowForm(false);
  };

  // ── Calculated order total for form preview ──────────────
  const formTotal = form.items.reduce((sum, item) => {
    const p = products.find((p) => p.id === parseInt(item.product_id));
    return sum + (p ? parseFloat(p.price) * parseInt(item.quantity || 0) : 0);
  }, 0);

  // ── Submit new order ─────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      customer_name:  form.customer_name,
      customer_email: form.customer_email,
      notes:          form.notes,
      items: form.items
        .filter((i) => i.product_id)
        .map((i) => ({ product_id: parseInt(i.product_id), quantity: parseInt(i.quantity) }))
    };

    const res = await apiFetch("/api/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      alert(data.error || "Failed to create order");
      return;
    }

    resetForm();
    fetchAll();
  };

  // ── Update status ────────────────────────────────────────
  const handleStatusChange = async (orderId, status) => {
    const res = await apiFetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      fetchAll();
      if (detailOrder?.id === orderId) {
        const updated = await apiFetch(`/api/orders/${orderId}`, { credentials: "include" });
        setDetail(await updated.json());
      }
    }
  };

  // ── Delete order ─────────────────────────────────────────
  const handleDelete = async (orderId) => {
    if (!window.confirm("Delete this order? Stock will be restored.")) return;
    const res = await apiFetch(`/api/orders/${orderId}`, {
      method: "DELETE",
      credentials: "include"
    });
    if (res.ok) { setDetail(null); fetchAll(); }
  };

  // ── Open detail modal ─────────────────────────────────────
  const openDetail = async (orderId) => {
    const res = await apiFetch(`/api/orders/${orderId}`, { credentials: "include" });
    const data = await res.json();
    setDetail(data);
  };

  // ── Filtered orders ──────────────────────────────────────
  const filtered = filterStatus === "all"
    ? orders
    : orders.filter((o) => o.status === filterStatus);

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={shell}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }

        .ord-row:hover { background: #1e293b !important; cursor: pointer; }
        .filter-btn:hover { background: #334155 !important; }
        .close-btn:hover { background: #334155 !important; }
        .action-btn:hover { opacity: 0.85; }
        .add-item-btn:hover { background: #0f172a !important; }
        .remove-item:hover { color: #ef4444 !important; }

        .stat-card { transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-2px); }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: slideIn 0.3s ease forwards; }

        @keyframes fadeOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .overlay-fade { animation: fadeOverlay 0.2s ease forwards; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link to="/" style={backBtn}>← Home</Link>
          <div>
            <h1 style={pageTitle}>Orders</h1>
            <p style={pageSubtitle}>Track and manage customer orders</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={newOrderBtn}>
          {showForm ? "✕ Cancel" : "+ New Order"}
        </button>
      </div>

      {/* ── SUMMARY STATS ── */}
      {summary && (
        <div style={statsRow} className="animate-in">
          <StatCard label="Total Revenue"  value={`₹${parseFloat(summary.total_revenue).toLocaleString()}`} accent="#10b981" />
          <StatCard label="Total Orders"   value={summary.total_orders}  accent="#3b82f6" />
          <StatCard label="Pending"        value={summary.pending}       accent="#f59e0b" />
          <StatCard label="Delivered"      value={summary.delivered}     accent="#10b981" />
          <StatCard label="Cancelled"      value={summary.cancelled}     accent="#ef4444" />
        </div>
      )}

      {/* ── NEW ORDER FORM ── */}
      {showForm && (
        <div style={formCard} className="animate-in">
          <h2 style={formTitle}>New Order</h2>
          <form onSubmit={handleSubmit}>

            {/* Customer info */}
            <div style={formRow}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Customer Name *</label>
                <input
                  required
                  placeholder="Full name"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  style={formInput}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Customer Email</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  style={formInput}
                />
              </div>
            </div>

            {/* Items */}
            <label style={{ ...fieldLabel, marginBottom: "10px", display: "block" }}>Order Items *</label>
            {form.items.map((item, i) => {
              const selectedProduct = products.find((p) => p.id === parseInt(item.product_id));
              return (
                <div key={i} style={itemRow}>
                  <select
                    required
                    value={item.product_id}
                    onChange={(e) => updateItem(i, "product_id", e.target.value)}
                    style={{ ...formInput, flex: 2 }}
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₹{p.price} (stock: {p.stock})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    max={selectedProduct?.stock || 999}
                    required
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", e.target.value)}
                    style={{ ...formInput, flex: "0 0 80px" }}
                  />

                  <span style={itemSubtotal}>
                    {selectedProduct
                      ? `₹${(parseFloat(selectedProduct.price) * parseInt(item.quantity || 0)).toLocaleString()}`
                      : "—"}
                  </span>

                  {form.items.length > 1 && (
                    <button
                      type="button"
                      className="remove-item"
                      onClick={() => removeItem(i)}
                      style={removeBtn}
                    >✕</button>
                  )}
                </div>
              );
            })}

            <button type="button" className="add-item-btn" onClick={addItem} style={addItemBtn}>
              + Add Item
            </button>

            {/* Notes */}
            <div style={{ marginTop: "16px" }}>
              <label style={fieldLabel}>Notes</label>
              <textarea
                placeholder="Any special instructions…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                style={{ ...formInput, height: "70px", resize: "vertical" }}
              />
            </div>

            {/* Total + submit */}
            <div style={formFooter}>
              <span style={totalPreview}>
                Total: <strong style={{ color: "#10b981" }}>₹{formTotal.toLocaleString()}</strong>
              </span>
              <button style={submitBtn} disabled={submitting}>
                {submitting ? "Placing…" : "Place Order"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── FILTER TABS ── */}
      <div style={filterRow}>
        {["all", ...Object.keys(STATUS)].map((s) => (
          <button
            key={s}
            className="filter-btn"
            onClick={() => setFilter(s)}
            style={{
              ...filterBtn,
              background:   filterStatus === s ? "#2A9D8F" : "#1e293b",
              color:        filterStatus === s ? "#fff"    : "#94a3b8",
              fontWeight:   filterStatus === s ? "700"     : "400",
            }}
          >
            {s === "all" ? "All" : STATUS[s].label}
            <span style={filterCount}>
              {s === "all"
                ? orders.length
                : orders.filter((o) => o.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── ORDERS TABLE ── */}
      {loading ? (
        <p style={emptyText}>Loading orders…</p>
      ) : filtered.length === 0 ? (
        <p style={emptyText}>No orders found. Create your first one!</p>
      ) : (
        <div style={tableWrap} className="animate-in">
          <table style={table}>
            <thead>
              <tr>
                {["Order ID", "Customer", "Items", "Total", "Status", "Date", "Action"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className="ord-row"
                  style={tr}
                  onClick={() => openDetail(order.id)}
                >
                  <td style={td}>
                    <span style={monoText}>#{order.id}</span>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: "600", color: "#f1f5f9" }}>{order.customer_name}</div>
                    {order.customer_email && (
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{order.customer_email}</div>
                    )}
                  </td>
                  <td style={td}>
                    <span style={monoText}>{order.item_count}</span>
                  </td>
                  <td style={td}>
                    <strong style={{ color: "#10b981" }}>₹{parseFloat(order.total_amount).toLocaleString()}</strong>
                  </td>
                  <td style={td}>
                    <StatusBadge status={order.status} />
                  </td>
                  <td style={td}>
                    <span style={{ color: "#64748b", fontSize: "12px" }}>
                      {new Date(order.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric"
                      })}
                    </span>
                  </td>
                  <td style={td} onClick={(e) => e.stopPropagation()}>
                    <StatusDropdown
                      current={order.status}
                      onChange={(s) => handleStatusChange(order.id, s)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ORDER DETAIL MODAL ── */}
      {detailOrder && (
        <div style={overlay} className="overlay-fade" onClick={() => setDetail(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()} className="animate-in">

            {/* Modal header */}
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>Order <span style={{ color: "#2A9D8F" }}>#{detailOrder.id}</span></h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                  {new Date(detailOrder.created_at).toLocaleString("en-IN")}
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <StatusBadge status={detailOrder.status} />
                <button className="close-btn" onClick={() => setDetail(null)} style={closeBtn}>✕</button>
              </div>
            </div>

            {/* Customer */}
            <div style={modalSection}>
              <p style={sectionLabel}>CUSTOMER</p>
              <p style={sectionValue}>{detailOrder.customer_name}</p>
              {detailOrder.customer_email && (
                <p style={{ color: "#64748b", fontSize: "13px", margin: "2px 0 0" }}>{detailOrder.customer_email}</p>
              )}
            </div>

            {/* Items */}
            <div style={modalSection}>
              <p style={sectionLabel}>ITEMS</p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Product", "Qty", "Unit Price", "Subtotal"].map((h) => (
                      <th key={h} style={modalTh}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(detailOrder.items || []).map((item) => (
                    <tr key={item.id}>
                      <td style={modalTd}>{item.product_name}</td>
                      <td style={modalTd}>{item.quantity}</td>
                      <td style={modalTd}>₹{parseFloat(item.unit_price).toLocaleString()}</td>
                      <td style={{ ...modalTd, color: "#10b981", fontWeight: "600" }}>
                        ₹{parseFloat(item.subtotal).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={totalRow}>
                Total: <strong style={{ color: "#10b981", marginLeft: "8px" }}>
                  ₹{parseFloat(detailOrder.total_amount).toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Notes */}
            {detailOrder.notes && (
              <div style={modalSection}>
                <p style={sectionLabel}>NOTES</p>
                <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>{detailOrder.notes}</p>
              </div>
            )}

            {/* Status progression */}
            {detailOrder.status !== "cancelled" && (
              <div style={modalSection}>
                <p style={sectionLabel}>UPDATE STATUS</p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {STATUS_FLOW.map((s) => (
                    <button
                      key={s}
                      className="action-btn"
                      disabled={detailOrder.status === s}
                      onClick={() => handleStatusChange(detailOrder.id, s)}
                      style={{
                        ...statusActionBtn,
                        background: detailOrder.status === s ? STATUS[s].bg : "#1e293b",
                        color:      detailOrder.status === s ? STATUS[s].color : "#94a3b8",
                        border:     `1px solid ${detailOrder.status === s ? STATUS[s].color : "#334155"}`,
                        cursor:     detailOrder.status === s ? "default" : "pointer",
                      }}
                    >
                      {STATUS[s].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Danger zone */}
            {detailOrder.status === "pending" && (
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  className="action-btn"
                  onClick={() => handleStatusChange(detailOrder.id, "cancelled")}
                  style={{ ...dangerBtn, background: "#1c0f0f", color: "#ef4444", border: "1px solid #ef4444" }}
                >
                  Cancel Order
                </button>
                <button
                  className="action-btn"
                  onClick={() => handleDelete(detailOrder.id)}
                  style={{ ...dangerBtn, background: "#1c0f0f", color: "#ef4444", border: "1px solid #ef4444" }}
                >
                  Delete Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ── SUB-COMPONENTS ─────────────────────────────────────────────

function StatCard({ label, value, accent }) {
  return (
    <div className="stat-card" style={{ ...statCard, borderTop: `3px solid ${accent}` }}>
      <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: "26px", fontWeight: "800", color: accent, fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      padding: "3px 10px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: "700",
      letterSpacing: "0.04em",
      textTransform: "uppercase"
    }}>{s.label}</span>
  );
}

function StatusDropdown({ current, onChange }) {
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      disabled={current === "cancelled"}
      style={{
        background: "#0f172a",
        color: "#94a3b8",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "4px 8px",
        fontSize: "12px",
        cursor: current === "cancelled" ? "not-allowed" : "pointer",
        fontFamily: "'Outfit', sans-serif"
      }}
    >
      {Object.entries(STATUS).map(([val, { label }]) => (
        <option key={val} value={val}>{label}</option>
      ))}
    </select>
  );
}


// ── STYLES ──────────────────────────────────────────────────────

const shell = {
  background: "#0f172a",
  minHeight: "100vh",
  padding: "28px 32px",
  fontFamily: "'Outfit', sans-serif",
  color: "#f1f5f9"
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "28px"
};

const backBtn = {
  background: "#1e293b",
  color: "#94a3b8",
  padding: "6px 14px",
  borderRadius: "6px",
  textDecoration: "none",
  fontSize: "13px",
  fontFamily: "'Outfit', sans-serif"
};

const pageTitle = {
  fontFamily: "'Outfit', sans-serif",
  fontWeight: "800",
  fontSize: "28px",
  margin: "0 0 2px",
  color: "#f1f5f9"
};

const pageSubtitle = {
  margin: 0,
  color: "#64748b",
  fontSize: "13px"
};

const newOrderBtn = {
  background: "#2A9D8F",
  color: "#fff",
  border: "none",
  padding: "10px 20px",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily: "'Outfit', sans-serif",
  fontWeight: "600",
  fontSize: "14px"
};

const statsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "14px",
  marginBottom: "24px"
};

const statCard = {
  background: "#1e293b",
  padding: "16px 18px",
  borderRadius: "12px"
};

// ── FORM ──
const formCard = {
  background: "#1e293b",
  borderRadius: "14px",
  padding: "24px",
  marginBottom: "24px",
  border: "1px solid #334155"
};

const formTitle = {
  fontWeight: "800",
  fontSize: "18px",
  margin: "0 0 20px",
  color: "#f1f5f9"
};

const formRow = {
  display: "flex",
  gap: "16px",
  marginBottom: "16px",
  flexWrap: "wrap"
};

const fieldLabel = {
  display: "block",
  fontSize: "12px",
  fontWeight: "600",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "6px"
};

const formInput = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "10px 12px",
  color: "#f1f5f9",
  fontSize: "14px",
  fontFamily: "'Outfit', sans-serif"
};

const itemRow = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  marginBottom: "10px",
  flexWrap: "wrap"
};

const itemSubtotal = {
  color: "#10b981",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "13px",
  minWidth: "80px",
  textAlign: "right"
};

const removeBtn = {
  background: "none",
  border: "none",
  color: "#64748b",
  cursor: "pointer",
  fontSize: "16px",
  padding: "4px",
  transition: "color 0.15s"
};

const addItemBtn = {
  background: "#0f172a",
  color: "#64748b",
  border: "1px dashed #334155",
  borderRadius: "8px",
  padding: "8px 16px",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "'Outfit', sans-serif",
  marginTop: "4px",
  transition: "background 0.15s"
};

const formFooter = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "20px",
  paddingTop: "16px",
  borderTop: "1px solid #334155"
};

const totalPreview = {
  fontSize: "15px",
  color: "#94a3b8"
};

const submitBtn = {
  background: "#2A9D8F",
  color: "#fff",
  border: "none",
  padding: "10px 28px",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily: "'Outfit', sans-serif",
  fontWeight: "700",
  fontSize: "14px"
};

// ── TABLE ──
const filterRow = {
  display: "flex",
  gap: "8px",
  marginBottom: "16px",
  flexWrap: "wrap"
};

const filterBtn = {
  border: "none",
  borderRadius: "20px",
  padding: "6px 14px",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "'Outfit', sans-serif",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  transition: "background 0.15s"
};

const filterCount = {
  background: "rgba(255,255,255,0.1)",
  borderRadius: "10px",
  padding: "1px 7px",
  fontSize: "11px"
};

const tableWrap = {
  background: "#1e293b",
  borderRadius: "14px",
  overflow: "hidden",
  border: "1px solid #334155"
};

const table = {
  width: "100%",
  borderCollapse: "collapse"
};

const th = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: "700",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderBottom: "1px solid #334155",
  background: "#0f172a"
};

const td = {
  padding: "14px 16px",
  fontSize: "14px",
  color: "#cbd5e1",
  borderBottom: "1px solid #1e293b"
};

const tr = {
  background: "#1e293b",
  transition: "background 0.15s"
};

const monoText = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "13px",
  color: "#94a3b8"
};

const emptyText = {
  color: "#475569",
  textAlign: "center",
  padding: "60px 0",
  fontSize: "15px"
};

// ── MODAL ──
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "20px"
};

const modal = {
  background: "#1e293b",
  borderRadius: "16px",
  width: "100%",
  maxWidth: "580px",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "28px",
  border: "1px solid #334155"
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "20px"
};

const modalTitle = {
  fontFamily: "'Outfit', sans-serif",
  fontWeight: "800",
  fontSize: "22px",
  margin: 0
};

const closeBtn = {
  background: "#0f172a",
  border: "none",
  color: "#94a3b8",
  cursor: "pointer",
  borderRadius: "6px",
  padding: "6px 10px",
  fontSize: "16px",
  transition: "background 0.15s"
};

const modalSection = {
  marginBottom: "20px",
  paddingBottom: "20px",
  borderBottom: "1px solid #334155"
};

const sectionLabel = {
  margin: "0 0 8px",
  fontSize: "11px",
  fontWeight: "700",
  color: "#475569",
  letterSpacing: "0.1em",
  textTransform: "uppercase"
};

const sectionValue = {
  margin: 0,
  fontWeight: "600",
  color: "#f1f5f9",
  fontSize: "15px"
};

const modalTh = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: "11px",
  color: "#475569",
  borderBottom: "1px solid #334155",
  textTransform: "uppercase",
  letterSpacing: "0.06em"
};

const modalTd = {
  padding: "10px 10px",
  fontSize: "13px",
  color: "#94a3b8",
  borderBottom: "1px solid #1a2540"
};

const totalRow = {
  textAlign: "right",
  padding: "12px 10px 0",
  fontSize: "15px",
  color: "#94a3b8"
};

const statusActionBtn = {
  padding: "7px 16px",
  borderRadius: "6px",
  fontFamily: "'Outfit', sans-serif",
  fontWeight: "600",
  fontSize: "13px",
  transition: "opacity 0.15s"
};

const dangerBtn = {
  padding: "8px 16px",
  borderRadius: "6px",
  fontFamily: "'Outfit', sans-serif",
  fontWeight: "600",
  fontSize: "13px",
  cursor: "pointer",
  transition: "opacity 0.15s"
};