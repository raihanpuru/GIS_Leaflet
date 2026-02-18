const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// ============================================================
// Konfigurasi
// ============================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leaflet_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 5,
});

// File GeoJSON yang mau diimport
// Format: { file: 'path/ke/file.geojson', kecamatan: 'nama_kecamatan' }
const GEOJSON_FILES = [
  { file: 'public/data/kecamatan/sidoarjo.geojson',  kecamatan: 'sidoarjo'  },
  { file: 'public/data/kecamatan/candi.geojson',     kecamatan: 'candi'     },
  { file: 'public/data/kecamatan/gedangan.geojson',  kecamatan: 'gedangan'  },
  { file: 'public/data/kecamatan/buduran.geojson',   kecamatan: 'buduran'   },
];

// Ukuran batch insert (lebih besar = lebih cepat, tapi lebih banyak memory)
const BATCH_SIZE = 500;

// ============================================================
// Helper
// ============================================================
function clean(val) {
  if (val === undefined || val === null || val === '') return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

function cleanFloat(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function cleanInt(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val);
  return isNaN(n) ? null : n;
}

// Konversi GeoJSON geometry → WKT (Well-Known Text) untuk MySQL
// MySQL/MariaDB menerima ST_GeomFromText(WKT, SRID)
function geomToWKT(geometry) {
  if (!geometry) return null;

  try {
    if (geometry.type === 'Point') {
      const [lng, lat] = geometry.coordinates;
      return `POINT(${lng} ${lat})`;

    } else if (geometry.type === 'Polygon') {
      const rings = geometry.coordinates.map(ring => {
        const pts = ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
        return `(${pts})`;
      });
      return `POLYGON(${rings.join(', ')})`;

    } else if (geometry.type === 'MultiPolygon') {
      const polys = geometry.coordinates.map(poly => {
        const rings = poly.map(ring => {
          const pts = ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
          return `(${pts})`;
        });
        return `(${rings.join(', ')})`;
      });
      return `MULTIPOLYGON(${polys.join(', ')})`;

    } else {
      // Geometry type lain (LineString, dll) — skip
      return null;
    }
  } catch (e) {
    return null;
  }
}

// ============================================================
// Import satu file GeoJSON
// ============================================================
async function importGeoJSON(conn, filePath, kecamatan) {
  console.log(`\n📂 Loading ${filePath}...`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const geojson = JSON.parse(raw);

  const features = geojson.features;
  console.log(`   Total features: ${features.length}`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Proses per batch
  for (let i = 0; i < features.length; i += BATCH_SIZE) {
    const batch = features.slice(i, i + BATCH_SIZE);

    const values = [];
    const placeholders = [];

    for (const feat of batch) {
      const p = feat.properties || {};
      const wkt = geomToWKT(feat.geometry);

      if (!wkt) {
        skipped++;
        continue;
      }

      // Ambil building:levels dengan fallback
      const levels = cleanInt(p['building:levels'] || p['levels']);
      const heightVal = cleanFloat(p['height']);

      values.push(
        clean(p['@id']),
        kecamatan,
        clean(p['name']),
        clean(p['building']),
        levels,
        heightVal,
        clean(p['amenity']),
        clean(p['shop']),
        clean(p['leisure']),
        clean(p['office']),
        clean(p['tourism']),
        clean(p['religion']),
        clean(p['denomination']),
        clean(p['surface']),
        clean(p['addr:street']),
        clean(p['addr:housenumber']),
        clean(p['addr:city']),
        clean(p['addr:postcode']),
        clean(p['addr:district']),
        clean(p['addr:subdistrict']),
        clean(p['phone'] || p['contact:phone']),
        clean(p['website']),
        clean(p['opening_hours']),
        wkt,   // akan di-wrap ST_GeomFromText di query
      );

      placeholders.push(
        `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ST_GeomFromText(?, 4326))`
      );
    }

    if (placeholders.length === 0) continue;

    try {
      const sql = `
        INSERT INTO bangunan (
          osm_id, kecamatan,
          name, building, building_levels, height,
          amenity, shop, leisure, office, tourism,
          religion, denomination, surface,
          addr_street, addr_housenumber, addr_city, addr_postcode,
          addr_district, addr_subdistrict,
          phone, website, opening_hours,
          geom
        ) VALUES ${placeholders.join(', ')}
      `;

      await conn.execute(sql, values);
      inserted += placeholders.length;

    } catch (err) {
      // Kalau batch gagal, coba satu per satu untuk isolasi error
      for (let j = 0; j < batch.length; j++) {
        const feat = batch[j];
        const p = feat.properties || {};
        const wkt = geomToWKT(feat.geometry);
        if (!wkt) continue;

        try {
          await conn.execute(
            `INSERT INTO bangunan (
              osm_id, kecamatan,
              name, building, building_levels, height,
              amenity, shop, leisure, office, tourism,
              religion, denomination, surface,
              addr_street, addr_housenumber, addr_city, addr_postcode,
              addr_district, addr_subdistrict,
              phone, website, opening_hours,
              geom
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ST_GeomFromText(?, 4326))`,
            [
              clean(p['@id']), kecamatan,
              clean(p['name']), clean(p['building']),
              cleanInt(p['building:levels'] || p['levels']), cleanFloat(p['height']),
              clean(p['amenity']), clean(p['shop']), clean(p['leisure']),
              clean(p['office']), clean(p['tourism']), clean(p['religion']),
              clean(p['denomination']), clean(p['surface']),
              clean(p['addr:street']), clean(p['addr:housenumber']),
              clean(p['addr:city']), clean(p['addr:postcode']),
              clean(p['addr:district']), clean(p['addr:subdistrict']),
              clean(p['phone'] || p['contact:phone']),
              clean(p['website']), clean(p['opening_hours']),
              wkt,
            ]
          );
          inserted++;
        } catch (e2) {
          errors++;
          if (errors <= 5) console.warn(`   ⚠ Skip feature: ${e2.message.substring(0, 80)}`);
        }
      }
    }

    // Progress
    const done = Math.min(i + BATCH_SIZE, features.length);
    process.stdout.write(`\r   Progress: ${done}/${features.length} (inserted: ${inserted}, skip: ${skipped}, err: ${errors})`);
  }

  console.log(`\n   ✅ Done! Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
  return { inserted, skipped, errors };
}

// ============================================================
// Main
// ============================================================
async function main() {
  // Bisa jalankan untuk file tertentu via argument:
  // node import-geojson.js sidoarjo
  // node import-geojson.js              ← semua file
  const filterKec = process.argv[2];
  const filesToProcess = filterKec
    ? GEOJSON_FILES.filter(f => f.kecamatan === filterKec)
    : GEOJSON_FILES;

  if (filesToProcess.length === 0) {
    console.error(`❌ Kecamatan "${filterKec}" tidak ditemukan.`);
    console.error(`   Pilihan: ${GEOJSON_FILES.map(f => f.kecamatan).join(', ')}`);
    process.exit(1);
  }

  console.log('🚀 Import GeoJSON → MySQL/MariaDB');
  console.log(`   Target: ${filesToProcess.map(f => f.kecamatan).join(', ')}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);

  const conn = await pool.getConnection();

  try {
    // Nonaktifkan autocommit untuk performa
    await conn.execute('SET autocommit = 0');
    await conn.execute('SET foreign_key_checks = 0');

    const totalStats = { inserted: 0, skipped: 0, errors: 0 };

    for (const { file, kecamatan } of filesToProcess) {
      const fullPath = path.resolve(file);
      if (!fs.existsSync(fullPath)) {
        console.warn(`⚠ File tidak ditemukan: ${fullPath}`);
        continue;
      }

      const stats = await importGeoJSON(conn, fullPath, kecamatan);
      totalStats.inserted += stats.inserted;
      totalStats.skipped += stats.skipped;
      totalStats.errors += stats.errors;

      // Commit per file
      await conn.execute('COMMIT');
      console.log(`   💾 Committed ${kecamatan}`);
    }

    await conn.execute('SET autocommit = 1');
    await conn.execute('SET foreign_key_checks = 1');

    console.log('\n=============================');
    console.log('✅ SEMUA SELESAI!');
    console.log(`   Total inserted : ${totalStats.inserted}`);
    console.log(`   Total skipped  : ${totalStats.skipped}`);
    console.log(`   Total errors   : ${totalStats.errors}`);
    console.log('=============================');

  } catch (err) {
    await conn.execute('ROLLBACK');
    console.error('\n❌ Fatal error:', err.message);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
