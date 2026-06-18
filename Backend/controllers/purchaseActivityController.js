
import pool from "../config/db.js";
export const logActivity = async (
  businessId,
  entityType,
  entityId,
  action,
  performedBy,
  details = {}
) => {
  try {
    const description =
      `${action} ${entityType} #${entityId}`;

    await pool.query(
      `INSERT INTO purchase_activity_log
       (business_id, action_type, description, created_by)
       VALUES ($1, $2, $3, $4)`,
      [
        businessId,
        action,
        description,
        performedBy
      ]
    );
  } catch (err) {
    console.error("Activity log error:", err.message);
  }
};

export const getActivityLog = async (req, res) => {
  try {
    const {businessId} = req.user;
    const { entity_type, entity_id, limit = 50 } = req.query;

    const conditions = ["business_id = $1"];
    const params     = [businessId];

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
