// controllers/purchaseOrderController.js
import pool from "../config/db.js";
import { logActivity } from "./purchaseActivityController.js";

const generateNumber = async (client, businessId, prefix, table, col) => {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM ${table} WHERE business_id=$1 AND ${col} LIKE $2`,
    [businessId, `${prefix}-${year}-%`]
  );
  return `${prefix}-${year}-${String(parseInt(rows[0].count) + 1).padStart(4, "0")}`;
};

// ── CREATE PO ────────────────────────────────────────────────
export const createPO = async (req, res) => {
  const client = await pool.connect();
  try {
    const { businessId, userId } = req.user;
    const {
      pr_id, rfq_id, supplier_id, delivery_date, payment_terms,
      shipping_address, notes, items
    } = req.body;

    if (!supplier_id) return res.status(400).json({ error: "Supplier is required" });
    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });

    // Validate supplier
    const suppCheck = await client.query(
      "SELECT id FROM suppliers WHERE id=$1 AND business_id=$2 AND status='active'",
      [supplier_id, businessId]
    );
    if (!suppCheck.rows.length) return res.status(400).json({ error: "Supplier not found" });

    // Validate items
    for (const item of items) {
      if (!item.item_name?.trim()) return res.status(400).json({ error: "Each item needs a name" });
      if (!item.quantity || item.quantity <= 0) return res.status(400).json({ error: "Quantity must be > 0" });
      if (item.unit_price < 0) return res.status(400).json({ error: "Unit price cannot be negative" });
    }

    await client.query("BEGIN");
    const po_number = await generateNumber(client, businessId, "PO", "purchase_orders", "po_number");

    // Calculate totals
    let subtotal = 0;
    const enrichedItems = items.map(item => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unit_price || 0);
      const taxPct = parseFloat(item.tax_percent || 0);
      const discPct = parseFloat(item.discount_percent || 0);
      const lineTotal = qty * price * (1 + taxPct / 100) * (1 - discPct / 100);
      subtotal += lineTotal;
      return { ...item, total_price: lineTotal };
    });

    const taxAmount = items.reduce((s, i) => {
      const qty = parseFloat(i.quantity);
      const price = parseFloat(i.unit_price || 0);
      return s + qty * price * parseFloat(i.tax_percent || 0) / 100;
    }, 0);
    const discountAmount = parseFloat(req.body.discount_amount || 0);
    const totalAmount = subtotal - discountAmount;

    const poResult = await client.query(
      `INSERT INTO purchase_orders
         (business_id, po_number, pr_id, rfq_id, supplier_id, created_by,
          delivery_date, payment_terms, shipping_address, notes,
          subtotal, tax_amount, discount_amount, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'sent')
       RETURNING *`,
      [businessId, po_number, pr_id||null, rfq_id||null, supplier_id, userId,
       delivery_date||null, payment_terms||null, shipping_address||null, notes||null,
       subtotal, taxAmount, discountAmount, totalAmount]
    );
    const po = poResult.rows[0];

    for (const item of enrichedItems) {
      await client.query(
        `INSERT INTO purchase_order_items
           (po_id, business_id, product_id, item_name, description, quantity,
            unit, unit_price, tax_percent, discount_percent, total_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [po.id, businessId, item.product_id||null, item.item_name.trim(),
         item.description||null, item.quantity, item.unit||'pcs',
         item.unit_price||0, item.tax_percent||0, item.discount_percent||0, item.total_price]
      );
    }

    // Mark PR as ordered if linked
    if (pr_id) {
      await client.query(
        "UPDATE purchase_requisitions SET status='ordered', updated_at=NOW() WHERE id=$1 AND business_id=$2",
        [pr_id, businessId]
      );
    }

    // Update supplier's total_orders count
    await client.query(
      "UPDATE suppliers SET total_orders=total_orders+1, updated_at=NOW() WHERE id=$1",
      [supplier_id]
    );

    await client.query("COMMIT");
    await logActivity(businessId, 'po', po.id, 'created', userId, { po_number, supplier_id });

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

// ── LIST POs ─────────────────────────────────────────────────
export const getPOs = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { status, supplier_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = ["po.business_id = $1"];
    const params = [businessId];
    if (status) { params.push(status); conditions.push(`po.status = $${params.length}`); }
    if (supplier_id) { params.push(parseInt(supplier_id)); conditions.push(`po.supplier_id = $${params.length}`); }

    const where = conditions.join(" AND ");
    const result = await pool.query(
      `SELECT po.*, s.name AS supplier_name, u.name AS created_by_name,
              COUNT(poi.id) AS item_count
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN users u ON u.id = po.created_by
       LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
       WHERE ${where}
       GROUP BY po.id, s.name, u.name
       ORDER BY po.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM purchase_orders po WHERE ${where}`, params
    );

    res.json({ orders: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error("GET POs ERROR:", err);
    res.status(500).json({ error: "Failed to fetch purchase orders" });
  }
};

// ── GET SINGLE PO ────────────────────────────────────────────
export const getPOById = async (req, res) => {
  try {
    const { businessId } = req.user;
    const full = await getFullPO(req.params.id, businessId);
    if (!full) return res.status(404).json({ error: "Purchase order not found" });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch purchase order" });
  }
};

// ── UPDATE STATUS ────────────────────────────────────────────
export const updatePOStatus = async (req, res) => {
  try {
    const { businessId, userId } = req.user;
    const { id } = req.params;
    const { status } = req.body;

    const VALID = ['draft','sent','confirmed','partially_received','received','cancelled','closed'];
    if (!VALID.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID.join(', ')}` });
    }

    const po = await pool.query(
      "SELECT * FROM purchase_orders WHERE id=$1 AND business_id=$2",
      [id, businessId]
    );
    if (!po.rows.length) return res.status(404).json({ error: "Purchase order not found" });
    if (['cancelled','closed'].includes(po.rows[0].status)) {
      return res.status(400).json({ error: `Cannot update a ${po.rows[0].status} PO` });
    }

    await pool.query(
      "UPDATE purchase_orders SET status=$1, updated_at=NOW() WHERE id=$2 AND business_id=$3",
      [status, id, businessId]
    );

    await logActivity(businessId, 'po', id, `status_${status}`, userId, {});
    res.json({ message: "Status updated", id, status });
  } catch (err) {
    console.error("UPDATE PO STATUS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── HELPER ───────────────────────────────────────────────────
const getFullPO = async (id, businessId) => {
  const poRes = await pool.query(
    `SELECT po.*, s.name AS supplier_name, s.email AS supplier_email,
            s.phone AS supplier_phone, u.name AS created_by_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users u ON u.id = po.created_by
     WHERE po.id=$1 AND po.business_id=$2`,
    [id, businessId]
  );
  if (!poRes.rows.length) return null;
  const po = poRes.rows[0];

  const itemsRes = await pool.query(
    "SELECT * FROM purchase_order_items WHERE po_id=$1 ORDER BY id",
    [id]
  );
  po.items = itemsRes.rows;
  return po;
};