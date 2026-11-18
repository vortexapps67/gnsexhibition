const { getProjects } = require('../_lib/db');

function xml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function baseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (process.env.VERCEL ? 'https' : 'http');
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/xml');
    return res.end('<?xml version="1.0" encoding="UTF-8"?><error>Method not allowed</error>');
  }

  try {
    const base = baseUrl(req);
    const pages = [
      { path: '', priority: '1.0', freq: 'weekly' },
      { path: 'projects.html', priority: '0.9', freq: 'daily' },
      { path: 'about.html', priority: '0.7', freq: 'monthly' },
      { path: 'schedule.html', priority: '0.7', freq: 'monthly' },
      { path: 'judges.html', priority: '0.6', freq: 'monthly' },
      { path: 'faq.html', priority: '0.6', freq: 'monthly' },
      { path: 'submit.html', priority: '0.8', freq: 'monthly' }
    ];

    const projects = (await getProjects()).filter(p => p.status === 'approved' && !p.preview);
    const entries = pages.map(page => `
  <url>
    <loc>${xml(base + '/' + page.path)}</loc>
    <changefreq>${page.freq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);

    projects.forEach(p => {
      const modified = p.reviewedAt || p.createdAt || Date.now();
      entries.push(`
  <url>
    <loc>${xml(`${base}/project.html?id=${encodeURIComponent(p.id)}`)}</loc>
    <lastmod>${new Date(modified).toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    });

    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}\n</urlset>`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) {
    console.error('Error generating sitemap:', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/xml');
    return res.end('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap unavailable</error>');
  }
};
