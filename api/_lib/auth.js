const crypto = require('crypto');

function getSecret() {
  return process.env.SESSION_SECRET || 'expo-2026-default-session-secret-change-me';
}

function getAdminCredentials() {
  return {
    user: process.env.ADMIN_USERNAME || 'admin',
    pass: process.env.ADMIN_PASSWORD || 'exhibition2026'
  };
}

function signToken(payload) {
  const secret = getSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const secret = getSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  
  if (signature.length !== expectedSig.length) return null;
  try {
    const match = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    if (!match) return null;
    const json = Buffer.from(body, 'base64url').toString('utf8');
    const data = JSON.parse(json);
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers && req.headers.cookie;
  if (!rc) return list;
  rc.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const key = parts.shift().trim();
    const val = decodeURIComponent(parts.join('='));
    list[key] = val;
  });
  return list;
}

function getTokenFromReq(req) {
  const authHeader = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req);
  if (cookies.admin_session) {
    return cookies.admin_session;
  }
  return null;
}

function getAuthenticatedAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const session = verifyToken(token);
  if (session && session.role === 'admin') {
    return session;
  }
  return null;
}

function requireAdmin(req, res) {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required' }));
    return null;
  }
  return admin;
}

function validateCredentials(user, pass) {
  const creds = getAdminCredentials();
  if (!user || !pass) return false;
  return user.trim() === creds.user.trim() && pass === creds.pass;
}

module.exports = {
  signToken,
  verifyToken,
  getTokenFromReq,
  getAuthenticatedAdmin,
  requireAdmin,
  validateCredentials,
  getAdminCredentials
};
