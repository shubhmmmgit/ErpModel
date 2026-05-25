import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoute.js";
import crmRoutes     from "./routes/crmRoutes.js";  
import { authMiddleware } from "./middlewares/authmiddleware.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://erpmodell.netlify.app"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
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