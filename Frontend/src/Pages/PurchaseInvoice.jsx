import { useState, useEffect } from "react";
import { apiFetch } from "../api";
import {
  cardStyle, sectionTitle, inputStyle, selectStyle,
  Btn, Table, Td, Tr, StatusBadge, Modal, FormInput,
  C, useToast, fmtCurrency, fmtDate
} from "./Purchaseshared.jsx";

const INV_STATUS = {
  pending:         { label: "Pending",        bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
  partially_paid:  { label: "Partial",        bg: "rgba(99,102,241,0.12)",  color: "#818cf8" },
  paid:            { label: "Paid",           bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  overdue:         { label: "Overdue",        bg: "rgba(248,113,113,0.12)", color: "#f87171" },
  cancelled:       { label: "Cancelled",      bg: "rgba(148,163,184,0.1)",  color: "#94a3b8" },
};

const EMPTY = {
  po_id: "",
  supplier_id: "",
  total_amount: "",
  notes: "",
};

export default function PurchaseInvoice() {
  const [invoices, setInvoices]   = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pos, setPos]             = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail]       = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying]       = useState(false);
  const { toast, ToastContainer } = useToast();

  // ── Fetch all data ─────────────────────────────────────────
  const fetchAll = async () => {
    try {
      const [invData, suppData, poData] = await Promise.all([
        apiFetch("/api/purchase/invoices"),
        apiFetch("/api/purchase/suppliers?limit=200"),
        apiFetch("/api/purchase/orders"),
      ]);
      setInvoices(invData.invoices || []);
      setSuppliers(suppData.suppliers || []);
      setPos(poData.orders || []);
    } catch (err) {
      console.error("fetchAll error:", err);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Auto-generate invoice number
  const openCreate = () => {
     setForm(EMPTY);
     setShowForm(true);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── When PO is selected, auto-fill supplier ────────────────
  const handlePoChange = (poId) => {
    set("po_id", poId);
    if (poId) {
      const selectedPo = pos.find(p => String(p.id) === String(poId));
      if (selectedPo?.supplier_id) {
        set("supplier_id", String(selectedPo.supplier_id));
      }
    }
  };

  // ── Create Invoice ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.total_amount || parseFloat(form.total_amount) <= 0) {
      toast("Total amount must be greater than 0", "error");
      return;
    }
    if (!form.supplier_id) {
      toast("Please select a supplier", "error");
      return;
    }

    setSubmitting(true);
    try {
const created = await apiFetch("/api/purchase/invoices", {
  method: "POST",
  body: JSON.stringify({
    po_id: form.po_id ? Number(form.po_id) : null,
    supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
    total_amount: Number(form.total_amount),
    notes: form.notes || null,
  }),
});
      toast(`Invoice ${created.invoice_number} created successfully`);
      setShowForm(false);
      setForm(EMPTY);
      fetchAll();
    } catch (err) {
      toast(err.message || "Failed to create invoice", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Record Payment ─────────────────────────────────────────
  const handlePayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast("Enter a valid payment amount", "error");
      return;
    }
    setPaying(true);
    try {
      const data = await apiFetch(`/api/purchase/invoices/${detail.id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paid_amount: Number(payAmount) }),
      });
      toast(`Payment recorded — ${data.status === "paid" ? "Fully Paid ✓" : "Partially Paid"}`);
      setPayAmount("");
      fetchAll();
      // Refresh detail
      const updated = await apiFetch(`/api/purchase/invoices`);
      const inv = (updated.invoices || []).find(i => i.id === detail.id);
      if (inv) setDetail(inv);
    } catch (err) {
      toast(err.message || "Payment failed", "error");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div>
      <ToastContainer />

      {/* ── Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={sectionTitle}>🧾 Purchase Invoices</h2>
        <Btn onClick={openCreate}>+ Create Invoice</Btn>
      </div>

      {/* ── Table ── */}
      <Table
        headers={["Invoice #", "Supplier", "PO", "Total", "Paid", "Balance", "Status", "Actions"]}
        empty={invoices.length === 0 ? "No invoices yet." : undefined}
      >
        {invoices.map(i => (
          <Tr key={i.id}>
            <Td><span style={{ fontFamily:"monospace", color: C.blue }}>{i.invoice_number}</span></Td>
            <Td>{i.supplier_name || "—"}</Td>
            <Td>{i.po_number || "—"}</Td>
            <Td><strong style={{ color: C.text }}>₹{Number(i.total_amount||0).toLocaleString()}</strong></Td>
            <Td><span style={{ color: C.green }}>₹{Number(i.paid_amount||0).toLocaleString()}</span></Td>
            <Td><span style={{ color: Number(i.balance_due) > 0 ? C.red : C.muted }}>
              ₹{Number(i.balance_due||0).toLocaleString()}
            </span></Td>
            <Td><StatusBadge status={i.status} map={INV_STATUS} /></Td>
            <Td>
              <Btn
                variant="secondary"
                onClick={() => setDetail(i)}
                style={{ padding:"4px 10px", fontSize:"12px" }}
              >
                View
              </Btn>
            </Td>
          </Tr>
        ))}
      </Table>

      {/* ── Create Invoice Modal ── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Invoice" width="540px">
        <form onSubmit={handleSubmit} style={{ paddingTop:"16px" }}>

         <div
  style={{
    padding: "10px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    marginBottom: "14px",
    color: "#94a3b8",
    fontSize: "13px"
  }}
>
  Invoice number will be generated automatically.
</div>

          <FormInput label="Purchase Order (optional)">
            <select
              value={form.po_id}
              onChange={e => handlePoChange(e.target.value)}
              style={selectStyle}
            >
              <option value="">— Select PO (auto-fills supplier) —</option>
              {pos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.po_number} — ₹{Number(p.total_amount||0).toLocaleString()}
                </option>
              ))}
            </select>
          </FormInput>

          <FormInput label="Supplier *">
            <select
              required
              value={form.supplier_id}
              onChange={e => set("supplier_id", e.target.value)}
              style={selectStyle}
            >
              <option value="">— Select Supplier —</option>
              {suppliers.filter(s => s.status === "active").map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </FormInput>

          <FormInput label="Total Amount (₹) *">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.total_amount}
              onChange={e => set("total_amount", e.target.value)}
              style={inputStyle}
              placeholder="5000.00"
            />
          </FormInput>

          <FormInput label="Notes">
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              style={{ ...inputStyle, height:"70px", resize:"vertical" }}
              placeholder="Any notes…"
            />
          </FormInput>

          <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end", marginTop:"16px" }}>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Invoice"}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* ── Invoice Detail + Payment Modal ── */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`Invoice — ${detail.invoice_number}`} width="520px">
          <div style={{ paddingTop:"12px" }}>

            {/* Summary */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"20px" }}>
              {[
                ["Supplier",    detail.supplier_name || "—"],
                ["PO",          detail.po_number || "—"],
                ["Total",       `₹${Number(detail.total_amount||0).toLocaleString()}`],
                ["Paid",        `₹${Number(detail.paid_amount||0).toLocaleString()}`],
                ["Balance Due", `₹${Number(detail.balance_due||0).toLocaleString()}`],
                ["Status",      detail.status],
              ].map(([label, val]) => (
                <div key={label}>
                  <p style={{ margin:"0 0 2px", fontSize:"11px", color:C.muted,
                    textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</p>
                  <p style={{ margin:0, fontWeight:"600", color:"#f1f5f9", fontSize:"14px" }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Record Payment */}
            {detail.status !== "paid" && detail.status !== "cancelled" && (
              <div style={{ background:"#0f172a", borderRadius:"10px", padding:"16px",
                border:"1px solid #334155" }}>
                <p style={{ margin:"0 0 12px", fontWeight:"700", color:"#f1f5f9", fontSize:"14px" }}>
                  Record Payment
                </p>
                <div style={{ display:"flex", gap:"10px" }}>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={`Max ₹${Number(detail.balance_due||0).toLocaleString()}`}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    style={{ ...inputStyle, flex:1 }}
                  />
                  <Btn onClick={handlePayment} disabled={paying}>
                    {paying ? "Saving…" : "Record"}
                  </Btn>
                </div>
              </div>
            )}

            {detail.status === "paid" && (
              <div style={{ textAlign:"center", padding:"16px",
                color: C.green, fontWeight:"700", fontSize:"16px" }}>
                ✓ Fully Paid
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}