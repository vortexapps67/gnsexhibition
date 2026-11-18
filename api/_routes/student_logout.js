const { sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  return sendJson(res, 200, {
    success: true,
    message: 'Signed out successfully'
  }, {
    'Set-Cookie': 'student_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
  });
};
