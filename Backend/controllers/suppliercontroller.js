// controllers/supplierController.js
// ─────────────────────────────────────────────────────────────────────────────
//  FIXED:
//  1. Uses req.user.userId (not businessId)
//  2. FIXED "missing FROM-clause entry for table s" — the subquery that
//     referenced `s.user_id` and `s.id` inside a correlated subquery without
//     a table alias was broken. Now uses simple scalar subqueries correctly.
//  3. All queries scoped by user_id (multi-tenant security maintained)
// ─────────────────────────────────────────────────────────────────────────────
import pool from "../config/db.js";
import { logActivity } from "./purchaseActivityController.js";

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createSupplier = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name, email, phone, address, city, country,
      gstin, payment_terms, lead_time_days, notes,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Supplier name is required" });
    }

    // Duplicate name check (within this tenant only)
    const dup = await pool.query(
      `SELECT id FROM suppliers
       WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND status <> 'inactive'`,
      [userId, name.trim()]
    );
    if (dup.rows.length) {
      return res.status(409).json({ error: "A supplier with this name already exists" });
    }

    const result = await pool.query(
      `INSERT INTO suppliers
         (user_id, name, email, phone, address, city, country,
          gstin, payment_terms, lead_time_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        userId, name.trim(), email || null, phone || null, address || null,
        city || null, country || null, gstin || null,
        payment_terms || null, lead_time_days || 0, notes || null,
      ]
    );

    await logActivity(userId, "supplier", result.rows[0].id, "created", userId, { name: name.trim() });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE SUPPLIER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── LIST ──────────────────────────────────────────────────────────────────────
// FIXED: was using `s.` alias inside a subquery that wasn't scoped to the outer
// query's FROM clause. Now uses clean correlated subqueries with explicit ids.
export const getSuppliers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build dynamic WHERE clause
    const conditions = ["user_id = $1"];
    const params     = [userId];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    const where = conditions.join(" AND ");

    // Simple flat query — no broken subquery aliases
    const result = await pool.query(
      `SELECT *
       FROM suppliers
       WHERE ${where}
       ORDER BY name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    // Enrich with PO stats in a separate safe query
    const ids = result.rows.map(r => r.id);
    let poStats = {};
    if (ids.length) {
      const statsRes = await pool.query(
        `SELECT
           supplier_id,
           COUNT(*)                                                                 AS total_pos,
           COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled'), 0)     AS total_purchase_value
         FROM purchase_orders
         WHERE supplier_id = ANY($1::int[])
           AND user_id     = $2
         GROUP BY supplier_id`,
        [ids, userId]
      );
      statsRes.rows.forEach(r => {
        poStats[r.supplier_id] = {
          total_pos:            r.total_pos,
          total_purchase_value: r.total_purchase_value,
        };
      });
    }

    const enriched = result.rows.map(s => ({
      ...s,
      total_pos:            poStats[s.id]?.total_pos            || 0,
      total_purchase_value: poStats[s.id]?.total_purchase_value || 0,
    }));

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM suppliers WHERE ${where}`,
      params
    );

    res.json({
      suppliers: enriched,
      total:     parseInt(countResult.rows[0].count),
      page:      parseInt(page),
      limit:     parseInt(limit),
    });
  } catch (err) {
    console.error("GET SUPPLIERS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET SINGLE ────────────────────────────────────────────────────────────────
export const getSupplierById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM suppliers WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET SUPPLIER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
export const updateSupplier = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const {
      name, email, phone, address, city, country,
      gstin, payment_terms, lead_time_days, status, notes,
    } = req.body;

    const existing = await pool.query(
      "SELECT id FROM suppliers WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const result = await pool.query(
      `UPDATE suppliers
       SET name=$1, email=$2, phone=$3, address=$4, city=$5, country=$6,
           gstin=$7, payment_terms=$8, lead_time_days=$9, status=$10, notes=$11,
           updated_at=NOW()
       WHERE id=$12 AND user_id=$13
       RETURNING *`,
      [
        name, email || null, phone || null, address || null, city || null,
        country || null, gstin || null, payment_terms || null,
        lead_time_days || 0, status || "active", notes || null,
        id, userId,
      ]
    );

    await logActivity(userId, "supplier", id, "updated", userId, {});
    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE SUPPLIER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE (soft) ─────────────────────────────────────────────────────────────
export const deleteSupplier = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const existing = await pool.query(
      "SELECT id FROM suppliers WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Block deletion if active POs exist
    const activePos = await pool.query(
      `SELECT COUNT(*) FROM purchase_orders
       WHERE supplier_id = $1 AND user_id = $2
         AND status NOT IN ('cancelled', 'closed')`,
      [id, userId]
    );
    if (parseInt(activePos.rows[0].count) > 0) {
      return res.status(400).json({
        error: "Cannot remove supplier with active purchase orders",
      });
    }

    await pool.query(
      "UPDATE suppliers SET status = 'inactive', updated_at = NOW() WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    await logActivity(userId, "supplier", id, "deactivated", userId, {});
    res.json({ message: "Supplier deactivated" });
  } catch (err) {
    console.error("DELETE SUPPLIER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
