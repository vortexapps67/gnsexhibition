const { getStats, getBackendInfo } = require('./_lib/db');
const { sendJson, handleCors } = require('./_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    const stats = await getStats();
    const backend = getBackendInfo();

    return sendJson(res, 200, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      backend: backend.type,
      environment: {
        adminUsernameConfigured: Boolean(process.env.ADMIN_USERNAME),
        adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
        sessionSecretConfigured: Boolean(process.env.SESSION_SECRET),
        firebaseUrlConfigured: Boolean(process.env.FIREBASE_DATABASE_URL),
        isVercel: Boolean(process.env.VERCEL)
      },
      stats
    });
  } catch (err) {
    return sendJson(res, 500, {
      status: 'degraded',
      error: err.message
    });
  }
};
