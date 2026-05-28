import { useState } from "react";
import {
  cardStyle,
  sectionTitle,
  Table,
  Td,
  Tr,
  Btn,
  StatusBadge,
  PO_STATUS,
  inputStyle,
} from "./Purchaseshared.jsx";

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [supplier, setSupplier] = useState("");

  const createPO = (e) => {
    e.preventDefault();

    setOrders([
      {
        id: `PO-${Date.now()}`,
        supplier,
        total: 35000,
        status: "sent",
      },
      ...orders,
    ]);

    setSupplier("");
  };

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>🛒 Purchase Orders</h2>

        <form onSubmit={createPO} style={{ display: "flex", gap: "12px" }}>
          <input
            placeholder="Supplier Name"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            style={inputStyle}
            required
          />

          <Btn type="submit">Generate PO</Btn>
        </form>
      </div>

      <Table headers={["PO ID", "Supplier", "Amount", "Status"]}>
        {orders.map((o) => (
          <Tr key={o.id}>
            <Td>{o.id}</Td>
            <Td>{o.supplier}</Td>
            <Td>₹{o.total.toLocaleString()}</Td>
            <Td>
              <StatusBadge status={o.status} map={PO_STATUS} />
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}