const fs = require('fs');
const csv = require('csv-parser');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Konfigurasi koneksi database
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leaflet_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

// Fungsi untuk membersihkan dan mengkonversi nilai
function cleanValue(value) {
  if (!value || value === '-' || value === '') return null;
  return value.toString().trim();
}

function parseNumber(value) {
  if (!value || value === '-' || value === '') return null;
  const cleaned = value.toString().replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseInteger(value) {
  if (!value || value === '-' || value === '') return null;
  const cleaned = value.toString().replace(/[^\d-]/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(value) {
  if (!value || value === '-' || value === '') return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// Fungsi untuk import data dari CSV
async function importCSV(filePath) {
  const conn = await pool.getConnection();

  try {
    console.log('Mulai import data dari:', filePath);

    let totalRows = 0;
    let successRows = 0;
    let errorRows = 0;
    let updatedRows = 0;
    let insertedRows = 0;

    const results = [];

    // Baca file CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          results.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Total baris dalam CSV: ${results.length}`);

    // Process setiap row
    for (const row of results) {
      totalRows++;

      try {
        const bulan = parseInteger(row.bulan);
        const tahun = parseInteger(row.tahun);
        const nosambungan = cleanValue(row.nosambungan);
        const idpelanggan = cleanValue(row.idpelanggan);
        const nopelanggan = cleanValue(row.nopelanggan);
        const nama = cleanValue(row.nama);
        const alamat = cleanValue(row.alamat);
        const noalamat = cleanValue(row.noalamat);
        const pakai = parseInteger(row.pakai);
        const tagihan = parseNumber(row.tagihan);
        const tglbayar = parseDate(row.tglbayar);
        const lunas = parseInteger(row.lunas);
        const longitude = parseNumber(row.Long);
        const latitude = parseNumber(row.Lat);

        // Cek apakah data sudah ada (berdasarkan nosambungan, bulan, tahun)
        const [checkRows] = await conn.execute(
          'SELECT id FROM pelanggan WHERE nosambungan = ? AND bulan = ? AND tahun = ?',
          [nosambungan, bulan, tahun]
        );

        if (checkRows.length > 0) {
          // Update data yang sudah ada
          await conn.execute(
            `UPDATE pelanggan SET
              idpelanggan = ?,
              nopelanggan = ?,
              nama = ?,
              alamat = ?,
              noalamat = ?,
              pakai = ?,
              tagihan = ?,
              tglbayar = ?,
              lunas = ?,
              longitude = ?,
              latitude = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE nosambungan = ? AND bulan = ? AND tahun = ?`,
            [idpelanggan, nopelanggan, nama, alamat, noalamat, pakai, tagihan, tglbayar, lunas, longitude, latitude, nosambungan, bulan, tahun]
          );

          updatedRows++;
          console.log(`Updated: ${nosambungan} - ${nama} (${bulan}/${tahun})`);
        } else {
          // Insert data baru
          await conn.execute(
            `INSERT INTO pelanggan (
              bulan, tahun, nosambungan, idpelanggan, nopelanggan,
              nama, alamat, noalamat, pakai, tagihan,
              tglbayar, lunas, longitude, latitude
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bulan, tahun, nosambungan, idpelanggan, nopelanggan, nama, alamat, noalamat, pakai, tagihan, tglbayar, lunas, longitude, latitude]
          );

          insertedRows++;
          console.log(`Inserted: ${nosambungan} - ${nama} (${bulan}/${tahun})`);
        }

        successRows++;

      } catch (error) {
        errorRows++;
        console.error(`Error pada baris ${totalRows}:`, error.message);
        console.error('Data:', row);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total baris: ${totalRows}`);
    console.log(`Berhasil: ${successRows}`);
    console.log(`- Inserted: ${insertedRows}`);
    console.log(`- Updated: ${updatedRows}`);
    console.log(`Error: ${errorRows}`);

  } catch (error) {
    console.error('Error saat import:', error);
    throw error;
  } finally {
    conn.release();
  }
}

// Jalankan import
const csvFilePath = process.argv[2] || './tagihan_pakai_pondok_jati__1_.csv';

importCSV(csvFilePath)
  .then(() => {
    console.log('\nImport selesai!');
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import gagal:', error);
    pool.end();
    process.exit(1);
  });
