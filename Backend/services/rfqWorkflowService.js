import pool from "../config/db.js";
import { generateDocumentNumber }
from "./documentNumberService.js";

export const createPOFromRFQ = async (
  rfqId,
  supplierId,
  businessId
) => {

  const rfq = await pool.query(
    `
    SELECT *
    FROM rfqs
    WHERE id = $1
    `,
    [rfqId]
  );

  if (!rfq.rows.length) {
    throw new Error("RFQ not found");
  }

  const quotation = await pool.query(
    `
    SELECT *
    FROM rfq_suppliers
    WHERE rfq_id = $1
    AND supplier_id = $2
    `,
    [rfqId, supplierId]
  );

  if (!quotation.rows.length) {
    throw new Error("Quotation not found");
  }

  const poNumber =
    await generateDocumentNumber(
      businessId,
      "PO"
    );

  const po = await pool.query(
    `
    INSERT INTO purchase_orders
    (
      business_id,
      supplier_id,
      rfq_id,
      po_number,
      total_amount,
      order_date,
      status,
      created_by,
      subtotal,
      tax_amount,
      discount_amount
    )
    VALUES
    (
      $1,$2,$3,$4,$5,
      CURRENT_DATE,
      'draft',
      $6,
      $7,$8,$9
    )
    RETURNING *
    `,
    [
      businessId,
      supplierId,
      rfqId,
      poNumber,
      quotation.rows[0].quoted_amount || 0,
      businessId,
      quotation.rows[0].quoted_amount || 0,
      0,
      0
    ]
  );

  return po.rows[0];
};