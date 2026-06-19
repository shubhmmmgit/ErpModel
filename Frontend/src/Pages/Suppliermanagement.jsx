// SupplierManagement.jsx
import { useState, useEffect } from "react";
import {
  C, PR_STATUS, StatusBadge, Modal, FormInput, Btn, Table, Td, Tr,
  inputStyle, selectStyle, cardStyle, sectionTitle, fmtCurrency, fmtDate,
  useToast, SearchBar, FilterSelect, monoStyle
} from "./Purchaseshared.jsx";

const EMPTY = { name:"", email:"", phone:"", address:"", city:"", country:"",
                gstin:"", payment_terms:"", lead_time_days:0, notes:"", status:"active" };

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
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search)       params.set("search", search);
    const res = await fetch(`/api/purchase/suppliers?${params}`, { credentials: "include" });
    const data = await res.json();
    setSuppliers(data.suppliers || []);
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, [statusFilter, search]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit   = (s)  => { setEditing(s.id); setForm({ ...s }); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const url    = editing ? `/api/purchase/suppliers/${editing}` : "/api/purchase/suppliers";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method, credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { toast(data.error || "Failed to save", "error"); return; }
    toast(editing ? "Supplier updated" : "Supplier created");
    setShowForm(false);
    fetchSuppliers();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deactivate this supplier?")) return;
    const res = await fetch(`/api/purchase/suppliers/${id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Failed", "error"); return; }
    toast("Supplier deactivated");
    fetchSuppliers();
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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