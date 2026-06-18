import { useState, useEffect } from "react";
import { apiFetch } from "../api";

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
} from "./Purchaseshared.jsx";

export default function PurchaseInvoice() {
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [po, setPo] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");

const addInvoice = async (e) => {
  e.preventDefault();

  try {
const invoiceData = {
  invoice_number: `INV-${Date.now()}`,
  po_id: Number(po),
  supplier_id: Number(supplierId),
  total_amount:  Number(price),
};

    console.log("BEFORE FETCH");

    const response = await fetch(
      "http://localhost:8080/api/purchase/invoices",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(invoiceData),
      }
    );

    console.log("FETCH COMPLETE");
    console.log("STATUS:", response.status);

    const data = await response.json();

console.log("RESPONSE DATA:", data);
 
await fetchInvoices();

  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
};
const fetchInvoices = async () => {
  try {
    const data = await apiFetch("/api/purchase/invoices");
    setInvoices(data.invoices || []);
  } catch (err) {
    console.error(err);
  }
};

useEffect(() => {
  fetchInvoices();
}, []);
const fetchSuppliers = async () => {
  try {
    const data = await apiFetch("/api/purchase/suppliers");

    console.log("SUPPLIERS:", data);

    setSuppliers(data.suppliers || []);
  } catch (err) {
    console.error(err);
  }
};

useEffect(() => {
  fetchInvoices();
  fetchSuppliers();
}, []);

console.log("FIRST INVOICE:", invoices[0]);
  return (
    <div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>🧾 Purchase Invoice</h2>

        <form onSubmit={addInvoice} style={{ display: "flex", gap: "12px" }}>
         <select
  value={supplierId}
  onChange={(e) => setSupplierId(e.target.value)}
  style={inputStyle}
>
  <option value="">Select Supplier</option>

  {suppliers.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ))}
</select>
          <input
  placeholder="Purchase Order ID"
  value={po}
  onChange={(e) => setPo(e.target.value)}
  style={inputStyle}
/>

          <Btn type="submit">Add Invoice</Btn>
        </form>
      </div>

      <Table headers={["Invoice", "Supplier", "Amount", "Status"]}>
        {invoices.map((i) => (
          <Tr key={i.id}>
            <Td>{i.invoice_number || i.id}</Td>

<Td>{i.supplier_name || "Supplier"}</Td>

<Td>
 ₹{Number(i.total_amount || 0).toLocaleString()}
</Td>
            <Td>
              <StatusBadge status={i.status} map={INV_STATUS} />
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}