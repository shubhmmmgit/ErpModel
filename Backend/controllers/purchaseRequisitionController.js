// controllers/purchaseRequisitionController.js
// FIXED: Uses req.user.userId; products stock lookup uses user_id column
import pool from "../config/db.js";
import { logActivity } from "./purchaseActivityController.js";

const genNumber = async (client, userId, prefix, table, col) => {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM ${table} WHERE user_id = $1 AND ${col} LIKE $2`,
    [userId, `${prefix}-${year}-%`]
  );
  return `${prefix}-${year}-${String(parseInt(rows[0].count) + 1).padStart(4, "0")}`;
};

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createPR = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { department, purpose, required_date, priority, notes, items } = req.body;

    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });
    for (const item of items) {
      if (!item.item_name?.trim()) return res.status(400).json({ error: "Each item must have a name" });
      if (!item.quantity || parseFloat(item.quantity) <= 0) return res.status(400).json({ error: "Quantity must be > 0" });
    }

    await client.query("BEGIN");
    const pr_number = await genNumber(client, userId, "PR", "purchase_requisitions", "pr_number");

    // Snapshot current stock (products.user_id matches)
    const enrichedItems = await Promise.all(items.map(async (item) => {
      let currentStock = 0;
      if (item.product_id) {
        const stockRes = await client.query(
          "SELECT stock FROM products WHERE id = $1 AND user_id = $2",
          [item.product_id, userId]
        );
        currentStock = stockRes.rows[0]?.stock || 0;
      }
      return { ...item, current_stock: currentStock };
    }));

    const totalAmount = enrichedItems.reduce(
      (sum, i) => sum + parseFloat(i.estimated_price || 0) * parseFloat(i.quantity), 0
    );

    const prResult = await client.query(
      `INSERT INTO purchase_requisitions
         (user_id, pr_number, requested_by, department, purpose,
          required_date, priority, notes, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
       RETURNING *`,
      [userId, pr_number, userId, department || null, purpose || null,
       required_date || null, priority || "normal", notes || null, totalAmount]
    );
    const pr = prResult.rows[0];

    for (const item of enrichedItems) {
      await client.query(
        `INSERT INTO purchase_requisition_items
           (pr_id, user_id, product_id, item_name, description,
            quantity, unit, estimated_price, current_stock)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [pr.id, userId, item.product_id || null, item.item_name.trim(),
         item.description || null, item.quantity, item.unit || "pcs",
         item.estimated_price || 0, item.current_stock]
      );
    }

    await client.query("COMMIT");
    await logActivity(userId, "pr", pr.id, "created", userId, { pr_number });

    const full = await getFullPR(pr.id, userId);
    res.status(201).json(full);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE PR ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ── LIST ──────────────────────────────────────────────────────────────────────
export const getPRs = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, priority, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ["pr.user_id = $1"];
    const params     = [userId];
    if (status)   { params.push(status);   conditions.push(`pr.status = $${params.length}`); }
    if (priority) { params.push(priority); conditions.push(`pr.priority = $${params.length}`); }

    const result = await pool.query(
      `SELECT pr.*, COUNT(pri.id) AS item_count
       FROM purchase_requisitions pr
       LEFT JOIN purchase_requisition_items pri ON pri.pr_id = pr.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY pr.id
       ORDER BY pr.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM purchase_requisitions pr WHERE ${conditions.join(" AND ")}`,
      params
    );

    res.json({ requisitions: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error("GET PRs ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET SINGLE ────────────────────────────────────────────────────────────────
export const getPRById = async (req, res) => {
  try {
    const full = await getFullPR(req.params.id, req.user.userId);
    if (!full) return res.status(404).json({ error: "Requisition not found" });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
export const approvePR = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const pr = await pool.query(
      "SELECT * FROM purchase_requisitions WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (!pr.rows.length) return res.status(404).json({ error: "Requisition not found" });
    if (pr.rows[0].status !== "pending") {
      return res.status(400).json({ error: `Cannot approve PR with status: ${pr.rows[0].status}` });
    }

    await pool.query(
      `UPDATE purchase_requisitions
       SET status = 'approved', approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [userId, id, userId]
    );
    await logActivity(userId, "pr", id, "approved", userId, {});
    res.json({ message: "Requisition approved" });
  } catch (err) {
    console.error("APPROVE PR ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── REJECT ────────────────────────────────────────────────────────────────────
export const rejectPR = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { rejection_reason } = req.body;

    const pr = await pool.query(
      "SELECT * FROM purchase_requisitions WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (!pr.rows.length) return res.status(404).json({ error: "Requisition not found" });
    if (!["pending", "approved"].includes(pr.rows[0].status)) {
      return res.status(400).json({ error: `Cannot reject PR with status: ${pr.rows[0].status}` });
    }

    await pool.query(
      `UPDATE purchase_requisitions
       SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [rejection_reason || null, id, userId]
    );
    await logActivity(userId, "pr", id, "rejected", userId, { rejection_reason });
    res.json({ message: "Requisition rejected" });
  } catch (err) {
    console.error("REJECT PR ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── HELPER ────────────────────────────────────────────────────────────────────
const getFullPR = async (id, userId) => {
  const prRes = await pool.query(
    "SELECT * FROM purchase_requisitions WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (!prRes.rows.length) return null;
  const pr = prRes.rows[0];
  const itemsRes = await pool.query(
    "SELECT * FROM purchase_requisition_items WHERE pr_id = $1 ORDER BY id",
    [id]
  );
  pr.items = itemsRes.rows;
  return pr;
};
