const { requireAdmin } = require('../_lib/auth');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');
const { getAdminUsers, createAdminUser, getAdminUserRaw } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const users = await getAdminUsers();
    return sendJson(res, 200, { success: true, users });
  }

  if (req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const user = await createAdminUser({ username: body.username, password: body.password, role: body.role });
      return sendJson(res, 201, { success: true, user });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Failed to create admin user' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};