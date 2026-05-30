
import pool from "../config/db.js";

export const getPurchaseDashboard = async (req, res) => {
  try {
   const { businessId } = req.user; // ← FIXED: was req.user.businessId

    const [
      prStats,
      poStats,
      invoiceStats,
      returnStats,
      topSuppliers,
      recentActivity,
      monthlySpend,
    ] = await Promise.all([

      // ── PR summary ──────────────────────────────────────────
      pool.query(
        `SELECT
           COUNT(*)                                         AS total,
           COUNT(*) FILTER (WHERE status = 'pending')      AS pending,
           COUNT(*) FILTER (WHERE status = 'approved')     AS approved,
           COUNT(*) FILTER (WHERE status = 'rejected')     AS rejected,
           COUNT(*) FILTER (WHERE status = 'ordered')      AS ordered
         FROM purchase_requisitions
         WHERE business_id = $1`,
        [businessId]
      ),

      // ── PO summary ──────────────────────────────────────────
      pool.query(
        `SELECT
           COUNT(*)                                                                   AS total,
           COUNT(*) FILTER (WHERE status = 'sent')                                   AS sent,
           COUNT(*) FILTER (WHERE status = 'confirmed')                              AS confirmed,
           COUNT(*) FILTER (WHERE status = 'received')                               AS received,
           COUNT(*) FILTER (WHERE status = 'cancelled')                              AS cancelled,
           COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled'), 0)       AS total_value
         FROM purchase_orders
         WHERE business_id = $1`,
        [businessId]
      ),

      // ── Invoice summary ──────────────────────────────────────
      pool.query(
        `SELECT
           COUNT(*)                                            AS total,
           COUNT(*) FILTER (WHERE status = 'pending')         AS pending,
           COUNT(*) FILTER (WHERE status = 'paid')            AS paid,
           COUNT(*) FILTER (WHERE status = 'overdue')         AS overdue,
           COALESCE(SUM(total_amount), 0)                     AS total_invoiced,
           COALESCE(SUM(paid_amount), 0)                      AS total_paid,
           COALESCE(SUM(balance_due), 0)                      AS total_outstanding
         FROM purchase_invoices
         WHERE business_id = $1`,
        [businessId]
      ),

      // ── Return summary ───────────────────────────────────────
      pool.query(
        `SELECT
           COUNT(*)                                                              AS total,
           COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled'), 0)  AS total_value
         FROM purchase_returns
         WHERE business_id = $1`,
        [businessId]
      ),

      // ── Top 5 suppliers by PO value ──────────────────────────
      // FIXED: removed broken JOIN condition "po.business_id=s.business_id"
      pool.query(
        `SELECT
           s.id,
           s.name,
           s.rating,
           COUNT(po.id)                                                                AS order_count,
           COALESCE(SUM(po.total_amount) FILTER (WHERE po.status <> 'cancelled'), 0)  AS total_value
         FROM suppliers s
         LEFT JOIN purchase_orders po
               ON po.supplier_id = s.id
              AND po.business_id     = s.business_id
         WHERE s.business_id = $1
           AND s.status  = 'active'
         GROUP BY s.id, s.name, s.rating
         ORDER BY total_value DESC
         LIMIT 5`,
        [businessId]
      ),

      // ── Recent activity ──────────────────────────────────────
      // FIXED: removed JOIN on users table (doesn't exist in your schema)
      pool.query(
        `SELECT *
         FROM purchase_activity_log
         WHERE business_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [businessId]
      ),

      // ── Monthly spend (last 6 months) ─────────────────────────
      pool.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
           DATE_TRUNC('month', created_at)                       AS month_date,
           COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled'), 0) AS spend
         FROM purchase_orders
         WHERE business_id    = $1
           AND created_at >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month_date ASC`,
        [businessId]
      ),
    ]);

    res.json({
      pr:              prStats.rows[0],
      po:              poStats.rows[0],
      invoice:         invoiceStats.rows[0],
      returns:         returnStats.rows[0],
      top_suppliers:   topSuppliers.rows,
      recent_activity: recentActivity.rows,
      monthly_spend:   monthlySpend.rows,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ error: err.message }); // expose real error for debugging
  }
};
