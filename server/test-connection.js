require('dotenv').config();
const db = require('./config/database');

async function testConnection() {
  console.log('Testing database connection...\n');

  try {
    // Test basic connection
    console.log('1. Testing basic connection...');
    const result = await db.query('SELECT NOW() as now_time, VERSION() as db_version');
    console.log('✓ Connected successfully');
    console.log('  Current time:', result.rows[0].now_time);
    console.log('  MySQL/MariaDB version:', result.rows[0].db_version.split('-')[0]);

    // Test spatial support
    console.log('\n2. Testing spatial support...');
    const spatialResult = await db.query("SELECT ST_AsText(ST_GeomFromText('POINT(0 0)')) as test_point");
    console.log('✓ Spatial functions OK');
    console.log('  Test point:', spatialResult.rows[0].test_point);

    // Test pelanggan table
    console.log('\n3. Testing pelanggan table...');
    const pelangganCount = await db.query('SELECT COUNT(*) as count FROM pelanggan');
    console.log('✓ Pelanggan table exists');
    console.log('  Total records:', pelangganCount.rows[0].count);

    // Test sample query
    console.log('\n4. Testing sample query...');
    const sampleData = await db.query('SELECT * FROM pelanggan LIMIT 3');
    console.log('✓ Sample query successful');
    console.log('  Sample records:');
    sampleData.rows.forEach((row, idx) => {
      console.log(`    ${idx + 1}. ${row.nama} - ${row.alamat} ${row.noalamat}`);
    });

    // Test spatial query
    console.log('\n5. Testing spatial query...');
    const spatialQuery = `
      SELECT 
        nama, 
        alamat, 
        noalamat,
        ST_AsText(location) as location_text
      FROM pelanggan 
      WHERE location IS NOT NULL 
      LIMIT 1
    `;
    const spatialRes = await db.query(spatialQuery);
    if (spatialRes.rows.length > 0) {
      console.log('✓ Spatial query successful');
      console.log('  Location:', spatialRes.rows[0].location_text);
    } else {
      console.log('⚠ No spatial data found');
    }

    // Test statistics
    console.log('\n6. Testing statistics...');
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT alamat) as unique_addresses,
        COUNT(CASE WHEN longitude IS NOT NULL AND latitude IS NOT NULL THEN 1 END) as with_coordinates
      FROM pelanggan
    `;
    const statsResult = await db.query(statsQuery);
    const stats = statsResult.rows[0];
    console.log('✓ Statistics query successful');
    console.log('  Total records:', stats.total);
    console.log('  Unique addresses:', stats.unique_addresses);
    console.log('  Records with coordinates:', stats.with_coordinates);

    console.log('\n✅ All tests passed!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nError details:', error);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure MySQL/MariaDB is running');
      console.error('   - Linux: sudo service mysql start  (atau mariadb start)');
      console.error('   - macOS: brew services start mysql');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Authentication failed. Check your .env file:');
      console.error('   - DB_USER');
      console.error('   - DB_PASSWORD');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Tip: Database does not exist. Buat dulu dengan:');
      console.error('   mysql -u root -p -e "CREATE DATABASE leaflet_db;"');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('\n💡 Tip: Tabel belum ada. Jalankan schema SQL dulu.');
    }

    process.exit(1);
  }
}

// Run test
testConnection();