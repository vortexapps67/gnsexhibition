const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  'Robotics', 'AI & Machine Learning', 'Web Development', 'Mobile Apps',
  'IoT & Hardware', 'Science & Research', 'Art & Design', 'Game Development', 'Other'
];

function uid(prefix = 'p_') {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function getFirebaseUrl(subpath) {
  let base = process.env.FIREBASE_DATABASE_URL || '';
  if (!base) return null;
  base = base.replace(/\/+$/, '');
  const secret = process.env.FIREBASE_AUTH_SECRET;
  const authQuery = secret ? `?auth=${encodeURIComponent(secret)}` : '';
  return `${base}/expo2026/${subpath}.json${authQuery}`;
}

// Local filesystem fallback
let localStoreCache = null;

function getLocalStorePath() {
  // If running in Vercel serverless, /tmp is writable
  const isVercel = !!process.env.VERCEL;
  if (isVercel) {
    return path.join('/tmp', 'expo_store.json');
  }
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
  }
  return path.join(dataDir, 'store.json');
}

function readLocalStore() {
  if (localStoreCache) return localStoreCache;
  const p = getLocalStorePath();
  try {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      localStoreCache = {
        projects: Array.isArray(data.projects) ? data.projects : [],
        activity: Array.isArray(data.activity) ? data.activity : []
      };
      return localStoreCache;
    }
  } catch (e) {
    console.error('Error reading local store:', e.message);
  }
  localStoreCache = { projects: [], activity: [] };
  return localStoreCache;
}

function writeLocalStore(store) {
  localStoreCache = store;
  const p = getLocalStorePath();
  try {
    fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing local store:', e.message);
  }
}

// Helper: Convert Firebase object { key: item } to array
function objectToArray(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj).map(k => ({
    ...(obj[k] || {}),
    id: (obj[k] && obj[k].id) || k
  }));
}

// Helper: Convert array to object { [item.id]: item }
function arrayToObject(list) {
  const obj = {};
  (list || []).forEach(item => {
    if (item && item.id) obj[item.id] = item;
  });
  return obj;
}

/* ==================== CORE DB API ==================== */

async function getProjects() {
  const url = getFirebaseUrl('projects');
  if (url) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const val = await res.json();
        return objectToArray(val).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    } catch (e) {
      console.warn('Firebase getProjects failed, using local store:', e.message);
    }
  }
  const store = readLocalStore();
  return (store.projects || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function getProjectById(id) {
  const projects = await getProjects();
  return projects.find(p => p.id === id) || null;
}

async function saveAllProjects(list) {
  const store = readLocalStore();
  store.projects = list;
  writeLocalStore(store);

  const url = getFirebaseUrl('projects');
  if (url) {
    try {
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arrayToObject(list))
      });
    } catch (e) {
      console.error('Firebase saveAllProjects failed:', e.message);
    }
  }
}

async function addProject(projectData) {
  const project = {
    id: uid(),
    title: (projectData.title || '').trim(),
    studentName: (projectData.studentName || '').trim(),
    grade: (projectData.grade || '').trim(),
    email: (projectData.email || '').trim(),
    category: projectData.category || 'Other',
    description: (projectData.description || '').trim(),
    imageUrl: (projectData.imageUrl || '').trim(),
    demoUrl: (projectData.demoUrl || '').trim() || '#',
    repoUrl: (projectData.repoUrl || '').trim() || '#',
    tags: Array.isArray(projectData.tags)
      ? projectData.tags
      : (projectData.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    status: projectData.status || 'pending',
    featured: Boolean(projectData.featured),
    createdAt: Date.now(),
    reviewedAt: null,
    reviewNote: projectData.reviewNote || ''
  };

  const list = await getProjects();
  list.unshift(project);
  await saveAllProjects(list);
  await logActivity('Submitted', `New project: "${project.title}" by ${project.studentName}`);
  return project;
}

async function updateProject(id, patch) {
  const list = await getProjects();
  const index = list.findIndex(p => p.id === id);
  if (index === -1) return null;

  const current = list[index];
  const updated = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt
  };

  if (patch.tags && typeof patch.tags === 'string') {
    updated.tags = patch.tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  list[index] = updated;
  await saveAllProjects(list);
  return updated;
}

async function deleteProject(id) {
  const list = await getProjects();
  const target = list.find(p => p.id === id);
  if (!target) return false;

  const filtered = list.filter(p => p.id !== id);
  await saveAllProjects(filtered);
  await logActivity('Deleted', `Project: "${target.title}"`);
  return true;
}

async function clearProjects() {
  await saveAllProjects([]);
  await logActivity('Cleared all projects', 'All submissions removed');
  return true;
}

/* ==================== ACTIVITY API ==================== */

async function getActivity() {
  const url = getFirebaseUrl('activity');
  if (url) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const val = await res.json();
        return objectToArray(val).sort((a, b) => (b.at || 0) - (a.at || 0));
      }
    } catch (e) {
      console.warn('Firebase getActivity failed, using local store:', e.message);
    }
  }
  const store = readLocalStore();
  return (store.activity || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
}

async function logActivity(action, detail) {
  const entry = {
    id: uid('act_'),
    action,
    detail: detail || '',
    at: Date.now()
  };

  const current = await getActivity();
  const updated = [entry, ...current].slice(0, 50);

  const store = readLocalStore();
  store.activity = updated;
  writeLocalStore(store);

  const url = getFirebaseUrl('activity');
  if (url) {
    try {
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arrayToObject(updated))
      });
    } catch (e) {
      console.error('Firebase logActivity failed:', e.message);
    }
  }
  return entry;
}

async function clearActivity() {
  const store = readLocalStore();
  store.activity = [];
  writeLocalStore(store);

  const url = getFirebaseUrl('activity');
  if (url) {
    try {
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
    } catch (e) {}
  }
  return true;
}

async function getStats() {
  const list = await getProjects();
  return {
    total: list.length,
    approved: list.filter(p => p.status === 'approved').length,
    pending: list.filter(p => p.status === 'pending').length,
    rejected: list.filter(p => p.status === 'rejected').length
  };
}

function getBackendInfo() {
  const firebaseConfigured = Boolean(process.env.FIREBASE_DATABASE_URL);
  return {
    type: firebaseConfigured ? 'firebase' : 'local-storage',
    firebaseUrl: firebaseConfigured ? process.env.FIREBASE_DATABASE_URL : null
  };
}

module.exports = {
  CATEGORIES,
  getProjects,
  getProjectById,
  addProject,
  updateProject,
  deleteProject,
  clearProjects,
  getActivity,
  logActivity,
  clearActivity,
  getStats,
  getBackendInfo
};
