const http = require('http');
const fs = require('fs');
const path = require('path');

// Built-in .env parser (zero dependency)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
      });
      console.log(' Loaded environment variables from .env');
    } catch (e) {
      console.warn('Could not parse .env file:', e.message);
    }
  }
}
loadEnv();

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Single unified API Router
const apiHandler = require('./api/index');

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  req.query = Object.fromEntries(parsedUrl.searchParams.entries());

  // Handle all API routes through single router
  if (pathname.startsWith('/api')) {
    return apiHandler(req, res);
  }

  // Handle Static Files
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : decodeURIComponent(pathname));
  
  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (!path.extname(filePath)) {
        const withHtml = filePath + '.html';
        if (fs.existsSync(withHtml)) {
          filePath = withHtml;
        } else {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.end('<h1>404 Not Found</h1><p>The requested file does not exist.</p>');
        }
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end('<h1>404 Not Found</h1>');
      }
    } else if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.statusCode = 500;
        return res.end('Error reading file: ' + readErr.message);
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.end(content);
    });
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(` Expo 2026 Server running at http://localhost:${PORT}`);
    console.log(` Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(` API Health:  http://localhost:${PORT}/api/health`);
    console.log(` Admin User:  ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(` Admin Pass:  ${process.env.ADMIN_PASSWORD ? '••••••••' : '(not set)'}`);
    console.log(` Backend DB:  ${process.env.FIREBASE_DATABASE_URL ? 'Firebase RTDB' : 'Local File Store'}`);
    console.log(`==================================================\n`);
  });
}

module.exports = server;
