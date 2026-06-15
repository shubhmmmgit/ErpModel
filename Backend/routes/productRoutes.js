import express from "express";
import {
  addProduct,
  getProducts,
  deleteProduct,
  updateProduct,
} from "../controllers/productController.js";

import { authMiddleware } from "../middlewares/authmiddleware.js"; 

const router = express.Router();


router.get("/", authMiddleware, getProducts);        
router.post("/add", authMiddleware, addProduct);
router.put("/:id", authMiddleware, updateProduct);
router.delete("/:id", authMiddleware, deleteProduct);


export default router;