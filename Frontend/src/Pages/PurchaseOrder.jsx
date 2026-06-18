import { useState, useEffect } from "react";import {
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
import { apiFetch } from "../api.js";
export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [supplier, setSupplier] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [itemName, setItemName] = useState("");
const [quantity, setQuantity] = useState(1);
const [price, setPrice] = useState("");

const createPO = async (e) => {
  e.preventDefault();

  try {
   const orderData = {
   supplier_id: Number(supplierId),
  items: [
  {
    item_name: itemName,
    quantity: Number(quantity),
    unit_price: Number(price),
  },
],
};
    const data = await apiFetch("/api/purchase/orders", {
  method: "POST",
  body: JSON.stringify(orderData),
});

console.log("PO CREATED:", data);
    setSupplier("");
  } catch (err) {
    console.error("Create PO failed:", err);
  }
};
const fetchPOs = async () => {
  try {
    const data = await apiFetch("/api/purchase/orders");

    console.log("PO DATA:", data);

    setOrders(data.orders || data);
  } catch (err) {
    console.error(err);
  }
};
const fetchSuppliers = async () => {
  try {
    const data = await apiFetch("/api/purchase/suppliers");
    setSuppliers(data.suppliers || []);
  } catch (err) {
    console.error(err);
  }
};

useEffect(() => {
  fetchPOs();
  fetchSuppliers();
}, []);

console.log("SUPPLIERS:", suppliers);
  return (
    <div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>🛒 Purchase Orders</h2>

        <form onSubmit={createPO} style={{ display: "flex", gap: "12px" }}>
<select
  value={supplierId}
  onChange={(e) => setSupplierId(e.target.value)}
  style={{
    ...inputStyle,
    color: "white",
    backgroundColor: "#0b1020",
  }}
  required
>
  <option value="" style={{ color: "white" }}>
    Select Supplier
  </option>

  {suppliers.map((s) => (
    <option
      key={s.id}
      value={s.id}
      style={{ color: "white" }}
    >
      {s.name}
    </option>
  ))}
</select>
<input
  placeholder="Item Name"
  value={itemName}
  onChange={(e) => setItemName(e.target.value)}
  style={inputStyle}
/>

<input
  placeholder="Quantity"
  type="number"
  value={quantity}
  onChange={(e) => setQuantity(e.target.value)}
  style={inputStyle}
/>

<input
  placeholder="Unit Price"
  type="number"
  value={price}
  onChange={(e) => setPrice(e.target.value)}
  style={inputStyle}
/>
          <Btn type="submit">Generate PO</Btn>
        </form>
      </div>

  <Table headers={["PO ID", "Supplier", "Amount", "Status"]}>
  {orders.map((o) => (
    <Tr key={o.id}>
      <Td>{o.id}</Td>
      <Td>{o.supplier_name}</Td>
      <Td>₹{Number(o.total_amount).toLocaleString()}</Td>
      <Td>
        <StatusBadge status={o.status} map={PO_STATUS} />
      </Td>
    </Tr>
  ))}
</Table>
    </div>
  );
}