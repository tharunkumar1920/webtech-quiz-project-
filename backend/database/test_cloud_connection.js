require('dotenv').config();
const { Pool } = require('pg');

async function testCloudConnection() {
  console.log('\n========================================================');
  console.log('       ✦ EDUQUEST CLOUD DATABASE CONNECTION TEST ✦      ');
  console.log('========================================================\n');

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.log('❌ No DATABASE_URL found in your .env file!');
    console.log('👉 Please add your PostgreSQL connection string to .env like this:');
    console.log('   DATABASE_URL=postgresql://user:password@host:port/database\n');
    process.exit(1);
  }

  console.log('Testing connection to:');
  // Mask password for security
  const masked = connectionString.replace(/:([^@]+)@/, ':****@');
  console.log(`   ${masked}\n`);

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000
  });

  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to cloud PostgreSQL database!');

    const res = await client.query('SELECT version(), current_database(), current_user');
    console.log(`   Database Name : ${res.rows[0].current_database}`);
    console.log(`   User          : ${res.rows[0].current_user}`);
    console.log(`   Engine Version: ${res.rows[0].version.split(' ')[0]} ${res.rows[0].version.split(' ')[1]}`);

    // Check if tables already exist
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`\nExisting Tables in Cloud DB (${tableNames.length}):`);
    if (tableNames.length > 0) {
      console.log('   ', tableNames.join(', '));
    } else {
      console.log('   (Empty database. Tables will be automatically created on `npm start`)');
    }

    client.release();
    await pool.end();

    console.log('\n========================================================');
    console.log('🎉 CONNECTION TEST PASSED! You are ready to run `npm start`');
    console.log('========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Connection Failed:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.log('👉 Tip: Double check your database password in the connection URL.');
    } else if (err.message.includes('getaddrinfo ENOTFOUND')) {
      console.log('👉 Tip: The database host address could not be reached. Check the hostname in the URL.');
    }
    console.log('\n========================================================\n');
    process.exit(1);
  }
}

testCloudConnection();
