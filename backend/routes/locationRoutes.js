import express from "express";
import { getLocations, getAllLocations} from "../controllers/locationController.js";


const locationRoutes = express.Router();

locationRoutes.get("/", getLocations);
locationRoutes.get("/alllocations", getAllLocations);


export default locationRoutes;
