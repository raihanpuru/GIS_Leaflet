const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/bangunan/:kecamatan
// Kembalikan data sebagai GeoJSON FeatureCollection
// supaya polygon.js frontend tidak perlu banyak diubah
router.get('/:kecamatan', async (req, res) => {
  const { kecamatan } = req.params;

  // Optional query params untuk filter
  const { building, amenity, name, bbox } = req.query;

  try {
    let query = `
      SELECT
        id, osm_id, kecamatan,
        name, building, building_levels, height,
        amenity, shop, leisure, office, tourism,
        religion, denomination, surface,
        addr_street, addr_housenumber, addr_city, addr_postcode,
        addr_district, addr_subdistrict,
        phone, website, opening_hours,
        ST_AsGeoJSON(geom) AS geometry
      FROM bangunan
      WHERE kecamatan = ?
    `;
    const params = [kecamatan];

    if (building) { query += ` AND building = ?`; params.push(building); }
    if (amenity)  { query += ` AND amenity = ?`;  params.push(amenity);  }
    if (name)     { query += ` AND name LIKE ?`;  params.push(`%${name}%`); }

    // Bbox filter: minLng,minLat,maxLng,maxLat
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
      query += ` AND MBRIntersects(geom, ST_GeomFromText(?, 4326))`;
      params.push(`POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Data bangunan untuk kecamatan "${kecamatan}" tidak ditemukan di database.`,
      });
    }

    // Susun GeoJSON FeatureCollection
    // (format sama persis seperti file .geojson statis)
    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: JSON.parse(row.geometry),
      properties: {
        '@id':            row.osm_id,
        name:             row.name,
        building:         row.building,
        'building:levels': row.building_levels,
        height:           row.height,
        amenity:          row.amenity,
        shop:             row.shop,
        leisure:          row.leisure,
        office:           row.office,
        tourism:          row.tourism,
        religion:         row.religion,
        denomination:     row.denomination,
        surface:          row.surface,
        'addr:street':    row.addr_street,
        'addr:housenumber': row.addr_housenumber,
        'addr:city':      row.addr_city,
        'addr:postcode':  row.addr_postcode,
        'addr:district':  row.addr_district,
        'addr:subdistrict': row.addr_subdistrict,
        phone:            row.phone,
        website:          row.website,
        opening_hours:    row.opening_hours,
      },
    }));

    const geojson = {
      type: 'FeatureCollection',
      features,
    };

    res.json(geojson);

  } catch (error) {
    console.error('Error fetching bangunan:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil data bangunan',
      message: error.message,
    });
  }
});

// GET /api/bangunan/:kecamatan/stats
// Info jumlah bangunan per tipe
router.get('/:kecamatan/stats', async (req, res) => {
  const { kecamatan } = req.params;
  try {
    const result = await db.query(
      `SELECT building, COUNT(*) as jumlah
       FROM bangunan WHERE kecamatan = ?
       GROUP BY building ORDER BY jumlah DESC`,
      [kecamatan]
    );
    res.json({ success: true, kecamatan, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;