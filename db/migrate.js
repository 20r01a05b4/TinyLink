// simple migration runner using node + pg
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_create_links.sql'), 'utf8');
  console.log("sql ",process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration completed.');
  } catch (err) {
    console.error('Migration error:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
