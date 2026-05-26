import pool from "../config/db.js";

// ─────────────────────────────────────────────
//  CREATE PRODUCT
// ─────────────────────────────────────────────
export const addProduct = async (req, res) => {
  try {
    const { name, price, stock, attributes } = req.body;
    const { businessId } = req.user;

    if (!name || price == null || stock == null) {
      return res.status(400).json({ error: "name, price and stock are required" });
    }

    const result = await pool.query(
      `INSERT INTO products (business_id, name, price, stock, attributes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [businessId, name, price, stock, attributes || {}]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("ADD PRODUCT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
//  GET ALL PRODUCTS
// ─────────────────────────────────────────────
export const getProducts = async (req, res) => {
  try {
    const { businessId } = req.user;

    const result = await pool.query(
      "SELECT * FROM products WHERE business_id = $1 ORDER BY created_at DESC",
      //                                ^^^^^^^^^^^ snake_case — was businessId
      [businessId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("FETCH PRODUCTS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
//  DELETE PRODUCT
// ─────────────────────────────────────────────
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.user;

    const result = await pool.query(
      "DELETE FROM products WHERE id = $1 AND business_id = $2 RETURNING id",
      //                                          ^^^^^^^^^^^ was businessId
      [id, businessId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found or not authorised" });
    }

    res.json({ message: "Deleted" });

  } catch (err) {
    console.error("DELETE PRODUCT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
//  UPDATE PRODUCT
// ─────────────────────────────────────────────
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, stock, attributes } = req.body;
    const { businessId } = req.user;

    const result = await pool.query(
      `UPDATE products
       SET name = $1, price = $2, stock = $3, attributes = $4
       WHERE id = $5 AND business_id = $6
       RETURNING *`,
      //          ^^^^^^^^^^^ was businessId
      [name, price, stock, attributes || {}, id, businessId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found or not authorised" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("UPDATE PRODUCT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};