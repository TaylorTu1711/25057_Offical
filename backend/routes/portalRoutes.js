import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { attachUserScope, requireDtrSortAdmin, requirePortal } from '../middleware/portalMiddleware.js';
import { addMidaCncMachine, bootMidaCncMachineData, deleteMidaCncMachine, deleteMidaCncMachineDowntime, getMidaCncMachineAlarms, getMidaCncMachineById, getMidaCncMachineDailySetup, getMidaCncMachineDowntime, getMidaCncMachineDowntimePareto, getMidaCncMachinePerformance, getMidaCncMachineTelemetry, getMidaCncMachineTelemetryDaily, getMidaCncMachines, getPortalHome, postMidaCncMachineDowntime, putMidaCncMachineDailySetup, updateMidaCncMachineInfo, updateMidaMachineLayout } from '../controllers/portalController.js';
import {
  createDtrSortMachine,
  getDtrSortMachine,
  getDtrSortMachineCountsHourly,
  getDtrSortMachineStats,
  getDtrSortMachineStatusTimeline,
  getDtrSortMachines,
  removeDtrSortMachine,
  updateDtrSortMachineInfo,
} from '../controllers/dtrSortMachineController.js';
import { PORTALS } from '../utils/userScope.js';
import { machineImageUpload } from '../utils/upload.js';

const portalRoutes = express.Router();

portalRoutes.use(authenticate, attachUserScope);
portalRoutes.get('/me', getPortalHome);

portalRoutes.get('/dtr/sort-machines', requirePortal(PORTALS.DTR_SORTMACHINE), getDtrSortMachines);
portalRoutes.get(
  '/dtr/sort-machines/:machine_id/counts/hourly',
  requirePortal(PORTALS.DTR_SORTMACHINE),
  getDtrSortMachineCountsHourly,
);
portalRoutes.get(
  '/dtr/sort-machines/:machine_id/status',
  requirePortal(PORTALS.DTR_SORTMACHINE),
  getDtrSortMachineStatusTimeline,
);
portalRoutes.get(
  '/dtr/sort-machines/:machine_id/stats',
  requirePortal(PORTALS.DTR_SORTMACHINE),
  getDtrSortMachineStats,
);
portalRoutes.get('/dtr/sort-machines/:machine_id', requirePortal(PORTALS.DTR_SORTMACHINE), getDtrSortMachine);
portalRoutes.post(
  '/dtr/sort-machines',
  requirePortal(PORTALS.DTR_SORTMACHINE),
  requireDtrSortAdmin,
  machineImageUpload.single('image_url'),
  createDtrSortMachine,
);
portalRoutes.put(
  '/dtr/sort-machines/:machine_id',
  requirePortal(PORTALS.DTR_SORTMACHINE),
  requireDtrSortAdmin,
  machineImageUpload.single('image_url'),
  updateDtrSortMachineInfo,
);
portalRoutes.delete(
  '/dtr/sort-machines/:machine_id',
  requirePortal(PORTALS.DTR_SORTMACHINE),
  requireDtrSortAdmin,
  removeDtrSortMachine,
);
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
