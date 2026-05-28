// controllers/purchaseRequisitionController.js
import pool from "../config/db.js";
import { logActivity } from "./purchaseActivityController.js";

// ── Sequence number helper ───────────────────────────────────
const generateNumber = async (client, businessId, prefix, table, col) => {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM ${table} WHERE business_id=$1 AND ${col} LIKE $2`,
    [businessId, `${prefix}-${year}-%`]
  );
  return `${prefix}-${year}-${String(parseInt(rows[0].count) + 1).padStart(4, "0")}`;
};

// ── CREATE PR ────────────────────────────────────────────────
export const createPR = async (req, res) => {
  const client = await pool.connect();
  try {
    const { businessId, userId } = req.user;
    const { department, purpose, required_date, priority, notes, items } = req.body;

    if (!items?.length) {
      return res.status(400).json({ error: "At least one item is required" });
    }
    for (const item of items) {
      if (!item.item_name?.trim()) return res.status(400).json({ error: "Each item must have a name" });
      if (!item.quantity || item.quantity <= 0) return res.status(400).json({ error: "Quantity must be > 0" });
    }

    await client.query("BEGIN");

    const pr_number = await generateNumber(client, businessId, "PR", "purchase_requisitions", "pr_number");

    // Snapshot current stock for each product item
    const enrichedItems = await Promise.all(items.map(async (item) => {
      let currentStock = 0;
      if (item.product_id) {
        const stockRes = await client.query(
          "SELECT stock FROM products WHERE id=$1 AND user_id=$2",
          [item.product_id, businessId]
        );
        currentStock = stockRes.rows[0]?.stock || 0;
      }
      return { ...item, current_stock: currentStock };
    }));

    const totalAmount = enrichedItems.reduce(
      (sum, i) => sum + (parseFloat(i.estimated_price || 0) * parseFloat(i.quantity)), 0
    );

    const prResult = await client.query(
      `INSERT INTO purchase_requisitions
         (business_id, pr_number, requested_by, department, purpose, required_date, priority, notes, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
       RETURNING *`,
      [businessId, pr_number, userId, department||null, purpose||null,
       required_date||null, priority||'normal', notes||null, totalAmount]
    );
    const pr = prResult.rows[0];

    for (const item of enrichedItems) {
      await client.query(
        `INSERT INTO purchase_requisition_items
           (pr_id, business_id, product_id, item_name, description, quantity, unit, estimated_price, current_stock)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [pr.id, businessId, item.product_id||null, item.item_name.trim(),
         item.description||null, item.quantity, item.unit||'pcs',
         item.estimated_price||0, item.current_stock]
      );
    }

    await client.query("COMMIT");
    await logActivity(businessId, 'pr', pr.id, 'created', userId, { pr_number });

    const full = await getFullPR(pr.id, businessId);
    res.status(201).json(full);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE PR ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ── LIST PRs ─────────────────────────────────────────────────
export const getPRs = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { status, priority, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = ["pr.business_id = $1"];
    const params = [businessId];

    if (status) { params.push(status); conditions.push(`pr.status = $${params.length}`); }
    if (priority) { params.push(priority); conditions.push(`pr.priority = $${params.length}`); }

    const where = conditions.join(" AND ");
    const result = await pool.query(
      `SELECT pr.*,
              u.name AS requested_by_name,
              COUNT(pri.id) AS item_count
       FROM purchase_requisitions pr
       LEFT JOIN users u ON u.id = pr.requested_by
       LEFT JOIN purchase_requisition_items pri ON pri.pr_id = pr.id
       WHERE ${where}
       GROUP BY pr.id, u.name
       ORDER BY pr.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM purchase_requisitions pr WHERE ${where}`,
      params
    );

    res.json({
      requisitions: result.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error("GET PRs ERROR:", err);
    res.status(500).json({ error: "Failed to fetch requisitions" });
  }
};

// ── GET SINGLE PR ────────────────────────────────────────────
export const getPRById = async (req, res) => {
  try {
    const { businessId } = req.user;
    const full = await getFullPR(req.params.id, businessId);
    if (!full) return res.status(404).json({ error: "Requisition not found" });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch requisition" });
  }
};

// ── APPROVE PR ───────────────────────────────────────────────
export const approvePR = async (req, res) => {
  try {
    const { businessId, userId } = req.user;
    const { id } = req.params;

    const pr = await getPRForBusiness(id, businessId);
    if (!pr) return res.status(404).json({ error: "Requisition not found" });
    if (pr.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve a PR with status: ${pr.status}` });
    }

    await pool.query(
      "UPDATE purchase_requisitions SET status='approved', approved_by=$1, updated_at=NOW() WHERE id=$2 AND business_id=$3",
      [userId, id, businessId]
    );

    await logActivity(businessId, 'pr', id, 'approved', userId, {});
    res.json({ message: "Requisition approved", id });
  } catch (err) {
    console.error("APPROVE PR ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── REJECT PR ────────────────────────────────────────────────
export const rejectPR = async (req, res) => {
  try {
    const { businessId, userId } = req.user;
    const { id } = req.params;
    const { rejection_reason } = req.body;

    const pr = await getPRForBusiness(id, businessId);
    if (!pr) return res.status(404).json({ error: "Requisition not found" });
    if (!['pending','approved'].includes(pr.status)) {
      return res.status(400).json({ error: `Cannot reject a PR with status: ${pr.status}` });
    }

    await pool.query(
      "UPDATE purchase_requisitions SET status='rejected', rejection_reason=$1, updated_at=NOW() WHERE id=$2 AND business_id=$3",
      [rejection_reason||null, id, businessId]
    );

    await logActivity(businessId, 'pr', id, 'rejected', userId, { rejection_reason });
    res.json({ message: "Requisition rejected", id });
  } catch (err) {
    console.error("REJECT PR ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── HELPERS ──────────────────────────────────────────────────
const getPRForBusiness = async (id, businessId) => {
  const r = await pool.query(
    "SELECT * FROM purchase_requisitions WHERE id=$1 AND business_id=$2",
    [id, businessId]
  );
  return r.rows[0] || null;
};

const getFullPR = async (id, businessId) => {
  const prRes = await pool.query(
    `SELECT pr.*, u.name AS requested_by_name, a.name AS approved_by_name
     FROM purchase_requisitions pr
     LEFT JOIN users u ON u.id = pr.requested_by
     LEFT JOIN users a ON a.id = pr.approved_by
     WHERE pr.id=$1 AND pr.business_id=$2`,
    [id, businessId]
  );
  if (!prRes.rows.length) return null;
  const pr = prRes.rows[0];

  const itemsRes = await pool.query(
    "SELECT * FROM purchase_requisition_items WHERE pr_id=$1 ORDER BY id",
    [id]
  );
  pr.items = itemsRes.rows;
  return pr;
};
