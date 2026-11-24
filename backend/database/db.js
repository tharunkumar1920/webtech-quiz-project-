const path = require('path');
const fs = require('fs');
const os = require('os');

const isPostgres = !!(
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'))
);

let pool = null;
let sqliteDb = null;

if (isPostgres) {
  const { Pool } = require('pg');
  console.log('[DB] Connecting to Cloud PostgreSQL database...');

  const connectionString = process.env.DATABASE_URL;
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle PostgreSQL client:', err.message);
  });
} else {
  const sqlite3 = require('sqlite3').verbose();
  let dbPath = process.env.DB_PATH || path.join(__dirname, 'exam_portal.sqlite');

  if (!process.env.DB_PATH) {
    let canWrite = false;
    try {
      const testFile = path.join(__dirname, `.write_test_${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      canWrite = true;
    } catch (e) {
      canWrite = false;
    }

    if (!canWrite) {
      const fallbackPath = path.join(os.tmpdir(), 'exam_portal.sqlite');
      if (fs.existsSync(dbPath)) {
        try {
          const srcStat = fs.statSync(dbPath);
          const shouldCopy = !fs.existsSync(fallbackPath) || fs.statSync(fallbackPath).mtimeMs < srcStat.mtimeMs;
          if (shouldCopy) {
            fs.copyFileSync(dbPath, fallbackPath);
          }
        } catch (copyErr) {
          console.error('[DB] Failed to copy database to fallback temp location:', copyErr.message);
        }
      }
      dbPath = fallbackPath;
    }
  }

  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[DB] Failed to connect to SQLite database:', err.message);
    } else {
      sqliteDb.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
        if (pragmaErr) {
          console.error('[DB] Failed to enable foreign keys:', pragmaErr.message);
        }
      });
    }
  });
}

/**
 * Convert standard SQL with '?' parameters to PostgreSQL '$1, $2, ...'
 */
function convertToPgPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

/**
 * Run a query that performs an INSERT, UPDATE, or DELETE
 * Returns { id, changes }
 */
async function run(sql, params = []) {
  if (isPostgres) {
    let pgSql = convertToPgPlaceholders(sql.trim());
    const isInsert = /^INSERT\s+INTO/i.test(pgSql);
    const hasReturning = /RETURNING/i.test(pgSql);

    if (isInsert && !hasReturning) {
      pgSql += ' RETURNING id';
    }

    const res = await pool.query(pgSql, params);
    const insertedId = (res.rows && res.rows[0] && res.rows[0].id) ? res.rows[0].id : null;
    return {
      id: insertedId,
      changes: res.rowCount || 0
    };
  }

  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) {
        return reject(err);
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Run a query that returns a single row
 */
async function get(sql, params = []) {
  if (isPostgres) {
    const pgSql = convertToPgPlaceholders(sql.trim());
    const res = await pool.query(pgSql, params);
    return res.rows[0] || null;
  }

  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

/**
 * Run a query that returns multiple rows
 */
async function query(sql, params = []) {
  if (isPostgres) {
    const pgSql = convertToPgPlaceholders(sql.trim());
    const res = await pool.query(pgSql, params);
    return res.rows || [];
  }

  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

/**
 * Execute raw multi-line SQL
 */
async function exec(sql) {
  if (isPostgres) {
    await pool.query(sql);
    return;
  }

  return new Promise((resolve, reject) => {
    sqliteDb.exec(sql, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Initialize schema if tables don't exist
 */
async function initSchema() {
  if (isPostgres) {
    const schemaPgPath = path.join(__dirname, 'schema_pg.sql');
    const schemaSql = fs.readFileSync(schemaPgPath, 'utf8');
    await pool.query(schemaSql);
    console.log('[DB] PostgreSQL schema verified/created successfully.');

    // Auto-seed if Admins table is empty
    const checkAdmin = await pool.query('SELECT COUNT(*) AS cnt FROM Admins');
    if (parseInt(checkAdmin.rows[0].cnt, 10) === 0) {
      console.log('[DB] Fresh database detected. Auto-seeding initial data...');
      const seedScript = require('./seed');
      if (typeof seedScript.seedDatabase === 'function') {
        await seedScript.seedDatabase();
      }
    }
    return;
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await exec(schemaSql);
}

module.exports = {
  db: isPostgres ? pool : sqliteDb,
  pool,
  isPostgres,
  run,
  get,
  query,
  all: query,
  exec,
  initSchema
};
