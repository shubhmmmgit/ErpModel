
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

export const createGRN = async (req, res) => {
  const client = await pool.connect();
  try {
    const {businessId} = req.user;
    const { po_id, receipt_date, quality_notes, notes, items } = req.body;

    if (!po_id) return res.status(400).json({ error: "Purchase Order is required" });
    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });

    const poCheck = await client.query(
      "SELECT * FROM purchase_orders WHERE id = $1 AND business_id = $2", [po_id, businessId]
    );
    if (!poCheck.rows.length) return res.status(404).json({ error: "Purchase Order not found" });

    const po = poCheck.rows[0];
    if (!["sent","confirmed","partially_received"].includes(po.status)) {
      return res.status(400).json({ error: `Cannot receive against PO with status: ${po.status}` });
    }

    for (const item of items) {
      if (!item.item_name?.trim()) return res.status(400).json({ error: "Each item needs a name" });
      if (parseFloat(item.accepted_qty || 0) > parseFloat(item.received_qty || 0)) {
        return res.status(400).json({ error: "Accepted qty cannot exceed received qty" });
      }
    }

    await client.query("BEGIN");
    const grn_number = await genNumber(client, businessId, "GRN", "goods_receipts", "grn_number");

    const totalReceived = items.reduce(
      (s, i) => s + parseFloat(i.accepted_qty || 0) * parseFloat(i.unit_price || 0), 0
    );

    const grnResult = await client.query(
      `INSERT INTO goods_receipts
         (business_id, grn_number, po_id, supplier_id, received_by,
          receipt_date, quality_notes, notes, total_received, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'accepted')
       RETURNING *`,
      [businessId, grn_number, po_id, po.supplier_id, businessId,
       receipt_date || new Date().toISOString().split("T")[0],
       quality_notes || null, notes || null, totalReceived]
    );
    const grn = grnResult.rows[0];

    let allFullyReceived = true;

    for (const item of items) {
      const receivedQty = parseFloat(item.received_qty || 0);
      const acceptedQty = parseFloat(item.accepted_qty || 0);
      const rejectedQty = receivedQty - acceptedQty;
      const qualityStatus = acceptedQty === 0 ? "rejected" : rejectedQty > 0 ? "partial" : "accepted";

      await client.query(
        `INSERT INTO goods_receipt_items
           (grn_id, business_id, po_item_id, product_id, item_name,
            ordered_qty, received_qty, accepted_qty, rejected_qty,
            unit, unit_price, quality_status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [grn.id, businessId, item.po_item_id || null, item.product_id || null,
         item.item_name.trim(), item.ordered_qty || 0, receivedQty, acceptedQty, rejectedQty,
         item.unit || "pcs", item.unit_price || 0, qualityStatus, item.notes || null]
      );

      // ── INVENTORY: increase stock 
      if (acceptedQty > 0 && item.product_id) {
        await client.query(
          "UPDATE products SET stock = stock + $1 WHERE id = $2 AND business_id = $3",
          [acceptedQty, item.product_id, businessId]
        );
      }

      if (item.po_item_id) {
        await client.query(
          "UPDATE purchase_order_items SET received_qty = received_qty + $1 WHERE id = $2 AND po_id = $3",
          [acceptedQty, item.po_item_id, po_id]
        );
        const poItem = await client.query(
          "SELECT quantity, received_qty FROM purchase_order_items WHERE id = $1", [item.po_item_id]
        );
        if (poItem.rows[0] && parseFloat(poItem.rows[0].received_qty) < parseFloat(poItem.rows[0].quantity)) {
          allFullyReceived = false;
        }
      } else {
        allFullyReceived = false;
      }
    }

    await client.query(
      "UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3",
      [allFullyReceived ? "received" : "partially_received", po_id, businessId]
    );

    await client.query("COMMIT");
    await logActivity(businessId, "grn", grn.id, "created", businessId, { grn_number, po_id });

    const full = await getFullGRN(grn.id, businessId);
    res.status(201).json(full);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE GRN ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getGRNs = async (req, res) => {
  try {
    const {businessId} = req.user;
    const { status, po_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ["g.business_id = $1"];
    const params     = [businessId];
    if (status) { params.push(status);          conditions.push(`g.status = $${params.length}`); }
    if (po_id)  { params.push(parseInt(po_id)); conditions.push(`g.po_id = $${params.length}`); }

    const result = await pool.query(
      `SELECT g.*, s.name AS supplier_name, po.po_number, COUNT(gi.id) AS item_count
       FROM goods_receipts g
       LEFT JOIN suppliers s        ON s.id  = g.supplier_id
       LEFT JOIN purchase_orders po ON po.id = g.po_id
       LEFT JOIN goods_receipt_items gi ON gi.grn_id = g.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY g.id, s.name, po.po_number
       ORDER BY g.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    res.json({ receipts: result.rows });
  } catch (err) {
    console.error("GET GRNs ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getGRNById = async (req, res) => {
  try {
    const full = await getFullGRN(req.params.id, req.user.businessId);
    if (!full) return res.status(404).json({ error: "GRN not found" });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getFullGRN = async (id, businessId) => {
  const grnRes = await pool.query(
    `SELECT g.*, s.name AS supplier_name, po.po_number
     FROM goods_receipts g
     LEFT JOIN suppliers s ON s.id = g.supplier_id
     LEFT JOIN purchase_orders po ON po.id = g.po_id
     WHERE g.id = $1 AND g.business_id = $2`,
    [id, businessId]
  );
  if (!grnRes.rows.length) return null;
  const grn = grnRes.rows[0];
  const itemsRes = await pool.query("SELECT * FROM goods_receipt_items WHERE grn_id = $1 ORDER BY id", [id]);
  grn.items = itemsRes.rows;
  return grn;
};
