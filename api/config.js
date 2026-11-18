const { CATEGORIES, getBackendInfo } = require('./_lib/db');
const { sendJson, handleCors } = require('./_lib/helper');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const backendInfo = getBackendInfo();

  return sendJson(res, 200, {
    siteName: process.env.SITE_NAME || 'Expo 2026 — School Exhibition',
    year: process.env.EXHIBITION_YEAR || '2026',
    categories: CATEGORIES,
    allowPublicSubmissions: process.env.ALLOW_PUBLIC_SUBMISSIONS !== 'false',
    backend: backendInfo.type,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '179200222340-vsv7qsqr1g49ns3nhgt0kuhshtt4es5t.apps.googleusercontent.com',
    features: {
      auth: true,
      realtimeSync: true,
      exportCsv: true,
      exportJson: true
    }
  });
};
