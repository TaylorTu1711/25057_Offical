import express from "express";
import { register, login, getCurrentUser, logout } from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const authRoutes = express.Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.get("/me", authenticate, getCurrentUser);
authRoutes.post('/logout', authenticate, logout); 

export default authRoutes;
