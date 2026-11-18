const { handleCors, sendJson } = require('./_lib/helper');

const handlers = {
  '/api/auth/login': require('./_routes/auth_login'),
  '/api/auth/verify': require('./_routes/auth_verify'),
  '/api/auth/logout': require('./_routes/auth_logout'),
  '/api/auth/google': require('./_routes/auth_google'),
  '/api/auth/google/callback': require('./_routes/auth_google'),
  '/api/student/register': require('./_routes/student_register'),
  '/api/student/login': require('./_routes/student_login'),
  '/api/student/me': require('./_routes/student_me'),
  '/api/student/update': require('./_routes/student_me'),
  '/api/student/lookup': require('./_routes/student_lookup'),
  '/api/student/logout': require('./_routes/student_logout'),
  '/api/vote': require('./_routes/vote'),
  '/api/votes': require('./_routes/vote'),
  '/api/projects': require('./_routes/projects'),
  '/api/activity': require('./_routes/activity'),
  '/api/admin/reset': require('./_routes/admin_reset'),
  '/api/admin/users': require('./_routes/admin_users'),
  '/api/admin/settings': require('./_routes/admin_settings'),
  '/api/admin/students': require('./_routes/students_admin'),
  '/api/config': require('./_routes/config'),
  '/api/health': require('./_routes/health'),
};

const projectItemHandler = require('./_routes/project_item');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const rawUrl = req.headers['x-matched-path'] || req.url || '/api';
  const parsed = new URL(rawUrl, 'http://localhost');
  const pathname = (parsed.pathname || '/api').replace(/\/+$/, '') || '/api';

  // Ensure req.query is populated
  if (!req.query) {
    req.query = Object.fromEntries(parsed.searchParams.entries());
  }

  // Exact route match
  if (handlers[pathname]) {
    return handlers[pathname](req, res);
  }

  // Dynamic /api/projects/:id route
  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    req.query.id = decodeURIComponent(projectMatch[1]);
    return projectItemHandler(req, res);
  }

  // Dynamic /api/admin/users/:id route
  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (adminUserMatch) {
    req.query.id = decodeURIComponent(adminUserMatch[1]);
    return require('./_routes/admin_user_item')(req, res);
  }

  // Root /api endpoint
  if (pathname === '/api' || pathname === '') {
    return sendJson(res, 200, {
      ok: true,
      service: 'Expo 2026 API',
      status: 'online',
      routes: Object.keys(handlers)
    });
  }

  return sendJson(res, 404, {
    error: `API route not found: ${pathname}`
  });
};
