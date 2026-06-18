import { useState, useEffect } from "react";
import { apiFetch } from "../api";
import {
  C,
  PR_STATUS,
  StatusBadge,
  Btn,
  Table,
  Td,
  Tr,
  cardStyle,
  sectionTitle,
  inputStyle,
  selectStyle,
} from "./Purchaseshared.jsx";


export default function PurchaseRequisition() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    department: "",
    requester: "",
    amount: "",
  });

const fetchPRs = async () => {
  try {
    const data = await apiFetch("/api/purchase/requisitions");

    console.log("PRS:", data);

    setRows(data.requisitions || []);
  } catch (err) {
    console.error(err);
  }
};
const addReq = async (e) => {
  e.preventDefault();

  try {
    const payload = {
      department: form.department,
      purpose: "Manual Purchase Request",
      required_date: new Date().toISOString(),
      priority: "medium",
      notes: "",
      items: [
        {
          item_name: "General Item",
          quantity: 1,
          estimated_price: Number(form.amount)
        }
      ]
    };

    console.log("PR PAYLOAD:", payload);

    await apiFetch("/api/purchase/requisitions", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    setForm({
      department: "",
      requester: "",
      amount: ""
    });

    fetchPRs();

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};
useEffect(() => {
  fetchPRs();
}, []);
  return (
    <div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>📋 Create Purchase Requisition</h2>

        <form
          onSubmit={addReq}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "14px" }}
        >
          <input
            placeholder="Department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            style={inputStyle}
            required
          />

          <input
            placeholder="Requester Name"
            value={form.requester}
            onChange={(e) => setForm({ ...form, requester: e.target.value })}
            style={inputStyle}
            required
          />

          <input
            type="number"
            placeholder="Estimated Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            style={inputStyle}
            required
          />

          <Btn type="submit">Create PR</Btn>
        </form>
      </div>

      <Table
        headers={["PR ID", "Department", "Requester", "Items", "Amount", "Status", "Date"]}
      >
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td>{r.id}</Td>
            <Td>{r.department}</Td>
            <Td>{r.requested_by ?? "-"}</Td>
<Td>{r.item_count ?? 0}</Td>
<Td>₹{(r.total_amount ?? 0).toLocaleString()}</Td>
<Td>
  {r.created_at
    ? new Date(r.created_at).toLocaleDateString()
    : "-"}
</Td>
            <Td>
              <StatusBadge status={r.status} map={PR_STATUS} />
            </Td>
            <Td>{new Date(r.date).toLocaleDateString()}</Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}