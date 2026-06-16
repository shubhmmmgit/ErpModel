import express from "express";
import {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} from "../controllers/supplierController";

const router = express.Router();

router.get("/",     getSuppliers);
router.post("/",    createSupplier);
router.get("/:id",  getSupplierById);
router.put("/:id",  updateSupplier);
router.delete("/:id", deleteSupplier);

export default router;