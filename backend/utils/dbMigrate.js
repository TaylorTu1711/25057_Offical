import pool from '../db.js';
import { ensureCncMachinesTable, ensurePublicMachinesTable } from './machineSchema.js';
import { ensureAllCncTelemetryColumns } from './cncTelemetry.js';
import { ensureDailySetupTable } from './cncDailySetup.js';
import { ensureAllCncDowntimeTables } from './cncDowntime.js';

export async function migrateUserAccessSchema() {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'factory';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS portal VARCHAR(50) DEFAULT 'default';

      CREATE TABLE IF NOT EXISTS user_locations (
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        location VARCHAR(255) NOT NULL,
        PRIMARY KEY (user_id, location)
      );

      CREATE SCHEMA IF NOT EXISTS cnc;
    `);
    await ensurePublicMachinesTable(pool);
    await ensureCncMachinesTable(pool);
    await ensureAllCncTelemetryColumns(pool);
    await ensureDailySetupTable(pool);
    await ensureAllCncDowntimeTables(pool);
    console.log('✅ User access schema migrated');
  } catch (error) {
    console.error('User access migration error:', error.message);
  }
}
