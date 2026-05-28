import { useState } from "react";
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

export default function GoodsReceipt() {
  const [grns, setGrns] = useState([]);
  const [po, setPo] = useState("");

  const createGRN = (e) => {
    e.preventDefault();

    setGrns([
      {
        id: `GRN-${Date.now()}`,
        po,
        received: new Date().toLocaleDateString(),
        stockUpdated: true,
      },
      ...grns,
    ]);

    setPo("");
  };

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>📦 Goods Receipt Note</h2>

        <form onSubmit={createGRN} style={{ display: "flex", gap: "12px" }}>
          <input
            placeholder="Purchase Order ID"
            value={po}
            onChange={(e) => setPo(e.target.value)}
            style={inputStyle}
            required
          />

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