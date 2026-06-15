import express from "express";
import {
  exportProducts, exportInventory, exportSuppliers,
  exportCustomers, exportPurchaseOrders,
} from "../controllers/exportController.js";
 
const exportRouter = express.Router();
exportRouter.get("/products",        exportProducts);
exportRouter.get("/inventory",       exportInventory);
exportRouter.get("/suppliers",       exportSuppliers);
exportRouter.get("/customers",       exportCustomers);
exportRouter.get("/purchase-orders", exportPurchaseOrders);
export default exportRouter ;