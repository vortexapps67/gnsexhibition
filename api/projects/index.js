const { getAuthenticatedAdmin } = require('../_lib/auth');
const { getProjects, addProject, CATEGORIES } = require('../_lib/db');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const statusParam = url.searchParams.get('status');
  const catParam = url.searchParams.get('category') || url.searchParams.get('cat');
  const queryParam = (url.searchParams.get('q') || '').toLowerCase();

  // GET /api/projects
  if (req.method === 'GET') {
    try {
      let list = await getProjects();

      if (catParam && catParam !== 'All') {
        list = list.filter(p => p.category === catParam);
      }
      if (statusParam && statusParam.toLowerCase() !== 'all') {
        list = list.filter(p => (p.status || '').toLowerCase() === statusParam.toLowerCase());
      }
      if (queryParam) {
        list = list.filter(p => {
          const haystack = `${p.title} ${p.studentName} ${p.description} ${(p.tags || []).join(' ')}`.toLowerCase();
          return haystack.includes(queryParam);
        });
      }

      return sendJson(res, 200, {
        success: true,
        count: list.length,
        projects: list
      });
    } catch (e) {
      console.error('Error fetching projects:', e);
      return sendJson(res, 500, { error: 'Failed to retrieve projects' });
    }
  }

  // POST /api/projects
  if (req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { title, studentName, grade, email, category, description, imageUrl, demoUrl, repoUrl, tags } = body;

      if (!title || !studentName || !grade || !description) {
        return sendJson(res, 400, {
          error: 'Missing required fields: title, studentName, grade, and description are required.'
        });
      }

      const validCat = CATEGORIES.includes(category) ? category : 'Other';

      const project = await addProject({
        title,
        studentName,
        grade,
        email: email || '',
        category: validCat,
        description,
        imageUrl: imageUrl || '',
        demoUrl: demoUrl || '#',
        repoUrl: repoUrl || '#',
        tags: tags || []
      });

      return sendJson(res, 201, {
        success: true,
        message: 'Project submitted successfully for review.',
        project
      });
    } catch (e) {
      console.error('Error submitting project:', e);
      return sendJson(res, 500, { error: 'Failed to submit project' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
