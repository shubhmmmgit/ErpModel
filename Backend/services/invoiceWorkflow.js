import pool from "../config/db.js";

export async function createInvoiceFromGRN(
  grnId,
  businessId,
  userId
) {

const grnResult = await pool.query(
    `
    SELECT
      gr.*,
      po.subtotal,
      po.tax_amount,
      po.discount_amount,
      po.total_amount
    FROM goods_receipts gr
    JOIN purchase_orders po
      ON po.id = gr.po_id
    WHERE gr.id = $1
      AND gr.business_id = $2
    `,
    [grnId, businessId]
  );

  if (!grnResult.rows.length) {
    throw new Error("GRN not found");
  }

const grn = grnResult.rows[0];

const existing = await pool.query(
    `
    SELECT id
    FROM purchase_invoices
    WHERE grn_id = $1
    `,
    [grnId]
  );

  if (existing.rows.length) {
    throw new Error(
      "Invoice already exists for this GRN"
    );
  }

const seqResult = await pool.query(
  `
  INSERT INTO document_sequences
  (
    business_id,
    document_type,
    current_number
  )
  VALUES
  (
    $1,
    'INV',
    1
  )
  ON CONFLICT (business_id, document_type)
  DO UPDATE
  SET current_number =
      document_sequences.current_number + 1
  RETURNING current_number
  `,
  [businessId]
);

const nextNumber =
  seqResult.rows[0].current_number;

const invoiceNumber =
  `INV-${new Date().getFullYear()}-${String(nextNumber).padStart(4, "0")}`;

const invoice =
    await pool.query(
      `
      INSERT INTO purchase_invoices
      (
        business_id,
        supplier_id,
        po_id,
        grn_id,
        invoice_number,

        invoice_date,
        due_date,

        subtotal,
        tax_amount,
        discount_amount,
        total_amount,

        balance_due,

        status,
        payment_status,
        created_by
      )
      VALUES
      (
        $1,$2,$3,$4,$5,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        $6,$7,$8,$9,
        $9,
        'pending',
        'pending',
        $10
      )
      RETURNING *
      `,
      [
        businessId,
        grn.supplier_id,
        grn.po_id,
        grn.id,
        invoiceNumber,

        grn.subtotal || 0,
        grn.tax_amount || 0,
        grn.discount_amount || 0,
        grn.total_amount || 0,

        userId
      ]
    );

  return invoice.rows[0];
}