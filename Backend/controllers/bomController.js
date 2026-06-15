
import pool from "../config/db.js";
import { recordMovement } from "./InventoryController.js";

// ─────────────────────────────────────────────────────────────
//  CREATE BOM
//  POST /api/bom
//  Body: { finished_good_id, name, yield_quantity, notes, items: [{ raw_material_id, quantity_required }] }
// ─────────────────────────────────────────────────────────────
export const createBOM = async (req, res) => {
  const client = await pool.connect();
  try {
    const { businessId, userId } = req.user;
    const { finished_good_id, name, yield_quantity = 1, notes, items } = req.body;

    if (!finished_good_id || !items || items.length === 0) {
      return res.status(400).json({ error: "finished_good_id and items are required" });
    }

    // Verify finished good belongs to this business
    const fgCheck = await pool.query(
      "SELECT id, name, product_type FROM products WHERE id = $1 AND business_id = $2",
      [finished_good_id, businessId]
    );
    if (!fgCheck.rows[0]) return res.status(404).json({ error: "Finished good product not found" });

    // Verify all raw materials belong to this business
    const rmIds = items.map((i) => i.raw_material_id);
    const rmCheck = await pool.query(
      "SELECT id FROM products WHERE id = ANY($1::int[]) AND business_id = $2",
      [rmIds, businessId]
    );
    if (rmCheck.rows.length !== rmIds.length) {
      return res.status(400).json({ error: "One or more raw materials not found" });
    }

    await client.query("BEGIN");

    // Upsert BOM header (one BOM per finished good per business)
    const bomResult = await client.query(
      `INSERT INTO bom_headers (business_id, finished_good_id, name, yield_quantity, notes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (business_id, finished_good_id)
       DO UPDATE SET name=EXCLUDED.name, yield_quantity=EXCLUDED.yield_quantity,
                     notes=EXCLUDED.notes, updated_at=NOW()
       RETURNING *`,
      [businessId, finished_good_id, name || fgCheck.rows[0].name + " BOM", yield_quantity, notes || null]
    );
    const bom = bomResult.rows[0];

    // Delete old items and re-insert
    await client.query("DELETE FROM bom_items WHERE bom_header_id = $1 AND business_id = $2", [bom.id, businessId]);

    for (const item of items) {
      if (!item.quantity_required || item.quantity_required <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Each item must have quantity_required > 0" });
      }
      await client.query(
        `INSERT INTO bom_items (bom_header_id, business_id, raw_material_id, quantity_required, notes)
         VALUES ($1,$2,$3,$4,$5)`,
        [bom.id, businessId, item.raw_material_id, item.quantity_required, item.notes || null]
      );
    }

    await client.query("COMMIT");

    const full = await getFullBOM(bom.id, businessId);
    res.status(201).json(full);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE BOM ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
//  GET ALL BOMs
//  GET /api/bom
// ─────────────────────────────────────────────────────────────
export const getBOMs = async (req, res) => {
  try {
    const { businessId } = req.user;

    const result = await pool.query(
      `SELECT bh.*, p.name AS finished_good_name, p.sku, p.stock AS current_stock,
              COUNT(bi.id) AS ingredient_count
       FROM bom_headers bh
       JOIN products p ON p.id = bh.finished_good_id
       LEFT JOIN bom_items bi ON bi.bom_header_id = bh.id
       WHERE bh.business_id = $1 AND bh.is_active = TRUE
       GROUP BY bh.id, p.name, p.sku, p.stock
       ORDER BY p.name`,
      [businessId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch BOMs" });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET SINGLE BOM
//  GET /api/bom/:id
// ─────────────────────────────────────────────────────────────
export const getBOMById = async (req, res) => {
  try {
    const { businessId } = req.user;
    const bom = await getFullBOM(req.params.id, businessId);
    if (!bom) return res.status(404).json({ error: "BOM not found" });
    res.json(bom);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch BOM" });
  }
};

// ─────────────────────────────────────────────────────────────
//  PRODUCTION RUN — consume raw materials, produce finished goods
//  POST /api/bom/:id/produce
//  Body: { quantity_to_produce, notes }
// ─────────────────────────────────────────────────────────────
export const runProduction = async (req, res) => {
  const client = await pool.connect();
  try {
    const { businessId, userId } = req.user;
    const { quantity_to_produce, notes } = req.body;

    if (!quantity_to_produce || quantity_to_produce <= 0) {
      return res.status(400).json({ error: "quantity_to_produce must be > 0" });
    }

    const bom = await getFullBOM(req.params.id, businessId);
    if (!bom) return res.status(404).json({ error: "BOM not found" });

    // Calculate raw material requirements
    const scaleFactor = quantity_to_produce / parseFloat(bom.yield_quantity);
    const requirements = bom.items.map((item) => ({
      ...item,
      required_qty: parseFloat(item.quantity_required) * scaleFactor,
    }));

    // Pre-flight: check stock for ALL raw materials before any deduction
    for (const req_item of requirements) {
      const stockCheck = await pool.query(
        "SELECT stock, name FROM products WHERE id = $1 AND business_id = $2",
        [req_item.raw_material_id, businessId]
      );
      if (!stockCheck.rows[0]) {
        return res.status(400).json({ error: `Raw material ID ${req_item.raw_material_id} not found` });
      }
      if (parseFloat(stockCheck.rows[0].stock) < req_item.required_qty) {
        return res.status(400).json({
          error: `Insufficient stock for "${stockCheck.rows[0].name}". `
               + `Required: ${req_item.required_qty}, Available: ${stockCheck.rows[0].stock}`,
        });
      }
    }

    await client.query("BEGIN");

    const productionRef = `PROD-${Date.now()}`;

    // Deduct raw materials
    for (const req_item of requirements) {
      await recordMovement(client, {
        businessId,
        productId:    req_item.raw_material_id,
        movementType: "PRODUCTION_OUT",
        quantity:     req_item.required_qty,
        referenceType: "production",
        notes:        `${notes || ""} | Production: ${quantity_to_produce} × ${bom.finished_good_name}`,
        userId,
      });
    }

    // Add finished goods to stock
    await recordMovement(client, {
      businessId,
      productId:    bom.finished_good_id,
      movementType: "PRODUCTION_IN",
      quantity:     parseFloat(quantity_to_produce),
      referenceType: "production",
      notes:        `${notes || ""} | BOM: ${bom.name}`,
      userId,
    });

    await client.query("COMMIT");

    res.status(201).json({
      message:              "Production run completed",
      finished_good:        bom.finished_good_name,
      quantity_produced:    quantity_to_produce,
      raw_materials_used:   requirements,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PRODUCTION RUN ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
//  CHECK FEASIBILITY — how many can be produced given current stock
//  GET /api/bom/:id/feasibility
// ─────────────────────────────────────────────────────────────
export const checkFeasibility = async (req, res) => {
  try {
    const { businessId } = req.user;

    const bom = await getFullBOM(req.params.id, businessId);
    if (!bom) return res.status(404).json({ error: "BOM not found" });

    const feasibility = [];
    let maxProducible = Infinity;

    for (const item of bom.items) {
      const stockRes = await pool.query(
        "SELECT stock, name, sku FROM products WHERE id = $1 AND business_id = $2",
        [item.raw_material_id, businessId]
      );
      const product = stockRes.rows[0];
      const available      = parseFloat(product?.stock || 0);
      const qtyRequired    = parseFloat(item.quantity_required);
      const canMake        = qtyRequired > 0 ? Math.floor(available / qtyRequired) * parseFloat(bom.yield_quantity) : Infinity;

      maxProducible = Math.min(maxProducible, canMake);

      feasibility.push({
        raw_material_id:  item.raw_material_id,
        raw_material_name: product?.name || "Unknown",
        sku:              product?.sku,
        quantity_required: qtyRequired,
        available_stock:  available,
        can_support_units: canMake,
        sufficient:       available >= qtyRequired,
      });
    }

    res.json({
      bom_id:          bom.id,
      finished_good:   bom.finished_good_name,
      yield_quantity:  bom.yield_quantity,
      max_producible:  maxProducible === Infinity ? 0 : maxProducible,
      ingredients:     feasibility,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to check feasibility" });
  }
};

// ─────────────────────────────────────────────────────────────
//  DELETE BOM
//  DELETE /api/bom/:id
// ─────────────────────────────────────────────────────────────
export const deleteBOM = async (req, res) => {
  try {
    const { businessId } = req.user;
    const result = await pool.query(
      "UPDATE bom_headers SET is_active=FALSE WHERE id=$1 AND business_id=$2 RETURNING id",
      [req.params.id, businessId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "BOM not found" });
    res.json({ message: "BOM archived" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete BOM" });
  }
};

// ─────────────────────────────────────────────────────────────
//  INTERNAL: full BOM with items
// ─────────────────────────────────────────────────────────────
export const getFullBOM = async (bomId, businessId) => {
  const bomResult = await pool.query(
    `SELECT bh.*, p.name AS finished_good_name, p.sku, p.stock AS current_stock, p.product_type
     FROM bom_headers bh
     JOIN products p ON p.id = bh.finished_good_id
     WHERE bh.id = $1 AND bh.business_id = $2`,
    [bomId, businessId]
  );
  if (!bomResult.rows[0]) return null;
  const bom = bomResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT
    bi.*,
    p.name AS raw_material_name,
    p.sku,
    p.stock AS available_stock,
    COALESCE(u.abbreviation,'') AS unit
FROM bom_items bi
JOIN products p
    ON p.id = bi.raw_material_id
LEFT JOIN units_of_measure u
    ON u.id = p.unit_id
WHERE bi.bom_header_id = $1
AND bi.business_id = $2`,
    [bomId, businessId]
  );
  bom.items = itemsResult.rows;
  return bom;
};
export const getFinishedProducts = async (req, res) => {
  try {
    const { businessId } = req.user;

    const result = await pool.query(
      `
      SELECT id,name,sku
      FROM products
      WHERE business_id = $1
      ORDER BY name
      `,
      [businessId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch products",
    });
  }
};