const { requireAdmin } = require('../_lib/auth');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');
const { getStudents, deleteStudent } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const students = await getStudents();
    const safe = students.map(({ hash, salt, ...rest }) => rest);
    return sendJson(res, 200, { success: true, count: safe.length, students: safe });
  }

  if (req.method === 'DELETE') {
    try {
      const body = await parseJsonBody(req);
      const id = body.id || (req.query && req.query.id);
      if (!id) return sendJson(res, 400, { error: 'Student ID required' });
      await deleteStudent(id);
      return sendJson(res, 200, { success: true, message: 'Student deleted' });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Failed to delete student' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};