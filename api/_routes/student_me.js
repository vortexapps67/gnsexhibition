const { getAuthenticatedStudent } = require('../_lib/auth');
const { getProjectsByStudentId, getStudentVote, getStudentById, updateStudent } = require('../_lib/db');
const { sendJson, handleCors, parseJsonBody } = require('../_lib/helper');

function formatStudent(s) {
  return {
    id: s.id,
    studentCode: s.studentCode || ('EXP-' + (s.id || '').slice(2, 6).toUpperCase()),
    name: s.name,
    email: s.email,
    grade: (s.grade && s.grade !== 'Student') ? s.grade : '',
    admissionNo: s.admissionNo || '',
    rollNo: s.rollNo || '',
    partnerNames: s.partnerNames || '',
    partnerRollNos: s.partnerRollNos || '',
    teamMembers: Array.isArray(s.teamMembers) ? s.teamMembers : [],
    picture: s.picture || '',
    isGoogle: !!s.googleId,
    createdAt: s.createdAt || Date.now()
  };
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const sessionStudent = getAuthenticatedStudent(req);
  if (!sessionStudent) {
    return sendJson(res, 401, { authenticated: false, error: 'Not authenticated as a student' });
  }

  // UPDATE Profile Details (POST / PUT)
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const body = await parseJsonBody(req);
      const updated = await updateStudent(sessionStudent.id, {
        grade: body.grade,
        admissionNo: body.admissionNo,
        rollNo: body.rollNo,
        partnerNames: body.partnerNames,
        partnerRollNos: body.partnerRollNos,
        teamMembers: body.teamMembers,
        name: body.name
      });

      return sendJson(res, 200, {
        success: true,
        message: 'Profile details updated successfully',
        student: formatStudent(updated)
      });
    } catch (err) {
      console.error('Error updating student profile:', err);
      return sendJson(res, 400, { error: err.message || 'Failed to update profile' });
    }
  }

  // GET Profile Details
  try {
    const dbStudent = (await getStudentById(sessionStudent.id)) || sessionStudent;
    const myProjects = await getProjectsByStudentId(sessionStudent.id, sessionStudent.email);
    const votedProjectId = await getStudentVote(sessionStudent.id);

    return sendJson(res, 200, {
      authenticated: true,
      student: formatStudent(dbStudent),
      myProjects,
      votedProjectId
    });
  } catch (err) {
    console.error('Error in student/me:', err);
    return sendJson(res, 500, { error: 'Failed to retrieve student profile' });
  }
};
