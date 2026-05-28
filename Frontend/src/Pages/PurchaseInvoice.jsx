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
  INV_STATUS,
} from "./purchaseShared.jsx";

export default function PurchaseInvoice() {
  const [invoices, setInvoices] = useState([]);
  const [supplier, setSupplier] = useState("");

  const addInvoice = (e) => {
    e.preventDefault();

    setInvoices([
      {
        id: `INV-${Date.now()}`,
        supplier,
        amount: 55000,
        status: "pending",
      },
      ...invoices,
    ]);

    setSupplier("");
  };

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>🧾 Purchase Invoice</h2>

        <form onSubmit={addInvoice} style={{ display: "flex", gap: "12px" }}>
          <input
            placeholder="Supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            style={inputStyle}
            required
          />

          <Btn type="submit">Add Invoice</Btn>
        </form>
      </div>

      <Table headers={["Invoice", "Supplier", "Amount", "Status"]}>
        {invoices.map((i) => (
          <Tr key={i.id}>
            <Td>{i.id}</Td>
            <Td>{i.supplier}</Td>
            <Td>₹{i.amount.toLocaleString()}</Td>
            <Td>
              <StatusBadge status={i.status} map={INV_STATUS} />
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}