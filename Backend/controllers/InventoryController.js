import pool from "../config/db.js";

export const recordMovement = async (
  client,
  {
    businessId,
    productId,
    movementType,
    quantity,
    referenceType = null,
    notes = null,
    userId = null,
  }
) => {
  const beforeRes = await client.query(
    `SELECT stock, cost_price
     FROM products
     WHERE id = $1
     AND business_id = $2`,
    [productId, businessId]
  );

  if (!beforeRes.rows[0]) {
    throw new Error("Product not found");
  }

  const beforeQty = Number(beforeRes.rows[0].stock);
  const costPrice = Number(beforeRes.rows[0].cost_price || 0);

  let afterQty;

  if (
    movementType === "PRODUCTION_OUT" ||
    movementType === "SALE" ||
    movementType === "RETURN_OUT"
  ) {
    afterQty = beforeQty - quantity;
  } else {
    afterQty = beforeQty + quantity;
  }

  await client.query(
    `
    UPDATE products
    SET stock = $1
    WHERE id = $2
    AND business_id = $3
    `,
    [afterQty, productId, businessId]
  );

  await client.query(
    `
    INSERT INTO inventory_movements (
      business_id,
      product_id,
      movement_type,
      quantity,
      quantity_before,
      quantity_after,
      unit_cost,
      total_cost,
      reference_type,
      notes,
      user_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    )
    `,
    [
      businessId,
      productId,
      movementType,
      quantity,
      beforeQty,
      afterQty,
      costPrice,
      costPrice * quantity,
      referenceType,
      notes,
      userId,
    ]
  );
};
export const getValuation = async (req, res) => {
  try {
    const { businessId } = req.user;
 
    const result = await pool.query(
      `SELECT
         p.product_type,
         COALESCE(pc.name,'Uncategorized') AS category,
         COUNT(p.id)              AS product_count,
         SUM(p.stock)             AS total_stock_qty,
         SUM(p.stock*p.cost_price) AS total_cost_value,
         SUM(p.stock*p.price)      AS total_sale_value,
         SUM(p.stock*p.price) - SUM(p.stock*p.cost_price) AS potential_margin
       FROM products p
       LEFT JOIN product_categories pc ON pc.id = p.category_id
       WHERE p.business_id = $1
         AND p.is_active = TRUE
         AND p.track_inventory = TRUE
       GROUP BY p.product_type, pc.name
       ORDER BY total_cost_value DESC NULLS LAST`,
      [businessId]
    );
 
    const totals = await pool.query(
      `SELECT
         SUM(stock*cost_price) AS grand_cost_value,
         SUM(stock*price)      AS grand_sale_value,
         COUNT(*)              AS total_skus
       FROM products
       WHERE business_id = $1 AND is_active = TRUE AND track_inventory = TRUE`,
      [businessId]
    );
 
    res.json({ breakdown: result.rows, totals: totals.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch valuation" });
  }
};
 