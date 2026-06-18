
import pool from "../config/db.js";
import { logActivity } from "./purchaseActivityController.js";

const genNumber = async (client, businessId, prefix, table, col) => {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM ${table} WHERE business_id = $1 AND ${col} LIKE $2`,
    [businessId, `${prefix}-${year}-%`]
  );
  return `${prefix}-${year}-${String(parseInt(rows[0].count) + 1).padStart(4, "0")}`;
};

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createPO = async (req, res) => {
  const client = await pool.connect();
  try {
    const {businessId} = req.user;
    const {
      pr_id, rfq_id, supplier_id, delivery_date,
      payment_terms, shipping_address, notes, items, discount_amount,
    } = req.body;
let finalSupplierId = supplier_id;

if (!finalSupplierId && rfq_id) {
  const rfqSupp = await client.query(
    `
    SELECT supplier_id
    FROM rfq_suppliers
    WHERE rfq_id = $1
    LIMIT 1
    `,
    [rfq_id]
  );

  if (!rfqSupp.rows.length) {
    return res.status(400).json({
      error: "No supplier linked to RFQ"
    });
  }

  finalSupplierId = rfqSupp.rows[0].supplier_id;
}

if (!finalSupplierId) {
  return res.status(400).json({
    error: "Supplier is required"
  });
}

const suppCheck = await client.query(
  `
  SELECT id
  FROM suppliers
  WHERE id = $1
    AND business_id = $2
    AND status = 'active'
  `,
  [finalSupplierId, businessId]
);

if (!suppCheck.rows.length) {
  return res.status(400).json({
    error: "Supplier not found or inactive"
  });
}
    for (const item of items) {
      if (!item.item_name?.trim()) return res.status(400).json({ error: "Each item needs a name" });
      if (!item.quantity || parseFloat(item.quantity) <= 0) return res.status(400).json({ error: "Quantity must be > 0" });
    }

    await client.query("BEGIN");
    const po_number = await genNumber(client, businessId, "PO", "purchase_orders", "po_number");

    let subtotal = 0;
    const enrichedItems = items.map(item => {
      const qty      = parseFloat(item.quantity);
      const price    = parseFloat(item.unit_price    || 0);
      const taxPct   = parseFloat(item.tax_percent   || 0);
      const discPct  = parseFloat(item.discount_percent || 0);
      const lineTotal = qty * price * (1 + taxPct / 100) * (1 - discPct / 100);
      subtotal += lineTotal;
      return { ...item, total_price: lineTotal };
    });

    const taxAmount      = items.reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.unit_price || 0) * parseFloat(i.tax_percent || 0) / 100, 0);
    const discountAmt    = parseFloat(discount_amount || 0);
    const totalAmount    = subtotal - discountAmt;

    const poResult = await client.query(
      `INSERT INTO purchase_orders
         (business_id, po_number, pr_id, rfq_id, supplier_id, created_by,
          delivery_date, payment_terms, shipping_address, notes,
          subtotal, tax_amount, discount_amount, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'sent')
       RETURNING *`,
      [businessId, po_number, pr_id || null, rfq_id || null,   finalSupplierId,businessId,
       delivery_date || null, payment_terms || null, shipping_address || null, notes || null,
       subtotal, taxAmount, discountAmt, totalAmount]
    );
    const po = poResult.rows[0];

    for (const item of enrichedItems) {
      await client.query(
        `INSERT INTO purchase_order_items
           (po_id, business_id, product_id, item_name, description,
            quantity, unit, unit_price, tax_percent, discount_percent, total_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [po.id, businessId, item.product_id || null, item.item_name.trim(),
         item.description || null, item.quantity, item.unit || "pcs",
         item.unit_price || 0, item.tax_percent || 0, item.discount_percent || 0, item.total_price]
      );
    }

    if (pr_id) {
      await client.query(
        "UPDATE purchase_requisitions SET status = 'ordered', updated_at = NOW() WHERE id = $1 AND business_id = $2",
        [pr_id, businessId]
      );
    }

    await client.query(
      "UPDATE suppliers SET total_orders = total_orders + 1, updated_at = NOW() WHERE id = $1 AND business_id = $2",
      [  finalSupplierId, businessId]
    );

    await client.query("COMMIT");
    await logActivity(
  businessId,
  "po",
  po.id,
  "created",
  businessId,
  {
    po_number,
    supplier_id: finalSupplierId
  }
);

    const full = await getFullPO(po.id, businessId);
    res.status(201).json(full);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE PO ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ── LIST ──────────────────────────────────────────────────────────────────────
export const getPOs = async (req, res) => {
  try {
    const {businessId} = req.user;
    const { status, supplier_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ["po.business_id = $1"];
    const params     = [businessId];
    if (status)      { params.push(status);               conditions.push(`po.status = $${params.length}`); }
    if (supplier_id) { params.push(parseInt(supplier_id)); conditions.push(`po.supplier_id = $${params.length}`); }

    const result = await pool.query(
      `SELECT po.*, s.name AS supplier_name, COUNT(poi.id) AS item_count
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY po.id, s.name
       ORDER BY po.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM purchase_orders po WHERE ${conditions.join(" AND ")}`, params
    );

    res.json({ orders: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error("GET POs ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET SINGLE ────────────────────────────────────────────────────────────────
export const getPOById = async (req, res) => {
  try {
    const full = await getFullPO(req.params.id, req.user.businessId);
    if (!full) return res.status(404).json({ error: "Purchase order not found" });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
export const updatePOStatus = async (req, res) => {
  try {
    const {businessId} = req.user;
    const { id } = req.params;
    const { status } = req.body;

    const VALID = ["draft","sent","confirmed","partially_received","received","cancelled","closed"];
    if (!VALID.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid values: ${VALID.join(", ")}` });
    }

    const po = await pool.query(
      "SELECT * FROM purchase_orders WHERE id = $1 AND business_id = $2", [id, businessId]
    );
    if (!po.rows.length) return res.status(404).json({ error: "Purchase order not found" });
    if (["cancelled","closed"].includes(po.rows[0].status)) {
      return res.status(400).json({ error: `Cannot update a ${po.rows[0].status} PO` });
    }

    await pool.query(
      "UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3",
      [status, id, businessId]
    );
    await logActivity(businessId, "po", id, `status_${status}`, businessId, {});
    res.json({ message: "Status updated", id, status });
  } catch (err) {
    console.error("UPDATE PO STATUS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── HELPER ────────────────────────────────────────────────────────────────────
const getFullPO = async (id, businessId) => {
  const poRes = await pool.query(
    `SELECT po.*, s.name AS supplier_name, s.email AS supplier_email, s.phone AS supplier_phone
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.id = $1 AND po.business_id = $2`,
    [id, businessId]
  );
  if (!poRes.rows.length) return null;
  const po = poRes.rows[0];
  const itemsRes = await pool.query("SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY id", [id]);
  po.items = itemsRes.rows;
  return po;
};
