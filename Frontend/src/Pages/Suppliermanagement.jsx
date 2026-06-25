// SupplierManagement.jsx
import { useState, useEffect } from "react";
import {
  C, PR_STATUS, StatusBadge, Modal, FormInput, Btn, Table, Td, Tr,
  inputStyle, selectStyle, cardStyle, sectionTitle, fmtCurrency, fmtDate,
  useToast, SearchBar, FilterSelect, monoStyle
} from "./Purchaseshared.jsx";
import { apiFetch } from "../api.js";

const EMPTY = { name:"", email:"", phone:"", address:"", city:"", country:"",
                gstin:"", payment_terms:"", lead_time_days:0, notes:"", status:"active",
                automation: { create_rfq: false, create_po: false },
                default_products: [] };

export default function SupplierManagement() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast, ToastContainer } = useToast();


 const fetchSuppliers = async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const data = await apiFetch(`/api/purchase/suppliers?${params}`);
    setSuppliers(data.suppliers || []);
  } catch (err) {
    console.error("fetchSuppliers error:", err);
    setSuppliers([]);
  } finally {
    setLoading(false);
  }
}

  useEffect(() => { fetchSuppliers(); }, [statusFilter, search]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit   = (s)  => { setEditing(s.id); setForm({ ...EMPTY, ...s, default_products: s.default_products||[], automation: { create_rfq:false, create_po:false, ...(s.automation||{}) } }); setShowForm(true); };

 const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);
  try {
    const url    = editing ? `/api/purchase/suppliers/${editing}` : "/api/purchase/suppliers";
    const method = editing ? "PUT" : "POST";
    const data = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    toast(editing ? "Supplier updated" : "Supplier created");
    setShowForm(false);
    fetchSuppliers();
  } catch (err) {
    toast(err.message || "Failed to save", "error");
  } finally {
    setSubmitting(false);
  }
};


  const handleDelete = async (id) => {
  if (!window.confirm("Deactivate this supplier?")) return;
  try {
    await apiFetch(`/api/purchase/suppliers/${id}`, { method: "DELETE" });
    toast("Supplier deactivated");
    fetchSuppliers();
  } catch (err) {
    toast(err.message || "Failed", "error");
  }
};
  const set     = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAuto = (k, v) => setForm(f => ({ ...f, automation: { ...(f.automation||{}), [k]: v } }));

  // Default products helpers
  const addDefaultProduct    = () => setForm(f => ({ ...f, default_products: [...(f.default_products||[]), { name:"", qty:1 }] }));
  const removeDefaultProduct = (i) => setForm(f => ({ ...f, default_products: f.default_products.filter((_,idx)=>idx!==i) }));
  const setDP = (i, field, val) => setForm(f => {
    const dp = [...(f.default_products||[])];
    dp[i] = { ...dp[i], [field]: val };
    return { ...f, default_products: dp };
  });

  return (
    <div>
      <ToastContainer />

      {/* ── Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"10px" }}>
        <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search suppliers…" />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value:"", label:"All Status" },
              { value:"active", label:"Active" },
              { value:"inactive", label:"Inactive" },
              { value:"blacklisted", label:"Blacklisted" },
            ]}
          />
        </div>
        <Btn onClick={openCreate}>+ Add Supplier</Btn>
      </div>

      {/* ── Table ── */}
      <Table
        headers={["Supplier", "Contact", "GSTIN", "Payment Terms", "Lead Time", "Rating", "Status", "Actions"]}
        empty={loading ? "Loading…" : suppliers.length === 0 ? "No suppliers yet. Add your first one." : undefined}
      >
        {suppliers.map(s => (
          <Tr key={s.id}>
            <Td>
              <div style={{ fontWeight:"600", color:"#e6f1ff" }}>{s.name}</div>
              {s.city && <div style={{ fontSize:"11px", color:C.muted }}>{s.city}{s.country ? `, ${s.country}` : ""}</div>}
            </Td>
            <Td>
              {s.email && <div style={{ fontSize:"12px" }}>{s.email}</div>}
              {s.phone && <div style={{ fontSize:"12px", color:C.muted }}>{s.phone}</div>}
            </Td>
            <Td><span style={monoStyle}>{s.gstin || "—"}</span></Td>
            <Td>{s.payment_terms || "—"}</Td>
            <Td>{s.lead_time_days ? `${s.lead_time_days}d` : "—"}</Td>
            <Td>
              <span style={{ color: C.yellow, fontWeight:"700" }}>★ {parseFloat(s.rating||0).toFixed(1)}</span>
            </Td>
            <Td>
              <StatusBadge status={s.status} map={{
                active:      { label:"Active",      bg:"rgba(52,211,153,0.12)", color:C.green },
                inactive:    { label:"Inactive",    bg:"#1d2035",               color:C.muted },
                blacklisted: { label:"Blacklisted", bg:"rgba(248,113,113,0.12)", color:C.red  },
              }} />
            </Td>
            <Td>
              <div style={{ display:"flex", gap:"6px" }}>
                <Btn variant="secondary" onClick={() => openEdit(s)} style={{ padding:"4px 10px", fontSize:"12px" }}>Edit</Btn>
                <Btn variant="danger"    onClick={() => handleDelete(s.id)} style={{ padding:"4px 10px", fontSize:"12px" }}>Remove</Btn>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>

      {/* ── Form Modal ── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Supplier" : "Add New Supplier"}
        width="620px"
      >
        <form onSubmit={handleSubmit} style={{ paddingTop:"16px" }}>
          <div style={row2}>
            <FormInput label="Supplier Name" required>
              <input required value={form.name} onChange={e=>set("name",e.target.value)} style={inputStyle} placeholder="Company name" />
            </FormInput>
            <FormInput label="Status">
              <select value={form.status} onChange={e=>set("status",e.target.value)} style={selectStyle}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </FormInput>
          </div>
          <div style={row2}>
            <FormInput label="Email">
              <input type="email" value={form.email||""} onChange={e=>set("email",e.target.value)} style={inputStyle} placeholder="supplier@example.com" />
            </FormInput>
            <FormInput label="Phone">
              <input value={form.phone||""} onChange={e=>set("phone",e.target.value)} style={inputStyle} placeholder="+91 9999 999 999" />
            </FormInput>
          </div>
          <div style={row2}>
            <FormInput label="City">
              <input value={form.city||""} onChange={e=>set("city",e.target.value)} style={inputStyle} placeholder="Mumbai" />
            </FormInput>
            <FormInput label="Country">
              <input value={form.country||""} onChange={e=>set("country",e.target.value)} style={inputStyle} placeholder="India" />
            </FormInput>
          </div>
          <FormInput label="Address">
            <textarea value={form.address||""} onChange={e=>set("address",e.target.value)}
              style={{ ...inputStyle, height:"70px", resize:"vertical" }} placeholder="Full address" />
          </FormInput>
          <div style={row2}>
            <FormInput label="GSTIN">
              <input value={form.gstin||""} onChange={e=>set("gstin",e.target.value)} style={inputStyle} placeholder="22AAAA0000A1Z5" />
            </FormInput>
            <FormInput label="Payment Terms">
              <input value={form.payment_terms||""} onChange={e=>set("payment_terms",e.target.value)} style={inputStyle} placeholder="Net 30" />
            </FormInput>
          </div>
          <FormInput label="Lead Time (days)">
            <input type="number" min="0" value={form.lead_time_days||0}
              onChange={e=>set("lead_time_days",parseInt(e.target.value))} style={{ ...inputStyle, width:"50%" }} />
          </FormInput>
          <FormInput label="Notes">
            <textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)}
              style={{ ...inputStyle, height:"70px", resize:"vertical" }} placeholder="Any additional notes…" />
          </FormInput>

          {/* ── Default Products ── */}
          <div style={{ marginTop:"16px", padding:"14px 16px", background:"rgba(255,255,255,0.04)", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
              <div style={{ fontSize:"11px", fontWeight:"700", color:"#64748b", letterSpacing:"0.08em", textTransform:"uppercase" }}>Default Products</div>
              <button
                type="button"
                onClick={addDefaultProduct}
                style={{ background:"rgba(42,157,143,0.15)", color:"#2A9D8F", border:"1px solid rgba(42,157,143,0.3)", borderRadius:"6px", padding:"4px 10px", fontSize:"12px", cursor:"pointer", fontWeight:"600" }}
              >+ Add Product</button>
            </div>

            {(form.default_products||[]).length === 0 ? (
              <div style={{ fontSize:"13px", color:"#475569", textAlign:"center", padding:"10px 0" }}>
                No default products yet — add products to enable meaningful automation.
              </div>
            ) : (
              <div>
                {/* Column headers */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 28px", gap:"8px", marginBottom:"6px" }}>
                  <span style={{ fontSize:"11px", color:"#475569", fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.06em" }}>Product Name</span>
                  <span style={{ fontSize:"11px", color:"#475569", fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.06em" }}>Qty</span>
                  <span />
                </div>
                {(form.default_products||[]).map((dp, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 80px 28px", gap:"8px", marginBottom:"8px", alignItems:"center" }}>
                    <input
                      placeholder="e.g. Cotton Fabric"
                      value={dp.name}
                      onChange={e => setDP(i, "name", e.target.value)}
                      style={{ ...inputStyle, margin:0 }}
                    />
                    <input
                      type="number"
                      min="1"
                      value={dp.qty}
                      onChange={e => setDP(i, "qty", parseInt(e.target.value)||1)}
                      style={{ ...inputStyle, margin:0 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeDefaultProduct(i)}
                      style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:"16px", padding:"0", lineHeight:1 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Automation Rules ── */}
          <div style={{ marginTop:"12px", padding:"14px 16px", background:"rgba(255,255,255,0.04)", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize:"11px", fontWeight:"700", color:"#64748b", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"4px" }}>Automation Rules</div>
            <div style={{ fontSize:"12px", color:"#475569", marginBottom:"12px" }}>
              Triggered when supplier is saved — uses Default Products above to pre-fill.
            </div>
            <label style={{ display:"flex", alignItems:"flex-start", gap:"10px", cursor:(form.default_products||[]).length===0?"not-allowed":"pointer", marginBottom:"10px", opacity:(form.default_products||[]).length===0?0.45:1 }}>
              <input
                type="checkbox"
                checked={!!(form.automation?.create_rfq)}
                disabled={(form.default_products||[]).length===0}
                onChange={e => setAuto("create_rfq", e.target.checked)}
                style={{ width:"15px", height:"15px", accentColor:"#2A9D8F", cursor:"pointer", marginTop:"2px", flexShrink:0 }}
              />
              <div>
                <div style={{ fontSize:"14px", color:"#cbd5e1", fontWeight:"500" }}> Create Draft RFQ Template</div>
                <div style={{ fontSize:"11px", color:"#475569", marginTop:"2px" }}>Creates a draft RFQ pre-filled with the default products above</div>
              </div>
            </label>
            <label style={{ display:"flex", alignItems:"flex-start", gap:"10px", cursor:(form.default_products||[]).length===0?"not-allowed":"pointer", opacity:(form.default_products||[]).length===0?0.45:1 }}>
              <input
                type="checkbox"
                checked={!!(form.automation?.create_po)}
                disabled={(form.default_products||[]).length===0}
                onChange={e => setAuto("create_po", e.target.checked)}
                style={{ width:"15px", height:"15px", accentColor:"#2A9D8F", cursor:"pointer", marginTop:"2px", flexShrink:0 }}
              />
              <div>
                <div style={{ fontSize:"14px", color:"#cbd5e1", fontWeight:"500" }}>Create Draft PO Template</div>
                <div style={{ fontSize:"11px", color:"#475569", marginTop:"2px" }}>Creates a draft PO pre-filled with the default products above</div>
              </div>
            </label>
            {(form.default_products||[]).length===0 && (
              <div style={{ marginTop:"10px", fontSize:"12px", color:"#f59e0b", display:"flex", alignItems:"center", gap:"6px" }}>
                ⚠ Add at least one default product above to enable automation.
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end", marginTop:"8px" }}>
            <Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn>
            <Btn type="submit" disabled={submitting}>{submitting ? "Saving…" : editing ? "Update Supplier" : "Create Supplier"}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const row2 = { display:"flex", gap:"14px" };