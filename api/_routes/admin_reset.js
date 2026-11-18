const { requireAdmin } = require('../_lib/auth');
const { clearProjects } = require('../_lib/db');
const { sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  try {
    await clearProjects();
    return sendJson(res, 200, { success: true, message: 'All project data has been cleared.' });
  } catch (e) {
    console.error('Error resetting projects:', e);
    return sendJson(res, 500, { error: 'Failed to reset project data.' });
  }
};
