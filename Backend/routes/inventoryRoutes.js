import express from "express";
import { signup, login, logout, getMe } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authmiddleware.js";
 
const router = express.Router();
router.post("/signup",  signup);
router.post("/login",   login);
router.post("/logout",  logout);
router.get("/me",       authMiddleware, getMe);
export default router  ;