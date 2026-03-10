const fs = require('fs');
const csv = require('csv-parser');
const mysql = require('mysql2/promise');
require('dotenv').config();

const COL_NOPELANGGAN = 'nopelanggan'; 
const COL_LAT         = 'Lat';    
const COL_LONG        = 'Long';       

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leaflet_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

function parseCoord(value) {
  if (!value || value === '-' || value.toString().trim() === '') return null;
  const num = parseFloat(value.toString().replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
}

function cleanValue(value) {
  if (!value) return null;
  return value.toString().trim() || null;
}

async function importLatLong(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File tidak ditemukan: ${filePath}`);
    process.exit(1);
  }

  const conn = await pool.getConnection();

  try {
    console.log('======================================');
    console.log('  Import Koordinat (Lat/Long)');
    console.log('======================================');
    console.log(`File  : ${filePath}`);
    console.log(`Target: kolom nopelanggan di tabel pelanggan`);
    console.log('');

    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Total baris CSV : ${rows.length}`);

    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      console.log(`Kolom CSV       : ${headers.join(', ')}`);

      const missingCols = [];
      if (!headers.includes(COL_NOPELANGGAN)) missingCols.push(COL_NOPELANGGAN);
      if (!headers.includes(COL_LAT))         missingCols.push(COL_LAT);
      if (!headers.includes(COL_LONG))        missingCols.push(COL_LONG);

      if (missingCols.length > 0) {
        console.error(`\nERROR: Kolom berikut tidak ditemukan di CSV: ${missingCols.join(', ')}`);
        console.error('Sesuaikan nama kolom di bagian KONFIGURASI pada script ini.');
        process.exit(1);
      }
    }

    console.log('');
    console.log('Memproses...');
    console.log('--------------------------------------');

    let total     = 0;
    let updated   = 0;
    let skipped   = 0; 
    let noCoord   = 0; 
    let errors    = 0;

    for (const row of rows) {
      total++;

      try {
        const nopelanggan = cleanValue(row[COL_NOPELANGGAN]);
        const latitude    = parseCoord(row[COL_LAT]);
        const longitude   = parseCoord(row[COL_LONG]);

        if (!nopelanggan) {
          console.warn(`  [SKIP] Baris ${total}: nopelanggan kosong`);
          skipped++;
          continue;
        }

        if (latitude === null || longitude === null) {
          console.warn(`  [SKIP] ${nopelanggan}: lat/long kosong atau tidak valid`);
          noCoord++;
          continue;
        }

        const [checkRows] = await conn.execute(
          'SELECT id FROM pelanggan WHERE nopelanggan = ? LIMIT 1',
          [nopelanggan]
        );

        if (checkRows.length === 0) {
          console.warn(`  [NOTFOUND] ${nopelanggan}: tidak ditemukan di database`);
          skipped++;
          continue;
        }

        const [result] = await conn.execute(
          `UPDATE pelanggan
           SET latitude  = ?,
               longitude = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE nopelanggan = ?`,
          [latitude, longitude, nopelanggan]
        );

        console.log(`  [OK] ${nopelanggan}: lat=${latitude}, long=${longitude} (${result.affectedRows} baris di-update)`);
        updated++;

      } catch (err) {
        errors++;
        console.error(`  [ERROR] Baris ${total}:`, err.message);
      }
    }

    console.log('');
    console.log('======================================');
    console.log('  SUMMARY');
    console.log('======================================');
    console.log(`Total baris CSV     : ${total}`);
    console.log(`Berhasil di-update  : ${updated}`);
    console.log(`Tidak ditemukan di DB / nopelanggan kosong: ${skipped}`);
    console.log(`Lat/Long kosong/invalid : ${noCoord}`);
    console.log(`Error               : ${errors}`);
    console.log('======================================');

  } catch (err) {
    console.error('Terjadi kesalahan:', err);
    throw err;
  } finally {
    conn.release();
  }
}

const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.error('Usage: node import-latlong.js <path-ke-file.csv>');
  console.error('Contoh: node import-latlong.js ./data_koordinat.csv');
  process.exit(1);
}

importLatLong(csvFilePath)
  .then(() => {
    console.log('\nSelesai!');
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Gagal:', err);
    pool.end();
    process.exit(1);
  });