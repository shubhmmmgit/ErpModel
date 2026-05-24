import pool from "../config/db.js";

// ─────────────────────────────────────────────────────────────
//  HELPER — verify order belongs to this business
// ─────────────────────────────────────────────────────────────
const getOrderForBusiness = async (orderId, businessId) => {
  const result = await pool.query(
    "SELECT * FROM orders WHERE id = $1 AND business_id = $2",
    [orderId, businessId]
  );
  return result.rows[0] || null;
};


// ─────────────────────────────────────────────────────────────
//  CREATE ORDER
//  POST /api/orders
//  Body: { customer_name, customer_email?, notes?, items: [{ product_id, quantity }] }
// ─────────────────────────────────────────────────────────────
export const createOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const { businessId, userId } = req.user;
    const { customer_name, customer_email, notes, items } = req.body;

    // ── Validation ──
    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ error: "customer_name is required" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one order item is required" });
    }
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ error: "Each item needs a valid product_id and quantity >= 1" });
      }
    }

    await client.query("BEGIN");

    // ── Fetch products & verify they belong to this business ──
    const productIds = items.map((i) => i.product_id);
    const productResult = await client.query(
      `SELECT * FROM products
       WHERE id = ANY($1::int[]) AND business_id = $2`,
      [productIds, businessId]
    );

    if (productResult.rows.length !== productIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "One or more products not found or don't belong to your business" });
    }

    const productMap = {};
    productResult.rows.forEach((p) => (productMap[p.id] = p));

    // ── Check stock ──
    for (const item of items) {
      const product = productMap[item.product_id];
      if (product.stock < item.quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Insufficient stock for "${product.name}". Available: ${product.stock}`
        });
      }
    }

    // ── Calculate total ──
    const totalAmount = items.reduce((sum, item) => {
      return sum + parseFloat(productMap[item.product_id].price) * item.quantity;
    }, 0);

    // ── Create order ──
    const orderResult = await client.query(
      `INSERT INTO orders (business_id, user_id, customer_name, customer_email, notes, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [businessId, userId, customer_name.trim(), customer_email || null, notes || null, totalAmount]
    );
    const order = orderResult.rows[0];

    // ── Insert order items & decrement stock ──
    for (const item of items) {
      const product = productMap[item.product_id];

      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, product.id, product.name, item.quantity, product.price]
      );

      // Decrement stock
      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [item.quantity, product.id]
      );
    }

    await client.query("COMMIT");

    // ── Return full order with items ──
    const fullOrder = await getFullOrder(order.id);
    res.status(201).json(fullOrder);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};


// ─────────────────────────────────────────────────────────────
//  GET ALL ORDERS (for this business)
//  GET /api/orders?status=pending&page=1&limit=20
// ─────────────────────────────────────────────────────────────
export const getOrders = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { status, page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT o.*,
             COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.business_id = $1
    `;
    const params = [businessId];

    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Total count for pagination
    let countQuery = "SELECT COUNT(*) FROM orders WHERE business_id = $1";
    const countParams = [businessId];
    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $2`;
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      orders: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (err) {
    console.error("GET ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};


// ─────────────────────────────────────────────────────────────
//  GET SINGLE ORDER WITH ITEMS
//  GET /api/orders/:id
// ─────────────────────────────────────────────────────────────
export const getOrderById = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { id } = req.params;

    const order = await getOrderForBusiness(id, businessId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const full = await getFullOrder(id);
    res.json(full);

  } catch (err) {
    console.error("GET ORDER ERROR:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
};


// ─────────────────────────────────────────────────────────────
//  UPDATE ORDER STATUS
//  PATCH /api/orders/:id/status
//  Body: { status: "confirmed" | "shipped" | "delivered" | "cancelled" }
// ─────────────────────────────────────────────────────────────
export const updateOrderStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const { businessId } = req.user;
    const { id } = req.params;
    const { status } = req.body;

    const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    const order = await getOrderForBusiness(id, businessId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Prevent updating a cancelled order
    if (order.status === "cancelled" && status !== "cancelled") {
      return res.status(400).json({ error: "Cannot change status of a cancelled order" });
    }

    await client.query("BEGIN");

    // If cancelling — restore stock
    if (status === "cancelled" && order.status !== "cancelled") {
      const items = await client.query(
        "SELECT * FROM order_items WHERE order_id = $1",
        [id]
      );
      for (const item of items.rows) {
        await client.query(
          "UPDATE products SET stock = stock + $1 WHERE id = $2",
          [item.quantity, item.product_id]
        );
      }
    }

    const result = await client.query(
      "UPDATE orders SET status = $1 WHERE id = $2 AND business_id = $3 RETURNING *",
      [status, id, businessId]
    );

    await client.query("COMMIT");

    res.json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ error: "Failed to update status" });
  } finally {
    client.release();
  }
};


// ─────────────────────────────────────────────────────────────
//  DELETE ORDER
//  DELETE /api/orders/:id
//  Only allowed if status = 'pending'
// ─────────────────────────────────────────────────────────────
export const deleteOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const { businessId } = req.user;
    const { id } = req.params;

    const order = await getOrderForBusiness(id, businessId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.status !== "pending") {
      return res.status(400).json({ error: "Only pending orders can be deleted" });
    }

    await client.query("BEGIN");

    // Restore stock before deleting
    const items = await client.query(
      "SELECT * FROM order_items WHERE order_id = $1",
      [id]
    );
    for (const item of items.rows) {
      await client.query(
        "UPDATE products SET stock = stock + $1 WHERE id = $2",
        [item.quantity, item.product_id]
      );
    }

    // order_items deleted via CASCADE
    await client.query(
      "DELETE FROM orders WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );

    await client.query("COMMIT");
    res.json({ message: "Order deleted and stock restored" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE ORDER ERROR:", err);
    res.status(500).json({ error: "Failed to delete order" });
  } finally {
    client.release();
  }
};


// ─────────────────────────────────────────────────────────────
//  DASHBOARD SUMMARY
//  GET /api/orders/summary
// ─────────────────────────────────────────────────────────────
export const getOrderSummary = async (req, res) => {
  try {
    const { businessId } = req.user;

    const result = await pool.query(
      `SELECT
         COUNT(*)                                          AS total_orders,
         COUNT(*) FILTER (WHERE status = 'pending')       AS pending,
         COUNT(*) FILTER (WHERE status = 'confirmed')     AS confirmed,
         COUNT(*) FILTER (WHERE status = 'shipped')       AS shipped,
         COUNT(*) FILTER (WHERE status = 'delivered')     AS delivered,
         COUNT(*) FILTER (WHERE status = 'cancelled')     AS cancelled,
         COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) AS total_revenue
       FROM orders
       WHERE business_id = $1`,
      [businessId]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("SUMMARY ERROR:", err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
};



const getFullOrder = async (orderId) => {
  const orderResult = await pool.query(
    "SELECT * FROM orders WHERE id = $1",
    [orderId]
  );
  const order = orderResult.rows[0];

  const itemsResult = await pool.query(
    "SELECT * FROM order_items WHERE order_id = $1",
    [orderId]
  );
  order.items = itemsResult.rows;
  return order;
};