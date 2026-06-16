/**
 * CWC Inventory Management — Database Seeder
 *
 * Creates all tables from schema.sql and seeds the default
 * categories (with their custom fields) required by the app.
 *
 * Usage:
 *   node seed.js
 *
 * Reads DATABASE_URL from server/.env automatically.
 * Safe to re-run: categories use ON CONFLICT DO NOTHING.
 */

require('dotenv').config({ path: require('path').join(__dirname, 'server', '.env') });

const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL not found in server/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// ─── Default Categories ───────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: 'Desktop',    description: 'Desktop computers and workstations' },
  { name: 'Laptop',     description: 'Portable laptop computers' },
  { name: 'Printer',    description: 'Laser and inkjet printers' },
  { name: 'UPS',        description: 'Uninterruptible Power Supply units' },
  { name: 'Monitor',    description: 'Computer monitors and displays' },
  { name: 'Scanner',    description: 'Document and flatbed scanners' },
  { name: 'Networking', description: 'Routers, switches, and network equipment' },
  { name: 'Phone',      description: 'Mobile phones and IP phones' },
];

// ─── Default Custom Fields per Category ──────────────────────
const CATEGORY_FIELDS = {
  Desktop: [
    { field_name: 'processor',  field_label: 'Processor',         field_type: 'text',   sort_order: 1 },
    { field_name: 'ram',        field_label: 'RAM',                field_type: 'text',   sort_order: 2 },
    { field_name: 'storage',    field_label: 'Storage',            field_type: 'text',   sort_order: 3 },
    { field_name: 'os',         field_label: 'Operating System',   field_type: 'text',   sort_order: 4 },
  ],
  Laptop: [
    { field_name: 'processor',   field_label: 'Processor',         field_type: 'text',   sort_order: 1 },
    { field_name: 'ram',         field_label: 'RAM',                field_type: 'text',   sort_order: 2 },
    { field_name: 'storage',     field_label: 'Storage',            field_type: 'text',   sort_order: 3 },
    { field_name: 'screen_size', field_label: 'Screen Size',        field_type: 'text',   sort_order: 4 },
    { field_name: 'os',          field_label: 'Operating System',   field_type: 'text',   sort_order: 5 },
  ],
  Printer: [
    { field_name: 'printer_type', field_label: 'Printer Type',     field_type: 'select',
      field_options: JSON.stringify(['Laser', 'Inkjet', 'Dot Matrix', 'Thermal']),        sort_order: 1 },
    { field_name: 'is_color',     field_label: 'Color Printing',   field_type: 'boolean', sort_order: 2 },
    { field_name: 'is_network',   field_label: 'Network Printer',  field_type: 'boolean', sort_order: 3 },
  ],
  UPS: [
    { field_name: 'capacity_va',  field_label: 'Capacity (VA)',    field_type: 'number', sort_order: 1 },
    { field_name: 'battery_type', field_label: 'Battery Type',     field_type: 'text',   sort_order: 2 },
  ],
};

async function run() {
  const client = await pool.connect();

  try {
    console.log('🔗  Connected to database');
    console.log('');

    // ── Step 1: Create all tables, sequences, indexes, triggers ──
    console.log('📦  Running schema.sql...');
    await client.query(schema);
    console.log('    ✓ All tables, sequences, and triggers ready');

    // ── Step 2: Seed default categories + their custom fields ─────
    console.log('');
    console.log('🗂   Seeding default categories...');

    for (const cat of DEFAULT_CATEGORIES) {
      const result = await client.query(
        `INSERT INTO categories (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING
         RETURNING id, name`,
        [cat.name, cat.description]
      );

      if (result.rows.length > 0) {
        const catId = result.rows[0].id;
        console.log(`    ✓ ${cat.name} (id=${catId})`);

        const fields = CATEGORY_FIELDS[cat.name];
        if (fields) {
          for (const field of fields) {
            await client.query(
              `INSERT INTO category_fields
                 (category_id, field_name, field_label, field_type, field_options, is_required, sort_order)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (category_id, field_name) DO NOTHING`,
              [
                catId,
                field.field_name,
                field.field_label,
                field.field_type,
                field.field_options || null,
                false,
                field.sort_order,
              ]
            );
          }
          console.log(`      ↳ ${fields.length} custom fields seeded`);
        }
      } else {
        console.log(`    — ${cat.name} already exists, skipped`);
      }
    }

    console.log('');
    console.log('✅  Database setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Start the backend:   cd server && npm run dev');
    console.log('  2. Start the frontend:  cd client && npm run dev');
    console.log('  3. Visit:               http://localhost:5173/setup');
    console.log('  4. Create your super-admin account and log in.');
    console.log('');

  } catch (err) {
    console.error('');
    console.error('❌  Seeder failed:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    if (err.hint)   console.error('   Hint:  ', err.hint);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
