const db = require('../config/database');

class Pelanggan {
  // Get all pelanggan with optional filters
  static async getAll(filters = {}) {
    let query = `
      SELECT 
        id, nosambungan, idpelanggan, nopelanggan, nama,
        alamat, noalamat, nourut, longitude, latitude,
        pakai, tagihan, tglbayar, lunas, bulan, tahun,
        ST_AsGeoJSON(location) as location,
        created_at, updated_at
      FROM pelanggan
      WHERE 1=1
    `;

    const params = [];

    // Filter by nama
    if (filters.nama) {
      query += ` AND nama LIKE ?`;
      params.push(`%${filters.nama}%`);
    }

    // Filter by alamat
    if (filters.alamat) {
      query += ` AND alamat LIKE ?`;
      params.push(`%${filters.alamat}%`);
    }

    // Filter by noalamat
    if (filters.noalamat) {
      query += ` AND noalamat LIKE ?`;
      params.push(`%${filters.noalamat}%`);
    }

    // Filter by bulan
    if (filters.bulan) {
      query += ` AND bulan = ?`;
      params.push(parseInt(filters.bulan));
    }

    // Filter by tahun
    if (filters.tahun) {
      query += ` AND tahun = ?`;
      params.push(parseInt(filters.tahun));
    }

    // Filter by bounding box (for map viewport)
    if (filters.bbox) {
      const [minLng, minLat, maxLng, maxLat] = filters.bbox.split(',').map(Number);
      query += ` AND longitude BETWEEN ? AND ?`;
      query += ` AND latitude BETWEEN ? AND ?`;
      params.push(minLng, maxLng, minLat, maxLat);
    }

    query += ` ORDER BY nourut ASC`;

    // Add pagination
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const result = await db.query(query, params);
    // Parse location JSON string jadi object
    return result.rows.map(row => ({
      ...row,
      location: row.location ? JSON.parse(row.location) : null,
    }));
  }

  // Get pelanggan by ID
  static async getById(id) {
    const query = `
      SELECT 
        id, nosambungan, idpelanggan, nopelanggan, nama,
        alamat, noalamat, nourut, longitude, latitude,
        pakai, tagihan, tglbayar, lunas,
        ST_AsGeoJSON(location) as location,
        created_at, updated_at
      FROM pelanggan
      WHERE id = ?
    `;

    const result = await db.query(query, [id]);
    const row = result.rows[0];
    if (!row) return null;
    return { ...row, location: row.location ? JSON.parse(row.location) : null };
  }

  // Get pelanggan by nosambungan
  static async getByNosambungan(nosambungan) {
    const query = `
      SELECT 
        id, nosambungan, idpelanggan, nopelanggan, nama,
        alamat, noalamat, nourut, longitude, latitude,
        pakai, tagihan, tglbayar, lunas,
        ST_AsGeoJSON(location) as location,
        created_at, updated_at
      FROM pelanggan
      WHERE nosambungan = ?
    `;

    const result = await db.query(query, [nosambungan]);
    const row = result.rows[0];
    if (!row) return null;
    return { ...row, location: row.location ? JSON.parse(row.location) : null };
  }

  // Search pelanggan
  static async search(searchTerm) {
    const query = `
      SELECT 
        id, nosambungan, idpelanggan, nopelanggan, nama,
        alamat, noalamat, nourut, longitude, latitude,
        pakai, tagihan, tglbayar, lunas,
        ST_AsGeoJSON(location) as location,
        created_at, updated_at
      FROM pelanggan
      WHERE 
        nama LIKE ? OR
        alamat LIKE ? OR
        noalamat LIKE ? OR
        nosambungan LIKE ?
      ORDER BY nourut ASC
      LIMIT 50
    `;

    const likeParam = `%${searchTerm}%`;
    const result = await db.query(query, [likeParam, likeParam, likeParam, likeParam]);
    return result.rows.map(row => ({
      ...row,
      location: row.location ? JSON.parse(row.location) : null,
    }));
  }

  // Get pelanggan within radius (in meters)
  // MySQL/MariaDB tidak punya ST_DWithin, pakai ST_Distance_Sphere
  static async getWithinRadius(longitude, latitude, radiusMeters) {
    const query = `
      SELECT 
        id, nosambungan, idpelanggan, nopelanggan, nama,
        alamat, noalamat, nourut, longitude, latitude,
        pakai, tagihan, tglbayar, lunas,
        ST_AsGeoJSON(location) as location,
        ST_Distance_Sphere(
          location,
          ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)
        ) as distance,
        created_at, updated_at
      FROM pelanggan
      WHERE location IS NOT NULL
      HAVING distance <= ?
      ORDER BY distance ASC
    `;

    const result = await db.query(query, [longitude, latitude, radiusMeters]);
    return result.rows.map(row => ({
      ...row,
      location: row.location ? JSON.parse(row.location) : null,
    }));
  }

  // Create new pelanggan
  static async create(data) {
    const query = `
      INSERT INTO pelanggan (
        nosambungan, idpelanggan, nopelanggan, nama,
        alamat, noalamat, nourut, longitude, latitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.nosambungan,
      data.idpelanggan,
      data.nopelanggan,
      data.nama,
      data.alamat,
      data.noalamat,
      data.nourut,
      data.longitude,
      data.latitude,
    ];

    const result = await db.query(query, values);
    // Ambil data yang baru diinsert
    const newId = result.rows.insertId;
    return this.getById(newId);
  }

  // Update pelanggan
  static async update(id, data) {
    const query = `
      UPDATE pelanggan SET
        nosambungan = COALESCE(?, nosambungan),
        idpelanggan = COALESCE(?, idpelanggan),
        nopelanggan = COALESCE(?, nopelanggan),
        nama = COALESCE(?, nama),
        alamat = COALESCE(?, alamat),
        noalamat = COALESCE(?, noalamat),
        nourut = COALESCE(?, nourut),
        longitude = COALESCE(?, longitude),
        latitude = COALESCE(?, latitude),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const values = [
      data.nosambungan,
      data.idpelanggan,
      data.nopelanggan,
      data.nama,
      data.alamat,
      data.noalamat,
      data.nourut,
      data.longitude,
      data.latitude,
      id,
    ];

    await db.query(query, values);
    return this.getById(id);
  }

  // Delete pelanggan
  static async delete(id) {
    const existing = await this.getById(id);
    if (!existing) return null;
    await db.query('DELETE FROM pelanggan WHERE id = ?', [id]);
    return existing;
  }

  // Get statistics
  static async getStats() {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT alamat) as unique_addresses,
        COUNT(CASE WHEN longitude IS NOT NULL AND latitude IS NOT NULL THEN 1 END) as with_coordinates
      FROM pelanggan
    `;

    const result = await db.query(query);
    return result.rows[0];
  }
}

module.exports = Pelanggan;
