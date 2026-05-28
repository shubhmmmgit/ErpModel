// controllers/supplierController.js
import pool from "../config/db.js";
import { logActivity } from "./purchaseActivityController.js";

// ── CREATE ───────────────────────────────────────────────────
export const createSupplier = async (req, res) => {
  try {
    const { businessId, userId } = req.user;
    const {
      name, email, phone, address, city, country,
      gstin, payment_terms, lead_time_days, notes
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Supplier name is required" });
    }

    // Prevent duplicate name within same business
    const dup = await pool.query(
      "SELECT id FROM suppliers WHERE business_id=$1 AND LOWER(name)=LOWER($2) AND status!='blacklisted'",
      [businessId, name.trim()]
    );
    if (dup.rows.length) {
      return res.status(409).json({ error: "A supplier with this name already exists" });
    }

    const result = await pool.query(
      `INSERT INTO suppliers
         (business_id, name, email, phone, address, city, country, gstin, payment_terms, lead_time_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [businessId, name.trim(), email||null, phone||null, address||null,
       city||null, country||null, gstin||null, payment_terms||null,
       lead_time_days||0, notes||null]
    );

    await logActivity(businessId, 'supplier', result.rows[0].id, 'created', userId, { name });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE SUPPLIER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── LIST ─────────────────────────────────────────────────────
export const getSuppliers = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = ["s.business_id = $1"];
    const params = [businessId];

    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(s.name ILIKE $${params.length} OR s.email ILIKE $${params.length})`);
    }

    const where = conditions.join(" AND ");
    const query = `
      SELECT s.*,
             COUNT(po.id) AS total_pos,
             COALESCE(SUM(po.total_amount) FILTER (WHERE po.status NOT IN ('cancelled')), 0) AS total_purchase_value
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.business_id = s.business_id
      WHERE ${where}
      GROUP BY s.id
      ORDER BY s.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM suppliers WHERE ${conditions.join(" AND ")}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      suppliers: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error("GET SUPPLIERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
};

// ── GET SINGLE ───────────────────────────────────────────────
export const getSupplierById = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.*,
              json_agg(po ORDER BY po.created_at DESC) FILTER (WHERE po.id IS NOT NULL) AS recent_orders
       FROM suppliers s
       LEFT JOIN purchase_orders po ON po.supplier_id=s.id AND po.business_id=s.business_id
       WHERE s.id=$1 AND s.business_id=$2
       GROUP BY s.id`,
      [id, businessId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET SUPPLIER ERROR:", err);
    res.status(500).json({ error: "Failed to fetch supplier" });
  }
};

// ── UPDATE ───────────────────────────────────────────────────
export const updateSupplier = async (req, res) => {
  try {
    const { businessId, userId } = req.user;
    const { id } = req.params;
    const {
      name, email, phone, address, city, country,
      gstin, payment_terms, lead_time_days, status, notes
    } = req.body;

    // Ensure belongs to business
    const existing = await pool.query(
      "SELECT id FROM suppliers WHERE id=$1 AND business_id=$2",
      [id, businessId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const result = await pool.query(
      `UPDATE suppliers
       SET name=$1, email=$2, phone=$3, address=$4, city=$5, country=$6,
           gstin=$7, payment_terms=$8, lead_time_days=$9, status=$10, notes=$11,
           updated_at=NOW()
       WHERE id=$12 AND business_id=$13
       RETURNING *`,
      [name, email||null, phone||null, address||null, city||null, country||null,
       gstin||null, payment_terms||null, lead_time_days||0, status||'active',
       notes||null, id, businessId]
    );

    await logActivity(businessId, 'supplier', id, 'updated', userId, { status });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE SUPPLIER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE (soft: set status=inactive) ──────────────────────
export const deleteSupplier = async (req, res) => {
  try {
    const { businessId, userId } = req.user;
    const { id } = req.params;

    // Check if supplier has active POs
    const activePos = await pool.query(
      "SELECT COUNT(*) FROM purchase_orders WHERE supplier_id=$1 AND business_id=$2 AND status NOT IN ('cancelled','closed')",
      [id, businessId]
    );
    if (parseInt(activePos.rows[0].count) > 0) {
      return res.status(400).json({ error: "Cannot delete supplier with active purchase orders" });
    }

    await pool.query(
      "UPDATE suppliers SET status='inactive', updated_at=NOW() WHERE id=$1 AND business_id=$2",
      [id, businessId]
    );

    await logActivity(businessId, 'supplier', id, 'deactivated', userId, {});
    res.json({ message: "Supplier deactivated" });
  } catch (err) {
    console.error("DELETE SUPPLIER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};