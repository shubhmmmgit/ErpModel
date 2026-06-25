
import pool from "../config/db.js";
import { recordMovement } from "./inventoryController.js";


const generatePoNumber = async (client, businessId) => {
  const res = await client.query(
    "SELECT COUNT(*) FROM purchase_orders WHERE business_id = $1",
    [businessId]
  );
  const seq = parseInt(res.rows[0].count) + 1;
  return `PO-${businessId}-${String(seq).padStart(5, "0")}`;
};

const generateGrnNumber = async (client, businessId) => {
  const res = await client.query(
    "SELECT COUNT(*) FROM goods_receipts WHERE business_id = $1",
    [businessId]
  );
  const seq = parseInt(res.rows[0].count) + 1;
  return `GRN-${businessId}-${String(seq).padStart(5, "0")}`;
};


export const createPurchaseOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { businessId, userId } = req.user;
    const { supplier_id, expected_date, notes, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0 || !item.unit_price) {
        return res.status(400).json({ error: "Each item needs product_id, quantity > 0, and unit_price" });
      }
    }

    await client.query("BEGIN");

    // Verify all products belong to this business
    const productIds = items.map((i) => i.product_id);
    const prodCheck = await client.query(
      "SELECT id FROM products WHERE id = ANY($1::int[]) AND business_id = $2",
      [productIds, businessId]
    );
    if (prodCheck.rows.length !== productIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "One or more products not found" });
    }

    // Verify supplier (if provided)
    if (supplier_id) {
      const supCheck = await client.query(
        "SELECT id FROM suppliers WHERE id = $1 AND business_id = $2",
        [supplier_id, businessId]
      );
      if (!supCheck.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Supplier not found" });
      }
    }

    const poNumber   = await generatePoNumber(client, businessId);
    const totalAmount = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

    const poResult = await client.query(
      `INSERT INTO purchase_orders
         (business_id, user_id, supplier_id, po_number, status, expected_date, notes, total_amount)
       VALUES ($1,$2,$3,$4,'draft',$5,$6,$7) RETURNING *`,
      [businessId, userId, supplier_id || null, poNumber, expected_date || null, notes || null, totalAmount]
    );
    const po = poResult.rows[0];

    // Insert items
    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_order_items
           (purchase_order_id, business_id, product_id, quantity_ordered, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [po.id, businessId, item.product_id, item.quantity, item.unit_price]
      );
    }

    await client.query("COMMIT");

    const full = await getFullPO(po.id, businessId);
    res.status(201).json(full);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE PO ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
//  GET ALL PURCHASE ORDERS
//  GET /api/purchase-orders?status=draft&page=1&limit=20
// ─────────────────────────────────────────────────────────────
export const getPurchaseOrders = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [businessId];
    let where = "po.business_id = $1";

    if (status) {
      params.push(status);
      where += ` AND po.status = $${params.length}`;
    }

    const result = await pool.query(
      `SSELECT
    po.*,

    s.name AS supplier_name,

    COUNT(poi.id) AS item_count,

    COALESCE(
        SUM(
            (
                poi.quantity * poi.unit_price
                -
                (
                    poi.quantity
                    * poi.unit_price
                    * poi.discount_percent / 100
                )
            )
            *
            (
                1 + poi.tax_percent / 100
            )
        ),
        0
    ) AS calculated_total
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
       WHERE ${where}
       GROUP BY 
       po.id, 
       s.name
       ORDER BY po.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM purchase_orders po WHERE ${where}`,
      params
    );

    res.json({
      purchaseOrders: result.rows,
      pagination: {
        total:      parseInt(countResult.rows[0].count),
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch purchase orders" });
  }
};


export const getPurchaseOrderById = async (req, res) => {
  try {
    const { businessId } = req.user;
    const full = await getFullPO(req.params.id, businessId);
    if (!full) return res.status(404).json({ error: "Purchase order not found" });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch purchase order" });
  }
};


export const updatePOStatus = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { status } = req.body;
    const VALID = ["draft","sent","partial","received","cancelled"];

    if (!VALID.includes(status)) {
      return res.status(400).json({ error: `Status must be: ${VALID.join(", ")}` });
    }

    const result = await pool.query(
      "UPDATE purchase_orders SET status=$1 WHERE id=$2 AND business_id=$3 RETURNING *",
      [status, req.params.id, businessId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "PO not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update status" });
  }
};


export const receiveGoods = async (req, res) => {
  const client = await pool.connect();
  try {
    const { businessId, userId } = req.user;
    const poId = parseInt(req.params.id);
    const { items, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item required for receipt" });
    }

    // Verify PO belongs to this business
    const poCheck = await pool.query(
      "SELECT * FROM purchase_orders WHERE id = $1 AND business_id = $2",
      [poId, businessId]
    );
    if (!poCheck.rows[0]) return res.status(404).json({ error: "Purchase order not found" });
    if (poCheck.rows[0].status === "cancelled") {
      return res.status(400).json({ error: "Cannot receive against a cancelled PO" });
    }

    await client.query("BEGIN");

    const grnNumber = await generateGrnNumber(client, businessId);

    const grnResult = await client.query(
      `INSERT INTO goods_receipts
         (business_id, purchase_order_id, user_id, grn_number, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [businessId, poId, userId, grnNumber, notes || null]
    );
    const grn = grnResult.rows[0];

    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Each receipt item needs product_id and quantity > 0" });
      }

      // Verify product is on this PO and belongs to this business
      const poItemCheck = await client.query(
        `SELECT poi.* FROM purchase_order_items poi
         JOIN products p ON p.id = poi.product_id
         WHERE poi.id = $1 AND poi.purchase_order_id = $2 AND poi.business_id = $3`,
        [item.po_item_id, poId, businessId]
      );

      // Insert GRN item
      await client.query(
        `INSERT INTO goods_receipt_items
           (goods_receipt_id, business_id, product_id, po_item_id, quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [grn.id, businessId, item.product_id, item.po_item_id || null, item.quantity, item.unit_price || 0]
      );

      // Update PO item received quantity
      if (item.po_item_id) {
        await client.query(
          "UPDATE purchase_order_items SET quantity_received = quantity_received + $1 WHERE id = $2 AND business_id = $3",
          [item.quantity, item.po_item_id, businessId]
        );
      }

      // ── KEY: Record stock movement (PURCHASE) — this updates products.stock ──
      await recordMovement(client, {
        businessId,
        productId:    item.product_id,
        movementType: "PURCHASE",
        quantity:     parseFloat(item.quantity),
        unitCost:     parseFloat(item.unit_price || 0),
        referenceType: "goods_receipt",
        referenceId:  grn.id,
        notes:        `GRN: ${grnNumber}`,
        userId,
      });
    }

    // Update PO status: partial or received
    const poItemsResult = await client.query(
      "SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE purchase_order_id = $1 AND business_id = $2",
      [poId, businessId]
    );
    const allReceived = poItemsResult.rows.every(
      (r) => parseFloat(r.quantity_received) >= parseFloat(r.quantity_ordered)
    );
    const anyReceived = poItemsResult.rows.some((r) => parseFloat(r.quantity_received) > 0);

    await client.query(
      "UPDATE purchase_orders SET status = $1 WHERE id = $2 AND business_id = $3",
      [allReceived ? "received" : anyReceived ? "partial" : "sent", poId, businessId]
    );

    await client.query("COMMIT");
    res.status(201).json({ message: "Goods received and stock updated", grn_number: grnNumber, grn_id: grn.id });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("RECEIVE GOODS ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
//  GET GOODS RECEIPTS FOR A PO
//  GET /api/purchase-orders/:id/receipts
// ─────────────────────────────────────────────────────────────
export const getGoodsReceipts = async (req, res) => {
  try {
    const { businessId } = req.user;
    const poId = parseInt(req.params.id);

    const result = await pool.query(
      `SELECT gr.*, 
              json_agg(json_build_object(
                'product_id', gri.product_id,
                'product_name', p.name,
                'sku', p.sku,
                'quantity', gri.quantity,
                'unit_price', gri.unit_price
              )) AS items
       FROM goods_receipts gr
       JOIN goods_receipt_items gri ON gri.goods_receipt_id = gr.id
       JOIN products p ON p.id = gri.product_id
       WHERE gr.purchase_order_id = $1 AND gr.business_id = $2
       GROUP BY gr.id
       ORDER BY gr.created_at DESC`,
      [poId, businessId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch goods receipts" });
  }
};

// ─────────────────────────────────────────────────────────────
//  INTERNAL: build full PO with items
// ─────────────────────────────────────────────────────────────
const getFullPO = async (poId, businessId) => {
  const poResult = await pool.query(
    `SELECT po.*, s.name AS supplier_name, s.email AS supplier_email
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.id = $1 AND po.business_id = $2`,
    [poId, businessId]
  );
  if (!poResult.rows[0]) return null;
  const po = poResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT poi.*, p.name AS product_name, p.sku
     FROM purchase_order_items poi
     JOIN products p ON p.id = poi.product_id
     WHERE poi.purchase_order_id = $1 AND poi.business_id = $2`,
    [poId, businessId]
  );
  po.items = itemsResult.rows;
  return po;
};