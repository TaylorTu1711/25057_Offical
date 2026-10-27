import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { attachUserScope, requirePortal } from '../middleware/portalMiddleware.js';
import { addMidaCncMachine, bootMidaCncMachineData, deleteMidaCncMachine, deleteMidaCncMachineDowntime, getMidaCncMachineAlarms, getMidaCncMachineById, getMidaCncMachineDailySetup, getMidaCncMachineDowntime, getMidaCncMachineDowntimePareto, getMidaCncMachinePerformance, getMidaCncMachineTelemetry, getMidaCncMachineTelemetryDaily, getMidaCncMachines, getPortalHome, postMidaCncMachineDowntime, putMidaCncMachineDailySetup, updateMidaCncMachineInfo, updateMidaMachineLayout } from '../controllers/portalController.js';
import { PORTALS } from '../utils/userScope.js';
import { machineImageUpload } from '../utils/upload.js';

const portalRoutes = express.Router();

portalRoutes.use(authenticate, attachUserScope);
portalRoutes.get('/me', getPortalHome);
portalRoutes.get('/mida/cnc-machines/:machine_id', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineById);
portalRoutes.get('/mida/cnc-machines/:machine_id/telemetry/daily', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineTelemetryDaily);
portalRoutes.get('/mida/cnc-machines/:machine_id/telemetry', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineTelemetry);
portalRoutes.get('/mida/cnc-machines/:machine_id/performance', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachinePerformance);
portalRoutes.get('/mida/cnc-machines/:machine_id/daily-setup', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineDailySetup);
portalRoutes.put(
  '/mida/cnc-machines/:machine_id/daily-setup',
  requirePortal(PORTALS.MIDA_CNC),
  putMidaCncMachineDailySetup,
);
portalRoutes.get('/mida/cnc-machines/:machine_id/downtime/pareto', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineDowntimePareto);
portalRoutes.get('/mida/cnc-machines/:machine_id/downtime', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineDowntime);
portalRoutes.post(
  '/mida/cnc-machines/:machine_id/downtime',
  requirePortal(PORTALS.MIDA_CNC),
  postMidaCncMachineDowntime,
);
portalRoutes.delete(
  '/mida/cnc-machines/:machine_id/downtime/:event_id',
  requirePortal(PORTALS.MIDA_CNC),
  deleteMidaCncMachineDowntime,
);
portalRoutes.get('/mida/cnc-machines/:machine_id/alarms', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachineAlarms);
portalRoutes.delete(
  '/mida/cnc-machines/:machine_id/boot',
  requirePortal(PORTALS.MIDA_CNC),
  authorizeRoles('admin'),
  bootMidaCncMachineData,
);
portalRoutes.patch('/mida/cnc-machines/:machine_id/layout', requirePortal(PORTALS.MIDA_CNC), updateMidaMachineLayout);
portalRoutes.patch('/mida/cnc-machines/:machine_id/info', requirePortal(PORTALS.MIDA_CNC), updateMidaCncMachineInfo);
portalRoutes.delete(
  '/mida/cnc-machines/:machine_id',
  requirePortal(PORTALS.MIDA_CNC),
  authorizeRoles('admin'),
  deleteMidaCncMachine,
);
portalRoutes.get('/mida/cnc-machines', requirePortal(PORTALS.MIDA_CNC), getMidaCncMachines);
portalRoutes.post(
  '/mida/machines',
  requirePortal(PORTALS.MIDA_CNC),
  authorizeRoles('admin'),
  machineImageUpload.single('image_url'),
  addMidaCncMachine,
);
export default portalRoutes;
