import { useState, useEffect } from "react";
import {
  cardStyle,
  sectionTitle,
  inputStyle,
  Btn,
  Table,
  Td,
  Tr,
  StatusBadge,
  C,
} from "./Purchaseshared.jsx";
import { apiFetch } from "../api";

const RFQ_STATUS = {
  open: { label: "Open", bg: "rgba(251,191,36,0.12)", color: C.yellow },
  closed: { label: "Closed", bg: "rgba(52,211,153,0.12)", color: C.green },
};

export default function RFQModule() {
  const [rfqs, setRfqs] = useState([]);
  const [title, setTitle] = useState("");



const createRFQ = async (e) => {
  e.preventDefault();

  try {
    const res = await apiFetch("/api/purchase/rfqs", {
      method: "POST",
      body: JSON.stringify({
        title,
        supplier_ids: [2,3], // supplier id from your suppliers table
        deadline: "2026-12-31",
        notes: ""
      })
    });

    console.log("RFQ CREATED:", res);

    setTitle("");

    await fetchRFQs();

  } catch (err) {
    console.error(err);
  }
};

const fetchRFQs = async () => {
  try {
    const data = await apiFetch("/api/purchase/rfqs");

    console.log("RFQS:", data);

    setRfqs(data.rfqs || data);
  } catch (err) {
    console.error(err);
  }
};
useEffect(() => {
  fetchRFQs();
}, []);

  return (
    <div>
      <div style={cardStyle}>
         <h2 style={sectionTitle}>📩 Request For Quotation</h2>

        <form onSubmit={createRFQ} style={{ display: "flex", gap: "12px" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="RFQ Title"
            style={inputStyle}
            required
          />

          <Btn type="submit">Create RFQ</Btn>
        </form>
      </div>

<Table headers={["RFQ ID", "RFQ Number", "Supplier", "Status"]}>
  {rfqs.map((r) => (
    <Tr key={r.id}>
      <Td>{r.id}</Td>
      <Td>{r.rfq_number}</Td>
      <Td>{r.supplier_names || "-"}</Td>
      <Td>
        <StatusBadge status={r.status} map={RFQ_STATUS} />
      </Td>
    </Tr>
  ))}
</Table>
    </div>
  );
}