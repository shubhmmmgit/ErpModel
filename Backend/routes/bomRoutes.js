import express from "express";
import {
  createBOM, getBOMs, getBOMById, runProduction,
  checkFeasibility, deleteBOM,getFinishedProducts
} from "../controllers/bomController.js";
 
const bomRouter = express.Router();
bomRouter.get("/",                   getBOMs);
bomRouter.get("/products", getFinishedProducts);
bomRouter.post("/",                  createBOM);
bomRouter.get("/:id",                getBOMById);
bomRouter.delete("/:id",             deleteBOM);
bomRouter.post("/:id/produce",       runProduction);
bomRouter.get("/:id/feasibility",    checkFeasibility);
export default bomRouter;