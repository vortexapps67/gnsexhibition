const { getAuthenticatedStudent } = require('../_lib/auth');
const { getProjectsByStudentId, getStudentVote, getStudentById } = require('../_lib/db');
const { sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const sessionStudent = getAuthenticatedStudent(req);
  if (!sessionStudent) {
    return sendJson(res, 401, { authenticated: false, error: 'Not authenticated as a student' });
  }

  try {
    const dbStudent = (await getStudentById(sessionStudent.id)) || sessionStudent;
    const myProjects = await getProjectsByStudentId(sessionStudent.id, sessionStudent.email);
    const votedProjectId = await getStudentVote(sessionStudent.id);

    return sendJson(res, 200, {
      authenticated: true,
      student: {
        id: dbStudent.id,
        name: dbStudent.name,
        email: dbStudent.email,
        grade: dbStudent.grade || 'Student',
        picture: dbStudent.picture || '',
        isGoogle: !!dbStudent.googleId,
        createdAt: dbStudent.createdAt || Date.now()
      },
      myProjects,
      votedProjectId
    });
  } catch (err) {
    console.error('Error in student/me:', err);
    return sendJson(res, 500, { error: 'Failed to retrieve student profile' });
  }
};
