const { requireAdmin } = require('../_lib/auth');
const { getProjectById, updateProject, deleteProject, logActivity } = require('../_lib/db');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');

function getIdFromRequest(req) {
  if (req.query && req.query.id) return req.query.id;
  const pathname = req.url.split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const id = getIdFromRequest(req);
  if (!id || id === 'index' || id === 'projects') {
    return sendJson(res, 400, { error: 'Project ID is required' });
  }

  // GET /api/projects/:id
  if (req.method === 'GET') {
    try {
      const project = await getProjectById(id);
      if (!project) {
        return sendJson(res, 404, { error: 'Project not found' });
      }
      return sendJson(res, 200, { success: true, project });
    } catch (e) {
      console.error('Error fetching project:', e);
      return sendJson(res, 500, { error: 'Failed to retrieve project' });
    }
  }

  // Protected Admin Routes: PATCH / PUT / DELETE
  const admin = requireAdmin(req, res);
  if (!admin) return; // 401 already sent by requireAdmin

  // PATCH / PUT /api/projects/:id
  if (req.method === 'PATCH' || req.method === 'PUT') {
    try {
      const existing = await getProjectById(id);
      if (!existing) {
        return sendJson(res, 404, { error: 'Project not found' });
      }

      const patch = await parseJsonBody(req);
      if (patch.status && patch.status !== existing.status) {
        patch.reviewedAt = Date.now();
        if (patch.status === 'approved') {
          await logActivity('Approved', `Project: "${existing.title}" approved by admin`);
        } else if (patch.status === 'rejected') {
          await logActivity('Rejected', `Project: "${existing.title}" rejected: ${patch.reviewNote || 'No reason provided'}`);
        }
      } else if (patch.featured !== undefined && patch.featured !== existing.featured) {
        await logActivity(patch.featured ? 'Featured' : 'Unfeatured', `Project: "${existing.title}"`);
      } else {
        await logActivity('Edited', `Project: "${existing.title}" updated by admin`);
      }

      const updated = await updateProject(id, patch);
      return sendJson(res, 200, { success: true, project: updated });
    } catch (e) {
      console.error('Error updating project:', e);
      return sendJson(res, 500, { error: 'Failed to update project' });
    }
  }

  // DELETE /api/projects/:id
  if (req.method === 'DELETE') {
    try {
      const existing = await getProjectById(id);
      if (!existing) {
        return sendJson(res, 404, { error: 'Project not found' });
      }

      const deleted = await deleteProject(id);
      return sendJson(res, 200, {
        success: true,
        message: `Project "${existing.title}" deleted successfully.`
      });
    } catch (e) {
      console.error('Error deleting project:', e);
      return sendJson(res, 500, { error: 'Failed to delete project' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
