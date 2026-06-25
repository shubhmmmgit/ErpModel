
import pool from "../config/db.js";

// ─────────────────────────────────────────────────────────────
//  COLUMN MAPPINGS — maps common user column names → internal fields
// ─────────────────────────────────────────────────────────────
const PRODUCT_COLUMN_MAP = {
  name:          ["name","product name","item name","product","item","description"],
  sku:           ["sku","code","product code","item code","barcode","ref"],
  product_type:  ["type","product type","category type","item type"],
  price:         ["price","sale price","selling price","mrp","rate"],
  cost_price:    ["cost","cost price","purchase price","buy price","landed cost"],
  stock:         ["stock","quantity","qty","opening stock","current stock","balance"],
  min_stock:     ["min stock","minimum stock","reorder level","reorder point","reorder qty"],
  unit:          ["unit","uom","unit of measure","unit name"],
  category:      ["category","category name","group","item group"],
};

const SUPPLIER_COLUMN_MAP = {
  name:         ["name","supplier name","vendor name","party name"],
  email:        ["email","email address","mail"],
  phone:        ["phone","mobile","contact","phone number","mobile number"],
  address:      ["address","billing address","ship address"],
  gstin:        ["gstin","gst","gst no","gst number","tax id"],
  contact_name: ["contact name","contact person","attention","attn"],
  notes:        ["notes","remarks","comment"],
};

const CUSTOMER_COLUMN_MAP = {
  name:         ["name","customer name","client name","party name"],
  email:        ["email","email address"],
  phone:        ["phone","mobile","contact"],
  address:      ["address","billing address"],
  gstin:        ["gstin","gst","gst no"],
  notes:        ["notes","remarks"],
};

// ─────────────────────────────────────────────────────────────
//  MAP HEADERS to internal field names (case-insensitive, fuzzy)
// ─────────────────────────────────────────────────────────────
export const mapHeaders = (rawHeaders, columnMap) => {
  const mapping = {};
  rawHeaders.forEach((header, idx) => {
    const clean = header.toString().toLowerCase().trim();
    for (const [field, aliases] of Object.entries(columnMap)) {
      if (aliases.includes(clean)) {
        mapping[field] = idx;
        break;
      }
    }
  });
  return mapping;
};

// ─────────────────────────────────────────────────────────────
//  PARSE & VALIDATE — return { rows, errors }
// ─────────────────────────────────────────────────────────────
export const parseAndValidateProducts = (rawRows, headers) => {
  const map = mapHeaders(headers, PRODUCT_COLUMN_MAP);
  const errors = [];
  const rows   = [];

  rawRows.forEach((row, i) => {
    const rowNum = i + 2; // 1-based + header
    const name = row[map.name]?.toString().trim();

    if (!name) {
      errors.push({ row: rowNum, field: "name", message: "Product name is required" });
      return;
    }

    const price = parseFloat(row[map.price]) || 0;
    if (price < 0) {
      errors.push({ row: rowNum, field: "price", message: "Price cannot be negative" });
    }

    const rawType = (row[map.product_type] || "").toString().toUpperCase().trim();
    const TYPE_MAP = {
      "RAW": "RAW_MATERIAL", "RAW MATERIAL": "RAW_MATERIAL",
      "RAWMATERIAL": "RAW_MATERIAL", "RAW_MATERIAL": "RAW_MATERIAL",
      "FINISHED": "FINISHED_GOOD", "FINISHED GOOD": "FINISHED_GOOD",
      "FINISHED_GOOD": "FINISHED_GOOD", "FINISHEDGOOD": "FINISHED_GOOD",
      "SERVICE": "SERVICE", "SVC": "SERVICE",
      "CONSUMABLE": "CONSUMABLE",
      "PACKAGING": "PACKAGING",
    };
    const product_type = TYPE_MAP[rawType] || "FINISHED_GOOD";

    rows.push({
      name,
      sku:          row[map.sku]?.toString().trim() || null,
      product_type,
      price:        Math.max(0, parseFloat(row[map.price]) || 0),
      cost_price:   Math.max(0, parseFloat(row[map.cost_price]) || 0),
      stock:        Math.max(0, parseFloat(row[map.stock]) || 0),
      min_stock:    Math.max(0, parseFloat(row[map.min_stock]) || 0),
      unit_name:    row[map.unit]?.toString().trim() || null,
      category_name: row[map.category]?.toString().trim() || null,
      _rowNum: rowNum,
    });
  });

  return { rows, errors };
};

export const parseAndValidateSuppliers = (rawRows, headers) => {
  const map = mapHeaders(headers, SUPPLIER_COLUMN_MAP);
  const errors = [];
  const rows   = [];

  rawRows.forEach((row, i) => {
    const rowNum = i + 2;
    const name = row[map.name]?.toString().trim();

    if (!name) {
      errors.push({ row: rowNum, field: "name", message: "Supplier name is required" });
      return;
    }

    const email = row[map.email]?.toString().trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, field: "email", message: `Invalid email: ${email}` });
    }

    rows.push({
      name,
      email,
      phone:        row[map.phone]?.toString().trim() || null,
      address:      row[map.address]?.toString().trim() || null,
      gstin:        row[map.gstin]?.toString().trim() || null,
      contact_name: row[map.contact_name]?.toString().trim() || null,
      notes:        row[map.notes]?.toString().trim() || null,
      _rowNum: rowNum,
    });
  });

  return { rows, errors };
};

export const parseAndValidateCustomers = (rawRows, headers) => {
  const map = mapHeaders(headers, CUSTOMER_COLUMN_MAP);
  const errors = [];
  const rows   = [];

  rawRows.forEach((row, i) => {
    const rowNum = i + 2;
    const name = row[map.name]?.toString().trim();
    if (!name) {
      errors.push({ row: rowNum, field: "name", message: "Customer name is required" });
      return;
    }
    rows.push({
      name,
      email:   row[map.email]?.toString().trim() || null,
      phone:   row[map.phone]?.toString().trim() || null,
      address: row[map.address]?.toString().trim() || null,
      gstin:   row[map.gstin]?.toString().trim() || null,
      notes:   row[map.notes]?.toString().trim() || null,
      _rowNum: rowNum,
    });
  });

  return { rows, errors };
};

// ─────────────────────────────────────────────────────────────
//  BULK IMPORT PRODUCTS
// ─────────────────────────────────────────────────────────────
export const bulkImportProducts = async (rows, businessId, userId) => {
  const client = await pool.connect();
  let successRows = 0, failedRows = 0, duplicateRows = 0;
  const errorLog = [];

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      try {
        // Resolve category
        let categoryId = null;
        if (row.category_name) {
          const catRes = await client.query(
            `INSERT INTO product_categories (business_id, name)
             VALUES ($1, $2)
             ON CONFLICT (business_id, name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [businessId, row.category_name]
          );
          categoryId = catRes.rows[0].id;
        }

        // Resolve unit
        let unitId = null;
        if (row.unit_name) {
          const unitRes = await client.query(
            `INSERT INTO units_of_measure (business_id, name, abbreviation)
             VALUES ($1, $2, $3)
             ON CONFLICT (business_id, abbreviation) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [businessId, row.unit_name, row.unit_name.toLowerCase().slice(0, 10)]
          );
          unitId = unitRes.rows[0].id;
        }

        // Duplicate check by SKU (within this business)
        if (row.sku) {
          const dupCheck = await client.query(
            "SELECT id FROM products WHERE business_id = $1 AND sku = $2",
            [businessId, row.sku]
          );
          if (dupCheck.rows.length > 0) {
            duplicateRows++;
            errorLog.push({ row: row._rowNum, message: `Duplicate SKU: ${row.sku} — skipped` });
            continue;
          }
        }

  await client.query(
  `INSERT INTO products (
      business_id,
      name,
      sku,
      product_type,
      price,
      cost_price,
      stock,
      min_stock,
      track_inventory,
      is_active
   )
   VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      CASE WHEN $4 = 'SERVICE' THEN FALSE ELSE TRUE END,
      TRUE
   )`,
  [
    businessId,
    row.name,
    row.sku || null,
    row.product_type,
    row.price,
    row.cost_price,
    row.stock,
    row.min_stock
  ]
);

        // Record opening stock movement
        if (row.stock > 0) {
          const newProd = await client.query(
            "SELECT id FROM products WHERE business_id=$1 AND name=$2 ORDER BY created_at DESC LIMIT 1",
            [businessId, row.name]
          );
          if (newProd.rows[0]) {
            await client.query(
              `INSERT INTO inventory_movements
                 (business_id, product_id, movement_type, quantity, quantity_before, quantity_after,
                  unit_cost, total_cost, reference_type, notes, user_id)
               VALUES ($1,$2,'IMPORT',$3,0,$3,$4,$5,'import','Imported via bulk upload',$6)`,
              [businessId, newProd.rows[0].id, row.stock, row.cost_price, row.stock * row.cost_price, userId]
            );
          }
        }

        successRows++;
      } catch (rowErr) {
        failedRows++;
        errorLog.push({ row: row._rowNum, message: rowErr.message });
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { successRows, failedRows, duplicateRows, errorLog };
};

// ─────────────────────────────────────────────────────────────
//  BULK IMPORT SUPPLIERS
// ─────────────────────────────────────────────────────────────
export const bulkImportSuppliers = async (rows, businessId, userId) => {
  const client = await pool.connect();
  let successRows = 0, failedRows = 0, duplicateRows = 0;
  const errorLog = [];

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      try {
        // Duplicate by name within business
        const dup = await client.query(
          "SELECT id FROM suppliers WHERE business_id = $1 AND LOWER(name) = LOWER($2)",
          [businessId, row.name]
        );
        if (dup.rows.length > 0) {
          duplicateRows++;
          errorLog.push({ row: row._rowNum, message: `Duplicate supplier: ${row.name} — skipped` });
          continue;
        }

        await client.query(
          `INSERT INTO suppliers (
 business_id,
 name,
 email,
 phone,
 address,
 gstin,
 notes
)
           VALUES [
 businessId,
 row.name,
 row.email,
 row.phone,
 row.address,
 row.gstin,
 row.notes
]`,
          [businessId, row.name, row.email, row.phone, row.address, row.gstin, row.contact_name, row.notes]
        );
        successRows++;
      } catch (rowErr) {
        failedRows++;
        errorLog.push({ row: row._rowNum, message: rowErr.message });
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { successRows, failedRows, duplicateRows, errorLog };
};

// ─────────────────────────────────────────────────────────────
//  BULK IMPORT CUSTOMERS
// ─────────────────────────────────────────────────────────────
export const bulkImportCustomers = async (rows, businessId, userId) => {
  const client = await pool.connect();
  let successRows = 0, failedRows = 0, duplicateRows = 0;
  const errorLog = [];

  try {
    await client.query("BEGIN");
    for (const row of rows) {
      try {
        const dup = await client.query(
          "SELECT id FROM customers WHERE business_id = $1 AND LOWER(name) = LOWER($2)",
          [businessId, row.name]
        );
        if (dup.rows.length > 0) {
          duplicateRows++;
          errorLog.push({ row: row._rowNum, message: `Duplicate customer: ${row.name} — skipped` });
          continue;
        }
        await client.query(
          `INSERT INTO customers (business_id, name, email, phone, address, gstin, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [businessId, row.name, row.email, row.phone, row.address, row.gstin, row.notes]
        );
        successRows++;
      } catch (rowErr) {
        failedRows++;
        errorLog.push({ row: row._rowNum, message: rowErr.message });
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { successRows, failedRows, duplicateRows, errorLog };
};

// ─────────────────────────────────────────────────────────────
//  LOG IMPORT HISTORY (always scoped to businessId)
// ─────────────────────────────────────────────────────────────
export const logImportHistory = async ({
  businessId, userId, entityType, fileName,
  totalRows, successRows, failedRows, duplicateRows,
  status = "completed", errorLog = [],
}) => {
  await pool.query(
    `INSERT INTO import_history
       (business_id, user_id, entity_type, file_name,
        total_rows, success_rows, failed_rows, duplicate_rows, status, error_log)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [businessId, userId, entityType, fileName,
     totalRows, successRows, failedRows, duplicateRows, status, JSON.stringify(errorLog)]
  );
};