// controllers/purchaseActivityController.js
// Uses user_id — matches DB schema (not business_id)
import pool from "../config/db.js";

export const logActivity = async (
  userId, entityType, entityId, action, performedBy, details = {}
) => {
  try {
    await pool.query(
      `INSERT INTO purchase_activity_log
         (user_id, entity_type, entity_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, entityType, entityId, action, performedBy, JSON.stringify(details)]
    );
  } catch (err) {
    // Non-fatal — log but never crash the main request
    console.error("Activity log error:", err.message);
  }
};

export const getActivityLog = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { entity_type, entity_id, limit = 50 } = req.query;

    const conditions = ["user_id = $1"];
    const params     = [userId];

    if (entity_type) {
      params.push(entity_type);
      conditions.push(`entity_type = $${params.length}`);
    }
    if (entity_id) {
      params.push(parseInt(entity_id));
      conditions.push(`entity_id = $${params.length}`);
    }

    const result = await pool.query(
      `SELECT * FROM purchase_activity_log
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, parseInt(limit)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET ACTIVITY LOG ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
