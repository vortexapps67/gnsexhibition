const { requireAdmin } = require('../_lib/auth');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');
const { updateAdminUser, deleteAdminUser, getAdminUserByIdRaw } = require('../_lib/db');

function getId(req) {
  if (req.query && req.query.id) return req.query.id;
  const pathname = req.url.split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const id = getId(req);
  if (!id || id === 'users' || id === 'admin') return sendJson(res, 400, { error: 'Admin user ID required' });

  if (req.method === 'GET') {
    const u = await getAdminUserByIdRaw(id);
    if (!u) return sendJson(res, 404, { error: 'Admin user not found' });
    const { hash, salt, ...safe } = u;
    return sendJson(res, 200, { success: true, user: safe });
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    try {
      const body = await parseJsonBody(req);
      const updated = await updateAdminUser(id, { username: body.username, password: body.password, role: body.role });
      return sendJson(res, 200, { success: true, user: updated });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Failed to update admin user' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteAdminUser(id, admin.user);
      return sendJson(res, 200, { success: true, message: 'Admin user deleted' });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Failed to delete admin user' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};