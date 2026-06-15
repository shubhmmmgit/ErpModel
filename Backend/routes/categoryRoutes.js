import express from "express";
import pool from "../config/db.js";
 
const categoryRouter = express.Router();
 
// GET /api/categories
categoryRouter.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM product_categories WHERE business_id=$1 ORDER BY name",
    [req.user.businessId]
  );
  res.json(result.rows);
});

// POST /api/categories
categoryRouter.post("/", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const result = await pool.query(
      "INSERT INTO product_categories (business_id,name,description) VALUES ($1,$2,$3) RETURNING *",
      [req.user.businessId, name, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ error: "Category already exists" });
    res.status(500).json({ error: "Failed to create category" });
  }
});
 
// DELETE /api/categories/:id
categoryRouter.delete("/:id", async (req, res) => {
  await pool.query(
    "DELETE FROM product_categories WHERE id=$1 AND business_id=$2",
    [req.params.id, req.user.businessId]
  );
  res.json({ message: "Deleted" });
});
 
export default categoryRouter ;
 