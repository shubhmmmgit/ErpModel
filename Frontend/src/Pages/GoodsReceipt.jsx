import { useState, useEffect } from "react";
import {
  cardStyle,
  sectionTitle,
  inputStyle,
  Btn,
  Table,
  Td,
  Tr,
  C,
} from "./Purchaseshared.jsx";
import { apiFetch } from "../api";

export default function GoodsReceipt() {
  const [grns, setGrns] = useState([]);
  const [po, setPo] = useState("");
  const [orders, setOrders] = useState([]);
  
const createGRN = async (e) => {
  e.preventDefault();

  try {
    const grnData = {
      
  po_id: Number(po),
  items: [
    {
      item_name: "Received Item",
      received_qty: 1,
      accepted_qty: 1,
      unit_price: 0
    }
    
  ]
};
console.log("GRN DATA:", grnData);
    
  const data = await apiFetch("/api/purchase/grn", {
  method: "POST",
  body: JSON.stringify(grnData),
});
    

    setGrns((prev) => [
      ...prev,
      {
        id: data.id,
        po,
        received: new Date().toLocaleDateString(),
      },
    ]);

    setPo("");
  } catch (err) {
    console.error(err);
  }
  
};
useEffect(() => {
  const loadPOs = async () => {
    try {
      const data = await apiFetch("/api/purchase/orders");
      console.log("POs:", data);
      setOrders(data.orders || []);
    } catch (err) {
      console.error(err);
    }
  };

  loadPOs();
}, []);
  return (
    <div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>📦 Goods Receipt Note</h2>

        <form onSubmit={createGRN} style={{ display: "flex", gap: "12px" }}>
         <select
  value={po}
  onChange={(e) => setPo(e.target.value)}
>
  <option value="">Select PO</option>

  {orders.map(o => (
    <option key={o.id} value={o.id}>
      {o.po_number}
    </option>
  ))}
</select>

          <Btn type="submit">Create GRN</Btn>
        </form>
      </div>

      <Table headers={["GRN ID", "PO", "Received Date", "Inventory"]}>
        {grns.map((g) => (
          <Tr key={g.id}>
            <Td>{g.id}</Td>
            <Td>{g.po}</Td>
            <Td>{g.received}</Td>
            <Td style={{ color: C.green, fontWeight: 700 }}>
              Stock Updated
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}