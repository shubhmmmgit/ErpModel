import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes    from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes   from "./routes/orderRoute.js";
import crmRoutes from "./routes/crmRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import { authMiddleware } from "./middlewares/authmiddleware.js";
import inventoryRoutes  from "./routes/inventoryRoutes.js";
import importRoutes     from "./routes/importRoutes.js";
import exportRoutes     from "./routes/exportRoutes.js";
import bomRoutes        from "./routes/bomRoutes.js";
import categoryRoutes   from "./routes/categoryRoutes.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://erpmodell.netlify.app"
  ],
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());   // must be before routes

app.get("/", (req, res) => res.send("ERP Backend Running"));

// ── Public ──
app.use("/api/auth", authRoutes);

// ── Protected ──
app.use("/api/products",          authMiddleware, productRoutes);
app.use("/api/orders",            authMiddleware, orderRoutes);
app.use("/api/crm", crmRoutes);
app.use("/api/purchase", authMiddleware, purchaseRoutes);
app.use("/api/suppliers",       authMiddleware, supplierRoutes);
app.use("/api/import",          authMiddleware, importRoutes);
app.use("/api/export",          authMiddleware, exportRoutes);
app.use("/api/bom",             authMiddleware, bomRoutes);
app.use("/api/categories",      authMiddleware, categoryRoutes);

app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

const PORT = process.env.PORT || 8080;
const RENDER_URL = "https://erpmodel.onrender.com";
setInterval(() => {
  fetch(`${RENDER_URL}/`)
    .then(() => console.log("Self-ping OK"))
    .catch((e) => console.log("Self-ping failed:", e.message));
}, 14 * 60 * 1000);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
