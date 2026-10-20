import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";

import {getProductivity} from "../controllers/detailMachineController.js";

const detailMachineRoutes = express.Router();


detailMachineRoutes.get("/", getProductivity);




export default detailMachineRoutes;