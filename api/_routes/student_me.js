const { getAuthenticatedStudent } = require('../_lib/auth');
const { getProjectsByStudentId, getStudentVote, getStudentById, updateStudent } = require('../_lib/db');
const { sendJson, handleCors, parseJsonBody } = require('../_lib/helper');

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
        name: body.name
      });

      return sendJson(res, 200, {
        success: true,
        message: 'Profile details updated successfully',
        student: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          grade: updated.grade || 'Student',
          admissionNo: updated.admissionNo || '',
          rollNo: updated.rollNo || '',
          partnerNames: updated.partnerNames || '',
          partnerRollNos: updated.partnerRollNos || '',
          picture: updated.picture || '',
          isGoogle: !!updated.googleId,
          createdAt: updated.createdAt || Date.now()
        }
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
      student: {
        id: dbStudent.id,
        name: dbStudent.name,
        email: dbStudent.email,
        grade: dbStudent.grade || 'Student',
        admissionNo: dbStudent.admissionNo || '',
        rollNo: dbStudent.rollNo || '',
        partnerNames: dbStudent.partnerNames || '',
        partnerRollNos: dbStudent.partnerRollNos || '',
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
