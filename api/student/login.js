const { getStudentByEmail } = require('../_lib/db');
const { verifyPassword, signStudentToken } = require('../_lib/auth');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = await parseJsonBody(req);
    const { email, password } = body;

    if (!email || !password) {
      return sendJson(res, 400, { error: 'Email and password are required.' });
    }

    const student = await getStudentByEmail(email);
    if (!student || !student.hash || !student.salt) {
      return sendJson(res, 401, { error: 'Invalid email or password.' });
    }

    const isValid = verifyPassword(password, student.hash, student.salt);
    if (!isValid) {
      return sendJson(res, 401, { error: 'Invalid email or password.' });
    }

    const safeStudent = {
      id: student.id,
      name: student.name,
      email: student.email,
      grade: student.grade,
      createdAt: student.createdAt
    };

    const token = signStudentToken(safeStudent);
    const cookie = `student_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

    return sendJson(res, 200, {
      success: true,
      message: 'Signed in successfully',
      token,
      student: safeStudent
    }, {
      'Set-Cookie': cookie
    });
  } catch (err) {
    console.error('Student login error:', err);
    return sendJson(res, 500, { error: 'Internal server error during login.' });
  }
};
