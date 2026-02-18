const fs = require('fs');
const csv = require('csv-parser');
const mysql = require('mysql2/promise');

// Konfigurasi database - SESUAIKAN dengan konfigurasi kamu!
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leaflet_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

async function importTagihanCSV(csvFilePath) {
  const results = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        console.log(`Total rows dari CSV: ${results.length}`);

        let successCount = 0;
        let updateCount = 0;
        let insertCount = 0;
        let errorCount = 0;

        for (const row of results) {
          try {
            // Parse data dari CSV
            const nosambungan = row.nosambungan?.trim();
            const idpelanggan = row.idpelanggan?.trim();
            const nopelanggan = row.nopelanggan?.trim();
            const nama = row.nama?.trim();
            const alamat = row.alamat?.trim();
            const noalamat = row.noalamat?.trim();
            const nourut = row.nourut ? parseInt(row.nourut) : null;
            const pakai = row.pakai ? parseInt(row.pakai) : null;
            const tagihan = row.tagihan ? parseFloat(row.tagihan) : null;
            const lunas = row.lunas ? parseInt(row.lunas) : 0;

            // Parse tanggal bayar (format: YYYY-MM-DD HH:MM:SS)
            let tglbayar = null;
            if (row.tglbayar && row.tglbayar.trim() !== '') {
              tglbayar = row.tglbayar.trim();
            }

            // Parse koordinat - kolom Long dan Lat
            const longitude = row.Long ? parseFloat(row.Long) : null;
            const latitude = row.Lat ? parseFloat(row.Lat) : null;

            if (!nosambungan || !idpelanggan || !nama) {
              console.log(`  Skip row: Missing required fields`);
              errorCount++;
              continue;
            }

            // Cek apakah data sudah ada berdasarkan nosambungan
            const [checkRows] = await pool.execute(
              'SELECT id FROM pelanggan WHERE nosambungan = ?',
              [nosambungan]
            );

            if (checkRows.length > 0) {
              // UPDATE data yang sudah ada
              await pool.execute(
                `UPDATE pelanggan 
                SET 
                  idpelanggan = ?,
                  nopelanggan = ?,
                  nama = ?,
                  alamat = ?,
                  noalamat = ?,
                  nourut = ?,
                  pakai = ?,
                  tagihan = ?,
                  tglbayar = ?,
                  lunas = ?,
                  longitude = ?,
                  latitude = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE nosambungan = ?`,
                [idpelanggan, nopelanggan, nama, alamat, noalamat, nourut, pakai, tagihan, tglbayar, lunas, longitude, latitude, nosambungan]
              );

              updateCount++;
            } else {
              // INSERT data baru
              await pool.execute(
                `INSERT INTO pelanggan 
                  (nosambungan, idpelanggan, nopelanggan, nama, alamat, noalamat, 
                   nourut, pakai, tagihan, tglbayar, lunas, longitude, latitude)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [nosambungan, idpelanggan, nopelanggan, nama, alamat, noalamat, nourut, pakai, tagihan, tglbayar, lunas, longitude, latitude]
              );

              insertCount++;
            }

            successCount++;

          } catch (error) {
            console.error(`   Error processing row:`, error.message);
            console.error(`   Row data:`, row);
            errorCount++;
          }
        }

        console.log('\n Import selesai!');
        console.log(`   Total processed: ${successCount}`);
        console.log(`   Inserted: ${insertCount}`);
        console.log(`   Updated: ${updateCount}`);
        console.log(`   Errors: ${errorCount}`);

        await pool.end();
        resolve();
      })
      .on('error', (error) => {
        console.error('Error reading CSV:', error);
        reject(error);
      });
  });
}

// Jalankan import
const csvPath = process.argv[2] || './tagihan_pakai_puri_indah.csv';

console.log(`Starting import from: ${csvPath}\n`);

importTagihanCSV(csvPath)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
