import express from "express";
import { getStatus } from "../controllers/statusMachineController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const statusRoutes = express.Router();

statusRoutes.get("/", getStatus);



export default statusRoutes;