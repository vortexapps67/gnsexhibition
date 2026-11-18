const { getAuthenticatedAdmin } = require('../_lib/auth');
const { sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    return sendJson(res, 401, { authenticated: false, error: 'Invalid or expired session' });
  }

  return sendJson(res, 200, {
    authenticated: true,
    user: admin.user,
    expiresAt: admin.exp
  });
};
