// Data layer for the exhibition site.
// Primary store: Firebase Realtime Database. Fallback: localStorage.
// All reads are synchronous against an in-memory cache; call ExpoStore.ready()
// once before the first render so the cache has been hydrated.

const STORE_KEY = 'expo_projects_v2';
const ACTIVITY_KEY = 'expo_activity_v2';
const ADMIN_KEY = 'expo_admin_session_v1';
const ADMIN_CREDS = { user: 'admin', pass: 'exhibition2026' };
const DB_ROOT = 'expo2026';

const firebaseConfig = {
  apiKey: "AIzaSyCRsbEJd4jNRYCeGsKDtaaO5HlWkEOkNIg",
  authDomain: "du-spoofer.firebaseapp.com",
  databaseURL: "https://du-spoofer-default-rtdb.firebaseio.com",
  projectId: "du-spoofer",
  storageBucket: "du-spoofer.firebasestorage.app",
  messagingSenderId: "732214647457",
  appId: "1:732214647457:web:9e91a8b48cfdac17c16ee0",
  measurementId: "G-V10EFESX44"
};

const CATEGORIES = [
  'Robotics', 'AI & Machine Learning', 'Web Development', 'Mobile Apps',
  'IoT & Hardware', 'Science & Research', 'Art & Design', 'Game Development', 'Other'
];

let db = null;
let useFirebase = false;
let projectsCache = null;
let activityCache = null;
let settled = false;
let resolveReady;
const readyPromise = new Promise(resolve => { resolveReady = resolve; });

// Live-sync subscribers. Pages register here to re-render in place whenever
// Firebase pushes a new projects/activity snapshot (or a local write occurs).
const projectSubs = [];
const activitySubs = [];
let lastProjectsSig = '';
let lastActivitySig = '';

function signature(list) {
  // Stable across Firebase key ordering and local object insertion order.
  return JSON.stringify((list || []).map(item => {
    const o = {};
    Object.keys(item || {}).sort().forEach(k => { o[k] = item[k]; });
    return o;
  }).sort((a, b) => String(a.id).localeCompare(String(b.id))));
}
function subscribeProjects(fn) { projectSubs.push(fn); return () => { const i = projectSubs.indexOf(fn); if (i > -1) projectSubs.splice(i, 1); }; }
function subscribeActivity(fn) { activitySubs.push(fn); return () => { const i = activitySubs.indexOf(fn); if (i > -1) activitySubs.splice(i, 1); }; }
function notifyProjects() {
  const sig = signature(projectsCache);
  if (sig === lastProjectsSig) return;
  lastProjectsSig = sig;
  projectSubs.forEach(fn => { try { fn(projectsCache); } catch (e) { /* subscriber error */ } });
}
function notifyActivity() {
  const sig = signature(activityCache);
  if (sig === lastActivitySig) return;
  lastActivitySig = sig;
  activitySubs.forEach(fn => { try { fn(activityCache); } catch (e) { /* subscriber error */ } });
}

function settle() {
  if (settled) return;
  settled = true;
  resolveReady({ source: useFirebase ? 'firebase' : 'localStorage' });
}
function ready() { return readyPromise; }

function uid() {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ---------- Firebase helpers ---------- */
function objectToArray(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj).map(k => ({ ...(obj[k] || {}), id: (obj[k] && obj[k].id) || k }));
}
function arrayToObject(list) {
  const obj = {};
  (list || []).forEach(item => { obj[item.id] = item; });
  return obj;
}
function localSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
}

function writeProjects(list) {
  projectsCache = list;
  localSave(STORE_KEY, list);
  notifyProjects();
  if (useFirebase && db) db.child('projects').set(arrayToObject(list)).catch(() => {});
}
function writeActivity(list) {
  activityCache = list;
  localSave(ACTIVITY_KEY, list);
  notifyActivity();
  if (useFirebase && db) db.child('activity').set(arrayToObject(list)).catch(() => {});
}

function fallback() {
  if (useFirebase && db) {
    try { db.child('projects').off(); db.child('activity').off(); } catch (e) { /* ignore */ }
  }
  useFirebase = false;
  db = null;
  loadLocalProjects();
  loadLocalActivity();
  notifyProjects();
  notifyActivity();
  settle();
}

// Cross-tab sync when running in localStorage fallback mode.
window.addEventListener('storage', e => {
  if (useFirebase) return;
  if (e.key === STORE_KEY) { projectsCache = null; loadLocalProjects(); notifyProjects(); }
  if (e.key === ACTIVITY_KEY) { activityCache = null; loadLocalActivity(); notifyActivity(); }
});

function init() {
  // If Firebase cannot be reached (offline or rules denial), keep the site usable.
  const timer = setTimeout(() => { if (!settled) fallback(); }, 4000);

  try {
    if (typeof firebase === 'undefined' || !firebase.database) throw new Error('Firebase SDK not loaded');
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

    const root = firebase.database().ref(DB_ROOT);
    db = root;
    useFirebase = true;
    window.ExpoDB = root;

    root.child('projects').on('value', snapshot => {
      clearTimeout(timer);
      const val = snapshot.val();
      // An empty database stays empty — projects only arrive via submissions.
      projectsCache = objectToArray(val);
      localSave(STORE_KEY, projectsCache);
      notifyProjects();
      settle();
    }, () => { clearTimeout(timer); fallback(); });

    root.child('activity').on('value', snapshot => {
      activityCache = objectToArray(snapshot.val()).sort((a, b) => (b.at || 0) - (a.at || 0));
      localSave(ACTIVITY_KEY, activityCache);
      notifyActivity();
    }, () => {});
  } catch (e) {
    clearTimeout(timer);
    fallback();
  }
}

/* ---------- Public synchronous API ---------- */
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
  try { activityCache = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'); }
  catch (e) { activityCache = []; }
  return activityCache;
}

function getProjects() { return loadLocalProjects().slice(); }
function saveProjects(list) { writeProjects(list); }
function getProjectById(id) { return getProjects().find(p => p.id === id) || null; }

function addProject(p) {
  const list = getProjects();
  const project = {
    id: uid(), status: 'pending', featured: false,
    createdAt: Date.now(), reviewedAt: null, reviewNote: '',
    ...p
  };
  list.unshift(project);
  writeProjects(list);
  return project;
}
function updateProject(id, patch) {
  const list = getProjects();
  const i = list.findIndex(p => p.id === id);
  if (i === -1) return null;
  list[i] = { ...list[i], ...patch };
  writeProjects(list);
  return list[i];
}
function deleteProject(id) {
  writeProjects(getProjects().filter(p => p.id !== id));
}
function clearProjects() {
  writeProjects([]);
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

function getActivity() { return loadLocalActivity().slice(); }
function logActivity(action, detail) {
  const entry = { id: uid(), action, detail, at: Date.now() };
  writeActivity([entry, ...getActivity()].slice(0, 40));
}

function isAdminLoggedIn() {
  try { return sessionStorage.getItem(ADMIN_KEY) === '1'; } catch (e) { return false; }
}
function adminLogin(user, pass) {
  if (user === ADMIN_CREDS.user && pass === ADMIN_CREDS.pass) {
    try { sessionStorage.setItem(ADMIN_KEY, '1'); } catch (e) { /* ignore */ }
    return true;
  }
  return false;
}
function adminLogout() { try { sessionStorage.removeItem(ADMIN_KEY); } catch (e) { /* ignore */ } }

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

window.ExpoStore = {
  CATEGORIES, firebaseConfig, ready, getProjects, saveProjects, addProject, updateProject,
  deleteProject, clearProjects, getProjectById, isAdminLoggedIn, adminLogin, adminLogout, stats,
  initials, uid, getActivity, logActivity, subscribeProjects, subscribeActivity,
  get backend() { return useFirebase ? 'firebase' : 'localStorage'; }
};

init();
