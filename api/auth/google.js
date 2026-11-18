const { findOrCreateGoogleStudent, logActivity } = require('../_lib/db');
const { signStudentToken, signToken } = require('../_lib/auth');
const { parseJsonBody, sendJson, handleCors } = require('../_lib/helper');

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID || '';
}

function getGoogleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET || '';
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  // 1. GET: OAuth Redirect or Callback
  if (req.method === 'GET') {
    const url = new URL(req.url, baseUrl);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') || '/my-projects.html';
    const error = url.searchParams.get('error');

    // If OAuth error returned by Google
    if (error) {
      res.statusCode = 302;
      res.setHeader('Location', `/student-login.html?error=${encodeURIComponent('Google login was cancelled or failed')}`);
      return res.end();
    }

    // Callback flow with Authorization Code
    if (code) {
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          }).toString()
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.id_token) {
          throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange authorization code');
        }

        // Verify ID Token with Google tokeninfo
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`);
        const payload = await verifyRes.json();
        if (!verifyRes.ok || !payload.email) {
          throw new Error('Failed to verify Google token');
        }

        const student = await findOrCreateGoogleStudent({
          name: payload.name || payload.email.split('@')[0],
          email: payload.email,
          googleId: payload.sub,
          picture: payload.picture || '',
          grade: 'Student'
        });

        const sessionToken = signStudentToken(student);
        const cookie = `student_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

        // Return HTML to store token in localStorage and redirect
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Set-Cookie', cookie);
        return res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Authenticating...</title></head>
            <body>
              <p>Signing in with Google, please wait...</p>
              <script>
                try {
                  localStorage.setItem('expo_student_token', ${JSON.stringify(sessionToken)});
                  localStorage.setItem('expo_student_user', JSON.stringify(${JSON.stringify(student)}));
                } catch(e) {}
                window.location.href = ${JSON.stringify(state)};
              </script>
            </body>
          </html>
        `);
      } catch (err) {
        console.error('Google OAuth callback error:', err);
        res.statusCode = 302;
        res.setHeader('Location', `/student-login.html?error=${encodeURIComponent(err.message)}`);
        return res.end();
      }
    }

    // Initiate Google OAuth redirect
    if (!clientId) {
      res.statusCode = 302;
      res.setHeader('Location', `/student-login.html?error=${encodeURIComponent('Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID.')}`);
      return res.end();
    }
    const targetState = url.searchParams.get('redirect') || '/my-projects.html';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      state: targetState
    }).toString();

    // If client asked for JSON url
    if (url.searchParams.get('format') === 'json') {
      return sendJson(res, 200, { success: true, url: authUrl });
    }

    res.statusCode = 302;
    res.setHeader('Location', authUrl);
    return res.end();
  }

  // 2. POST: Google Identity Services credential token verification
  if (req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { credential } = body;

      if (!credential) {
        return sendJson(res, 400, { error: 'Google credential token is required' });
      }

      // Verify token with Google's tokeninfo API
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      const payload = await verifyRes.json();

      if (!verifyRes.ok || !payload.email) {
        return sendJson(res, 401, { error: payload.error_description || 'Invalid Google credential token' });
      }

      // Security Check: Audience
      if (clientId && payload.aud && payload.aud !== clientId) {
        console.warn(`Audience mismatch: received ${payload.aud}, expected ${clientId}`);
      }

      if (payload.email_verified !== 'true' && payload.email_verified !== true) {
        return sendJson(res, 401, { error: 'Google email is not verified.' });
      }

      const student = await findOrCreateGoogleStudent({
        name: payload.name || payload.email.split('@')[0],
        email: payload.email,
        googleId: payload.sub,
        picture: payload.picture || '',
        grade: 'Student'
      });

      const sessionToken = signStudentToken(student);
      const cookie = `student_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

      // Check if this Google user is also an admin
      let isAdmin = false;
      let adminToken = null;
      const adminUser = (process.env.ADMIN_USERNAME || '').toLowerCase().trim();
      const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
      if ((adminEmail && payload.email.toLowerCase() === adminEmail) || (adminUser && payload.email.toLowerCase() === adminUser)) {
        isAdmin = true;
        adminToken = signToken({
          user: payload.email,
          role: 'admin',
          exp: Date.now() + 7 * 86400 * 1000
        });
      }

      return sendJson(res, 200, {
        success: true,
        message: 'Google authentication successful',
        token: sessionToken,
        student,
        isAdmin,
        adminToken
      }, {
        'Set-Cookie': cookie
      });
    } catch (err) {
      console.error('Google token verification error:', err);
      return sendJson(res, 500, { error: 'Failed to verify Google sign in: ' + err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
