import { useState } from "react";
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
} from "./purchaseShared.jsx";

const RFQ_STATUS = {
  open: { label: "Open", bg: "rgba(251,191,36,0.12)", color: C.yellow },
  closed: { label: "Closed", bg: "rgba(52,211,153,0.12)", color: C.green },
};

export default function RFQModule() {
  const [rfqs, setRfqs] = useState([]);
  const [title, setTitle] = useState("");

  const createRFQ = (e) => {
    e.preventDefault();

    setRfqs([
      {
        id: `RFQ-${Date.now()}`,
        title,
        suppliers: 3,
        status: "open",
      },
      ...rfqs,
    ]);

    setTitle("");
  };

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

      <Table headers={["RFQ ID", "Title", "Suppliers", "Status"]}>
        {rfqs.map((r) => (
          <Tr key={r.id}>
            <Td>{r.id}</Td>
            <Td>{r.title}</Td>
            <Td>{r.suppliers}</Td>
            <Td>
              <StatusBadge status={r.status} map={RFQ_STATUS} />
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}