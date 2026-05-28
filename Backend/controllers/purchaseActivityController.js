// controllers/purchaseActivityController.js
import pool from "../config/db.js";

export const logActivity = async (
  businessId, entityType, entityId, action, performedBy, details = {}
) => {
  try {
    await pool.query(
      `INSERT INTO purchase_activity_log
         (business_id, entity_type, entity_id, action, performed_by, details)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [businessId, entityType, entityId, action, performedBy, JSON.stringify(details)]
    );
  } catch (err) {
    // Non-fatal — log silently
    console.error("Activity log error:", err.message);
  }
};

export const getActivityLog = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { entity_type, entity_id, limit = 50 } = req.query;

    let conditions = ["l.business_id = $1"];
    const params = [businessId];

    if (entity_type) {
      params.push(entity_type);
      conditions.push(`l.entity_type = $${params.length}`);
    }
    if (entity_id) {
      params.push(parseInt(entity_id));
      conditions.push(`l.entity_id = $${params.length}`);
    }

    const result = await pool.query(
      `SELECT l.*, u.name AS performed_by_name
       FROM purchase_activity_log l
       LEFT JOIN users u ON u.id = l.performed_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY l.created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, parseInt(limit)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET ACTIVITY LOG ERROR:", err);
    res.status(500).json({ error: "Failed to fetch activity log" });
  }
};