import express from "express";
import {
  getCustomers,
  getCustomerDetail,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getLeads,
  createLead,
  updateLeadStatus,
  convertLead,
  deleteLead,
  addInteraction,
  getFollowUps,
  createFollowUp,
  markFollowUpDone,
  getCRMSummary
} from "../controllers/crmController.js";

const router = express.Router();

// ── Dashboard ──────────────────────────────────────────────
router.get("/summary", getCRMSummary);

// ── Customers ──────────────────────────────────────────────
router.get("/customers",        getCustomers);
router.post("/customers",       createCustomer);
router.get("/customers/:id",    getCustomerDetail);
router.put("/customers/:id",    updateCustomer);
router.delete("/customers/:id", deleteCustomer);

// ── Leads ──────────────────────────────────────────────────
router.get("/leads",                 getLeads);
router.post("/leads",                createLead);
router.patch("/leads/:id/status",    updateLeadStatus);
router.post("/leads/:id/convert",    convertLead);
router.delete("/leads/:id",          deleteLead);

// ── Interactions ───────────────────────────────────────────
router.post("/interactions", addInteraction);

// ── Follow-ups ─────────────────────────────────────────────
router.get("/followups",              getFollowUps);
router.post("/followups",             createFollowUp);
router.patch("/followups/:id/done",   markFollowUpDone);

export default router;