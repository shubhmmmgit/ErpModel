import { useState, useEffect } from "react";
import {
  cardStyle, sectionTitle, inputStyle, selectStyle,
  Btn, Table, Td, Tr, StatusBadge, Modal, FormInput, C, useToast
} from "./Purchaseshared.jsx";
import { apiFetch } from "../api";
import { toast } from "react-toastify";
const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080";

const RFQ_STATUS = {
  sent:     { label: "Sent",     bg: "rgba(251,191,36,0.12)",  color: C.yellow },
  received: { label: "Received", bg: "rgba(52,211,153,0.12)",  color: C.green  },
  compared: { label: "Compared", bg: "rgba(99,102,241,0.12)",  color: "#818cf8" },
  closed:   { label: "Closed",   bg: "rgba(148,163,184,0.12)", color: C.muted  },
};

const EMPTY_FORM = { pr_id: "", deadline: "", notes: "", supplier_ids: [] };

export default function RFQModule() {
  const [rfqs, setRfqs]           = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail]       = useState(null);
  const { toast, ToastContainer } = useToast();
  const [editingRFQ, setEditingRFQ] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchAll = async () => {
    try {
      const [rfqData, suppData] = await Promise.all([
        apiFetch("/api/purchase/rfqs"),
        apiFetch("/api/purchase/suppliers?limit=200"),
      ]);
      setRfqs(rfqData.rfqs || []);
      setSuppliers(suppData.suppliers || []);
    } catch (err) {
      console.error("RFQ fetchAll error:", err);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Toggle supplier selection ──────────────────────────────
  const toggleSupplier = (id) => {
    setForm(f => ({
      ...f,
      supplier_ids: f.supplier_ids.includes(id)
        ? f.supplier_ids.filter(s => s !== id)
        : [...f.supplier_ids, id]
    }));
  };

  // ── Create RFQ ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_ids.length) {
      toast("Select at least one supplier", "error");
      return;
    }
    setSubmitting(true);
    try {
        const url =
            editingRFQ
                ? `/api/purchase/rfqs/${editingRFQ}`
                : "/api/purchase/rfqs";

        const method =
            editingRFQ
                ? "PUT"
                : "POST";

        await apiFetch(url, {
            method,
            body: JSON.stringify({
          pr_id:        form.pr_id      || null,
          deadline:     form.deadline   || null,
          notes:        form.notes      || null,
          supplier_ids: form.supplier_ids,
        })
      });
        toast.success(
            editingRFQ
                ? "RFQ Updated"
                : "RFQ Created"
          );
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchAll();
    } catch (err) {
      toast(err.message || "Failed to create RFQ", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open detail ────────────────────────────────────────────
  const openDetail = async (id) => {
    try {
      const data = await apiFetch(`/api/purchase/rfqs/${id}`);
      setDetail(data);
    } catch (err) {
      toast("Failed to load RFQ details", "error");
    }
  };

  // ── Active (non-inactive) suppliers only ───────────────────
  const activeSuppliers = suppliers.filter(s => s.status === "active");


const editQuotation = async (rfqId, supplierId) => {
  try {
    const data = await apiFetch(
      `/api/purchase/quotation/${rfqId}/${supplierId}`
    );

    console.log("QUOTATION", data);

    // later:
    // setQuotation(data);
    // setShowQuotationModal(true);

  } catch (err) {
    console.error(err);
    toast.error("Unable to load quotation");
  }
};

const downloadQuotation = async (rfqId, supplierId) => {
  try {
    window.open(
      `${import.meta.env.VITE_API_URL}/api/purchase/quotation/${rfqId}/${supplierId}/pdf`,
      "_blank"
    );
  } catch (err) {
    console.error(err);
    toast.error("Unable to download PDF");
  }
};
const openEdit = async (rfq) => {
  try {
    const data = await apiFetch(
      `/api/purchase/rfqs/${rfq.id}`
    );

    setForm({
      deadline: data.deadline || "",
      notes: data.notes || "",
      supplier_ids:
        data.suppliers.map(
          s => s.supplier_id
        )
    });

    setEditingRFQ(rfq.id);

    setShowForm(true);

  } catch(err) {
    toast("Unable to load RFQ","error");
  }
};
  return (
    <div>
      <ToastContainer />

      {/* ── Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={sectionTitle}>📩 Request For Quotation</h2>
        <Btn onClick={() => setShowForm(true)}>+ Create RFQ</Btn>
      </div>

      {/* ── Table ── */}
      <Table
        headers={["RFQ Number", "Suppliers", "Deadline", "Quoted", "Status", "Actions"]}
        empty={rfqs.length === 0 ? "No RFQs yet. Create your first one." : undefined}
      >
        {rfqs.map(r => (
          <Tr key={r.id}>
            <Td><span style={{ fontFamily:"monospace", color: C.blue }}>{r.rfq_number}</span></Td>
            <Td>{r.supplier_names || "—"}</Td>
            <Td>{r.deadline ? new Date(r.deadline).toLocaleDateString("en-IN") : "—"}</Td>
            <Td><span style={{ color: C.green }}>{r.quoted_count || 0}/{r.supplier_count || 0}</span></Td>
            <Td><StatusBadge status={r.status} map={RFQ_STATUS} /></Td>
            <Td> 
              <Btn variant="secondary" onClick={() => openDetail(r.id)}
                style={{ padding:"4px 10px", fontSize:"12px" }}>
                View
              </Btn>
              
            </Td>
          </Tr>
        ))}
      </Table>

      {/* ── Create RFQ Modal ── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create RFQ" width="560px">
        <form onSubmit={handleSubmit} style={{ paddingTop:"16px" }}>

          <FormInput label="Deadline">
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              style={inputStyle}
            />
          </FormInput>

          <FormInput label="Notes">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ ...inputStyle, height:"70px", resize:"vertical" }}
              placeholder="Any special requirements…"
            />
          </FormInput>

          {/* Supplier selection */}
          <FormInput label={`Select Suppliers * (${form.supplier_ids.length} selected)`}>
            {activeSuppliers.length === 0 ? (
              <p style={{ color: C.red, fontSize:"13px" }}>
                No active suppliers found. Add suppliers first.
              </p>
            ) : (
              <div style={{
                border:"1px solid #334155", borderRadius:"8px",
                maxHeight:"200px", overflowY:"auto", padding:"8px"
              }}>
                {activeSuppliers.map(s => (
                  <label key={s.id} style={{
                    display:"flex", alignItems:"center", gap:"10px",
                    padding:"8px", borderRadius:"6px", cursor:"pointer",
                    background: form.supplier_ids.includes(s.id)
                      ? "rgba(42,157,143,0.15)" : "transparent",
                    marginBottom:"4px"
                  }}>
                    <input
                      type="checkbox"
                      checked={form.supplier_ids.includes(s.id)}
                      onChange={() => toggleSupplier(s.id)}
                      style={{ accentColor:"#2A9D8F", width:"16px", height:"16px" }}
                    />
                    <div>
                      <div style={{ fontWeight:"600", color:"#e6f1ff", fontSize:"13px" }}>{s.name}</div>
                      {s.city && <div style={{ fontSize:"11px", color: C.muted }}>{s.city}</div>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </FormInput>

          <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end", marginTop:"16px" }}>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn type="submit" disabled={submitting || form.supplier_ids.length === 0}>
              {submitting ? "Creating…" : "Create RFQ"}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`RFQ — ${detail.rfq_number}`} width="620px">
          <div style={{ paddingTop:"12px" }}>

            <div style={{ display:"flex", gap:"16px", marginBottom:"16px" }}>
              <div>
                <p style={metaLabel}>Status</p>
                <StatusBadge status={detail.status} map={RFQ_STATUS} />
              </div>
              {detail.deadline && (
                <div>
                  <p style={metaLabel}>Deadline</p>
                  <p style={metaValue}>{new Date(detail.deadline).toLocaleDateString("en-IN")}</p>
                </div>
              )}
            </div>

            {detail.notes && (
              <div style={{ marginBottom:"16px" }}>
                <p style={metaLabel}>Notes</p>
                <p style={{ color:"#94a3b8", fontSize:"13px", margin:0 }}>{detail.notes}</p>
              </div>
            )}

            <p style={{ ...metaLabel, marginBottom:"10px" }}>Supplier Quotations</p>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  {["Supplier", "Status", "Quoted Amount", "Delivery Days", "Actions"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"8px", fontSize:"11px",
                      color:"#475569", borderBottom:"1px solid #334155", textTransform:"uppercase" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(detail.suppliers || []).map(s => (
                  <tr key={s.supplier_id}>
                    <td style={dTd}>{s.supplier_name}</td>
                    <td style={dTd}>
                      <span style={{
                        background: s.status === "quoted" ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.1)",
                        color: s.status === "quoted" ? C.green : C.muted,
                        padding:"2px 8px", borderRadius:"10px", fontSize:"11px", fontWeight:"700"
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={dTd}>
                      {s.quoted_amount
                        ? <span style={{ color: C.green }}>₹{parseFloat(s.quoted_amount).toLocaleString()}</span>
                        : <span style={{ color: C.muted }}>Pending</span>}
                    </td>
                    <td style={dTd}>{s.delivery_days ? `${s.delivery_days}d` : "—"}</td>

<td style={dTd}>
  {s.status === "quoted" && (
    <div style={{ display:"flex", gap:"6px" }}>

      <Btn
        variant="secondary"
        onClick={() =>
          editQuotation(
            detail.id,
            s.supplier_id
          )
        }
        style={{ padding:"4px 8px", fontSize:"11px" }}
      >
        Edit
      </Btn>
          <Btn
      variant="secondary"
      onClick={() => openEdit(r)}
      style={{ padding:"4px 10px", fontSize:"12px" }}
    >
      Edit
    </Btn>

      <Btn
        variant="secondary"
        onClick={() =>
          downloadQuotation(
            detail.id,
            s.supplier_id
          )
        }
        style={{ padding:"4px 8px", fontSize:"11px" }}
      >
        PDF
      </Btn>

    </div>
  )}
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

const metaLabel = {
  margin:"0 0 4px", fontSize:"11px", fontWeight:"700",
  color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em"
};
const metaValue = { margin:0, fontWeight:"600", color:"#f1f5f9", fontSize:"14px" };
const dTd = { padding:"10px 8px", fontSize:"13px", color:"#94a3b8", borderBottom:"1px solid #1a2540" };