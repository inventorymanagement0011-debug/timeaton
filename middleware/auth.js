// middleware/auth.js
const bcrypt = require('bcryptjs');

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  // Store intended destination
  req.session.returnTo = req.originalUrl;
  res.redirect('/admin/login');
}

// Hash a password (run once to generate ADMIN_PASSWORD_HASH for .env)
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { requireAdmin, hashPassword, verifyPassword };
