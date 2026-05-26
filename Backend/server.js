import express      from "express";
import dotenv       from "dotenv";
import cors         from "cors";
import cookieParser from "cookie-parser";
import authRoutes    from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes   from "./routes/orderRoute.js";
import crmRoutes     from "./routes/crmRoutes.js";
import { authMiddleware } from "./middlewares/authmiddleware.js";

dotenv.config();

const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://erpmodell.netlify.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => res.send("SmartERP Backend Running"));

app.use("/api/auth",     authRoutes);
app.use("/api/products", authMiddleware, productRoutes);
app.use("/api/orders",   authMiddleware, orderRoutes);
app.use("/api/crm",      authMiddleware, crmRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));