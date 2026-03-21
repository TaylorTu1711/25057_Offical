import express from "express";

import { bootData } from "../controllers/bootData.js";

const deleteDataToBoot = express.Router();


deleteDataToBoot.delete("/:id", bootData);



export default deleteDataToBoot;
