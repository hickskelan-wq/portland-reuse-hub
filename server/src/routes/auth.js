const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { generateToken, verifyToken } = require('../middleware/auth');

// Get admin password hash from environment or create default
// In production, set ADMIN_PASSWORD_HASH environment variable
const getAdminPasswordHash = () => {
  if (process.env.ADMIN_PASSWORD_HASH) {
    return process.env.ADMIN_PASSWORD_HASH;
  }
  // Default password for development: 'admin123'
  // Generate with: node -e "console.log(require('bcryptjs').hashSync('admin123', 10))"
  return '$2a$10$rQZ1qg0/9.Vy8JqGrHpvfOeXzJYF1KqE9Kq0FqZp7qE9Kq0FqZp7q';
};

// POST /api/auth/login - Admin login
router.post('/login', async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const adminPasswordHash = getAdminPasswordHash();

    // For development, also allow plain text comparison with 'admin123'
    const isValidDev = process.env.NODE_ENV !== 'production' && password === 'admin123';
    const isValidHash = bcrypt.compareSync(password, adminPasswordHash);

    if (!isValidDev && !isValidHash) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT token
    const token = generateToken({ role: 'admin', iat: Date.now() });

    res.json({
      success: true,
      token,
      expiresIn: '24h'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verify - Verify JWT token
router.post('/verify', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required', valid: false });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token', valid: false });
  }

  res.json({
    valid: true,
    role: decoded.role,
    expiresAt: new Date(decoded.exp * 1000).toISOString()
  });
});

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', (req, res) => {
  // JWT tokens are stateless, so logout is handled client-side
  // This endpoint is for completeness and could be used for logging
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
