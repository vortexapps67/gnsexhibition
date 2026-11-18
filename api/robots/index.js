function baseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (process.env.VERCEL ? 'https' : 'http');
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Method not allowed');
  }

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin.html',
    'Disallow: /api/',
    '',
    `Sitemap: ${baseUrl(req)}/sitemap.xml`,
    ''
  ].join('\n');

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.end(req.method === 'HEAD' ? undefined : body);
};
