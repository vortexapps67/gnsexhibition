const { getAuthenticatedStudent } = require('../_lib/auth');
const { getProjectsByStudentId, getStudentVote } = require('../_lib/db');
const { sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const student = getAuthenticatedStudent(req);
  if (!student) {
    return sendJson(res, 401, { authenticated: false, error: 'Not authenticated as a student' });
  }

  try {
    const myProjects = await getProjectsByStudentId(student.id, student.email);
    const votedProjectId = await getStudentVote(student.id);

    return sendJson(res, 200, {
      authenticated: true,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        grade: student.grade
      },
      myProjects,
      votedProjectId
    });
  } catch (err) {
    console.error('Error in student/me:', err);
    return sendJson(res, 500, { error: 'Failed to retrieve student profile' });
  }
};
