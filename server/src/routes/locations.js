const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// GET /api/locations - Get all locations with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { type, search, category, includePending } = req.query;

    // Build where clause
    const where = {};

    // Only include non-pending locations by default
    if (includePending !== 'true') {
      where.isPending = false;
    }

    // Filter by type
    if (type && type !== 'all') {
      where.type = type;
    }

    // Filter by category
    if (category) {
      where.category = {
        contains: category,
        mode: 'insensitive'
      };
    }

    // Search in name, description, and accepts
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { accepts: { has: search.toLowerCase() } }
      ];
    }

    const locations = await req.prisma.location.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    res.json(locations);
  } catch (error) {
    next(error);
  }
});

// GET /api/locations/:id - Get single location
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const location = await req.prisma.location.findUnique({
      where: { id: parseInt(id) }
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(location);
  } catch (error) {
    next(error);
  }
});

// POST /api/locations - Create new location (admin only)
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const {
      name,
      type,
      category,
      address,
      lat,
      lng,
      phone,
      website,
      hours,
      accepts,
      description,
      isPending = false
    } = req.body;

    // Validate required fields
    if (!name || !type || !category || !address || lat === undefined || lng === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: name, type, category, address, lat, lng'
      });
    }

    const location = await req.prisma.location.create({
      data: {
        name,
        type,
        category,
        address,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        phone: phone || null,
        website: website || null,
        hours: hours || null,
        accepts: accepts || [],
        description: description || null,
        isPending
      }
    });

    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
});

// PUT /api/locations/:id - Update location (admin only)
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      category,
      address,
      lat,
      lng,
      phone,
      website,
      hours,
      accepts,
      description,
      isPending
    } = req.body;

    // Check if location exists
    const existing = await req.prisma.location.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const location = await req.prisma.location.update({
      where: { id: parseInt(id) },
      data: {
        name: name !== undefined ? name : existing.name,
        type: type !== undefined ? type : existing.type,
        category: category !== undefined ? category : existing.category,
        address: address !== undefined ? address : existing.address,
        lat: lat !== undefined ? parseFloat(lat) : existing.lat,
        lng: lng !== undefined ? parseFloat(lng) : existing.lng,
        phone: phone !== undefined ? phone : existing.phone,
        website: website !== undefined ? website : existing.website,
        hours: hours !== undefined ? hours : existing.hours,
        accepts: accepts !== undefined ? accepts : existing.accepts,
        description: description !== undefined ? description : existing.description,
        isPending: isPending !== undefined ? isPending : existing.isPending
      }
    });

    res.json(location);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/locations/:id - Delete location (admin only)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if location exists
    const existing = await req.prisma.location.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }

    await req.prisma.location.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
