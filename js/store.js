// Data layer for the exhibition site.
// Architecture: Pure serverless backend API (/api) with secure environment variables.
// ZERO credentials, secrets, or database URLs are exposed in client-side code.
// Reads are synchronous against an in-memory cache hydrated on startup.

const STORE_KEY = 'expo_projects_v2';
const ACTIVITY_KEY = 'expo_activity_v2';
const VOTES_KEY = 'expo_votes_counts_v1';
const STUDENT_VOTED_KEY = 'expo_student_voted_id';
const ADMIN_TOKEN_KEY = 'expo_admin_token';
const ADMIN_USER_KEY = 'expo_admin_user';
const STUDENT_TOKEN_KEY = 'expo_student_token';
const STUDENT_USER_KEY = 'expo_student_user';

const CATEGORIES = [
  'Robotics', 'AI & Machine Learning', 'Web Development', 'Mobile Apps',
  'IoT & Hardware', 'Science & Research', 'Art & Design', 'Game Development', 'Other'
];

// Sample exhibits are display-only. They are never written to localStorage or /api.
const previewMode = new URLSearchParams(location.search).get('preview') === '1';
const PREVIEW_PROJECTS = [
  {
    id: 'preview_irrigation', title: 'Smart Irrigation System', studentName: 'Aarav Mehta',
    grade: 'Grade 11', email: '', category: 'IoT & Hardware',
    description: 'A soil-moisture network that waters only where it is needed, cutting water use while keeping the school garden healthy.',
    imageUrl: 'assets/irrigation.svg', demoUrl: '#', repoUrl: '#',
    tags: ['Sensors', 'IoT', 'Sustainability'], status: 'approved', featured: true,
    createdAt: Date.parse('2026-11-21T09:00:00'), reviewedAt: Date.parse('2026-11-22T09:00:00'),
    reviewNote: '', preview: true
  },
  {
    id: 'preview_navigation', title: 'Campus Navigation Assistant', studentName: 'Ira Sharma',
    grade: 'Grade 12', email: '', category: 'Web Development',
    description: 'A responsive web guide that helps new students find classrooms, labs and events with clear step-by-step directions.',
    imageUrl: 'assets/navigation.svg', demoUrl: '#', repoUrl: '#',
    tags: ['Web', 'Accessibility', 'Maps'], status: 'approved', featured: true,
    createdAt: Date.parse('2026-11-20T09:00:00'), reviewedAt: Date.parse('2026-11-21T09:00:00'),
    reviewNote: '', preview: true
  },
  {
    id: 'preview_wellness', title: 'Wellness Companion', studentName: 'Naina Kapoor',
    grade: 'Grade 10', email: '', category: 'AI & Machine Learning',
    description: 'A private, friendly check-in tool that suggests small study and wellbeing routines based on how students feel each day.',
    imageUrl: 'assets/wellness.svg', demoUrl: '#', repoUrl: '#',
    tags: ['AI', 'Wellbeing', 'Python'], status: 'approved', featured: true,
    createdAt: Date.parse('2026-11-19T09:00:00'), reviewedAt: Date.parse('2026-11-20T09:00:00'),
    reviewNote: '', preview: true
  }
];

let projectsCache = null;
let activityCache = null;
let voteCountsCache = null;
let studentVotedIdCache = null;
let isApiConnected = false;
let settled = false;
let resolveReady;
const readyPromise = new Promise(resolve => { resolveReady = resolve; });

// Live sync subscribers
const projectSubs = [];
const activitySubs = [];
const voteSubs = [];
let lastProjectsSig = '';
let lastActivitySig = '';
let lastVotesSig = '';

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

function subscribeVotes(fn) {
  voteSubs.push(fn);
  return () => {
    const i = voteSubs.indexOf(fn);
    if (i > -1) voteSubs.splice(i, 1);
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

function notifyVotes() {
  const sig = JSON.stringify(voteCountsCache) + '|' + String(studentVotedIdCache);
  if (sig === lastVotesSig) return;
  lastVotesSig = sig;
  voteSubs.forEach(fn => { try { fn(voteCountsCache); } catch (e) {} });
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

// Admin Token
function getAdminToken() {
  try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function getAuthHeaders() {
  const token = getAdminToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

// Student Token & Auth
function getStudentToken() {
  try { return localStorage.getItem(STUDENT_TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function getStudentAuthHeaders() {
  const token = getStudentToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

function isStudentLoggedIn() {
  return Boolean(getStudentToken());
}

function getStudentUser() {
  try {
    const raw = localStorage.getItem(STUDENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
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
  if (!Array.isArray(projectsCache)) projectsCache = [];
  projectsCache = projectsCache.filter(p => p && !p.preview);
  localSave(STORE_KEY, projectsCache);
  return projectsCache;
}

function loadLocalActivity() {
  if (activityCache) return activityCache;
  try {
    activityCache = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  } catch (e) { activityCache = []; }
  if (!Array.isArray(activityCache)) activityCache = [];
  return activityCache;
}

function loadLocalVotes() {
  if (voteCountsCache) return voteCountsCache;
  try {
    voteCountsCache = JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
  } catch (e) { voteCountsCache = {}; }
  if (!voteCountsCache || typeof voteCountsCache !== 'object' || Array.isArray(voteCountsCache)) {
    voteCountsCache = {};
  }
  try {
    studentVotedIdCache = JSON.parse(localStorage.getItem(STUDENT_VOTED_KEY) || 'null');
  } catch (e) { studentVotedIdCache = null; }
  return voteCountsCache;
}

function getRealProjects() {
  return loadLocalProjects().filter(p => !p.preview).slice();
}

function getProjects() {
  const real = getRealProjects();
  if (!previewMode) return real;
  const ids = new Set(real.map(p => p.id));
  return real.concat(PREVIEW_PROJECTS.filter(p => !ids.has(p.id)).map(p => ({ ...p })));
}

function isPreviewProject(id) {
  return previewMode && PREVIEW_PROJECTS.some(p => p.id === id);
}

// Polling and API synchronization
async function syncFromApi() {
  try {
    const pRes = await fetch('/api/projects', { method: 'GET', cache: 'no-store' });
    if (pRes.ok) {
      const data = await pRes.json();
      if (Array.isArray(data.projects)) {
        projectsCache = data.projects.filter(p => !p.preview);
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

  try {
    const headers = getStudentAuthHeaders();
    const vRes = await fetch('/api/vote', { method: 'GET', headers, cache: 'no-store' });
    if (vRes.ok) {
      const vData = await vRes.json();
      if (vData.counts && typeof vData.counts === 'object') {
        voteCountsCache = vData.counts;
        localSave(VOTES_KEY, voteCountsCache);
      }
      if (vData.votedProjectId !== undefined) {
        studentVotedIdCache = vData.votedProjectId;
        localSave(STUDENT_VOTED_KEY, studentVotedIdCache);
      }
      notifyVotes();
    }
  } catch (e) {}
}

async function init() {
  loadLocalProjects();
  loadLocalActivity();
  loadLocalVotes();

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

// Cross-tab sync for localStorage
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
  if (e.key === VOTES_KEY || e.key === STUDENT_VOTED_KEY) {
    voteCountsCache = null;
    loadLocalVotes();
    notifyVotes();
  }
});

/* ==================== VOTING (ONE VOTE PER STUDENT ACCOUNT) ==================== */

function getVoteSummary() {
  return { ...loadLocalVotes() };
}

function getVoteCount(id) {
  const map = loadLocalVotes();
  return typeof map[id] === 'number' ? map[id] : 0;
}

function hasVoted(id) {
  loadLocalVotes();
  return Boolean(id && studentVotedIdCache === id);
}

function getStudentVotedId() {
  loadLocalVotes();
  return studentVotedIdCache;
}

async function toggleVote(id) {
  if (!id) return { voted: false, count: 0 };

  // Require student login to vote
  if (!isStudentLoggedIn()) {
    if (window.ExpoUI && window.ExpoUI.toast) {
      ExpoUI.toast('Please sign in as a student to vote. Each account gets 1 vote.', 'warning');
    }
    setTimeout(() => {
      const curPage = location.pathname.split('/').pop() || 'index.html';
      location.href = 'student-login.html?redirect=' + encodeURIComponent(curPage + location.search);
    }, 1200);
    return { voted: false, requireLogin: true };
  }

  if (isApiConnected) {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: getStudentAuthHeaders(),
      body: JSON.stringify({ projectId: id })
    });
    const data = await res.json();
    if (!res.ok) {
      if (window.ExpoUI && window.ExpoUI.toast) {
        ExpoUI.toast(data.error || 'Failed to register vote', 'error');
      }
      throw new Error(data.error || 'Failed to submit vote');
    }

    studentVotedIdCache = data.votedProjectId || null;
    localSave(STUDENT_VOTED_KEY, studentVotedIdCache);

    if (data.counts && typeof data.counts === 'object') {
      voteCountsCache = data.counts;
      localSave(VOTES_KEY, voteCountsCache);
    }

    notifyVotes();

    if (window.ExpoUI && window.ExpoUI.toast) {
      ExpoUI.toast(data.message || (data.isVoted ? 'Vote recorded!' : 'Vote removed'), 'success');
    }

    return { voted: Boolean(data.isVoted), count: data.projectVotes || 0 };
  }

  // Local fallback mode (1 vote per account)
  loadLocalVotes();
  const current = studentVotedIdCache;
  const isVoted = current === id ? null : id;
  studentVotedIdCache = isVoted;
  localSave(STUDENT_VOTED_KEY, studentVotedIdCache);

  const map = { ...loadLocalVotes() };
  if (current && map[current]) map[current] = Math.max(0, map[current] - 1);
  if (isVoted) map[isVoted] = (map[isVoted] || 0) + 1;

  voteCountsCache = map;
  localSave(VOTES_KEY, map);
  notifyVotes();

  return { voted: Boolean(isVoted), count: map[id] || 0 };
}

/* ==================== STUDENT AUTH ==================== */

async function studentRegister({ name, email, grade, password }) {
  try {
    const res = await fetch('/api/student/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, grade, password })
    });
    const data = await res.json();
    if (res.ok && data.success && data.token) {
      localStorage.setItem(STUDENT_TOKEN_KEY, data.token);
      localStorage.setItem(STUDENT_USER_KEY, JSON.stringify(data.student));
      await syncFromApi();
      return { success: true, student: data.student };
    }
    return { success: false, error: data.error || 'Registration failed' };
  } catch (err) {
    return { success: false, error: 'Network error connecting to backend API.' };
  }
}

async function studentLogin(email, password) {
  try {
    const res = await fetch('/api/student/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.success && data.token) {
      localStorage.setItem(STUDENT_TOKEN_KEY, data.token);
      localStorage.setItem(STUDENT_USER_KEY, JSON.stringify(data.student));
      await syncFromApi();
      return { success: true, student: data.student };
    }
    return { success: false, error: data.error || 'Invalid email or password' };
  } catch (err) {
    return { success: false, error: 'Network error connecting to backend API.' };
  }
}

async function studentLogout() {
  try {
    await fetch('/api/student/logout', {
      method: 'POST',
      headers: getStudentAuthHeaders()
    });
  } catch (e) {}

  localStorage.removeItem(STUDENT_TOKEN_KEY);
  localStorage.removeItem(STUDENT_USER_KEY);
  studentVotedIdCache = null;
  localSave(STUDENT_VOTED_KEY, null);
  notifyVotes();
}

async function getStudentProfile() {
  const token = getStudentToken();
  if (!token) return { authenticated: false };

  try {
    const res = await fetch('/api/student/me', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.votedProjectId !== undefined) {
        studentVotedIdCache = data.votedProjectId;
        localSave(STUDENT_VOTED_KEY, studentVotedIdCache);
        notifyVotes();
      }
      return data;
    }
  } catch (e) {}

  return { authenticated: false };
}

/* ==================== PUBLIC API ==================== */

function saveProjects(list) {
  projectsCache = list.filter(p => !p.preview);
  localSave(STORE_KEY, projectsCache);
  notifyProjects();
}

function getProjectById(id) {
  return getProjects().find(p => p.id === id) || null;
}

function addProject(p) {
  const student = getStudentUser();
  const project = {
    id: uid(),
    studentId: student ? student.id : null,
    status: 'pending',
    featured: false,
    createdAt: Date.now(),
    reviewedAt: null,
    reviewNote: '',
    ...p
  };

  const current = getRealProjects();
  current.unshift(project);
  saveProjects(current);

  if (isApiConnected) {
    const headers = getStudentAuthHeaders();
    fetch('/api/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify(project)
    }).then(res => res.json()).then(data => {
      if (data && data.project && data.project.id) {
        const list = getRealProjects();
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
  const list = getRealProjects();
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
        const fresh = getRealProjects();
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
  const filtered = getRealProjects().filter(p => p.id !== id);
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
  const list = getRealProjects();
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
  getRealProjects,
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
  isStudentLoggedIn,
  getStudentUser,
  studentRegister,
  studentLogin,
  studentLogout,
  getStudentProfile,
  stats,
  initials,
  uid,
  getActivity,
  logActivity,
  subscribeProjects,
  subscribeActivity,
  getVoteSummary,
  getVoteCount,
  hasVoted,
  getStudentVotedId,
  toggleVote,
  subscribeVotes,
  get previewMode() { return previewMode; },
  get backend() {
    return isApiConnected ? 'vercel-api' : 'localStorage';
  }
};

init();
