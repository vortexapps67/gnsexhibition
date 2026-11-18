const { getAuthenticatedStudent, getAuthenticatedAdmin } = require('../_lib/auth');
const { lookupStudent } = require('../_lib/db');
const { sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const student = getAuthenticatedStudent(req);
  const admin = getAuthenticatedAdmin(req);

  if (!student && !admin) {
    return sendJson(res, 401, { error: 'You must be signed in to search for classmates.' });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const query = url.searchParams.get('code') || url.searchParams.get('id') || url.searchParams.get('q') || '';

  if (!query.trim()) {
    return sendJson(res, 400, { error: 'Please enter a student Unique ID, Code, or Admission Number.' });
  }

  try {
    const found = await lookupStudent(query);
    if (!found) {
      return sendJson(res, 404, {
        success: false,
        error: `No student found matching "${query.trim()}". Check the ID and try again.`
      });
    }

    // Do not allow adding oneself as partner
    if (student && (found.id === student.id || found.studentCode === student.studentCode)) {
      return sendJson(res, 400, {
        success: false,
        error: 'That is your own Student ID. Enter your teammate\'s Unique ID.'
      });
    }

    return sendJson(res, 200, {
      success: true,
      student: found
    });
  } catch (err) {
    console.error('Error in student/lookup:', err);
    return sendJson(res, 500, { error: 'Failed to search for student' });
  }
};
