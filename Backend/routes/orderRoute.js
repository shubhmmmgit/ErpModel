import express from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  getOrderSummary
} from "../controllers/orderController.js";

const router = express.Router();

// Summary (must come before /:id to avoid route conflict)
router.get("/summary", getOrderSummary);

// CRUD
router.get("/", getOrders);
router.post("/", createOrder);
router.get("/:id", getOrderById);
router.patch("/:id/status", updateOrderStatus);
router.delete("/:id", deleteOrder);

export default router;