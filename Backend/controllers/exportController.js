// controllers/exportController.js
// Phase 3: Export Products, Inventory, Suppliers, Customers, Purchase data
// Always filtered by businessId — tenants can only export their own data
import * as XLSX from "xlsx";
import pool from "../config/db.js";

// ─────────────────────────────────────────────────────────────
//  HELPER — build and send Excel/CSV response
// ─────────────────────────────────────────────────────────────
const sendExport = (res, data, filename, format = "xlsx") => {
  if (!data || data.length === 0) {
    return res.status(404).json({ error: "No data to export" });
  }

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = Object.keys(data[0]).map(() => ({ wch: 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.setHeader("Content-Type", "text/csv");
    return res.send(csv);
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
};

// ─────────────────────────────────────────────────────────────
//  EXPORT PRODUCTS
//  GET /api/export/products?format=xlsx&type=RAW_MATERIAL
// ─────────────────────────────────────────────────────────────
export const exportProducts = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { format = "xlsx", type, category_id, lowStock } = req.query;

    const params = [businessId];
    let where = "p.business_id = $1 AND p.is_active = TRUE";

    if (type) { params.push(type); where += ` AND p.product_type = $${params.length}`; }
    
    if (lowStock === "true") where += " AND p.stock <= p.min_stock AND p.min_stock > 0";

    const result = await pool.query(
      `SELECT
         p.sku           AS "SKU",
         p.name          AS "Product Name",
         p.product_type  AS "Type",
         p.price         AS "Sale Price",
         p.cost_price    AS "Cost Price",
         p.stock         AS "Stock",
         p.min_stock     AS "Min Stock",
         p.stock * p.cost_price AS "Stock Value (Cost)",
         p.stock * p.price     AS "Stock Value (Sale)",
         CASE WHEN p.stock <= p.min_stock AND p.min_stock > 0 THEN 'LOW' ELSE 'OK' END AS "Stock Status",
         TO_CHAR(p.created_at, 'DD-Mon-YYYY') AS "Created"
       FROM products p
       WHERE ${where}
       ORDER BY p.name`,
      params
    );

    sendExport(res, result.rows, `products_export_${Date.now()}`, format);
  } catch (err) {
    console.error("EXPORT PRODUCTS ERROR:", err);
    res.status(500).json({ error: "Export failed" });
  }
};

// ─────────────────────────────────────────────────────────────
//  EXPORT INVENTORY MOVEMENTS
//  GET /api/export/inventory?format=xlsx&from=2024-01-01&to=2024-12-31
// ─────────────────────────────────────────────────────────────
export const exportInventory = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { format = "xlsx", product_id, type, from, to } = req.query;

    const params = [businessId];
    let where = "im.business_id = $1";

    if (product_id) { params.push(parseInt(product_id)); where += ` AND im.product_id = $${params.length}`; }
    if (type)       { params.push(type);                  where += ` AND im.movement_type = $${params.length}`; }
    if (from)       { params.push(from);                  where += ` AND im.created_at >= $${params.length}`; }
    if (to)         { params.push(to);                    where += ` AND im.created_at <= $${params.length}`; }

    const result = await pool.query(
      `SELECT
         TO_CHAR(im.created_at,'DD-Mon-YYYY HH24:MI') AS "Date",
         p.sku            AS "SKU",
         p.name           AS "Product",
         im.movement_type AS "Movement Type",
         im.quantity      AS "Quantity",
         im.quantity_before AS "Stock Before",
         im.quantity_after  AS "Stock After",
         im.unit_cost     AS "Unit Cost",
         im.total_cost    AS "Total Cost",
         COALESCE(im.reference_type,'') AS "Reference Type",
         COALESCE(im.reference_id::text,'') AS "Reference ID",
         COALESCE(im.notes,'')  AS "Notes",
         COALESCE(u.name,'System') AS "Done By"
       FROM inventory_movements im
       JOIN products p ON p.id = im.product_id
       LEFT JOIN users u ON u.id = im.user_id
       WHERE ${where}
       ORDER BY im.created_at DESC`,
      params
    );

    sendExport(res, result.rows, `inventory_movements_${Date.now()}`, format);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
};

// ─────────────────────────────────────────────────────────────
//  EXPORT SUPPLIERS
//  GET /api/export/suppliers?format=xlsx
// ─────────────────────────────────────────────────────────────
export const exportSuppliers = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { format = "xlsx" } = req.query;

    const result = await pool.query(
      `SELECT
  name AS "Supplier Name",
  email AS "Email",
  phone AS "Phone",
  gstin AS "GSTIN",
  address AS "Address",
  city AS "City",
  country AS "Country",
  payment_terms AS "Payment Terms",
  lead_time_days AS "Lead Time Days",
  rating AS "Rating",
  status AS "Status",
  notes AS "Notes",
  TO_CHAR(created_at,'DD-Mon-YYYY') AS "Created"
FROM suppliers`,
      [businessId]
    );

    sendExport(res, result.rows, `suppliers_export_${Date.now()}`, format);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
};

// ─────────────────────────────────────────────────────────────
//  EXPORT CUSTOMERS
//  GET /api/export/customers?format=xlsx
// ─────────────────────────────────────────────────────────────
export const exportCustomers = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { format = "xlsx" } = req.query;

    const result = await pool.query(
      `SELECT
  name AS "Customer Name",
  email AS "Email",
  phone AS "Phone",
  tags AS "Tags",
  notes AS "Notes",
  TO_CHAR(created_at,'DD-Mon-YYYY') AS "Created"
FROM customers`,
      [businessId]
    );

    sendExport(res, result.rows, `customers_export_${Date.now()}`, format);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
};

// ─────────────────────────────────────────────────────────────
//  EXPORT PURCHASE ORDERS
//  GET /api/export/purchase-orders?format=xlsx&status=received
// ─────────────────────────────────────────────────────────────
export const exportPurchaseOrders = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { format = "xlsx", status, from, to } = req.query;

    const params = [businessId];
    let where = "po.business_id = $1";

    if (status) { params.push(status); where += ` AND po.status = $${params.length}`; }
    if (from)   { params.push(from);   where += ` AND po.created_at >= $${params.length}`; }
    if (to)     { params.push(to);     where += ` AND po.created_at <= $${params.length}`; }

    const result = await pool.query(
  `
 SELECT
  po.po_number AS "PO Number",
  po.status AS "Status",
  COALESCE(s.name,'') AS "Supplier",
  po.total_amount AS "Total Amount",
  TO_CHAR(po.order_date,'DD-Mon-YYYY') AS "Order Date",
  TO_CHAR(po.created_at,'DD-Mon-YYYY HH24:MI') AS "Created"
  FROM purchase_orders po
  LEFT JOIN suppliers s
    ON s.id = po.supplier_id
  WHERE ${where}
  ORDER BY po.created_at DESC
  `,
  params
);
    sendExport(res, result.rows, `purchase_orders_${Date.now()}`, format);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
};