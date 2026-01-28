const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Helper to get today's date as YYYY-MM-DD
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// POST /api/analytics/track - Track an event (public)
router.post('/track', async (req, res, next) => {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Type and data are required' });
    }

    // Validate type
    const validTypes = ['search', 'view', 'filter', 'category'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const date = getTodayDate();
    const dataStr = String(data).toLowerCase().trim();

    // Upsert: increment count if exists, create if not
    await req.prisma.analytics.upsert({
      where: {
        type_data_date: {
          type,
          data: dataStr,
          date
        }
      },
      update: {
        count: { increment: 1 }
      },
      create: {
        type,
        data: dataStr,
        date,
        count: 1
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/batch - Track multiple events at once (public)
router.post('/batch', async (req, res, next) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    const date = getTodayDate();
    const validTypes = ['search', 'view', 'filter', 'category'];

    // Process each event
    const results = await Promise.all(
      events.map(async ({ type, data }) => {
        if (!type || !data || !validTypes.includes(type)) {
          return { success: false, type, data };
        }

        const dataStr = String(data).toLowerCase().trim();

        await req.prisma.analytics.upsert({
          where: {
            type_data_date: {
              type,
              data: dataStr,
              date
            }
          },
          update: {
            count: { increment: 1 }
          },
          create: {
            type,
            data: dataStr,
            date,
            count: 1
          }
        });

        return { success: true, type, data };
      })
    );

    res.json({ success: true, processed: results.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/insights - Get dashboard data (admin only)
router.get('/insights', authenticateToken, async (req, res, next) => {
  try {
    const { days = 30, type } = req.query;
    const daysNum = parseInt(days) || 30;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Build where clause
    const where = {
      date: {
        gte: startDateStr,
        lte: endDateStr
      }
    };

    if (type) {
      where.type = type;
    }

    // Get analytics data grouped by type and data
    const analytics = await req.prisma.analytics.findMany({
      where,
      orderBy: [
        { count: 'desc' }
      ]
    });

    // Group by type
    const grouped = {
      search: [],
      view: [],
      filter: [],
      category: []
    };

    analytics.forEach(item => {
      if (grouped[item.type]) {
        // Find existing entry or create new
        const existing = grouped[item.type].find(e => e.data === item.data);
        if (existing) {
          existing.count += item.count;
        } else {
          grouped[item.type].push({ data: item.data, count: item.count });
        }
      }
    });

    // Sort each group by count
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => b.count - a.count);
      grouped[key] = grouped[key].slice(0, 20); // Top 20 per category
    });

    // Get totals
    const totals = {
      searches: grouped.search.reduce((sum, item) => sum + item.count, 0),
      views: grouped.view.reduce((sum, item) => sum + item.count, 0),
      filters: grouped.filter.reduce((sum, item) => sum + item.count, 0),
      categories: grouped.category.reduce((sum, item) => sum + item.count, 0)
    };

    // Get daily breakdown for the period
    const dailyData = await req.prisma.analytics.groupBy({
      by: ['date', 'type'],
      where,
      _sum: {
        count: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Format daily data
    const daily = {};
    dailyData.forEach(item => {
      if (!daily[item.date]) {
        daily[item.date] = { search: 0, view: 0, filter: 0, category: 0 };
      }
      daily[item.date][item.type] = item._sum.count || 0;
    });

    res.json({
      period: {
        start: startDateStr,
        end: endDateStr,
        days: daysNum
      },
      totals,
      topSearches: grouped.search,
      topViews: grouped.view,
      topFilters: grouped.filter,
      topCategories: grouped.category,
      daily
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/summary - Quick summary stats (admin only)
router.get('/summary', authenticateToken, async (req, res, next) => {
  try {
    const today = getTodayDate();

    // Get today's stats
    const todayStats = await req.prisma.analytics.groupBy({
      by: ['type'],
      where: { date: today },
      _sum: { count: true }
    });

    // Get total locations count
    const locationCount = await req.prisma.location.count({
      where: { isPending: false }
    });

    // Get pending submissions count
    const pendingSubmissions = await req.prisma.submission.count({
      where: { status: 'pending' }
    });

    // Format today stats
    const todayFormatted = {
      search: 0,
      view: 0,
      filter: 0,
      category: 0
    };

    todayStats.forEach(stat => {
      todayFormatted[stat.type] = stat._sum.count || 0;
    });

    res.json({
      today: todayFormatted,
      locations: locationCount,
      pendingSubmissions
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
