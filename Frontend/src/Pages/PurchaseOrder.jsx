import { useState, useEffect } from "react";
import {
  cardStyle, sectionTitle, Table, Td, Tr, Btn,
  StatusBadge, PO_STATUS, inputStyle, selectStyle,
  Modal, FormInput, C, useToast, fmtCurrency, fmtDate
} from "./Purchaseshared.jsx";
import { apiFetch } from "../api.js";

// ── Empty form state ──────────────────────────────────────────
const EMPTY_FORM = {
  supplier_id: "",
  billing_address: "",
  shipping_address: "",
  po_date: new Date().toISOString().split("T")[0],
  delivery_date: "",
  payment_terms: "",
  notes: "",
  discount_percent: 0,
  
  items: [
  {
    item_name: "",
    quantity: 1,
    unit: "pcs",
    unit_price: "",
    description: "",
    tax_percent: 18
  }
]
};

// ── Item helpers ──────────────────────────────────────────────
const calcItemTotal  = (item) => Number(item.quantity || 0) * Number(item.unit_price || 0);
const calcSubtotal   = (items) => items.reduce((s, i) => s + calcItemTotal(i), 0);
const calcDiscount   = (subtotal, pct) => subtotal * (Number(pct) / 100);
const calcTax        = (subtotal, disc, pct) => (subtotal - disc) * (Number(pct) / 100);
const calcTotal      = (subtotal, disc, tax) => subtotal - disc + tax;

// ── Number to words (simple Indian system) ───────────────────
function toWords(n) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (n === 0) return "Zero";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
  if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + toWords(n%100) : "");
  if (n < 100000) return toWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + toWords(n%1000) : "");
  if (n < 10000000) return toWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + toWords(n%100000) : "");
  return toWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + toWords(n%10000000) : "");
}

export default function PurchaseOrders() {
  const [orders, setOrders]       = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const { toast, ToastContainer } = useToast();

  // ── Fetch ─────────────────────────────────────────────────
  const fetchAll = async () => {
    try {
      const [poData, suppData] = await Promise.all([
        apiFetch("/api/purchase/orders"),
        apiFetch("/api/purchase/suppliers?limit=200"),
      ]);
      setOrders(poData.orders || []);
      setSuppliers(suppData.suppliers || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Item CRUD ──────────────────────────────────────────────
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateItem = (i, k, v) => {
    const items = [...form.items];
    items[i] = { ...items[i], [k]: v };
    setForm(f => ({ ...f, items }));
  };
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items,
    { item_name:"", quantity:1, unit:"pcs", unit_price:"", description:"", tax_percent:18 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_,idx) => idx !== i) }));

  // ── Totals ─────────────────────────────────────────────────
  const subtotal = calcSubtotal(form.items);
  const discount = calcDiscount(subtotal, form.discount_percent);
  const tax   = form.items.reduce((sum, item) => {
    const base = Number(item.quantity || 0) * Number(item.unit_price || 0);
    return sum + base * Number(item.tax_percent || 0) / 100;
  }, 0);
  const total = calcTotal(subtotal, discount, tax);

  // ── Open create / edit ─────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = async (order) => {
    try {
      const data = await apiFetch(`/api/purchase/orders/${order.id}`);
      const o = data.order || data;
      setForm({
        supplier_id:      o.supplier_id || "",
        billing_address:  o.billing_address || "",
        shipping_address: o.shipping_address || "",
        po_date:          o.po_date ? o.po_date.split("T")[0] : new Date().toISOString().split("T")[0],
        delivery_date:    o.delivery_date ? o.delivery_date.split("T")[0] : "",
        payment_terms:    o.payment_terms || "",
        notes:            o.notes || "",
        discount_percent: o.discount_percent || 0,
        tax_percent:      0,
        items: (o.items || o.po_items || []).map(i => ({
  item_name: i.item_name || i.name || "",
  quantity: i.quantity || 1,
  unit: i.unit || "pcs",
  unit_price: i.unit_price || "",
  description: i.description || "",
  tax_percent: Number(i.tax_percent || 0),
})),
      });
      setEditingId(order.id);
      setShowForm(true);
    } catch (err) {
      toast("Failed to load PO for editing", "error");
    }
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) { toast("Select a supplier", "error"); return; }
    if (form.items.some(i => !i.item_name.trim() || !i.unit_price)) {
      toast("All items need a name and price", "error"); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        supplier_id:      Number(form.supplier_id),
        discount_percent: Number(form.discount_percent),
        tax_percent:      Number(form.tax_percent),
        subtotal_amount:  subtotal,
        discount_amount:  discount,
        tax_amount:       tax,
        total_amount:     total,
       items: form.items.map(i => ({
  item_name: i.item_name,
  quantity: i.quantity,
  unit: i.unit,
  unit_price: i.unit_price,
  description: i.description,

  tax_percent: Number(i.tax_percent || 0)
})),
        
      };
      console.log("SUBMIT PAYLOAD", payload);
      if (editingId) {
        await apiFetch(`/api/purchase/orders/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        toast("Purchase Order updated");
      } else {
        await apiFetch("/api/purchase/orders", { method: "POST", body: JSON.stringify(payload) });
        toast("Purchase Order created");
      }
      setShowForm(false);
      fetchAll();
    } catch (err) {
      toast(err.message || "Failed to save PO", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── View PO ────────────────────────────────────────────────
 const openView = async (order) => {
  try {
    const data = await apiFetch(`/api/purchase/orders/${order.id}`);

    const po = data.order || data;

    console.log("VIEW ORDER", {
      subtotal: po.subtotal,
      tax_amount: po.tax_amount,
      discount_amount: po.discount_amount,
      total_amount: po.total_amount,
      items: po.items
    });

    setViewOrder(po);

  } catch (err) {
    console.error(err);
    setViewOrder(order);
  }
};
  const selectedSupplier = suppliers.find(s => String(s.id) === String(form.supplier_id));
  

  return (
    <div>
      <ToastContainer />

      {/* ── Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={sectionTitle}>🛒 Purchase Orders</h2>
        <Btn onClick={openCreate}>+ Create PO</Btn>
      </div>

      {/* ── Table ── */}
      <Table
        headers={["PO Number","Supplier","Items","Total","Status","Actions"]}
        empty={orders.length === 0 ? "No purchase orders yet." : undefined}
      >
        {orders.map(o => (
          <Tr key={o.id}>
            <Td><span style={{ fontFamily:"monospace", color:C.blue }}>{o.po_number || `PO-${o.id}`}</span></Td>
            <Td>{o.supplier_name || "—"}</Td>
            <Td><span style={{ color:C.muted }}>{o.item_count || "—"}</span></Td>
            <Td><strong style={{ color:C.text }}>₹{Number(o.total_amount||0).toLocaleString()}</strong></Td>
            <Td><StatusBadge status={o.status} map={PO_STATUS} /></Td>
            <Td>
              <div style={{ display:"flex", gap:"6px" }}>
                <Btn variant="secondary" onClick={() => openView(o)}
                  style={{ padding:"4px 10px", fontSize:"12px" }}>View</Btn>
                <Btn variant="secondary" onClick={() => openEdit(o)}
                  style={{ padding:"4px 10px", fontSize:"12px" }}>Edit</Btn>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>

      {/* ══════════════════════════════════════════════════════
          CREATE / EDIT FORM MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? "Edit Purchase Order" : "Create Purchase Order"}
        width="780px"
      >
        <form onSubmit={handleSubmit} style={{ paddingTop:"16px" }}>

          {/* ── Section: Supplier & Dates ── */}
          <SectionHeader>Supplier & Dates</SectionHeader>
          <div style={grid2}>
            <FormInput label="Supplier *">
              <select required value={form.supplier_id}
                onChange={e => {
                  setField("supplier_id", e.target.value);
                  const s = suppliers.find(s => String(s.id) === e.target.value);
                  if (s?.address) setField("billing_address", [s.address, s.city, s.country].filter(Boolean).join(", "));
                }}
                style={selectStyle}>
                <option value="">— Select Supplier —</option>
                {suppliers.filter(s => s.status === "active").map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FormInput>
            <FormInput label="Payment Terms">
              <input value={form.payment_terms}
                onChange={e => setField("payment_terms", e.target.value)}
                style={inputStyle} placeholder="Net 30" />
            </FormInput>
            <FormInput label="PO Date">
              <input type="date" value={form.po_date}
                onChange={e => setField("po_date", e.target.value)} style={inputStyle} />
            </FormInput>
            <FormInput label="Expected Delivery">
              <input type="date" value={form.delivery_date}
                onChange={e => setField("delivery_date", e.target.value)} style={inputStyle} />
            </FormInput>
          </div>

          {/* ── Section: Addresses ── */}
          <SectionHeader>Addresses</SectionHeader>
          <div style={grid2}>
            <FormInput label="Billing Address">
              <textarea value={form.billing_address}
                onChange={e => setField("billing_address", e.target.value)}
                style={{ ...inputStyle, height:"80px", resize:"vertical" }}
                placeholder="Bill to address…" />
            </FormInput>
            <FormInput label="Shipping Address">
              <textarea value={form.shipping_address}
                onChange={e => setField("shipping_address", e.target.value)}
                style={{ ...inputStyle, height:"80px", resize:"vertical" }}
                placeholder="Ship to address…" />
            </FormInput>
          </div>

          {/* ── Section: Line Items ── */}
          <SectionHeader>Line Items</SectionHeader>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:"8px" }}>
              <thead>
                <tr>
                  {["Item Name","Description","Qty","Unit","Unit Price (₹)","GST %","Total",""].map(h => (
                    <th key={h} style={{ ...itemTh }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => (
                  <tr key={i}>
                    <td style={itemTd}>
                      <input required value={item.item_name}
                        onChange={e => updateItem(i, "item_name", e.target.value)}
                        style={{ ...inputStyle, minWidth:"140px" }} placeholder="Item name" />
                    </td>
                    <td style={itemTd}>
                      <input value={item.description}
                        onChange={e => updateItem(i, "description", e.target.value)}
                        style={{ ...inputStyle, minWidth:"120px" }} placeholder="Optional" />
                    </td>
                    <td style={itemTd}>
                      <input type="number" min="1" required value={item.quantity}
                        onChange={e => updateItem(i, "quantity", e.target.value)}
                        style={{ ...inputStyle, width:"70px" }} />
                    </td>
                    <td style={itemTd}>
                      <select value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)}
                        style={{ ...selectStyle, width:"80px" }}>
                        {["pcs","kg","ltr","m","box","set","no"].map(u =>
                          <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={itemTd}>
                      <input type="number" min="0" step="0.01" required value={item.unit_price}
                        onChange={e => updateItem(i, "unit_price", e.target.value)}
                        style={{ ...inputStyle, width:"110px" }} placeholder="0.00" />
                    </td>
                    <td style={itemTd}>
                      <input type="number" min="0" max="100" step="0.01"
                        value={item.tax_percent ?? 18}
                        onChange={e => updateItem(i, "tax_percent", e.target.value)}
                        style={{ ...inputStyle, width:"70px" }} placeholder="18" />
                    </td>
                    <td style={{ ...itemTd, color:C.green, fontWeight:"700", fontFamily:"monospace" }}>
                      ₹{(calcItemTotal(item) * (1 + Number(item.tax_percent||0)/100)).toLocaleString()}
                    </td>
                    <td style={itemTd}>
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)}
                          style={{ background:"none", border:"none", color:C.red,
                            cursor:"pointer", fontSize:"16px" }}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Btn type="button" variant="secondary" onClick={addItem}
              style={{ fontSize:"12px", padding:"6px 14px" }}>+ Add Item</Btn>
          </div>

          {/* ── Section: Tax & Discount ── */}
          <SectionHeader>Tax & Discount</SectionHeader>
          <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", marginBottom:"16px" }}>
            <FormInput label="Discount (%)">
              <input type="number" min="0" max="100" step="0.01"
                value={form.discount_percent}
                onChange={e => setField("discount_percent", e.target.value)}
                style={{ ...inputStyle, width:"120px" }} />
            </FormInput>
            
          </div>

          {/* ── Tax breakdown ── */}
          <div style={taxBox}>
            {[
              ["Subtotal", `₹${subtotal.toLocaleString()}`],
              form.discount_percent > 0 ? [`Discount (${form.discount_percent}%)`, `- ₹${discount.toLocaleString()}`] : null,
              [`CGST`, `+ ₹${(tax/2).toLocaleString()}`],
              [`SGST`, `+ ₹${(tax/2).toLocaleString()}`],
              [`Total GST`, `+ ₹${tax.toLocaleString()}`],
            ].filter(Boolean).map(([l, v]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between",
                padding:"6px 0", borderBottom:`1px solid #1e293b`, fontSize:"13px", color:C.muted }}>
                <span>{l}</span><span style={{ color:C.text }}>{v}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between",
              padding:"10px 0 0", fontSize:"16px", fontWeight:"800" }}>
              <span style={{ color:C.text }}>Total</span>
              <span style={{ color:C.green }}>₹{Math.round(total).toLocaleString()}</span>
            </div>
            <div style={{ fontSize:"11px", color:C.muted, marginTop:"4px", fontStyle:"italic" }}>
              IN WORDS: {toWords(Math.round(total))} Rupees Only
            </div>
          </div>

          {/* ── Notes ── */}
          <FormInput label="Notes / Terms & Conditions">
            <textarea value={form.notes} onChange={e => setField("notes", e.target.value)}
              style={{ ...inputStyle, height:"70px", resize:"vertical" }}
              placeholder="Payment terms, delivery instructions, warranty…" />
          </FormInput>

          <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end", marginTop:"16px" }}>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn type="submit" disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Update PO" : "Create PO"}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          VIEW MODAL — styled like the PDF
      ══════════════════════════════════════════════════════ */}
      {viewOrder && (
        <Modal open={!!viewOrder} onClose={() => setViewOrder(null)}
          title="" width="720px">
          <div style={poDoc}>

            {/* Header */}
            <div style={poHeader}>
              <div>
                <div style={poTitle}>PURCHASE ORDER</div>
                <div style={{ fontSize:"13px", color:C.muted, marginTop:"4px" }}>
                  {viewOrder.po_number || `PO-${viewOrder.id}`}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <StatusBadge status={viewOrder.status} map={PO_STATUS} />
                <div style={{ fontSize:"12px", color:C.muted, marginTop:"6px" }}>
                  Date: {viewOrder.po_date ? fmtDate(viewOrder.po_date) : "—"}
                </div>
                {viewOrder.delivery_date && (
                  <div style={{ fontSize:"12px", color:C.muted }}>
                    Delivery: {fmtDate(viewOrder.delivery_date)}
                  </div>
                )}
              </div>
            </div>

            <div style={poDivider} />

            {/* Parties */}
            <div style={grid2}>
              <div>
                <div style={poSectionLabel}>SUPPLIER</div>
                <div style={poPartyName}>{viewOrder.supplier_name || "—"}</div>
                {viewOrder.billing_address && (
                  <div style={poPartyAddr}>{viewOrder.billing_address}</div>
                )}
                {viewOrder.supplier_gstin && (
                  <div style={{ fontSize:"11px", color:C.muted, marginTop:"4px" }}>
                    GSTIN: {viewOrder.supplier_gstin}
                  </div>
                )}
              </div>
              <div>
                <div style={poSectionLabel}>SHIP TO</div>
                <div style={poPartyAddr}>
                  {viewOrder.shipping_address || "—"}
                </div>
                {viewOrder.payment_terms && (
                  <div style={{ fontSize:"12px", color:C.muted, marginTop:"8px" }}>
                    Payment Terms: <strong style={{ color:C.text }}>{viewOrder.payment_terms}</strong>
                  </div>
                )}
              </div>
            </div>

            <div style={poDivider} />

            {/* Line Items */}
            <div style={poSectionLabel}>ITEMS</div>
            <table style={{ width:"100%", borderCollapse:"collapse", marginTop:"8px" }}>
              <thead>
                <tr style={{ background:"#0f172a" }}>
                  {["#","Description","Qty","Unit","Unit Price",  "GST %", "Disc %","Amount"].map(h => (
                    <th key={h} style={poTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(viewOrder.items || viewOrder.po_items || []).map((item, i) => (
                  <tr key={i} style={{ borderBottom:"1px solid #1e293b" }}>
                    <td style={poTd}>{i + 1}</td>
                    <td style={poTd}>
                      <div style={{ fontWeight:"600", color:C.text }}>{item.item_name || item.name}</div>
                      {item.description && <div style={{ fontSize:"11px", color:C.muted }}>{item.description}</div>}
                    </td>
                    <td style={poTd}>{item.quantity}</td>

<td style={poTd}>{item.unit || "pcs"}</td>

<td style={poTd}>
  ₹{Number(item.unit_price).toLocaleString()}
</td>

<td style={poTd}>
  {item.tax_percent || 0}%
</td>

<td style={poTd}>
  {item.discount_percent || 0}%
</td>

<td style={{ ...poTd, fontWeight:"700" }}>
  ₹{Number(
    item.total_price ||
    (
      Number(item.quantity) *
      Number(item.unit_price)
    )
  ).toLocaleString()}
</td>
   
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"16px" }}>
  <div style={{ width:"320px" }}>

    {/* Subtotal */}
    <div style={{
      display:"flex",
      justifyContent:"space-between",
      padding:"5px 0",
      borderBottom:"1px solid #1e293b"
    }}>
      <span style={{ color:C.muted }}>Subtotal</span>
      <span style={{ color:C.text }}>
        ₹{Number(viewOrder.subtotal || 0).toLocaleString()}
      </span>
    </div>

    {/* Discount */}
    {Number(viewOrder.discount_amount || 0) > 0 && (
      <div style={{
        display:"flex",
        justifyContent:"space-between",
        padding:"5px 0",
        borderBottom:"1px solid #1e293b"
      }}>
        <span style={{ color:C.muted }}>Discount</span>
        <span style={{ color:"#ef4444" }}>
          - ₹{Number(viewOrder.discount_amount).toLocaleString()}
        </span>
      </div>
    )}

{/* Tax Breakdown */}
{Number(viewOrder.tax_amount || 0) > 0 && (
  <>
    <div style={{
      display:"flex",
      justifyContent:"space-between",
      padding:"5px 0",
      borderBottom:"1px solid #1e293b"
    }}>
      <span style={{ color:C.muted }}>
        CGST {(Number(viewOrder.tax_percent || 18) / 2)}%
      </span>

      <span style={{ color:C.text }}>
        ₹{(Number(viewOrder.tax_amount || 0) / 2).toLocaleString()}
      </span>
    </div>

    <div style={{
      display:"flex",
      justifyContent:"space-between",
      padding:"5px 0",
      borderBottom:"1px solid #1e293b"
    }}>
      <span style={{ color:C.muted }}>
        SGST {(Number(viewOrder.tax_percent || 18) / 2)}%
      </span>

      <span style={{ color:C.text }}>
        ₹{(Number(viewOrder.tax_amount || 0) / 2).toLocaleString()}
      </span>
    </div>
  </>
)}
 
    {/* Grand Total */}
    <div style={{
      display:"flex",
      justifyContent:"space-between",
      padding:"12px 0 0",
      fontWeight:"800",
      fontSize:"18px"
    }}>
      <span style={{ color:C.text }}>NET TOTAL</span>
      
      <span >
       ₹{(
  Number(viewOrder.subtotal || 0)
  - Number(viewOrder.discount_amount || 0)
  + Number(viewOrder.tax_amount || 0)
).toLocaleString()}
      </span>
    </div>

  </div>
</div>

            {/* In words */}
            <div style={{ ...poDivider, marginTop:"12px" }} />
            <div style={{ fontSize:"12px", color:C.muted, fontStyle:"italic" }}>
              IN WORDS: {toWords(
  Math.round(
    Number(viewOrder.subtotal || 0)
    - Number(viewOrder.discount_amount || 0)
    + Number(viewOrder.tax_amount || 0)
  )
)} Rupees Only
            </div>

            {/* Notes */}
            {viewOrder.notes && (
              <>
                <div style={{ ...poDivider, marginTop:"12px" }} />
                <div style={poSectionLabel}>NOTES / TERMS</div>
                <div style={{ fontSize:"13px", color:C.muted, marginTop:"6px" }}>{viewOrder.notes}</div>
              </>
            )}

            {/* Actions */}
            <div style={{ display:"flex", gap:"10px", marginTop:"20px", justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={() => { setViewOrder(null); openEdit(viewOrder); }}>
                ✏️ Edit PO
              </Btn>
              <Btn onClick={() => window.print()}>🖨️ Print</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────
function SectionHeader({ children }) {
  return (
    <div style={{ fontSize:"11px", fontWeight:"700", color:"#475569",
      textTransform:"uppercase", letterSpacing:"0.1em",
      borderBottom:"1px solid #1e293b", paddingBottom:"6px",
      marginBottom:"12px", marginTop:"20px" }}>
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const grid2    = { display:"flex", gap:"16px", flexWrap:"wrap", marginBottom:"8px" };
const taxBox   = { background:"#0f172a", borderRadius:"10px", padding:"16px",
  marginBottom:"16px", border:"1px solid #1e293b" };

const rowStyle = {
  display:"flex",
  justifyContent:"space-between",
  padding:"6px 0",
  borderBottom:"1px solid #1e293b",
  fontSize:"13px",
  color:C.muted
};

const itemTh = { textAlign:"left", padding:"8px 6px", fontSize:"11px", color:"#475569",
  textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid #1e293b",
  background:"#0f172a", whiteSpace:"nowrap" };
const itemTd = { padding:"6px 6px", verticalAlign:"middle" };

// PO Document styles
const poDoc         = { background:"#1e293b", borderRadius:"12px", padding:"28px",
  border:"1px solid #334155" };
const poHeader      = { display:"flex", justifyContent:"space-between", alignItems:"flex-start" };
const poTitle       = { fontSize:"22px", fontWeight:"800", color:"#f1f5f9",
  letterSpacing:"0.05em" };
const poDivider     = { borderTop:"1px solid #334155", margin:"16px 0" };
const poSectionLabel = { fontSize:"10px", fontWeight:"700", color:"#475569",
  textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"6px" };
const poPartyName   = { fontSize:"15px", fontWeight:"700", color:"#f1f5f9" };
const poPartyAddr   = { fontSize:"12px", color:"#94a3b8", marginTop:"4px", lineHeight:"1.6" };
const poTh          = { textAlign:"left", padding:"8px 10px", fontSize:"11px",
  color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em" };
const poTd          = { padding:"10px 10px", fontSize:"13px", color:"#94a3b8" };