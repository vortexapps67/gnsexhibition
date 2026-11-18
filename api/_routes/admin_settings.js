const { requireAdmin } = require('../_lib/auth');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');
const { getSettings, updateSettings } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') {
    const settings = await getSettings();
    return sendJson(res, 200, { success: true, settings });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const body = await parseJsonBody(req);
      const updated = await updateSettings(body);
      return sendJson(res, 200, { success: true, settings: updated });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Failed to update settings' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};