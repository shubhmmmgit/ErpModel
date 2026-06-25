import pool from "../config/db.js";
import { generateDocumentNumber }
from "./documentNumberService.js";

export const createWorkflowRule = async ({
businessId,
supplierId,
auto_rfq = false,
auto_po = false
}) => {
await pool.query(
`     INSERT INTO supplier_workflows
    (
      business_id,
      supplier_id,
      auto_rfq,
      auto_po
    )
    VALUES ($1,$2,$3,$4)
    `,
[
businessId,
supplierId,
auto_rfq,
auto_po
]
);
};

export const executeSupplierWorkflow = async ({
businessId,
supplierId,
userId
}) => {

const workflow = await pool.query(
`     SELECT *
    FROM supplier_workflows
    WHERE supplier_id = $1
      AND business_id = $2
    `,
[supplierId, businessId]
);

if (!workflow.rows.length) return;

const rule = workflow.rows[0];
console.log(
  "AUTOMATION:",
  {
    businessId,
    supplierId,
    auto_rfq: rule.auto_rfq,
    auto_po: rule.auto_po
  }
);

if (rule.auto_rfq) {

  const rfqNumber =
  await generateDocumentNumber(
    businessId,
    "RFQ"
  );

  await pool.query(
    `
    INSERT INTO rfqs
    (
      business_id,
      supplier_id,
      rfq_number,
      total_amount,
      status,
      created_by
    )
    VALUES
    ($1,$2,$3,$4,$5,$6)
    `,
    [
      businessId,
      supplierId,
      rfqNumber,
      0,
      "draft",
      userId
    ]
  );
}

if (rule.auto_po) {

  console.log("AUTO PO STARTED");

  try {

    const poNumber =
  await generateDocumentNumber(
    businessId,
    "PO"
  );
    const result = await pool.query(
      `
      INSERT INTO purchase_orders
      (
        business_id,
        supplier_id,
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
        $1,$2,$3,$4,CURRENT_DATE,$5,$6,$7,$8,$9
      )
      RETURNING *
      `,
      [
        businessId,
        supplierId,
        poNumber,
        0,
        "draft",
        userId,
        0,
        0,
        0
      ]
    );

    console.log("PO CREATED", result.rows[0]);

  } catch (err) {

    console.error("AUTO PO ERROR");
    console.error(err);

  }
}
};
