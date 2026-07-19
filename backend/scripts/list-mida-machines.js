import pool from '../db.js';
import { CNC_MACHINES_TABLE, PUBLIC_MACHINES_TABLE } from '../utils/machineSchema.js';

const { rows: inPublic } = await pool.query(`
  SELECT machine_id, machine_name, location, machine_category
  FROM ${PUBLIC_MACHINES_TABLE}
  WHERE location ILIKE '%MIDA%'
  ORDER BY machine_name
`);

const { rows: inCnc } = await pool.query(`
  SELECT machine_id, machine_name, location, machine_category
  FROM ${CNC_MACHINES_TABLE}
  WHERE location ILIKE '%MIDA%'
  ORDER BY machine_name
`);

console.log('public.machines (MIDA):', inPublic.length);
inPublic.forEach((m) => console.log(` - ${m.machine_id} | ${m.machine_name} | category=${m.machine_category ?? 'standard'}`));

console.log('\ncnc.machines (MIDA):', inCnc.length);
inCnc.forEach((m) => console.log(` - ${m.machine_id} | ${m.machine_name} | category=${m.machine_category ?? 'cnc'}`));

await pool.end();
