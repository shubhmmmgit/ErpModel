import pool from "../config/db.js";
import { generateDocumentNumber }
from "./documentNumberService.js";

export const createGRNFromPO = async (
  poId,
  businessId,
  userId
) => {

  // Get PO

  const poResult = await pool.query(
    `
    SELECT *
    FROM purchase_orders
    WHERE id = $1
    AND business_id = $2
    `,
    [poId, businessId]
  );

  if (!poResult.rows.length) {
    throw new Error("PO not found");
  }

  const po = poResult.rows[0];

  // Generate GRN Number

  const grnNumber =
    await generateDocumentNumber(
      businessId,
      "GRN"
    );

  // Calculate total received

  const items = await pool.query(
    `
    SELECT *
    FROM purchase_order_items
    WHERE po_id = $1
    `,
    [poId]
  );

  const totalReceived =
    items.rows.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0
    );

  // Create GRN

  const grn = await pool.query(
    `
    INSERT INTO goods_receipts
    (
      business_id,
      po_id,
      grn_number,
      supplier_id,
      receipt_date,
      received_by,
      status,
      total_received
    )
    VALUES
    (
      $1,$2,$3,$4,
      CURRENT_DATE,
      $5,
      'accepted',
      $6
    )
    RETURNING *
    `,
    [
      businessId,
      poId,
      grnNumber,
      po.supplier_id,
      userId,
      totalReceived
    ]
  );

  // Mark PO as received

  await pool.query(
    `
    UPDATE purchase_orders
    SET status='received'
    WHERE id=$1
    `,
    [poId]
  );

  return grn.rows[0];
};