const { getAuthenticatedStudent, requireStudent } = require('../_lib/auth');
const { getVoteCounts, getStudentVote, castStudentVote } = require('../_lib/db');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  // GET /api/vote: Get vote counts + current student's voted project (if logged in)
  if (req.method === 'GET') {
    try {
      const counts = await getVoteCounts();
      const student = getAuthenticatedStudent(req);
      const votedProjectId = student ? await getStudentVote(student.id) : null;

      return sendJson(res, 200, {
        success: true,
        counts,
        votedProjectId
      });
    } catch (err) {
      console.error('Error fetching votes:', err);
      return sendJson(res, 500, { error: 'Failed to retrieve vote data' });
    }
  }

  // POST /api/vote: Cast single vote (Strictly 1 vote per student account)
  if (req.method === 'POST') {
    const student = requireStudent(req, res);
    if (!student) return; // 401 already sent by requireStudent

    try {
      const body = await parseJsonBody(req);
      const { projectId } = body;

      if (!projectId) {
        return sendJson(res, 400, { error: 'projectId is required' });
      }

      const result = await castStudentVote(student.id, projectId);

      return sendJson(res, 200, {
        success: true,
        message: result.isVoted
          ? (result.previousVotedProject && result.previousVotedProject !== projectId
              ? 'Vote updated to this project! (1 vote per student account)'
              : 'Vote recorded for People\'s Choice Award!')
          : 'Vote removed',
        votedProjectId: result.votedProjectId,
        isVoted: result.isVoted,
        counts: result.counts,
        projectVotes: result.projectVotes
      });
    } catch (err) {
      console.error('Error casting vote:', err);
      return sendJson(res, 400, { error: err.message || 'Failed to register vote' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
