import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { attachUserScope, requirePortal } from '../middleware/portalMiddleware.js';
import { addMidaCncMachine, bootMidaCncMachineData, deleteMidaCncMachine, getMidaCncMachineAlarms, getMidaCncMachineById, getMidaCncMachineTelemetry, getMidaCncMachines, getPortalHome, updateMidaMachineLayout } from '../controllers/portalController.js';
import { PORTALS } from '../utils/userScope.js';
import { machineImageUpload } from '../utils/upload.js';

const portalRoutes = express.Router();

portalRoutes.use(authenticate, attachUserScope);
portalRoutes.get('/me', getPortalHome);
portalRoutes.get('/mida/cnc-machines/:machine_id', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineById);
portalRoutes.get('/mida/cnc-machines/:machine_id/telemetry', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineTelemetry);
portalRoutes.get('/mida/cnc-machines/:machine_id/alarms', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineAlarms);
portalRoutes.delete('/mida/cnc-machines/:machine_id/boot', requirePortal(PORTALS.MIDA_CNC), bootMidaCncMachineData);
portalRoutes.patch('/mida/cnc-machines/:machine_id/layout', requirePortal(PORTALS.MIDA_CNC), updateMidaMachineLayout);
portalRoutes.delete('/mida/cnc-machines/:machine_id', requirePortal(PORTALS.MIDA_CNC), deleteMidaCncMachine);
portalRoutes.get('/mida/cnc-machines', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachines);
portalRoutes.post(
  '/mida/machines',
  requirePortal(PORTALS.MIDA_CNC),
  machineImageUpload.single('image_url'),
  addMidaCncMachine,
);
export default portalRoutes;
