const { sendJson, handleCors } = require('../_lib/helper');
const { logActivity } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  await logActivity('Admin Logout', 'Admin signed out');

  return sendJson(res, 200, {
    success: true,
    message: 'Signed out successfully'
  }, {
    'Set-Cookie': 'admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
  });
};
