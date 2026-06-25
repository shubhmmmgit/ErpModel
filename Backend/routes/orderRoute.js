import express from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  getOrderSummary
} from "../controllers/orderController.js";
import { authMiddleware } from "../middlewares/authmiddleware.js";

const router = express.Router();

// Summary (must come before /:id to avoid route conflict)
router.get("/summary", getOrderSummary);

// CRUD
router.get("/", authMiddleware, getOrders);
router.post("/", authMiddleware, createOrder);
router.get("/:id", authMiddleware, getOrderById);
router.patch("/:id/status", authMiddleware, updateOrderStatus);
router.delete("/:id", authMiddleware, deleteOrder);
router.get("/summary", authMiddleware, getOrderSummary);

export default router;