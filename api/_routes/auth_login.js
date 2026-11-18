const { signToken } = require('../_lib/auth');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');
const { logActivity, verifyAdminCredentials } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = await parseJsonBody(req);
    const { user, pass } = body;

    if (!user || !pass) {
      return sendJson(res, 400, { error: 'Username and password are required.' });
    }

    const admin = await verifyAdminCredentials(user, pass);
    if (!admin) {
      return sendJson(res, 401, { error: 'Invalid admin credentials.' });
    }

    // Token valid for 7 days
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const token = signToken({
      user: admin.username,
      role: 'admin',
      exp: expiresAt
    });

    await logActivity('Admin Login', `Admin signed in successfully`);

    // Set cookie as well for browsers that support it
    const cookie = `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

    return sendJson(res, 200, {
      success: true,
      message: 'Authenticated successfully',
      token,
      user: admin.username,
      expiresAt
    }, {
      'Set-Cookie': cookie
    });
  } catch (err) {
    console.error('Login error:', err);
    return sendJson(res, 500, { error: 'Internal server error during login.' });
  }
};
