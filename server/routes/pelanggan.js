const express = require('express');
const router = express.Router();
const Pelanggan = require('../models/Pelanggan');

// GET /api/pelanggan - Get all pelanggan with filters
router.get('/', async (req, res) => {
  try {
    const filters = {
      nama: req.query.nama,
      alamat: req.query.alamat,
      noalamat: req.query.noalamat,
      bbox: req.query.bbox,
      bulan: req.query.bulan,
      tahun: req.query.tahun,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const pelanggan = await Pelanggan.getAll(filters);
    
    res.json({
      success: true,
      count: pelanggan.length,
      data: pelanggan,
    });
  } catch (error) {
    console.error('Error fetching pelanggan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pelanggan',
      message: error.message,
    });
  }
});

// GET /api/pelanggan/search?q=term - Search pelanggan
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" is required',
      });
    }

    const pelanggan = await Pelanggan.search(q);
    
    res.json({
      success: true,
      count: pelanggan.length,
      data: pelanggan,
    });
  } catch (error) {
    console.error('Error searching pelanggan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search pelanggan',
      message: error.message,
    });
  }
});

// GET /api/pelanggan/nearby - Get pelanggan within radius
router.get('/nearby', async (req, res) => {
  try {
    const { lng, lat, radius } = req.query;
    
    if (!lng || !lat) {
      return res.status(400).json({
        success: false,
        error: 'Parameters "lng" and "lat" are required',
      });
    }

    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);
    const radiusMeters = radius ? parseFloat(radius) : 500; // Default 500 meters

    const pelanggan = await Pelanggan.getWithinRadius(longitude, latitude, radiusMeters);
    
    res.json({
      success: true,
      count: pelanggan.length,
      data: pelanggan,
    });
  } catch (error) {
    console.error('Error fetching nearby pelanggan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby pelanggan',
      message: error.message,
    });
  }
});

// GET /api/pelanggan/stats - Get statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Pelanggan.getStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message,
    });
  }
});

// GET /api/pelanggan/:id - Get pelanggan by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pelanggan = await Pelanggan.getById(id);
    
    if (!pelanggan) {
      return res.status(404).json({
        success: false,
        error: 'Pelanggan not found',
      });
    }
    
    res.json({
      success: true,
      data: pelanggan,
    });
  } catch (error) {
    console.error('Error fetching pelanggan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pelanggan',
      message: error.message,
    });
  }
});

// POST /api/pelanggan - Create new pelanggan
router.post('/', async (req, res) => {
  try {
    const pelanggan = await Pelanggan.create(req.body);
    
    res.status(201).json({
      success: true,
      data: pelanggan,
    });
  } catch (error) {
    console.error('Error creating pelanggan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pelanggan',
      message: error.message,
    });
  }
});

// PATCH /api/pelanggan/by-nosambungan/:nosambungan - Update koordinat semua periode
router.patch('/by-nosambungan/:nosambungan', async (req, res) => {
  try {
    const { nosambungan } = req.params;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'latitude dan longitude wajib diisi',
      });
    }

    const affectedRows = await Pelanggan.updateCoordsByNosambungan(
      nosambungan,
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({
      success: true,
      affectedRows,
      message: `${affectedRows} record diupdate (semua periode)`,
    });
  } catch (error) {
    console.error('Error updating coords by nosambungan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update coordinates',
      message: error.message,
    });
  }
});

// PUT /api/pelanggan/:id - Update pelanggan
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pelanggan = await Pelanggan.update(id, req.body);
    
    if (!pelanggan) {
      return res.status(404).json({
        success: false,
        error: 'Pelanggan not found',
      });
    }
    
    res.json({
      success: true,
      data: pelanggan,
    });
  } catch (error) {
    console.error('Error updating pelanggan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update pelanggan',
      message: error.message,
    });
  }
});

// DELETE /api/pelanggan/:id - Delete pelanggan
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pelanggan = await Pelanggan.delete(id);
    
    if (!pelanggan) {
      return res.status(404).json({
        success: false,
        error: 'Pelanggan not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Pelanggan deleted successfully',
      data: pelanggan,
    });
  } catch (error) {
    console.error('Error deleting pelanggan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete pelanggan',
      message: error.message,
    });
  }
});

module.exports = router;