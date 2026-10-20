import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";

import { getErrorsMachine } from "../controllers/errorMachineController.js";

const errorsMachineRoutes = express.Router();


errorsMachineRoutes.get("/", getErrorsMachine);



export default errorsMachineRoutes;