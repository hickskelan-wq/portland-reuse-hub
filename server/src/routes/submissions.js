const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// POST /api/submissions - Submit new location suggestion (public)
router.post('/', async (req, res, next) => {
  try {
    const { locationData, submitterEmail } = req.body;

    if (!locationData) {
      return res.status(400).json({ error: 'Location data is required' });
    }

    // Validate required location fields
    const { name, type, category, address, lat, lng } = locationData;
    if (!name || !type || !category || !address || lat === undefined || lng === undefined) {
      return res.status(400).json({
        error: 'Location must include: name, type, category, address, lat, lng'
      });
    }

    const submission = await req.prisma.submission.create({
      data: {
        locationName: name,
        locationType: type,
        submitterEmail: submitterEmail || null,
        locationData: locationData,
        status: 'pending'
      }
    });

    res.status(201).json({
      success: true,
      id: submission.id,
      message: 'Submission received and pending review'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/submissions - Get all submissions (admin only)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const submissions = await req.prisma.submission.findMany({
      where,
      orderBy: { submittedAt: 'desc' }
    });

    res.json(submissions);
  } catch (error) {
    next(error);
  }
});

// GET /api/submissions/:id - Get single submission (admin only)
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const submission = await req.prisma.submission.findUnique({
      where: { id }
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/submissions/:id - Approve or reject submission (admin only)
router.patch('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be "approved" or "rejected"'
      });
    }

    // Find the submission
    const submission = await req.prisma.submission.findUnique({
      where: { id }
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (submission.status !== 'pending') {
      return res.status(400).json({
        error: `Submission has already been ${submission.status}`
      });
    }

    // Use a transaction to update submission and optionally create location
    const result = await req.prisma.$transaction(async (prisma) => {
      // Update submission status
      const updatedSubmission = await prisma.submission.update({
        where: { id },
        data: {
          status,
          processedAt: new Date()
        }
      });

      let newLocation = null;

      // If approved, create the location
      if (status === 'approved') {
        const locationData = submission.locationData;
        newLocation = await prisma.location.create({
          data: {
            name: locationData.name,
            type: locationData.type,
            category: locationData.category,
            address: locationData.address,
            lat: parseFloat(locationData.lat),
            lng: parseFloat(locationData.lng),
            phone: locationData.phone || null,
            website: locationData.website || null,
            hours: locationData.hours || null,
            accepts: locationData.accepts || [],
            description: locationData.description || null,
            isPending: false
          }
        });
      }

      return { submission: updatedSubmission, location: newLocation };
    });

    res.json({
      success: true,
      submission: result.submission,
      location: result.location,
      message: status === 'approved'
        ? 'Submission approved and location added'
        : 'Submission rejected'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/submissions/:id - Delete submission (admin only)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const submission = await req.prisma.submission.findUnique({
      where: { id }
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    await req.prisma.submission.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Submission deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
