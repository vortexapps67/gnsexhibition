// Data layer for the exhibition site.
// Architecture: Pure serverless backend API (/api) with secure environment variables.
// ZERO credentials, secrets, or database URLs are exposed in client-side code.
// Reads are synchronous against an in-memory cache hydrated on startup.

const STORE_KEY = 'expo_projects_v2';
const ACTIVITY_KEY = 'expo_activity_v2';
const ADMIN_TOKEN_KEY = 'expo_admin_token';
const ADMIN_USER_KEY = 'expo_admin_user';

const CATEGORIES = [
  'Robotics', 'AI & Machine Learning', 'Web Development', 'Mobile Apps',
  'IoT & Hardware', 'Science & Research', 'Art & Design', 'Game Development', 'Other'
];

let projectsCache = null;
let activityCache = null;
let isApiConnected = false;
let settled = false;
let resolveReady;
const readyPromise = new Promise(resolve => { resolveReady = resolve; });

// Live sync subscribers
const projectSubs = [];
const activitySubs = [];
let lastProjectsSig = '';
let lastActivitySig = '';

function signature(list) {
  return JSON.stringify((list || []).map(item => {
    const o = {};
    Object.keys(item || {}).sort().forEach(k => { o[k] = item[k]; });
    return o;
  }).sort((a, b) => String(a.id).localeCompare(String(b.id))));
}

function subscribeProjects(fn) {
  projectSubs.push(fn);
  return () => {
    const i = projectSubs.indexOf(fn);
    if (i > -1) projectSubs.splice(i, 1);
  };
}

function subscribeActivity(fn) {
  activitySubs.push(fn);
  return () => {
    const i = activitySubs.indexOf(fn);
    if (i > -1) activitySubs.splice(i, 1);
  };
}

function notifyProjects() {
  const sig = signature(projectsCache);
  if (sig === lastProjectsSig) return;
  lastProjectsSig = sig;
  projectSubs.forEach(fn => { try { fn(projectsCache); } catch (e) {} });
}

function notifyActivity() {
  const sig = signature(activityCache);
  if (sig === lastActivitySig) return;
  lastActivitySig = sig;
  activitySubs.forEach(fn => { try { fn(activityCache); } catch (e) {} });
}

function settle(source) {
  if (settled) return;
  settled = true;
  resolveReady({ source });
}

function ready() { return readyPromise; }

function uid(prefix = 'p_') {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function getAdminToken() {
  try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function getAuthHeaders() {
  const token = getAdminToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

function localSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function loadLocalProjects() {
  if (projectsCache) return projectsCache;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    projectsCache = raw ? JSON.parse(raw) : [];
  } catch (e) { projectsCache = []; }
  localSave(STORE_KEY, projectsCache);
  return projectsCache;
}

function loadLocalActivity() {
  if (activityCache) return activityCache;
  try {
    activityCache = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  } catch (e) { activityCache = []; }
  return activityCache;
}

// Polling and API synchronization
async function syncFromApi() {
  try {
    const pRes = await fetch('/api/projects', { method: 'GET', cache: 'no-store' });
    if (pRes.ok) {
      const data = await pRes.json();
      if (Array.isArray(data.projects)) {
        projectsCache = data.projects;
        localSave(STORE_KEY, projectsCache);
        notifyProjects();
        isApiConnected = true;
      }
    }
  } catch (e) {}

  try {
    const aRes = await fetch('/api/activity', { method: 'GET', cache: 'no-store' });
    if (aRes.ok) {
      const aData = await aRes.json();
      if (Array.isArray(aData.activity)) {
        activityCache = aData.activity;
        localSave(ACTIVITY_KEY, activityCache);
        notifyActivity();
      }
    }
  } catch (e) {}
}

async function init() {
  loadLocalProjects();
  loadLocalActivity();

  try {
    const health = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
    if (health.ok) {
      isApiConnected = true;
      await syncFromApi();
      settle('api');
      // Background sync every 4 seconds for real-time collaborative updates
      setInterval(syncFromApi, 4000);
      return;
    }
  } catch (e) {
    // API not running on this domain/host (e.g. static file preview)
  }

  // Fallback to local storage if API is unreachable
  settle('local');
}

// Storage event listener for cross-tab sync in local mode
window.addEventListener('storage', e => {
  if (isApiConnected) return;
  if (e.key === STORE_KEY) {
    projectsCache = null;
    loadLocalProjects();
    notifyProjects();
  }
  if (e.key === ACTIVITY_KEY) {
    activityCache = null;
    loadLocalActivity();
    notifyActivity();
  }
});

/* ==================== PUBLIC API ==================== */

function getProjects() {
  return loadLocalProjects().slice();
}

function getProjectById(id) {
  return getProjects().find(p => p.id === id) || null;
}

function saveProjects(list) {
  projectsCache = list;
  localSave(STORE_KEY, list);
  notifyProjects();
}

function addProject(p) {
  const project = {
    id: uid(),
    status: 'pending',
    featured: false,
    createdAt: Date.now(),
    reviewedAt: null,
    reviewNote: '',
    ...p
  };

  const current = getProjects();
  current.unshift(project);
  saveProjects(current);

  if (isApiConnected) {
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    }).then(res => res.json()).then(data => {
      if (data && data.project && data.project.id) {
        const list = getProjects();
        const idx = list.findIndex(x => x.id === project.id);
        if (idx !== -1) {
          list[idx] = data.project;
          saveProjects(list);
        }
      }
    }).catch(e => console.warn('API addProject error:', e));
  }

  return project;
}

function updateProject(id, patch) {
  const list = getProjects();
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return null;

  list[idx] = { ...list[idx], ...patch };
  saveProjects(list);

  if (isApiConnected) {
    fetch('/api/projects/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(patch)
    }).then(res => res.json()).then(data => {
      if (data && data.project) {
        const fresh = getProjects();
        const freshIdx = fresh.findIndex(x => x.id === id);
        if (freshIdx !== -1) {
          fresh[freshIdx] = data.project;
          saveProjects(fresh);
        }
      }
    }).catch(e => console.warn('API updateProject error:', e));
  }

  return list[idx];
}

function deleteProject(id) {
  const filtered = getProjects().filter(p => p.id !== id);
  saveProjects(filtered);

  if (isApiConnected) {
    fetch('/api/projects/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(e => console.warn('API deleteProject error:', e));
  }
}

function clearProjects() {
  saveProjects([]);

  if (isApiConnected) {
    fetch('/api/admin/reset', {
      method: 'POST',
      headers: getAuthHeaders()
    }).catch(e => console.warn('API clearProjects error:', e));
  }
}

function stats() {
  const list = getProjects();
  return {
    total: list.length,
    approved: list.filter(p => p.status === 'approved').length,
    pending: list.filter(p => p.status === 'pending').length,
    rejected: list.filter(p => p.status === 'rejected').length
  };
}

function getActivity() {
  return loadLocalActivity().slice();
}

function logActivity(action, detail) {
  const entry = { id: uid('act_'), action, detail, at: Date.now() };
  const updated = [entry, ...getActivity()].slice(0, 40);
  activityCache = updated;
  localSave(ACTIVITY_KEY, updated);
  notifyActivity();
}

function isAdminLoggedIn() {
  try {
    return Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY));
  } catch (e) {
    return false;
  }
}

async function verifyAdminSession() {
  const token = getAdminToken();
  if (!token) return false;

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.authenticated);
    }
  } catch (e) {}

  return isAdminLoggedIn();
}

async function adminLogin(user, pass) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass })
    });
    const data = await res.json();
    if (res.ok && data.success && data.token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      sessionStorage.setItem(ADMIN_USER_KEY, data.user || user);
      return { success: true, user: data.user || user };
    }
    return { success: false, error: data.error || 'Invalid credentials' };
  } catch (e) {
    return { success: false, error: 'Network error connecting to backend API.' };
  }
}

async function adminLogout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (e) {}

  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
  } catch (e) {}
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

window.ExpoStore = {
  CATEGORIES,
  ready,
  getProjects,
  saveProjects,
  addProject,
  updateProject,
  deleteProject,
  clearProjects,
  getProjectById,
  isAdminLoggedIn,
  verifyAdminSession,
  adminLogin,
  adminLogout,
  stats,
  initials,
  uid,
  getActivity,
  logActivity,
  subscribeProjects,
  subscribeActivity,
  get backend() {
    return isApiConnected ? 'vercel-api' : 'localStorage';
  }
};

init();
