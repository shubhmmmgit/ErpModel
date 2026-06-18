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
  RET_STATUS,
} from "./Purchaseshared.jsx";
import { apiFetch } from "../api.js";

// Pulls the first line item out of a PO regardless of which key the backend
// used for the array (items / po_items / line_items / order_items) and
// regardless of which key holds the name (item_name / name / product_name / description).
function getFirstItem(po) {
  if (!po) return null;
  const arr =
    po.items || po.po_items || po.line_items || po.order_items || [];
  return arr.length ? arr[0] : null;
}

function getItemName(item) {
  if (!item) return "";
  return (
    item.item_name ||
    item.name ||
    item.product_name ||
    item.description ||
    ""
  );
}

export default function PurchaseReturn() {
  const [returns, setReturns] = useState([]);
  const [reason, setReason] = useState("");
  const [poId, setPoId] = useState("");
  const [selectedPO, setSelectedPO] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [returnQty, setReturnQty] = useState("");
  const [orders, setOrders] = useState([]);
  const [formError, setFormError] = useState("");

  const firstItem = getFirstItem(selectedPO);
  const itemName = getItemName(firstItem);
  const unitPrice = firstItem?.unit_price || 0;

  const fetchReturns = async () => {
    try {
      const data = await apiFetch("/api/purchase/returns");
      setReturns(data.returns || data || []);
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

  const fetchOrders = async () => {
    try {
      const data = await apiFetch("/api/purchase/orders");
      setOrders(data.orders || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReturns();
    fetchSuppliers();
    fetchOrders();
  }, []);

  const handlePOChange = async (e) => {
    const id = e.target.value;
    setPoId(id);
    setFormError("");

    const poFromList = orders.find((o) => o.id === Number(id));
    setSelectedPO(poFromList || null);

    // The list endpoint may not include line items. If this PO has no
    // items array yet, try fetching the single-PO detail endpoint which
    // often includes the full items list.
    if (poFromList && !getFirstItem(poFromList) && id) {
      try {
        const detail = await apiFetch(`/api/purchase/orders/${id}`);
        const fullPO = detail.order || detail;
        if (getFirstItem(fullPO)) {
          setSelectedPO(fullPO);
        }
      } catch (err) {
        // Detail endpoint may not exist — fall back silently to list data.
        console.error("Could not fetch PO detail:", err);
      }
    }
  };

  const createReturn = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!selectedPO) {
      setFormError("Please select a PO.");
      return;
    }

    const name = getItemName(getFirstItem(selectedPO));
    if (!name) {
      setFormError(
        "This PO doesn't have item information available. Check that the PO includes line items before creating a return."
      );
      return;
    }

    try {
      const returnData = {
        supplier_id: selectedPO?.supplier_id,
        po_id: Number(poId),
        reason,
        items: [
          {
            item_name: name,
            return_qty: Number(returnQty),
            unit_price: Number(unitPrice),
          },
        ],
      };

      const response = await fetch(
        "http://localhost:8080/api/purchase/returns",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(returnData),
        }
      );

      const createdReturn = await response.json();

      if (!response.ok) {
        setFormError(createdReturn?.error || "Failed to create return.");
        return;
      }

      await fetchReturns();
      setReason("");
      setReturnQty("");
      setPoId("");
      setSelectedPO(null);
    } catch (err) {
      console.error(err);
      setFormError("Something went wrong creating the return.");
    }
  };

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>↩️ Purchase Return</h2>

        <form onSubmit={createReturn} style={{ display: "flex", gap: "12px" }}>
          <input
            placeholder="Return Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={inputStyle}
            required
          />

          <select
            value={poId}
            onChange={handlePOChange}
            style={{
              ...inputStyle,
              color: "white",
            }}
          >
            <option value="">Select PO</option>

            {orders.map((o) => (
              <option
                key={o.id}
                value={o.id}
                style={{
                  background: "#071024",
                  color: "white",
                }}
              >
                PO-{o.id}
              </option>
            ))}
          </select>

          <input
            value={unitPrice}
            readOnly
            style={{
              ...inputStyle,
              opacity: 0.8,
            }}
          />
          <input
            type="number"
            placeholder="Return Qty"
            value={returnQty}
            onChange={(e) => setReturnQty(e.target.value)}
            style={inputStyle}
            required
          />
          <Btn type="submit">Create Return</Btn>
        </form>

        {formError && (
          <p style={{ color: "#ff6b6b", marginTop: "8px" }}>{formError}</p>
        )}
      </div>

      <Table headers={["Return ID", "Reason", "Amount", "Status"]}>
        {returns.map((r) => (
          <Tr key={r.id}>
            <Td>{r.return_number || r.id}</Td>
            <Td>{r.reason}</Td>
            <Td>
              ₹{Number(r.total_amount || r.amount || 0).toLocaleString()}
            </Td>
            <Td>
              <StatusBadge status={r.status} map={RET_STATUS} />
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}