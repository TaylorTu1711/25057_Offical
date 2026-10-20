import pool from '../db.js';
import { ensureCncMachinesTable } from './machineSchema.js';

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

      ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_category VARCHAR(32) DEFAULT 'standard';

      CREATE SCHEMA IF NOT EXISTS cnc;
    `);
    await ensureCncMachinesTable(pool);
    console.log('✅ User access schema migrated');
  } catch (error) {
    console.error('User access migration error:', error.message);
  }
}
