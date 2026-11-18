const fs = require('fs');
const path = require('path');
const { generateSalt, hashPassword } = require('./auth');

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
        activity: Array.isArray(data.activity) ? data.activity : [],
        students: Array.isArray(data.students) ? data.students : [],
        studentVotes: data.studentVotes && typeof data.studentVotes === 'object' ? data.studentVotes : {}
      };
      return localStoreCache;
    }
  } catch (e) {
    console.error('Error reading local store:', e.message);
  }
  localStoreCache = { projects: [], activity: [], students: [], studentVotes: {} };
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

async function addProject(projectData, student = null) {
  const project = {
    id: uid(),
    studentId: student ? student.id : (projectData.studentId || null),
    title: (projectData.title || '').trim(),
    studentName: student ? student.name : (projectData.studentName || '').trim(),
    grade: student ? student.grade : (projectData.grade || '').trim(),
    email: student ? student.email : (projectData.email || '').trim(),
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

  // Clean up any votes on this deleted project
  const votes = await getStudentVotesMap();
  let votesModified = false;
  Object.keys(votes).forEach(sId => {
    if (votes[sId] === id) {
      delete votes[sId];
      votesModified = true;
    }
  });
  if (votesModified) {
    await saveStudentVotesMap(votes);
  }

  await logActivity('Deleted', `Project: "${target.title}"`);
  return true;
}

async function clearProjects() {
  await saveAllProjects([]);
  await saveStudentVotesMap({});
  await logActivity('Cleared all projects', 'All submissions removed');
  return true;
}

/* ==================== STUDENTS API ==================== */

async function getStudents() {
  const url = getFirebaseUrl('students');
  if (url) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const val = await res.json();
        return objectToArray(val);
      }
    } catch (e) {
      console.warn('Firebase getStudents failed, using local store:', e.message);
    }
  }
  const store = readLocalStore();
  return store.students || [];
}

async function saveAllStudents(list) {
  const store = readLocalStore();
  store.students = list;
  writeLocalStore(store);

  const url = getFirebaseUrl('students');
  if (url) {
    try {
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arrayToObject(list))
      });
    } catch (e) {
      console.error('Firebase saveAllStudents failed:', e.message);
    }
  }
}

async function getStudentByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  const students = await getStudents();
  return students.find(s => (s.email || '').toLowerCase() === cleanEmail) || null;
}

async function getStudentById(id) {
  if (!id) return null;
  const students = await getStudents();
  return students.find(s => s.id === id) || null;
}

async function createStudent({ name, email, grade, password }) {
  const cleanEmail = email.toLowerCase().trim();
  const existing = await getStudentByEmail(cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const salt = generateSalt();
  const hash = hashPassword(password, salt);

  const student = {
    id: uid('s_'),
    name: name.trim(),
    email: cleanEmail,
    grade: grade.trim(),
    hash,
    salt,
    createdAt: Date.now()
  };

  const list = await getStudents();
  list.push(student);
  await saveAllStudents(list);

  await logActivity('Student Registered', `${student.name} (${student.email}) registered`);

  const { hash: _, salt: __, ...safeStudent } = student;
  return safeStudent;
}

async function findOrCreateGoogleStudent({ name, email, googleId, picture, grade }) {
  const cleanEmail = (email || '').toLowerCase().trim();
  let student = await getStudentByEmail(cleanEmail);

  if (student) {
    const patch = {};
    if (!student.googleId && googleId) patch.googleId = googleId;
    if (!student.picture && picture) patch.picture = picture;
    if (Object.keys(patch).length > 0) {
      const list = await getStudents();
      const idx = list.findIndex(s => s.id === student.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...patch };
        await saveAllStudents(list);
        student = list[idx];
      }
    }
  } else {
    student = {
      id: uid('s_'),
      name: (name || 'Student').trim(),
      email: cleanEmail,
      grade: (grade || 'Student').trim(),
      googleId: googleId || null,
      picture: picture || '',
      createdAt: Date.now()
    };
    const list = await getStudents();
    list.push(student);
    await saveAllStudents(list);
    await logActivity('Google Sign In', `New student signed in with Google: ${student.name} (${student.email})`);
  }

  const { hash: _, salt: __, ...safeStudent } = student;
  return safeStudent;
}

async function getProjectsByStudentId(studentId, studentEmail = '') {
  const projects = await getProjects();
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  return projects.filter(p => {
    if (p.studentId && p.studentId === studentId) return true;
    if (cleanEmail && (p.email || '').toLowerCase() === cleanEmail) return true;
    return false;
  });
}

/* ==================== SINGLE VOTE PER ACCOUNT API ==================== */

async function getStudentVotesMap() {
  const url = getFirebaseUrl('student_votes');
  if (url) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const val = await res.json();
        return (val && typeof val === 'object') ? val : {};
      }
    } catch (e) {
      console.warn('Firebase getStudentVotesMap failed, using local store:', e.message);
    }
  }
  const store = readLocalStore();
  return store.studentVotes || {};
}

async function saveStudentVotesMap(map) {
  const store = readLocalStore();
  store.studentVotes = map;
  writeLocalStore(store);

  const url = getFirebaseUrl('student_votes');
  if (url) {
    try {
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(map)
      });
    } catch (e) {
      console.error('Firebase saveStudentVotesMap failed:', e.message);
    }
  }
}

async function getStudentVote(studentId) {
  if (!studentId) return null;
  const votes = await getStudentVotesMap();
  return votes[studentId] || null;
}

async function getVoteCounts() {
  const votes = await getStudentVotesMap();
  const counts = {};
  Object.values(votes).forEach(projectId => {
    if (projectId) {
      counts[projectId] = (counts[projectId] || 0) + 1;
    }
  });
  return counts;
}

async function castStudentVote(studentId, projectId) {
  if (!studentId) throw new Error('Student authentication is required to vote.');
  if (!projectId) throw new Error('Target project ID is required.');

  const project = await getProjectById(projectId);
  if (!project) throw new Error('Project not found.');

  const votes = await getStudentVotesMap();
  const currentVotedProject = votes[studentId];

  let isVoted = false;
  let previousVotedProject = null;

  if (currentVotedProject === projectId) {
    // Un-vote if clicking the currently voted project
    delete votes[studentId];
    isVoted = false;
    previousVotedProject = projectId;
  } else {
    // Cast or change vote to this project (Strictly 1 vote per account!)
    previousVotedProject = currentVotedProject || null;
    votes[studentId] = projectId;
    isVoted = true;
  }

  await saveStudentVotesMap(votes);

  const counts = await getVoteCounts();

  return {
    success: true,
    studentId,
    votedProjectId: isVoted ? projectId : null,
    isVoted,
    previousVotedProject,
    counts,
    projectVotes: counts[projectId] || 0
  };
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
  getStudents,
  getStudentByEmail,
  getStudentById,
  createStudent,
  findOrCreateGoogleStudent,
  getProjectsByStudentId,
  getStudentVotesMap,
  getStudentVote,
  getVoteCounts,
  castStudentVote,
  getStats,
  getBackendInfo
};
