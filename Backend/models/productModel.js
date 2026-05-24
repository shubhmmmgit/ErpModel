import pool from "../config/db.js";

export const createProduct = async (product) => {
  const { business_id, name, price, stock, attributes } = product;

  const query = `
    INSERT INTO products (business_id, name, price, stock, attributes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;

  const values = [business_id, name, price, stock, attributes];

  const result = await pool.query(query, values);
  return result.rows[0];
};

export const getProductsByBusiness = async (business_id) => {
  const result = await pool.query(
    "SELECT * FROM products WHERE businessId = $1 ORDER BY created_at DESC",
    [business_id]
  );

  return result.rows;
};