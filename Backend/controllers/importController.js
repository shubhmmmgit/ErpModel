// controllers/importController.js
// Phase 2: File upload → parse → preview → confirm → bulk insert
// Uses multer (memory storage) + xlsx library
import * as XLSX from "xlsx";
import pool from "../config/db.js";
import {
  parseAndValidateProducts,
  parseAndValidateSuppliers,
  parseAndValidateCustomers,
  bulkImportProducts,
  bulkImportSuppliers,
  bulkImportCustomers,
  logImportHistory,
} from "../services/importService.js";

// ─────────────────────────────────────────────────────────────
//  PARSE uploaded file buffer → [headers[], rows[][]]
// ─────────────────────────────────────────────────────────────
const parseFile = (buffer, mimetype, originalname) => {
  let workbook;
  const ext = originalname.split(".").pop().toLowerCase();

  if (ext === "csv" || mimetype === "text/csv") {
    workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  } else if (["xlsx","xls"].includes(ext)) {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } else {
    throw new Error("Unsupported file type. Please upload .xlsx, .xls, or .csv");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];

  // Convert to array of arrays (AOA) — first row = headers
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (aoa.length < 2) throw new Error("File is empty or has only headers");

  const headers = aoa[0].map((h) => h?.toString() || "");
  const dataRows = aoa.slice(1).filter((row) =>
    row.some((cell) => cell !== null && cell !== undefined && cell !== "")
  );

  return { headers, dataRows };
};

// ─────────────────────────────────────────────────────────────
//  PREVIEW (parse + validate but don't insert)
//  POST /api/import/preview
//  multipart: file + entity_type
// ─────────────────────────────────────────────────────────────
export const previewImport = async (req, res) => {
  try {
    const { businessId } = req.user;

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const entityType = req.body.entity_type;
    const VALID_ENTITIES = ["products","suppliers","customers"];
    if (!VALID_ENTITIES.includes(entityType)) {
      return res.status(400).json({ error: `entity_type must be: ${VALID_ENTITIES.join(", ")}` });
    }

    const { headers, dataRows } = parseFile(req.file.buffer, req.file.mimetype, req.file.originalname);

    let parseResult;
    if (entityType === "products") {
      parseResult = parseAndValidateProducts(dataRows, headers);
    } else if (entityType === "suppliers") {
      parseResult = parseAndValidateSuppliers(dataRows, headers);
    } else {
      parseResult = parseAndValidateCustomers(dataRows, headers);
    }

    // Return preview (first 20 rows) + full validation summary
    res.json({
      entity_type:  entityType,
      file_name:    req.file.originalname,
      total_rows:   dataRows.length,
      valid_rows:   parseResult.rows.length,
      invalid_rows: parseResult.errors.length,
      errors:       parseResult.errors,
      preview:      parseResult.rows.slice(0, 20),
      headers,
      // Encoded payload for confirmation step (avoids re-parsing)
      _payload: Buffer.from(JSON.stringify(parseResult.rows)).toString("base64"),
    });
  } catch (err) {
    console.error("PREVIEW ERROR:", err);
    res.status(400).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  CONFIRM IMPORT (uses pre-parsed payload from preview)
//  POST /api/import/confirm
//  Body: { entity_type, _payload, file_name }
// ─────────────────────────────────────────────────────────────
export const confirmImport = async (req, res) => {
  try {
    const { businessId, userId } = req.user;
    const { entity_type, _payload, file_name } = req.body;

    if (!_payload) return res.status(400).json({ error: "Missing payload — re-upload the file" });

    const rows = JSON.parse(Buffer.from(_payload, "base64").toString("utf8"));

    let result;
    if (entity_type === "products") {
      result = await bulkImportProducts(rows, businessId, userId);
    } else if (entity_type === "suppliers") {
      result = await bulkImportSuppliers(rows, businessId, userId);
    } else if (entity_type === "customers") {
      result = await bulkImportCustomers(rows, businessId, userId);
    } else {
      return res.status(400).json({ error: "Invalid entity_type" });
    }

    // Log to import_history
    await logImportHistory({
      businessId, userId, entityType: entity_type,
      fileName:     file_name || "upload",
      totalRows:    rows.length,
      successRows:  result.successRows,
      failedRows:   result.failedRows,
      duplicateRows: result.duplicateRows,
      errorLog:     result.errorLog,
    });

    res.json({
      message:        "Import completed",
      total_rows:     rows.length,
      success_rows:   result.successRows,
      failed_rows:    result.failedRows,
      duplicate_rows: result.duplicateRows,
      errors:         result.errorLog,
    });
  } catch (err) {
    console.error("CONFIRM IMPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET IMPORT HISTORY
//  GET /api/import/history
// ─────────────────────────────────────────────────────────────
export const getImportHistory = async (req, res) => {
  try {
    const { businessId } = req.user;
    const result = await pool.query(
      `SELECT ih.*, u.name AS imported_by
       FROM import_history ih
       LEFT JOIN users u ON u.id = ih.user_id
       WHERE ih.business_id = $1
       ORDER BY ih.created_at DESC
       LIMIT 50`,
      [businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch import history" });
  }
};

// ─────────────────────────────────────────────────────────────
//  DOWNLOAD TEMPLATE
//  GET /api/import/template/:entity_type
// ─────────────────────────────────────────────────────────────
export const downloadTemplate = (req, res) => {
  const { entity_type } = req.params;

  const templates = {
    products: {
      headers: ["name","sku","type","price","cost","stock","min_stock","unit","category"],
      sample:  [
        ["T-Shirt Red","SKU-001","FINISHED_GOOD",499,250,100,10,"pcs","Apparel"],
        ["Cotton Fabric","SKU-002","RAW_MATERIAL",120,80,500,50,"meters","Fabric"],
        ["Delivery Service","SKU-003","SERVICE",200,0,0,0,"","Services"],
      ],
    },
    suppliers: {
      headers: ["name","email","phone","address","gstin","contact_name","notes"],
      sample:  [
        ["Sharma Textiles","sharma@example.com","9876543210","Mumbai","29AABCT1332L1ZX","Rohit Sharma","Key fabric supplier"],
        ["Global Packaging","gp@example.com","9123456780","Delhi","07AAACG2115R1ZN","Priya Gupta",""],
      ],
    },
    customers: {
      headers: ["name","email","phone","address","gstin","notes"],
      sample:  [
        ["Rahul Enterprises","rahul@example.com","9988776655","Chennai","33AAABR1234C1ZE","VIP customer"],
        ["Metro Stores","metro@metro.in","9911223344","Bengaluru","","Bulk buyer"],
      ],
    },
  };

  const tpl = templates[entity_type];
  if (!tpl) return res.status(400).json({ error: "Invalid entity type" });

  const wb = XLSX.utils.book_new();
  const wsData = [tpl.headers, ...tpl.sample];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Style header row (bold hint via column widths)
  ws["!cols"] = tpl.headers.map(() => ({ wch: 20 }));

  XLSX.utils.book_append_sheet(wb, ws, entity_type);

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", `attachment; filename="${entity_type}_import_template.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
};