// controllers/rfqController.js
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

// ── CREATE RFQ ───────────────────────────────────────────────
export const createRFQ = async (req, res) => {
  const client = await pool.connect();
  try {
    const { businessId, userId } = req.user;
    const { pr_id, deadline, notes, supplier_ids } = req.body;

    if (!supplier_ids?.length) {
      return res.status(400).json({ error: "At least one supplier is required" });
    }

    // Validate suppliers belong to this business
    const suppCheck = await client.query(
      "SELECT id FROM suppliers WHERE id=ANY($1::int[]) AND business_id=$2 AND status='active'",
      [supplier_ids, businessId]
    );
    if (suppCheck.rows.length !== supplier_ids.length) {
      return res.status(400).json({ error: "One or more suppliers are invalid" });
    }

    // Validate PR if provided
    if (pr_id) {
      const prCheck = await client.query(
        "SELECT id, status FROM purchase_requisitions WHERE id=$1 AND business_id=$2",
        [pr_id, businessId]
      );
      if (!prCheck.rows.length) return res.status(400).json({ error: "PR not found" });
      if (!['approved','pending'].includes(prCheck.rows[0].status)) {
        return res.status(400).json({ error: "PR must be approved before creating RFQ" });
      }
    }

    await client.query("BEGIN");
    const rfq_number = await generateNumber(client, businessId, "RFQ", "rfqs", "rfq_number");

    const rfqResult = await client.query(
      `INSERT INTO rfqs (business_id, rfq_number, pr_id, created_by, deadline, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,'sent') RETURNING *`,
      [businessId, rfq_number, pr_id||null, userId, deadline||null, notes||null]
    );
    const rfq = rfqResult.rows[0];

    for (const suppId of supplier_ids) {
      await client.query(
        `INSERT INTO rfq_suppliers (rfq_id, business_id, supplier_id, status)
         VALUES ($1,$2,$3,'invited')`,
        [rfq.id, businessId, suppId]
      );
    }

    await client.query("COMMIT");
    await logActivity(businessId, 'rfq', rfq.id, 'created', userId, { rfq_number, supplier_count: supplier_ids.length });

    const full = await getFullRFQ(rfq.id, businessId);
    res.status(201).json(full);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE RFQ ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ── LIST RFQs ────────────────────────────────────────────────
export const getRFQs = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = ["r.business_id = $1"];
    const params = [businessId];
    if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }

    const result = await pool.query(
      `SELECT r.*, pr.pr_number, u.name AS created_by_name,
              COUNT(rs.id) AS supplier_count,
              COUNT(rs.id) FILTER (WHERE rs.status='quoted') AS quoted_count
       FROM rfqs r
       LEFT JOIN purchase_requisitions pr ON pr.id = r.pr_id
       LEFT JOIN users u ON u.id = r.created_by
       LEFT JOIN rfq_suppliers rs ON rs.rfq_id = r.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY r.id, pr.pr_number, u.name
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM rfqs r WHERE ${conditions.join(" AND ")}`, params
    );

    res.json({ rfqs: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error("GET RFQs ERROR:", err);
    res.status(500).json({ error: "Failed to fetch RFQs" });
  }
};

// ── GET SINGLE RFQ ───────────────────────────────────────────
export const getRFQById = async (req, res) => {
  try {
    const { businessId } = req.user;
    const full = await getFullRFQ(req.params.id, businessId);
    if (!full) return res.status(404).json({ error: "RFQ not found" });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch RFQ" });
  }
};

// ── SUBMIT QUOTATION (supplier quotes) ──────────────────────
export const submitQuotation = async (req, res) => {
  try {
    const { businessId, userId } = req.user;
    const { rfq_id, supplier_id } = req.params;
    const { quoted_amount, delivery_days, validity_date, notes, items } = req.body;

    // Verify RFQ + rfq_supplier belong to this business
    const rfqSupp = await pool.query(
      `SELECT rs.* FROM rfq_suppliers rs
       JOIN rfqs r ON r.id = rs.rfq_id
       WHERE rs.rfq_id=$1 AND rs.supplier_id=$2 AND r.business_id=$3`,
      [rfq_id, supplier_id, businessId]
    );
    if (!rfqSupp.rows.length) {
      return res.status(404).json({ error: "Supplier not found in this RFQ" });
    }

    await pool.query(
      `UPDATE rfq_suppliers
       SET quoted_amount=$1, delivery_days=$2, validity_date=$3, notes=$4, items=$5,
           status='quoted', updated_at=NOW()
       WHERE rfq_id=$6 AND supplier_id=$7`,
      [quoted_amount, delivery_days||null, validity_date||null, notes||null,
       JSON.stringify(items||[]), rfq_id, supplier_id]
    );

    // Check if all invited suppliers have quoted → mark RFQ as 'received'
    const pendingCount = await pool.query(
      "SELECT COUNT(*) FROM rfq_suppliers WHERE rfq_id=$1 AND status='invited'",
      [rfq_id]
    );
    if (parseInt(pendingCount.rows[0].count) === 0) {
      await pool.query(
        "UPDATE rfqs SET status='received', updated_at=NOW() WHERE id=$1 AND business_id=$2",
        [rfq_id, businessId]
      );
    }

    await logActivity(businessId, 'rfq', rfq_id, 'quotation_received', userId, { supplier_id, quoted_amount });
    res.json({ message: "Quotation submitted" });
  } catch (err) {
    console.error("SUBMIT QUOTATION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── SELECT SUPPLIER (comparison done, pick winner) ──────────
export const selectSupplier = async (req, res) => {
  try {
    const { businessId, userId } = req.user;
    const { rfq_id } = req.params;
    const { supplier_id } = req.body;

    const rfq = await pool.query(
      "SELECT * FROM rfqs WHERE id=$1 AND business_id=$2",
      [rfq_id, businessId]
    );
    if (!rfq.rows.length) return res.status(404).json({ error: "RFQ not found" });

    // Verify supplier quoted on this RFQ
    const quoted = await pool.query(
      "SELECT * FROM rfq_suppliers WHERE rfq_id=$1 AND supplier_id=$2 AND status='quoted'",
      [rfq_id, supplier_id]
    );
    if (!quoted.rows.length) {
      return res.status(400).json({ error: "Supplier has not submitted a quotation" });
    }

    await pool.query(
      "UPDATE rfq_suppliers SET status='selected' WHERE rfq_id=$1 AND supplier_id=$2",
      [rfq_id, supplier_id]
    );
    await pool.query(
      "UPDATE rfq_suppliers SET status='rejected' WHERE rfq_id=$1 AND supplier_id!=$2 AND status='quoted'",
      [rfq_id, supplier_id]
    );
    await pool.query(
      "UPDATE rfqs SET status='compared', selected_supplier_id=$1, updated_at=NOW() WHERE id=$2 AND business_id=$3",
      [supplier_id, rfq_id, businessId]
    );

    await logActivity(businessId, 'rfq', rfq_id, 'supplier_selected', userId, { supplier_id });
    res.json({ message: "Supplier selected", rfq_id, supplier_id });
  } catch (err) {
    console.error("SELECT SUPPLIER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── HELPERS ──────────────────────────────────────────────────
const getFullRFQ = async (id, businessId) => {
  const rfqRes = await pool.query(
    `SELECT r.*, pr.pr_number, u.name AS created_by_name
     FROM rfqs r
     LEFT JOIN purchase_requisitions pr ON pr.id = r.pr_id
     LEFT JOIN users u ON u.id = r.created_by
     WHERE r.id=$1 AND r.business_id=$2`,
    [id, businessId]
  );
  if (!rfqRes.rows.length) return null;
  const rfq = rfqRes.rows[0];

  const suppRes = await pool.query(
    `SELECT rs.*, s.name AS supplier_name, s.email AS supplier_email,
            s.rating, s.lead_time_days
     FROM rfq_suppliers rs
     JOIN suppliers s ON s.id = rs.supplier_id
     WHERE rs.rfq_id=$1
     ORDER BY rs.quoted_amount ASC NULLS LAST`,
    [id]
  );
  rfq.suppliers = suppRes.rows;
  return rfq;
};