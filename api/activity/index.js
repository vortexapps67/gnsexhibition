const { requireAdmin } = require('../_lib/auth');
const { getActivity, clearActivity } = require('../_lib/db');
const { sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') {
    try {
      const activity = await getActivity();
      return sendJson(res, 200, { success: true, count: activity.length, activity });
    } catch (e) {
      console.error('Error fetching activity:', e);
      return sendJson(res, 500, { error: 'Failed to retrieve activity log' });
    }
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    try {
      await clearActivity();
      return sendJson(res, 200, { success: true, message: 'Activity log cleared' });
    } catch (e) {
      console.error('Error clearing activity:', e);
      return sendJson(res, 500, { error: 'Failed to clear activity log' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
