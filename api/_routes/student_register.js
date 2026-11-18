const { createStudent } = require('../_lib/db');
const { signStudentToken } = require('../_lib/auth');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = await parseJsonBody(req);
    const { name, email, grade, password } = body;

    if (!name || !email || !grade || !password) {
      return sendJson(res, 400, { error: 'Name, email, grade, and password are required.' });
    }

    if (password.length < 6) {
      return sendJson(res, 400, { error: 'Password must be at least 6 characters long.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendJson(res, 400, { error: 'Please enter a valid student email address.' });
    }

    const student = await createStudent({ name, email, grade, password });
    const token = signStudentToken(student);

    const cookie = `student_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

    return sendJson(res, 201, {
      success: true,
      message: 'Student account registered successfully',
      token,
      student
    }, {
      'Set-Cookie': cookie
    });
  } catch (err) {
    return sendJson(res, 400, { error: err.message || 'Registration failed' });
  }
};
