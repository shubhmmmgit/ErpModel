import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";


const LEAD_STATUSES = ["new", "contacted", "qualified", "negotiation", "won", "lost"];

const STATUS_META = {
  new:         { label: "New",         color: "#64748b", bg: "#1e293b" },
  contacted:   { label: "Contacted",   color: "#3b82f6", bg: "#1e3a5f" },
  qualified:   { label: "Qualified",   color: "#a855f7", bg: "#2d1b69" },
  negotiation: { label: "Negotiation", color: "#f59e0b", bg: "#451a03" },
  won:         { label: "Won",         color: "#10b981", bg: "#064e3b" },
  lost:        { label: "Lost",        color: "#ef4444", bg: "#450a0a" },
};

const INTERACTION_ICONS = { note:"📝", call:"📞", email:"✉️", meeting:"🤝", whatsapp:"💬" };
const SOURCE_ICONS       = { instagram:"📸", website:"🌐", referral:"🤝", cold:"❄️", manual:"✋" };


const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
};


export default function CRMModule() {
  const navigate = useNavigate();
  const [view, setView]       = useState("dashboard");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/summary", { credentials: "include" });

     
      if (res.status === 401) {
        navigate("/auth");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load CRM data");
        setLoading(false);
        return;
      }

      setSummary(data);
    } catch (err) {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  return (
    <div style={shell}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:#0f172a; }
        ::-webkit-scrollbar-thumb { background:#334155; border-radius:3px; }
        .crm-nav:hover { background:#1e293b !important; color:#f1f5f9 !important; }
        .crm-nav.active { background:#2A9D8F !important; color:#fff !important; }
        .row-hover:hover { background:#172033 !important; cursor:pointer; }
        .card-hover:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.3) !important; }
        .action-btn:hover { opacity:0.8; }
        .tag { display:inline-block; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; margin:2px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation:fadeUp 0.3s ease forwards; }
      `}</style>

      {/* TOP BAR */}
      <div style={topBar}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <Link to="/" style={backBtn}>← Home</Link>
          <div>
            <h1 style={pageTitle}>CRM</h1>
            <p style={pageSubtitle}>Customers · Leads · Follow-ups</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["dashboard","📊 Dashboard"],["customers","👥 Customers"],["leads","🎯 Leads"],["followups","🔔 Follow-ups"]].map(([v, label]) => (
            <button
              key={v}
              className={`crm-nav${view===v?" active":""}`}
              onClick={() => setView(v)}
              style={navBtn}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* GLOBAL ERROR BANNER */}
      {error && (
        <div style={{ background:"#450a0a", border:"1px solid #ef4444", color:"#fca5a5", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>⚠️ {error}</span>
          <button onClick={fetchSummary} style={{ background:"#ef4444", color:"#fff", border:"none", borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:12 }}>Retry</button>
        </div>
      )}

      {/* VIEWS */}
      {view === "dashboard" && <Dashboard summary={summary} loading={loading} onRefresh={fetchSummary} setView={setView} />}
      {view === "customers" && <Customers onRefresh={fetchSummary} navigate={navigate} />}
      {view === "leads"     && <LeadBoard onRefresh={fetchSummary} />}
      {view === "followups" && <FollowUps onRefresh={fetchSummary} />}
    </div>
  );
}



function Dashboard({ summary, loading, onRefresh, setView }) {
  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={kpiGrid}>{[1,2,3,4,5,6].map(i => <div key={i} style={{ ...kpiCard, background:"#1e293b", height:90, borderRadius:12, opacity:0.4 }} />)}</div>
      <p style={emptyTxt}>Loading dashboard…</p>
    </div>
  );

 
  if (!summary) return (
    <p style={emptyTxt}>Could not load dashboard data. Check your server and try again.</p>
  );

 
  const customers          = summary.customers          || { total: 0, total_revenue: 0 };
  const leads              = summary.leads              || { total: 0, won: 0, lost: 0, new: 0, pipeline_value: 0, conversion_rate: "0.0" };
  const top_customers      = summary.top_customers      || [];
  const upcoming_follow_ups= summary.upcoming_follow_ups|| [];
  const lead_sources       = summary.lead_sources       || [];
  const recent_interactions= summary.recent_interactions|| [];

  return (
    <div className="fade-up">
      {/* KPI CARDS */}
      <div style={kpiGrid}>
        <KPI icon="👥" label="Total Customers" value={customers.total}                                       color="#3b82f6" />
        <KPI icon="💰" label="Total Revenue"   value={`₹${safeNum(customers.total_revenue).toLocaleString()}`} color="#10b981" />
        <KPI icon="🎯" label="Total Leads"     value={leads.total}                                           color="#a855f7" />
        <KPI icon="🏆" label="Conversion"      value={`${leads.conversion_rate}%`}                           color="#f59e0b" />
        <KPI icon="✅" label="Won Deals"        value={leads.won}                                             color="#10b981" />
        <KPI icon="💼" label="Pipeline Value"  value={`₹${safeNum(leads.pipeline_value).toLocaleString()}`}  color="#3b82f6" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginTop:20 }}>

        {/* TOP CUSTOMERS */}
        <div style={dashCard}>
          <div style={dashCardHdr}>
            <span>🏆 Top Customers</span>
            <button onClick={() => setView("customers")} style={seeAllBtn}>See all →</button>
          </div>
          {top_customers.length === 0
            ? <p style={emptyInCard}>No customers yet — create your first order!</p>
            : top_customers.map((c, i) => (
              <div key={c.id} style={topRow}>
                <div style={rankBadge}>{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, color:"#f1f5f9", fontSize:14 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:"#64748b" }}>{c.email || "No email"}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:"#10b981", fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>₹{safeNum(c.ltv).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:"#475569" }}>{c.orders} orders</div>
                </div>
              </div>
            ))
          }
        </div>

        {/* LEAD SOURCES */}
        <div style={dashCard}>
          <div style={dashCardHdr}><span>📡 Lead Sources</span></div>
          {lead_sources.length === 0
            ? <p style={emptyInCard}>No leads yet</p>
            : lead_sources.map(s => (
              <div key={s.source} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #1e293b" }}>
                <span style={{ color:"#94a3b8", fontSize:13 }}>{SOURCE_ICONS[s.source] || "•"} {s.source}</span>
                <span style={{ color:"#f1f5f9", fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{s.count}</span>
              </div>
            ))
          }
        </div>

        {/* RECENT INTERACTIONS */}
        <div style={dashCard}>
          <div style={dashCardHdr}><span>🕐 Recent Activity</span></div>
          {recent_interactions.length === 0
            ? <p style={emptyInCard}>No interactions yet</p>
            : recent_interactions.map(i => (
              <div key={i.id} style={{ padding:"10px 0", borderBottom:"1px solid #1e293b", display:"flex", gap:10 }}>
                <span style={{ fontSize:18 }}>{INTERACTION_ICONS[i.type] || "📝"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#94a3b8", fontSize:13 }}>
                    <strong style={{ color:"#f1f5f9" }}>{i.customer_name || i.lead_name || "Unknown"}</strong>{" — "}{i.summary}
                  </div>
                  <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>
                    {new Date(i.created_at).toLocaleDateString("en-IN",{ day:"2-digit", month:"short" })}
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* UPCOMING FOLLOW-UPS */}
        <div style={dashCard}>
          <div style={dashCardHdr}>
            <span>🔔 Upcoming Follow-ups</span>
            <button onClick={() => setView("followups")} style={seeAllBtn}>See all →</button>
          </div>
          {upcoming_follow_ups.length === 0
            ? <p style={emptyInCard}>No upcoming follow-ups 🎉</p>
            : upcoming_follow_ups.map(f => (
              <div key={f.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #1e293b" }}>
                <div>
                  <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:600 }}>{f.title}</div>
                  <div style={{ color:"#64748b", fontSize:11 }}>{f.customer_name || f.lead_name}</div>
                </div>
                <div style={{ color: new Date(f.due_date) < new Date() ? "#ef4444":"#f59e0b", fontSize:12, fontWeight:600 }}>
                  {new Date(f.due_date).toLocaleDateString("en-IN",{ day:"2-digit", month:"short" })}
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}


// ─── CUSTOMERS ───────────────────────────────────────────────
function Customers({ onRefresh, navigate }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState({ name:"", email:"", phone:"", tags:"", notes:"" });
  const [noteForm, setNoteForm]   = useState({ type:"note", summary:"" });
  const [fuForm, setFuForm]       = useState({ title:"", due_date:"" });
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]   = useState("");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/crm/customers?search=${encodeURIComponent(search)}&limit=50`, { credentials:"include" });
    if (res.status === 401) { navigate("/auth"); return; }
    const data = await res.json();
    setCustomers(data.customers || []);
    setLoading(false);
  }, [search, navigate]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openDetail = async (id) => {
    const res  = await fetch(`/api/crm/customers/${id}`, { credentials:"include" });
    const data = await res.json();
    setSelected(data);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setApiError("");
    const payload = { ...addForm, tags: addForm.tags ? addForm.tags.split(",").map(t=>t.trim()).filter(Boolean) : [] };
    const res  = await fetch("/api/crm/customers", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setApiError(data.error || "Failed to add customer"); return; }
    setShowAdd(false);
    setAddForm({ name:"", email:"", phone:"", tags:"", notes:"" });
    fetchCustomers(); onRefresh();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this customer?")) return;
    await fetch(`/api/crm/customers/${id}`, { method:"DELETE", credentials:"include" });
    fetchCustomers(); onRefresh();
  };

  const addNote = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/crm/interactions", {
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ customer_id: selected.id, ...noteForm })
    });
    if (res.ok) { setNoteForm({ type:"note", summary:"" }); openDetail(selected.id); }
  };

  const addFollowUp = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/crm/followups", {
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ customer_id: selected.id, ...fuForm })
    });
    if (res.ok) { setFuForm({ title:"", due_date:"" }); openDetail(selected.id); onRefresh(); }
  };

  return (
    <div className="fade-up">
      <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers…" style={searchInput} />
        <button onClick={() => setShowAdd(!showAdd)} style={addBtn}>{showAdd ? "✕ Cancel" : "+ Add Customer"}</button>
      </div>

      {apiError && <div style={errBanner}>⚠️ {apiError}</div>}

      {showAdd && (
        <form onSubmit={handleAdd} style={formCard}>
          <h3 style={formTitle}>New Customer</h3>
          <div style={formGrid}>
            <Field label="Name *"              value={addForm.name}  onChange={v=>setAddForm({...addForm,name:v})}  required placeholder="Full name" />
            <Field label="Email"               value={addForm.email} onChange={v=>setAddForm({...addForm,email:v})} type="email" placeholder="email@example.com" />
            <Field label="Phone"               value={addForm.phone} onChange={v=>setAddForm({...addForm,phone:v})} placeholder="+91 XXXXX XXXXX" />
            <Field label="Tags (comma-separated)" value={addForm.tags} onChange={v=>setAddForm({...addForm,tags:v})} placeholder="vip, wholesale" />
          </div>
          <Field label="Notes" value={addForm.notes} onChange={v=>setAddForm({...addForm,notes:v})} placeholder="Any notes…" textarea />
          <button style={submitBtn} disabled={submitting}>{submitting ? "Saving…" : "Add Customer"}</button>
        </form>
      )}

      {loading
        ? <p style={emptyTxt}>Loading customers…</p>
        : customers.length === 0
          ? <p style={emptyTxt}>No customers yet. Add one manually or place an order to auto-create.</p>
          : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>{["Customer","Email","Phone","Tags","Orders","Lifetime Value","Last Order",""].map(h=>(
                  <th key={h} style={th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="row-hover" style={tr} onClick={() => openDetail(c.id)}>
                    <td style={td}><span style={{ fontWeight:600, color:"#f1f5f9" }}>{c.name}</span></td>
                    <td style={td}><span style={{ color:"#64748b", fontSize:13 }}>{c.email || "—"}</span></td>
                    <td style={td}><span style={{ color:"#64748b", fontSize:13 }}>{c.phone || "—"}</span></td>
                    <td style={td}>{(c.tags||[]).map(t=><span key={t} className="tag" style={{ background:"#2d1b69", color:"#a855f7" }}>{t}</span>)}</td>
                    <td style={td}><span style={mono}>{c.order_count || 0}</span></td>
                    <td style={td}><strong style={{ color:"#10b981" }}>₹{safeNum(c.lifetime_value).toLocaleString()}</strong></td>
                    <td style={td}><span style={{ color:"#475569", fontSize:12 }}>{c.last_order_date ? new Date(c.last_order_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "Never"}</span></td>
                    <td style={td} onClick={e=>e.stopPropagation()}>
                      <button onClick={() => handleDelete(c.id)} style={dangerBtn}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {/* DETAIL MODAL */}
      {selected && (
        <div style={overlay} onClick={() => setSelected(null)}>
          <div style={modal} onClick={e=>e.stopPropagation()} className="fade-up">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <h2 style={{ margin:0, color:"#f1f5f9", fontSize:22, fontWeight:800 }}>{selected.name}</h2>
                <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:13 }}>{selected.email}{selected.phone ? " · "+selected.phone : ""}</p>
              </div>
              <button onClick={() => setSelected(null)} style={closeBtn}>✕</button>
            </div>

            {(selected.tags||[]).length > 0 && (
              <div style={{ marginBottom:16 }}>{selected.tags.map(t=><span key={t} className="tag" style={{ background:"#2d1b69", color:"#a855f7" }}>{t}</span>)}</div>
            )}

            <div style={{ display:"flex", gap:12, marginBottom:20 }}>
              <div style={miniStat}>
                <div style={{ color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em" }}>Orders</div>
                <div style={{ color:"#f1f5f9", fontWeight:800, fontSize:22, fontFamily:"'JetBrains Mono',monospace" }}>{selected.order_count || 0}</div>
              </div>
              <div style={miniStat}>
                <div style={{ color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em" }}>Lifetime Value</div>
                <div style={{ color:"#10b981", fontWeight:800, fontSize:22, fontFamily:"'JetBrains Mono',monospace" }}>₹{safeNum(selected.lifetime_value).toLocaleString()}</div>
              </div>
            </div>

            {/* Orders */}
            {(selected.orders||[]).length > 0 && (
              <div style={modalSec}>
                <p style={secLabel}>Order History</p>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>{["ID","Amount","Status","Date"].map(h=><th key={h} style={modalTh}>{h}</th>)}</tr></thead>
                  <tbody>
                    {selected.orders.map(o=>(
                      <tr key={o.id}>
                        <td style={modalTd}><span style={mono}>#{o.id}</span></td>
                        <td style={modalTd}><strong style={{ color:"#10b981" }}>₹{safeNum(o.total_amount).toLocaleString()}</strong></td>
                        <td style={modalTd}><StatusChip s={o.status} /></td>
                        <td style={modalTd}><span style={{ color:"#64748b", fontSize:12 }}>{new Date(o.created_at).toLocaleDateString("en-IN")}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Log interaction */}
            <div style={modalSec}>
              <p style={secLabel}>Log Interaction</p>
              <form onSubmit={addNote} style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <select value={noteForm.type} onChange={e=>setNoteForm({...noteForm,type:e.target.value})} style={smallSelect}>
                  {Object.keys(INTERACTION_ICONS).map(t=><option key={t} value={t}>{INTERACTION_ICONS[t]} {t}</option>)}
                </select>
                <input required value={noteForm.summary} onChange={e=>setNoteForm({...noteForm,summary:e.target.value})} placeholder="What happened?" style={{ ...smallInput, flex:1 }} />
                <button style={miniSubmit}>Log</button>
              </form>
              <div style={{ marginTop:12 }}>
                {(selected.interactions||[]).map(i=>(
                  <div key={i.id} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:"1px solid #1e293b" }}>
                    <span style={{ fontSize:16 }}>{INTERACTION_ICONS[i.type] || "📝"}</span>
                    <div>
                      <div style={{ color:"#94a3b8", fontSize:13 }}>{i.summary}</div>
                      <div style={{ color:"#475569", fontSize:11, marginTop:2 }}>{new Date(i.created_at).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                  </div>
                ))}
                {(selected.interactions||[]).length === 0 && <p style={{ color:"#334155", fontSize:13, margin:"8px 0 0" }}>No interactions yet.</p>}
              </div>
            </div>

            {/* Follow-up */}
            <div style={modalSec}>
              <p style={secLabel}>Schedule Follow-up</p>
              <form onSubmit={addFollowUp} style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <input required value={fuForm.title} onChange={e=>setFuForm({...fuForm,title:e.target.value})} placeholder="Follow-up title" style={{ ...smallInput, flex:1 }} />
                <input required type="date" value={fuForm.due_date} onChange={e=>setFuForm({...fuForm,due_date:e.target.value})} style={smallInput} />
                <button style={miniSubmit}>Set</button>
              </form>
              {(selected.follow_ups||[]).filter(f=>!f.done).map(f=>(
                <div key={f.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #1e293b" }}>
                  <span style={{ color:"#94a3b8", fontSize:13 }}>🔔 {f.title}</span>
                  <span style={{ color:"#f59e0b", fontSize:12 }}>{new Date(f.due_date).toLocaleDateString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── LEADS KANBAN ────────────────────────────────────────────
function LeadBoard({ onRefresh }) {
  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState({ name:"", email:"", phone:"", source:"manual", status:"new", value:"", notes:"" });
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [apiError, setApiError] = useState("");

  const fetchLeads = async () => {
    setLoading(true);
    const res  = await fetch("/api/crm/leads?limit=100", { credentials:"include" });
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setApiError("");
    const res  = await fetch("/api/crm/leads", {
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...form, value: parseFloat(form.value)||0 })
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setApiError(data.error || "Failed to add lead"); return; }
    setShowAdd(false);
    setForm({ name:"", email:"", phone:"", source:"manual", status:"new", value:"", notes:"" });
    fetchLeads(); onRefresh();
  };

  const changeStatus = async (id, status) => {
    await fetch(`/api/crm/leads/${id}/status`, {
      method:"PATCH", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status })
    });
    fetchLeads(); onRefresh();
  };

  const convertLead = async (id) => {
    if (!window.confirm("Convert this lead to a customer?")) return;
    const res  = await fetch(`/api/crm/leads/${id}/convert`, { method:"POST", credentials:"include" });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    alert("✅ Lead converted to customer!");
    fetchLeads(); onRefresh();
  };

  const deleteLead = async (id) => {
    if (!window.confirm("Delete this lead?")) return;
    await fetch(`/api/crm/leads/${id}`, { method:"DELETE", credentials:"include" });
    fetchLeads(); onRefresh();
  };

  const onDrop = (e, col) => {
    e.preventDefault();
    if (dragging && dragging.status !== col) changeStatus(dragging.id, col);
    setDragging(null);
  };

  const grouped = LEAD_STATUSES.reduce((acc, s) => { acc[s] = leads.filter(l => l.status === s); return acc; }, {});

  return (
    <div className="fade-up">
      <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
        <button onClick={() => setShowAdd(!showAdd)} style={addBtn}>{showAdd ? "✕ Cancel" : "+ Add Lead"}</button>
        <span style={{ color:"#475569", fontSize:13 }}>Drag cards between columns to update status</span>
      </div>

      {apiError && <div style={errBanner}>⚠️ {apiError}</div>}

      {showAdd && (
        <form onSubmit={handleAdd} style={formCard}>
          <h3 style={formTitle}>New Lead</h3>
          <div style={formGrid}>
            <Field label="Name *"         value={form.name}  onChange={v=>setForm({...form,name:v})}  required placeholder="Lead name" />
            <Field label="Email"          value={form.email} onChange={v=>setForm({...form,email:v})} type="email" placeholder="email@example.com" />
            <Field label="Phone"          value={form.phone} onChange={v=>setForm({...form,phone:v})} placeholder="+91 XXXXX XXXXX" />
            <Field label="Est. Value (₹)" value={form.value} onChange={v=>setForm({...form,value:v})} type="number" placeholder="0" />
            <div>
              <label style={fieldLabel}>Source</label>
              <select value={form.source} onChange={e=>setForm({...form,source:e.target.value})} style={formInput}>
                {["manual","website","instagram","referral","cold"].map(s=><option key={s} value={s}>{SOURCE_ICONS[s]} {s}</option>)}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Initial Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={formInput}>
                {LEAD_STATUSES.map(s=><option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>
          <Field label="Notes" value={form.notes} onChange={v=>setForm({...form,notes:v})} textarea placeholder="Any notes…" />
          <button style={submitBtn} disabled={submitting}>{submitting?"Saving…":"Add Lead"}</button>
        </form>
      )}

      {loading
        ? <p style={emptyTxt}>Loading leads…</p>
        : (
        <div style={kanbanBoard}>
          {LEAD_STATUSES.map(status => {
            const meta = STATUS_META[status];
            const cols = grouped[status] || [];
            return (
              <div key={status} style={{ ...kanbanCol, borderTop:`3px solid ${meta.color}` }}
                onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,status)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ color:meta.color, fontWeight:700, fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em" }}>{meta.label}</span>
                  <span style={{ background:meta.bg, color:meta.color, padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:700 }}>{cols.length}</span>
                </div>
                {cols.map(lead => (
                  <div key={lead.id} draggable onDragStart={()=>setDragging(lead)} style={kanbanCard} className="card-hover">
                    <div style={{ fontWeight:700, color:"#f1f5f9", fontSize:13, marginBottom:4 }}>{lead.name}</div>
                    {lead.email && <div style={{ color:"#64748b", fontSize:11, marginBottom:4 }}>{lead.email}</div>}
                    {safeNum(lead.value) > 0 && (
                      <div style={{ color:"#10b981", fontSize:12, fontWeight:600, fontFamily:"'JetBrains Mono',monospace", marginBottom:6 }}>
                        ₹{safeNum(lead.value).toLocaleString()}
                      </div>
                    )}
                    <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                      <span style={{ background:"#1e293b", color:"#64748b", padding:"2px 7px", borderRadius:20, fontSize:10 }}>
                        {SOURCE_ICONS[lead.source] || "•"} {lead.source}
                      </span>
                      {status !== "won" && status !== "lost" && (
                        <button className="action-btn" onClick={()=>convertLead(lead.id)} style={{ ...miniAction, color:"#10b981", borderColor:"#10b981" }}>✓ Convert</button>
                      )}
                      <button className="action-btn" onClick={()=>deleteLead(lead.id)} style={{ ...miniAction, color:"#ef4444", borderColor:"#ef4444" }}>✕</button>
                    </div>
                  </div>
                ))}
                {cols.length === 0 && (
                  <div style={{ color:"#334155", fontSize:12, textAlign:"center", padding:"20px 0", border:"1px dashed #1e293b", borderRadius:8 }}>Drop here</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── FOLLOW-UPS ───────────────────────────────────────────────
function FollowUps({ onRefresh }) {
  const [all, setAll]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  const fetchFu = async () => {
    setLoading(true);
    const res  = await fetch("/api/crm/followups", { credentials:"include" });
    const data = await res.json();
    setAll(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchFu(); }, []);

  const markDone = async (id) => {
    await fetch(`/api/crm/followups/${id}/done`, { method:"PATCH", credentials:"include" });
    fetchFu(); onRefresh();
  };

  const pending  = all.filter(f => !f.done);
  const done     = all.filter(f =>  f.done);
  const overdue  = pending.filter(f => new Date(f.due_date) < new Date());
  const upcoming = pending.filter(f => new Date(f.due_date) >= new Date());

  return (
    <div className="fade-up">
      {loading
        ? <p style={emptyTxt}>Loading follow-ups…</p>
        : (
        <>
          {overdue.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <h3 style={{ color:"#ef4444", fontSize:13, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>⚠️ Overdue ({overdue.length})</h3>
              {overdue.map(f => <FuCard key={f.id} f={f} onDone={markDone} overdue />)}
            </div>
          )}
          <div style={{ marginBottom:20 }}>
            <h3 style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>🔔 Upcoming ({upcoming.length})</h3>
            {upcoming.length === 0
              ? <p style={{ color:"#334155", fontSize:13 }}>No upcoming follow-ups. Great job!</p>
              : upcoming.map(f => <FuCard key={f.id} f={f} onDone={markDone} />)
            }
          </div>
          <button onClick={() => setShowDone(!showDone)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, padding:"4px 0" }}>
            {showDone ? "▲ Hide" : "▼ Show"} completed ({done.length})
          </button>
          {showDone && done.map(f => <FuCard key={f.id} f={f} onDone={markDone} completed />)}
        </>
      )}
    </div>
  );
}

function FuCard({ f, onDone, overdue, completed }) {
  return (
    <div style={{
      background: overdue ? "#1c0f0f" : completed ? "#0f172a" : "#1e293b",
      border:`1px solid ${overdue?"#ef4444":completed?"#1e293b":"#334155"}`,
      borderRadius:10, padding:"12px 16px", marginBottom:8,
      display:"flex", justifyContent:"space-between", alignItems:"center",
      opacity: completed ? 0.5 : 1
    }}>
      <div>
        <div style={{ fontWeight:600, color:completed?"#475569":"#f1f5f9", fontSize:14, textDecoration:completed?"line-through":"none" }}>🔔 {f.title}</div>
        <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>{f.customer_name || f.lead_name || "Unknown"}</div>
      </div>
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <span style={{ color:overdue?"#ef4444":"#f59e0b", fontSize:12, fontWeight:600 }}>
          {new Date(f.due_date).toLocaleDateString("en-IN",{ day:"2-digit", month:"short", year:"numeric" })}
        </span>
        {!completed && (
          <button onClick={() => onDone(f.id)} style={{ background:"#064e3b", color:"#10b981", border:"1px solid #10b981", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:12 }}>
            ✓ Done
          </button>
        )}
      </div>
    </div>
  );
}


// ─── SHARED COMPONENTS ───────────────────────────────────────
function KPI({ icon, label, value, color }) {
  return (
    <div className="card-hover" style={{ ...kpiCard, borderTop:`3px solid ${color}`, transition:"transform 0.2s, box-shadow 0.2s" }}>
      <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color, fontFamily:"'JetBrains Mono',monospace" }}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, type="text", placeholder="", required=false, textarea=false }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      {textarea
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ ...formInput, height:80, resize:"vertical" }} />
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required} style={formInput} />
      }
    </div>
  );
}

function StatusChip({ s }) {
  const colors = { pending:"#f59e0b", confirmed:"#3b82f6", shipped:"#8b5cf6", delivered:"#10b981", cancelled:"#ef4444" };
  return <span style={{ color:colors[s]||"#94a3b8", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{s}</span>;
}


// ─── STYLES ──────────────────────────────────────────────────
const shell        = { background:"#0f172a", minHeight:"100vh", padding:"24px 28px", fontFamily:"'Outfit',sans-serif", color:"#f1f5f9" };
const topBar       = { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:12 };
const backBtn      = { background:"#1e293b", color:"#94a3b8", padding:"6px 14px", borderRadius:6, textDecoration:"none", fontSize:13 };
const pageTitle    = { fontWeight:800, fontSize:28, margin:"0 0 2px", color:"#f1f5f9" };
const pageSubtitle = { margin:0, color:"#64748b", fontSize:13 };
const navBtn       = { background:"#0f172a", color:"#64748b", border:"1px solid #1e293b", padding:"7px 14px", borderRadius:8, cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontWeight:500, fontSize:13, transition:"background 0.15s, color 0.15s" };
const kpiGrid      = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14 };
const kpiCard      = { background:"#1e293b", borderRadius:12, padding:"16px 18px", boxShadow:"0 4px 12px rgba(0,0,0,0.2)" };
const dashCard     = { background:"#1e293b", borderRadius:12, padding:"18px 20px", border:"1px solid #334155" };
const dashCardHdr  = { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, fontWeight:700, fontSize:14, color:"#94a3b8" };
const seeAllBtn    = { background:"none", border:"none", color:"#2A9D8F", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif" };
const topRow       = { display:"flex", gap:12, alignItems:"center", padding:"10px 0", borderBottom:"1px solid #1e293b" };
const rankBadge    = { width:24, height:24, background:"#0f172a", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#64748b" };
const miniStat     = { background:"#0f172a", borderRadius:10, padding:"12px 16px", flex:1 };
const emptyTxt     = { color:"#475569", textAlign:"center", padding:"60px 0", fontSize:15 };
const emptyInCard  = { color:"#334155", fontSize:13, padding:"8px 0", margin:0 };
const errBanner    = { background:"#450a0a", border:"1px solid #ef4444", color:"#fca5a5", borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:13 };
const addBtn       = { background:"#2A9D8F", color:"#fff", border:"none", padding:"9px 18px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13, fontFamily:"'Outfit',sans-serif" };
const searchInput  = { background:"#1e293b", border:"1px solid #334155", borderRadius:8, padding:"9px 14px", color:"#f1f5f9", fontSize:13, fontFamily:"'Outfit',sans-serif", flex:1, minWidth:200 };
const tableWrap    = { background:"#1e293b", borderRadius:14, overflow:"hidden", border:"1px solid #334155" };
const table        = { width:"100%", borderCollapse:"collapse" };
const th           = { padding:"12px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", borderBottom:"1px solid #334155", background:"#0f172a" };
const td           = { padding:"13px 14px", fontSize:13, color:"#cbd5e1", borderBottom:"1px solid #1e293b" };
const tr           = { background:"#1e293b", transition:"background 0.15s" };
const mono         = { fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:"#94a3b8" };
const dangerBtn    = { background:"#450a0a", color:"#ef4444", border:"1px solid #ef4444", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:11 };
const overlay      = { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 };
const modal        = { background:"#1e293b", borderRadius:16, width:"100%", maxWidth:640, maxHeight:"90vh", overflowY:"auto", padding:28, border:"1px solid #334155" };
const closeBtn     = { background:"#0f172a", border:"none", color:"#94a3b8", cursor:"pointer", borderRadius:6, padding:"6px 10px", fontSize:16 };
const modalSec     = { marginBottom:20, paddingBottom:20, borderBottom:"1px solid #334155" };
const secLabel     = { margin:"0 0 10px", fontSize:11, fontWeight:700, color:"#475569", letterSpacing:"0.1em", textTransform:"uppercase" };
const modalTh      = { textAlign:"left", padding:"8px 10px", fontSize:11, color:"#475569", borderBottom:"1px solid #334155", textTransform:"uppercase" };
const modalTd      = { padding:"10px 10px", fontSize:13, color:"#94a3b8", borderBottom:"1px solid #1a2540" };
const smallSelect  = { background:"#0f172a", border:"1px solid #334155", borderRadius:6, padding:"8px 10px", color:"#f1f5f9", fontSize:13, fontFamily:"'Outfit',sans-serif" };
const smallInput   = { background:"#0f172a", border:"1px solid #334155", borderRadius:6, padding:"8px 10px", color:"#f1f5f9", fontSize:13, fontFamily:"'Outfit',sans-serif" };
const miniSubmit   = { background:"#2A9D8F", color:"#fff", border:"none", borderRadius:6, padding:"8px 14px", cursor:"pointer", fontWeight:600, fontSize:13, fontFamily:"'Outfit',sans-serif" };
const formCard     = { background:"#1e293b", borderRadius:14, padding:24, marginBottom:20, border:"1px solid #334155" };
const formTitle    = { fontWeight:800, fontSize:17, margin:"0 0 18px", color:"#f1f5f9" };
const formGrid     = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:14 };
const formInput    = { width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"9px 12px", color:"#f1f5f9", fontSize:13, fontFamily:"'Outfit',sans-serif" };
const fieldLabel   = { display:"block", fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 };
const submitBtn    = { background:"#2A9D8F", color:"#fff", border:"none", padding:"10px 24px", borderRadius:8, cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, marginTop:4 };
const kanbanBoard  = { display:"grid", gridTemplateColumns:"repeat(6,minmax(170px,1fr))", gap:12, overflowX:"auto" };
const kanbanCol    = { background:"#1e293b", borderRadius:12, padding:"14px 12px", minHeight:300, border:"1px solid #334155" };
const kanbanCard   = { background:"#0f172a", borderRadius:10, padding:"12px", marginBottom:8, cursor:"grab", border:"1px solid #1e293b", boxShadow:"0 4px 10px rgba(0,0,0,0.2)", transition:"transform 0.15s, box-shadow 0.15s" };
const miniAction   = { background:"none", borderRadius:6, border:"1px solid", padding:"2px 7px", cursor:"pointer", fontSize:10, fontWeight:700, fontFamily:"'Outfit',sans-serif" };