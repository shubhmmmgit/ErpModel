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
  const [selectedPO, setSelectedPO] = useState(null);
  const [loadingPO, setLoadingPO] = useState(false);

  const handlePOChange = async (e) => {
    const val = e.target.value;
    setPo(val);
    setSelectedPO(null);
    if (!val) return;
    setLoadingPO(true);
    try {
      const data = await apiFetch(`/api/purchase/orders/${val}`);
      setSelectedPO(data);
    } catch (err) {
      console.error("Failed to load PO details:", err);
    } finally {
      setLoadingPO(false);
    }
  };
const createGRN = async (e) => {
  e.preventDefault();

  if (!po) {
    alert("Please select a Purchase Order.");
    return;
  }
  if (!selectedPO) {
    alert("Selected PO not found. Please refresh and try again.");
    return;
  }
  if (!selectedPO.items || selectedPO.items.length === 0) {
    alert("This PO has no items to receive.");
    return;
  }

  try {
    const grnData = {
      po_id: Number(po),
      items: selectedPO.items.map(item => ({
        po_item_id: item.id,
        product_id: item.product_id,
        item_name: item.item_name,
        ordered_qty: item.quantity,
        received_qty: item.quantity,
        accepted_qty: item.quantity,
        unit_price: item.unit_price,
        unit: item.unit
      }))
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
    setSelectedPO(null);
    await loadPOs();
  } catch (err) {
    console.error(err);
  }
  
};
const loadPOs = async () => {
  try {
    const data = await apiFetch("/api/purchase/orders");
    console.log("Purchase Orders:", data.orders);

    setOrders(data.orders || []);
  } catch (err) {
    console.error(err);
  }
};

useEffect(() => {
  loadPOs();
}, []);
const receivePO = async (poId) => {
  try {
    await apiFetch(
      `/api/purchase/orders/${poId}/receive`,
      {
        method: "POST"
      }
    );

    alert("GRN Created Successfully");

    loadPOs();

  } catch (err) {
    alert(err.message);
  }
};
  return (
    <div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>📦 Goods Receipt Note</h2>

        <form onSubmit={createGRN} style={{ display: "flex", gap: "12px" }}>
         <select
  value={po}
  onChange={handlePOChange}
  style={inputStyle}
>
  <option value="">Select PO</option>

{orders
  .filter(o =>
    ["draft", "approved", "sent", "confirmed", "partially_received"].includes(o.status)
  )
  .map(o => (
    <option key={o.id} value={o.id}>
      {o.po_number}
    </option>
))}
</select>

          <Btn type="submit" disabled={loadingPO || !selectedPO}>
            {loadingPO ? "Loading…" : "Create GRN"}
          </Btn>
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