import { useState } from "react";
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

const MOCK = [
  {
    id: "PR-1001",
    department: "IT",
    requester: "Shubham",
    items: 4,
    amount: 45000,
    status: "pending",
    date: "2026-05-28",
  },
  {
    id: "PR-1002",
    department: "Operations",
    requester: "Rahul",
    items: 2,
    amount: 12000,
    status: "approved",
    date: "2026-05-25",
  },
];

export default function PurchaseRequisition() {
  const [rows, setRows] = useState(MOCK);
  const [form, setForm] = useState({
    department: "",
    requester: "",
    amount: "",
  });

    const addReq = (e) => {
    e.preventDefault();

    const item = {
      id: `PR-${Date.now()}`,
      department: form.department,
      requester: form.requester,
      items: 1,
      amount: Number(form.amount),
      status: "pending",
      date: new Date().toISOString(),
    };

    setRows([item, ...rows]);
    setForm({ department: "", requester: "", amount: "" });
  };

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
            <Td>{r.requester}</Td>
            <Td>{r.items}</Td>
             <Td>₹{r.amount.toLocaleString()}</Td>
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