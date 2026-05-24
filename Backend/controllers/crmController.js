import pool from "../config/db.js";

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — find-or-create customer by email within a business
//  Called from orderController when an order is placed
// ─────────────────────────────────────────────────────────────────────────────
export const findOrCreateCustomer = async (client, { businessId, name, email }) => {
  if (email) {
    const existing = await client.query(
      "SELECT * FROM customers WHERE business_id = $1 AND email = $2",
      [businessId, email]
    );
    if (existing.rows.length > 0) return existing.rows[0];
  }
  const result = await client.query(
    `INSERT INTO customers (business_id, name, email) VALUES ($1, $2, $3) RETURNING *`,
    [businessId, name, email || null]
  );
  return result.rows[0];
};


// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMERS — LIST
//  GET /api/crm/customers?search=&tag=&page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────
export const getCustomers = async (req, res) => {
  try {
    const { businessId } = req.user;                              // ← tenant key
    const { search = "", tag = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let base = `
      SELECT
        c.*,
        COUNT(DISTINCT o.id)                                                        AS order_count,
        COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) AS lifetime_value,
        MAX(o.created_at)                                                           AS last_order_date
      FROM customers c
      LEFT JOIN orders o
        ON  o.business_id    = c.business_id
        AND o.customer_email = c.email
      WHERE c.business_id = $1
    `;
    const params = [businessId];

    if (search) {
      params.push(`%${search}%`);
      base += ` AND (c.name ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
    }
    if (tag) {
      params.push(tag);
      base += ` AND $${params.length} = ANY(c.tags)`;
    }

    base += ` GROUP BY c.id ORDER BY lifetime_value DESC NULLS LAST`;
    base += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(base, params);

    // Count query for pagination
    let countQ = "SELECT COUNT(*) FROM customers WHERE business_id = $1";
    const countP = [businessId];
    if (search) { countP.push(`%${search}%`); countQ += ` AND (name ILIKE $${countP.length} OR email ILIKE $${countP.length})`; }
    if (tag)    { countP.push(tag);            countQ += ` AND $${countP.length} = ANY(tags)`; }
    const countRes = await pool.query(countQ, countP);

    res.json({
      customers: result.rows,
      pagination: {
        total:      parseInt(countRes.rows[0].count),
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("GET CUSTOMERS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMERS — SINGLE DETAIL
//  GET /api/crm/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getCustomerDetail = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { id } = req.params;

    const custRes = await pool.query(
      "SELECT * FROM customers WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );
    if (!custRes.rows[0]) return res.status(404).json({ error: "Customer not found" });

    const customer = custRes.rows[0];

    const [orders, interactions, followUps] = await Promise.all([
      pool.query(
        `SELECT id, total_amount, status, created_at
         FROM orders
         WHERE business_id = $1 AND customer_email = $2
         ORDER BY created_at DESC`,
        [businessId, customer.email]
      ),
      pool.query(
        "SELECT * FROM interactions WHERE customer_id = $1 ORDER BY created_at DESC",
        [id]
      ),
      pool.query(
        "SELECT * FROM follow_ups WHERE customer_id = $1 ORDER BY due_date ASC",
        [id]
      )
    ]);

    const totalSpend = orders.rows
      .filter(o => o.status !== "cancelled")
      .reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);

    res.json({
      ...customer,
      orders:         orders.rows,
      interactions:   interactions.rows,
      follow_ups:     followUps.rows,
      lifetime_value: totalSpend,
      order_count:    orders.rows.length
    });
  } catch (err) {
    console.error("CUSTOMER DETAIL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMERS — CREATE
//  POST /api/crm/customers
// ─────────────────────────────────────────────────────────────────────────────
export const createCustomer = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { name, email, phone, tags, notes } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "name is required" });

    if (email) {
      const dup = await pool.query(
        "SELECT id FROM customers WHERE business_id = $1 AND email = $2",
        [businessId, email]
      );
      if (dup.rows.length > 0)
        return res.status(409).json({ error: "A customer with this email already exists" });
    }

    const result = await pool.query(
      `INSERT INTO customers (business_id, name, email, phone, tags, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [businessId, name.trim(), email || null, phone || null, tags || [], notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE CUSTOMER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMERS — UPDATE
//  PUT /api/crm/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updateCustomer = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { id } = req.params;
    const { name, email, phone, tags, notes } = req.body;

    const result = await pool.query(
      `UPDATE customers SET name=$1, email=$2, phone=$3, tags=$4, notes=$5
       WHERE id=$6 AND business_id=$7 RETURNING *`,
      [name, email || null, phone || null, tags || [], notes || null, id, businessId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Customer not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMERS — DELETE
//  DELETE /api/crm/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteCustomer = async (req, res) => {
  try {
    const { businessId } = req.user;
    await pool.query(
      "DELETE FROM customers WHERE id = $1 AND business_id = $2",
      [req.params.id, businessId]
    );
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  LEADS — LIST
//  GET /api/crm/leads?status=&search=&page=1&limit=50
// ─────────────────────────────────────────────────────────────────────────────
export const getLeads = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { status, search = "", page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let q = `SELECT * FROM leads WHERE business_id = $1`;
    const p = [businessId];

    if (status) { p.push(status);        q += ` AND status = $${p.length}`; }
    if (search) { p.push(`%${search}%`); q += ` AND (name ILIKE $${p.length} OR email ILIKE $${p.length})`; }

    q += ` ORDER BY created_at DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`;
    p.push(parseInt(limit), offset);

    const result = await pool.query(q, p);
    res.json(result.rows);
  } catch (err) {
    console.error("GET LEADS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  LEADS — CREATE
//  POST /api/crm/leads
// ─────────────────────────────────────────────────────────────────────────────
export const createLead = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { name, email, phone, source, status, value, notes } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "name is required" });

    const result = await pool.query(
      `INSERT INTO leads (business_id, name, email, phone, source, status, value, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [businessId, name.trim(), email || null, phone || null,
       source || "manual", status || "new", value || 0, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE LEAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  LEADS — UPDATE STATUS
//  PATCH /api/crm/leads/:id/status
// ─────────────────────────────────────────────────────────────────────────────
export const updateLeadStatus = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { id } = req.params;
    const { status } = req.body;

    const VALID = ["new", "contacted", "qualified", "negotiation", "won", "lost"];
    if (!VALID.includes(status))
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID.join(", ")}` });

    const result = await pool.query(
      `UPDATE leads SET status=$1, updated_at=NOW()
       WHERE id=$2 AND business_id=$3 RETURNING *`,
      [status, id, businessId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Lead not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  LEADS — CONVERT TO CUSTOMER
//  POST /api/crm/leads/:id/convert
// ─────────────────────────────────────────────────────────────────────────────
export const convertLead = async (req, res) => {
  const client = await pool.connect();
  try {
    const { businessId } = req.user;
    const { id } = req.params;

    const leadRes = await client.query(
      "SELECT * FROM leads WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );
    const lead = leadRes.rows[0];
    if (!lead)                 return res.status(404).json({ error: "Lead not found" });
    if (lead.status === "won") return res.status(409).json({ error: "Lead already converted" });

    await client.query("BEGIN");

    // Reuse existing customer by email if present
    let customer;
    if (lead.email) {
      const dup = await client.query(
        "SELECT * FROM customers WHERE business_id=$1 AND email=$2",
        [businessId, lead.email]
      );
      customer = dup.rows[0];
    }
    if (!customer) {
      const c = await client.query(
        `INSERT INTO customers (business_id, name, email, phone)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [businessId, lead.name, lead.email || null, lead.phone || null]
      );
      customer = c.rows[0];
    }

    await client.query(
      `UPDATE leads SET status='won', converted_at=NOW(), customer_id=$1
       WHERE id=$2 AND business_id=$3`,
      [customer.id, id, businessId]
    );

    await client.query("COMMIT");
    res.json({ message: "Lead converted", customer });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CONVERT LEAD ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  LEADS — DELETE
//  DELETE /api/crm/leads/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteLead = async (req, res) => {
  try {
    const { businessId } = req.user;
    await pool.query(
      "DELETE FROM leads WHERE id=$1 AND business_id=$2",
      [req.params.id, businessId]
    );
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  INTERACTIONS — ADD
//  POST /api/crm/interactions
// ─────────────────────────────────────────────────────────────────────────────
export const addInteraction = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { customer_id, lead_id, type, summary } = req.body;

    if (!summary?.trim())
      return res.status(400).json({ error: "summary is required" });
    if (!customer_id && !lead_id)
      return res.status(400).json({ error: "customer_id or lead_id is required" });

    const result = await pool.query(
      `INSERT INTO interactions (business_id, customer_id, lead_id, type, summary)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [businessId, customer_id || null, lead_id || null, type || "note", summary.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  FOLLOW-UPS — LIST
//  GET /api/crm/followups
// ─────────────────────────────────────────────────────────────────────────────
export const getFollowUps = async (req, res) => {
  try {
    const { businessId } = req.user;
    const result = await pool.query(
      `SELECT f.*, c.name AS customer_name, l.name AS lead_name
       FROM follow_ups f
       LEFT JOIN customers c ON c.id = f.customer_id
       LEFT JOIN leads     l ON l.id = f.lead_id
       WHERE f.business_id = $1
       ORDER BY f.due_date ASC`,
      [businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  FOLLOW-UPS — CREATE
//  POST /api/crm/followups
// ─────────────────────────────────────────────────────────────────────────────
export const createFollowUp = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { customer_id, lead_id, title, due_date } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: "title is required" });
    if (!due_date)      return res.status(400).json({ error: "due_date is required" });

    const result = await pool.query(
      `INSERT INTO follow_ups (business_id, customer_id, lead_id, title, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [businessId, customer_id || null, lead_id || null, title.trim(), due_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  FOLLOW-UPS — MARK DONE
//  PATCH /api/crm/followups/:id/done
// ─────────────────────────────────────────────────────────────────────────────
export const markFollowUpDone = async (req, res) => {
  try {
    const { businessId } = req.user;
    await pool.query(
      "UPDATE follow_ups SET done=TRUE WHERE id=$1 AND business_id=$2",
      [req.params.id, businessId]
    );
    res.json({ message: "Marked done" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
//  CRM DASHBOARD SUMMARY
//  GET /api/crm/summary
// ─────────────────────────────────────────────────────────────────────────────
export const getCRMSummary = async (req, res) => {
  try {
    const { businessId } = req.user;

    // ── Customer stats ──────────────────────────────────────
    let custStats = { rows: [{ total_customers: 0, total_revenue: 0 }] };
    try {
      custStats = await pool.query(
        `SELECT
           COUNT(DISTINCT c.id)::int AS total_customers,
           COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) AS total_revenue
         FROM customers c
         LEFT JOIN orders o
           ON  o.business_id    = c.business_id
           AND o.customer_email = c.email
         WHERE c.business_id = $1`,
        [businessId]
      );
    } catch (e) { console.warn("CRM custStats failed:", e.message); }

    // ── Lead stats ──────────────────────────────────────────
    let leadStats = { rows: [{ total_leads: 0, won: 0, lost: 0, new_leads: 0, pipeline_value: 0 }] };
    try {
      leadStats = await pool.query(
        `SELECT
           COUNT(*)::int                                               AS total_leads,
           SUM(CASE WHEN status='won'  THEN 1 ELSE 0 END)::int        AS won,
           SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END)::int        AS lost,
           SUM(CASE WHEN status='new'  THEN 1 ELSE 0 END)::int        AS new_leads,
           COALESCE(SUM(CASE WHEN status='won' THEN value ELSE 0 END), 0) AS pipeline_value
         FROM leads WHERE business_id = $1`,
        [businessId]
      );
    } catch (e) { console.warn("CRM leadStats failed:", e.message); }

    // ── Top customers ───────────────────────────────────────
    let topCustomers = { rows: [] };
    try {
      topCustomers = await pool.query(
        `SELECT c.id, c.name, c.email,
           COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) AS ltv,
           COUNT(o.id)::int AS orders
         FROM customers c
         LEFT JOIN orders o
           ON  o.business_id    = c.business_id
           AND o.customer_email = c.email
         WHERE c.business_id = $1
         GROUP BY c.id ORDER BY ltv DESC LIMIT 5`,
        [businessId]
      );
    } catch (e) { console.warn("CRM topCustomers failed:", e.message); }

    // ── Upcoming follow-ups ─────────────────────────────────
    let upcomingFollowUps = { rows: [] };
    try {
      upcomingFollowUps = await pool.query(
        `SELECT f.*, c.name AS customer_name, l.name AS lead_name
         FROM follow_ups f
         LEFT JOIN customers c ON c.id = f.customer_id
         LEFT JOIN leads     l ON l.id = f.lead_id
         WHERE f.business_id = $1
           AND f.done = FALSE
           AND f.due_date <= (CURRENT_DATE + INTERVAL '7 days')
         ORDER BY f.due_date ASC LIMIT 5`,
        [businessId]
      );
    } catch (e) { console.warn("CRM upcomingFollowUps failed:", e.message); }

    // ── Lead sources ────────────────────────────────────────
    let leadSources = { rows: [] };
    try {
      leadSources = await pool.query(
        `SELECT source, COUNT(*)::int AS count
         FROM leads WHERE business_id = $1
         GROUP BY source ORDER BY count DESC`,
        [businessId]
      );
    } catch (e) { console.warn("CRM leadSources failed:", e.message); }

    // ── Recent interactions ─────────────────────────────────
    let recentInteractions = { rows: [] };
    try {
      recentInteractions = await pool.query(
        `SELECT i.*, c.name AS customer_name, l.name AS lead_name
         FROM interactions i
         LEFT JOIN customers c ON c.id = i.customer_id
         LEFT JOIN leads     l ON l.id = i.lead_id
         WHERE i.business_id = $1
         ORDER BY i.created_at DESC LIMIT 8`,
        [businessId]
      );
    } catch (e) { console.warn("CRM recentInteractions failed:", e.message); }

    // ── Build response ──────────────────────────────────────
    const cs = custStats.rows[0] || {};
    const ls = leadStats.rows[0] || {};
    const totalLeads = parseInt(ls.total_leads) || 0;
    const won        = parseInt(ls.won)         || 0;

    res.json({
      customers: {
        total:         parseInt(cs.total_customers) || 0,
        total_revenue: parseFloat(cs.total_revenue)  || 0
      },
      leads: {
        total:           totalLeads,
        won,
        lost:            parseInt(ls.lost)            || 0,
        new:             parseInt(ls.new_leads)        || 0,
        pipeline_value:  parseFloat(ls.pipeline_value) || 0,
        conversion_rate: totalLeads > 0 ? ((won / totalLeads) * 100).toFixed(1) : "0.0"
      },
      top_customers:       topCustomers.rows,
      upcoming_follow_ups: upcomingFollowUps.rows,
      lead_sources:        leadSources.rows,
      recent_interactions: recentInteractions.rows
    });
  } catch (err) {
    console.error("CRM SUMMARY OUTER ERROR:", err);
    res.status(500).json({ error: "Failed to fetch CRM summary" });
  }
};