
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

// ═══════════════════════════════════════════════════════════════════════════
//  INVOICE
// ═══════════════════════════════════════════════════════════════════════════
export const createInvoice = async (req, res) => {
  const client = await pool.connect();
  try {
    const {businessId} = req.user;
    const {
      invoice_number, po_id, grn_id, supplier_id,
      invoice_date, due_date, subtotal, tax_amount,
      discount_amount, total_amount, notes,
    } = req.body;

    if (!supplier_id)    return res.status(400).json({ error: "Supplier is required" });
    if (!invoice_number?.trim()) return res.status(400).json({ error: "Invoice number is required" });
    if (!total_amount || parseFloat(total_amount) <= 0) return res.status(400).json({ error: "Total amount must be > 0" });

    const suppCheck = await client.query(
      "SELECT id FROM suppliers WHERE id = $1 AND business_id = $2", [supplier_id, businessId]
    );
    if (!suppCheck.rows.length) return res.status(400).json({ error: "Supplier not found" });

    if (po_id) {
      const poCheck = await client.query(
        "SELECT id FROM purchase_orders WHERE id = $1 AND business_id = $2", [po_id, businessId]
      );
      if (!poCheck.rows.length) return res.status(400).json({ error: "Purchase Order not found" });
    }

    await client.query("BEGIN");
    const internal_ref = await genNumber(client, businessId, "INV", "purchase_invoices", "internal_ref");

    const result = await client.query(
      `INSERT INTO purchase_invoices
         (business_id, invoice_number, internal_ref, po_id, grn_id, supplier_id,
          created_by, invoice_date, due_date, subtotal, tax_amount, discount_amount,
          total_amount, balance_due, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,'pending')
       RETURNING *`,
      [businessId, invoice_number.trim(), internal_ref, po_id || null, grn_id || null,
       supplier_id, businessId, invoice_date || new Date().toISOString().split("T")[0],
       due_date || null, subtotal || 0, tax_amount || 0, discount_amount || 0,
       total_amount, notes || null]
    );

    await client.query("COMMIT");
    await logActivity(businessId, "invoice", result.rows[0].id, "created", businessId, { internal_ref });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE INVOICE ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getInvoices = async (req, res) => {
  try {
    const {businessId} = req.user;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ["i.business_id = $1"];
    const params     = [businessId];
    if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }

    const result = await pool.query(
      `SELECT i.*, s.name AS supplier_name, po.po_number
       FROM purchase_invoices i
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       LEFT JOIN purchase_orders po ON po.id = i.po_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY i.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM purchase_invoices i WHERE ${conditions.join(" AND ")}`, params
    );
    res.json({ invoices: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error("GET INVOICES ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const {businessId} = req.user;
    const result = await pool.query(
      `SELECT i.*, s.name AS supplier_name, po.po_number
       FROM purchase_invoices i
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       LEFT JOIN purchase_orders po ON po.id = i.po_id
       WHERE i.id = $1 AND i.business_id = $2`,
      [req.params.id, businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Invoice not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const recordPayment = async (req, res) => {
  try {
    const {businessId} = req.user;
    const { id } = req.params;
    const { paid_amount, payment_method, payment_date } = req.body;

    if (!paid_amount || parseFloat(paid_amount) <= 0) {
      return res.status(400).json({ error: "Payment amount must be > 0" });
    }

    const inv = await pool.query(
      "SELECT * FROM purchase_invoices WHERE id = $1 AND business_id = $2", [id, businessId]
    );
    if (!inv.rows.length) return res.status(404).json({ error: "Invoice not found" });
    if (inv.rows[0].status === "paid") return res.status(400).json({ error: "Invoice already fully paid" });

    const newPaid   = parseFloat(inv.rows[0].paid_amount) + parseFloat(paid_amount);
    const balance   = Math.max(0, parseFloat(inv.rows[0].total_amount) - newPaid);
    const newStatus = balance <= 0 ? "paid" : "partially_paid";

    await pool.query(
      `UPDATE purchase_invoices
       SET paid_amount=$1, balance_due=$2, status=$3,
           payment_method=$4, payment_date=$5, updated_at=NOW()
       WHERE id=$6 AND business_id=$7`,
      [newPaid, balance, newStatus, payment_method || null,
       payment_date || new Date().toISOString().split("T")[0], id, businessId]
    );

    await logActivity(businessId, "invoice", id, "payment_recorded", businessId, { paid_amount, newStatus });
    res.json({ message: "Payment recorded", status: newStatus, balance_due: balance });
  } catch (err) {
    console.error("RECORD PAYMENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//  PURCHASE RETURN
// ═══════════════════════════════════════════════════════════════════════════
export const createReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    const {businessId} = req.user;
    const { po_id, grn_id, supplier_id, return_date, reason, notes, items } = req.body;

    if (!supplier_id) return res.status(400).json({ error: "Supplier is required" });
    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });
    for (const item of items) {
      if (!item.item_name?.trim()) return res.status(400).json({ error: "Each item needs a name" });
      if (!item.return_qty || parseFloat(item.return_qty) <= 0) return res.status(400).json({ error: "Return qty must be > 0" });
    }

    const suppCheck = await client.query(
      "SELECT id FROM suppliers WHERE id = $1 AND business_id = $2", [supplier_id, businessId]
    );
    if (!suppCheck.rows.length) return res.status(400).json({ error: "Supplier not found" });

    await client.query("BEGIN");
    const year = new Date().getFullYear();
    const { rows } = await client.query(
      "SELECT COUNT(*) FROM purchase_returns WHERE business_id = $1 AND return_number LIKE $2",
      [businessId, `RTN-${year}-%`]
    );
    const return_number = `RTN-${year}-${String(parseInt(rows[0].count) + 1).padStart(4, "0")}`;
    const totalAmount   = items.reduce((s, i) => s + parseFloat(i.return_qty) * parseFloat(i.unit_price || 0), 0);

    const retResult = await client.query(
      `INSERT INTO purchase_returns
         (business_id, return_number, po_id, grn_id, supplier_id, created_by,
          return_date, reason, notes, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
       RETURNING *`,
      [businessId, return_number, po_id || null, grn_id || null, supplier_id, businessId,
       return_date || new Date().toISOString().split("T")[0], reason || null, notes || null, totalAmount]
    );
    const ret = retResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_return_items
           (return_id, business_id, product_id, item_name, return_qty, unit, unit_price, total_price, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [ret.id, businessId, item.product_id || null, item.item_name.trim(),
         item.return_qty, item.unit || "pcs", item.unit_price || 0,
         parseFloat(item.return_qty) * parseFloat(item.unit_price || 0), item.reason || null]
      );

      // ── INVENTORY: decrease stock on return ───────────────────────────────
      if (item.product_id) {
        await client.query(
          "UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2 AND business_id = $3",
          [item.return_qty, item.product_id, businessId]
        );
      }
    }

    await client.query(
      "UPDATE suppliers SET total_returns = total_returns + 1, updated_at = NOW() WHERE id = $1 AND business_id = $2",
      [supplier_id, businessId]
    );

    await client.query("COMMIT");
    await logActivity(businessId, "return", ret.id, "created", businessId, { return_number });
    res.status(201).json(ret);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE RETURN ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getReturns = async (req, res) => {
  try {
    const {businessId} = req.user;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ["r.business_id = $1"];
    const params     = [businessId];
    if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }

    const result = await pool.query(
      `SELECT r.*, s.name AS supplier_name, po.po_number
       FROM purchase_returns r
       LEFT JOIN suppliers s ON s.id = r.supplier_id
       LEFT JOIN purchase_orders po ON po.id = r.po_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM purchase_returns r WHERE ${conditions.join(" AND ")}`, params
    );
    res.json({ returns: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error("GET RETURNS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateReturnStatus = async (req, res) => {
  try {
    const {businessId} = req.user;
    const { id } = req.params;
    const { status } = req.body;

    const VALID = ["draft","pending","approved","shipped","completed","cancelled"];
    if (!VALID.includes(status)) return res.status(400).json({ error: `Invalid status. Valid: ${VALID.join(", ")}` });

    const existing = await pool.query(
      "SELECT id FROM purchase_returns WHERE id = $1 AND business_id = $2", [id, businessId]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Return not found" });

    await pool.query(
      "UPDATE purchase_returns SET status = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3",
      [status, id, businessId]
    );
    await logActivity(businessId, "return", id, `status_${status}`, businessId, {});
    res.json({ message: "Return status updated", id, status });
  } catch (err) {
    console.error("UPDATE RETURN STATUS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
