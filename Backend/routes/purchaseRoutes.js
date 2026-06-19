
import express from "express";

// ── Controllers ───────────────────────────────────────────────
import {
  createSupplier, getSuppliers, getSupplierById,
  updateSupplier, deleteSupplier
} from "../controllers/supplierController.js";

import {
  createPR, getPRs, getPRById, approvePR, rejectPR
} from "../controllers/purchaseRequisitionController.js";

import {
  createRFQ, getRFQs, getRFQById,
  submitQuotation, selectSupplier
} from "../controllers/rfqController.js";

import {
  createPO, getPOs, getPOById, updatePOStatus
} from "../controllers/purchaseOrderController.js";

import {
  createGRN, getGRNs, getGRNById
} from "../controllers/grnController.js";

import {
  createInvoice, getInvoices, recordPayment,
  createReturn, getReturns, updateReturnStatus
} from "../controllers/invoiceController.js";

import { getPurchaseDashboard } from "../controllers/purchaseDashboardController.js";
import { getActivityLog } from "../controllers/purchaseActivityController.js";
import { authMiddleware } from "../middlewares/authmiddleware.js";

const router = express.Router();

// ── Dashboard ────────────────────────────────────────────────
router.get("/dashboard",authMiddleware, getPurchaseDashboard);

// ── Activity Log ──────────────────────────────────────────────
router.get("/activity", getActivityLog);

// ── Suppliers ─────────────────────────────────────────────────
router.get   ("/suppliers",       getSuppliers);
router.post  ("/suppliers",       createSupplier);
router.get   ("/suppliers/:id",   getSupplierById);
router.put   ("/suppliers/:id",   updateSupplier);
router.delete("/suppliers/:id",   deleteSupplier);

// ── Purchase Requisitions ─────────────────────────────────────
router.get   ("/requisitions",               getPRs);
router.post  ("/requisitions",               createPR);
router.get   ("/requisitions/:id",           getPRById);
router.patch ("/requisitions/:id/approve",   approvePR);
router.patch ("/requisitions/:id/reject",    rejectPR);

// ── RFQs ──────────────────────────────────────────────────────
router.get   ("/rfqs",                                    getRFQs);
router.post  ("/rfqs",                                    createRFQ);
router.get   ("/rfqs/:id",                                getRFQById);
router.post  ("/rfqs/:rfq_id/quotation/:supplier_id",     submitQuotation);
router.patch ("/rfqs/:rfq_id/select-supplier",            selectSupplier);

// ── Purchase Orders ───────────────────────────────────────────
router.get   ("/orders",          getPOs);
router.post  ("/orders",     authMiddleware,     createPO);
router.get   ("/orders/:id",      getPOById);
router.patch ("/orders/:id/status", updatePOStatus);

// ── Goods Receipts (GRN) ──────────────────────────────────────
router.get   ("/grn",       getGRNs);
router.post  ("/grn",       createGRN);
router.get   ("/grn/:id",   getGRNById);

// ── Invoices ──────────────────────────────────────────────────
router.get   ("/invoices",            getInvoices);
router.post  ("/invoices",            createInvoice);
router.patch ("/invoices/:id/payment", recordPayment);

// ── Returns ───────────────────────────────────────────────────
router.get   ("/returns",          getReturns);
router.post  ("/returns",          createReturn);
router.patch ("/returns/:id/status", updateReturnStatus);

export default router;