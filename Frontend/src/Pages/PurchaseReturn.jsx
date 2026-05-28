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
  RET_STATUS,
} from "./Purchaseshared.jsx";

export default function PurchaseReturn() {
  const [returns, setReturns] = useState([]);
  const [reason, setReason] = useState("");

  const createReturn = (e) => {
    e.preventDefault();

    setReturns([
      {
        id: `RET-${Date.now()}`,
        reason,
        amount: 8000,
        status: "pending",
      },
      ...returns,
    ]);

    setReason("");
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

          <Btn type="submit">Create Return</Btn>
        </form>
      </div>

      <Table headers={["Return ID", "Reason", "Amount", "Status"]}>
        {returns.map((r) => (
          <Tr key={r.id}>
            <Td>{r.id}</Td>
            <Td>{r.reason}</Td>
            <Td>₹{r.amount.toLocaleString()}</Td>
            <Td>
              <StatusBadge status={r.status} map={RET_STATUS} />
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}