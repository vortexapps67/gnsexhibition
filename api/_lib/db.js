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
        adminUsers: Array.isArray(data.adminUsers) ? data.adminUsers : [],
        settings: (data.settings && typeof data.settings === 'object') ? data.settings : {},
        studentVotes: data.studentVotes && typeof data.studentVotes === 'object' ? data.studentVotes : {}
      };
      return localStoreCache;
    }
  } catch (e) {
    console.error('Error reading local store:', e.message);
  }
  localStoreCache = { projects: [], activity: [], students: [], adminUsers: [], settings: {}, studentVotes: {} };
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
    grade: (projectData.grade || (student ? student.grade : '')).trim(),
    admissionNo: (projectData.admissionNo || (student ? student.admissionNo : '') || '').trim(),
    rollNo: (projectData.rollNo || (student ? student.rollNo : '') || '').trim(),
    partnerNames: (projectData.partnerNames || (student ? student.partnerNames : '') || '').trim(),
    partnerRollNos: (projectData.partnerRollNos || (student ? student.partnerRollNos : '') || '').trim(),
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

function generateStudentCode(existingCodes = new Set()) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = 'EXP-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!existingCodes.has(code)) return code;
  }
  return 'EXP-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function getStudents() {
  let list = [];
  const url = getFirebaseUrl('students');
  if (url) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const val = await res.json();
        list = objectToArray(val);
      }
    } catch (e) {
      console.warn('Firebase getStudents failed, using local store:', e.message);
    }
  }
  if (!list.length) {
    const store = readLocalStore();
    list = store.students || [];
  }

  // Ensure every student has an easy-to-share Unique Student Code (e.g. EXP-8492)
  let changed = false;
  const existingCodes = new Set(list.map(s => s.studentCode).filter(Boolean));
  list.forEach(s => {
    if (!s.studentCode) {
      s.studentCode = generateStudentCode(existingCodes);
      existingCodes.add(s.studentCode);
      changed = true;
    }
  });
  if (changed) {
    saveAllStudents(list).catch(() => {});
  }
  return list;
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
  return students.find(s => s.id === id || s.studentCode === id) || null;
}

async function lookupStudent(query) {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim().toUpperCase();
  const rawQ = query.trim().toLowerCase();
  const list = await getStudents();

  const found = list.find(s => {
    if (s.studentCode && s.studentCode.toUpperCase() === q) return true;
    if (s.id && s.id.toUpperCase() === q) return true;
    if (s.admissionNo && s.admissionNo.toUpperCase() === q) return true;
    if (s.email && s.email.toLowerCase() === rawQ) return true;
    return false;
  });

  if (!found) return null;

  return {
    id: found.id,
    studentCode: found.studentCode,
    name: found.name,
    grade: (found.grade && found.grade !== 'Student') ? found.grade : '',
    admissionNo: found.admissionNo || '',
    rollNo: found.rollNo || '',
    email: found.email || '',
    picture: found.picture || ''
  };
}

async function createStudent({ name, email, grade, password }) {
  const cleanEmail = email.toLowerCase().trim();
  const existing = await getStudentByEmail(cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const list = await getStudents();
  const existingCodes = new Set(list.map(s => s.studentCode).filter(Boolean));
  const studentCode = generateStudentCode(existingCodes);

  const salt = generateSalt();
  const hash = hashPassword(password, salt);

  const student = {
    id: uid('s_'),
    studentCode,
    name: name.trim(),
    email: cleanEmail,
    grade: grade.trim(),
    teamMembers: [],
    hash,
    salt,
    createdAt: Date.now()
  };

  list.push(student);
  await saveAllStudents(list);

  await logActivity('Student Registered', `${student.name} (${student.email}) registered with ID ${studentCode}`);

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
    const list = await getStudents();
    const existingCodes = new Set(list.map(s => s.studentCode).filter(Boolean));
    const studentCode = generateStudentCode(existingCodes);

    student = {
      id: uid('s_'),
      studentCode,
      name: (name || 'Student').trim(),
      email: cleanEmail,
      grade: (grade || 'Student').trim(),
      googleId: googleId || null,
      picture: picture || '',
      teamMembers: [],
      createdAt: Date.now()
    };
    list.push(student);
    await saveAllStudents(list);
    await logActivity('Google Sign In', `New student signed in with Google: ${student.name} (${student.email}) - Code ${studentCode}`);
  }

  const { hash: _, salt: __, ...safeStudent } = student;
  return safeStudent;
}

async function updateStudent(studentId, patch) {
  if (!studentId) throw new Error('Student ID is required');
  const list = await getStudents();
  const idx = list.findIndex(s => s.id === studentId);
  if (idx === -1) throw new Error('Student not found');

  const allowedFields = ['grade', 'admissionNo', 'rollNo', 'partnerNames', 'partnerRollNos', 'name', 'teamMembers'];
  const updatedPatch = {};
  allowedFields.forEach(f => {
    if (patch[f] !== undefined) {
      if (f === 'teamMembers') {
        updatedPatch[f] = Array.isArray(patch[f]) ? patch[f] : [];
      } else {
        updatedPatch[f] = typeof patch[f] === 'string' ? patch[f].trim() : patch[f];
      }
    }
  });

  // If teamMembers was updated, synchronize partnerNames and partnerRollNos
  if (updatedPatch.teamMembers && Array.isArray(updatedPatch.teamMembers)) {
    if (!updatedPatch.partnerNames) {
      updatedPatch.partnerNames = updatedPatch.teamMembers.map(m => m.name).filter(Boolean).join(', ');
    }
    if (!updatedPatch.partnerRollNos) {
      updatedPatch.partnerRollNos = updatedPatch.teamMembers.map(m => m.rollNo).filter(Boolean).join(', ');
    }
  }

  list[idx] = {
    ...list[idx],
    ...updatedPatch,
    updatedAt: Date.now()
  };

  await saveAllStudents(list);
  await logActivity('Student Profile Updated', `${list[idx].name} updated profile details`);

  const { hash: _, salt: __, ...safeStudent } = list[idx];
  return safeStudent;
}

async function getProjectsByStudentId(studentId, studentEmail = '', student = null) {
  const projects = await getProjects();
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  const targetStudent = student || (studentId ? await getStudentById(studentId) : null);
  return projects.filter(p => {
    if (p.studentId && p.studentId === studentId) return true;
    if (cleanEmail && (p.email || '').toLowerCase() === cleanEmail) return true;
    if (targetStudent && isStudentProjectOwnerOrPartner(targetStudent, p)) return true;
    return false;
  });
}

function isStudentProjectOwnerOrPartner(student, project, projectAuthor = null) {
  if (!student || !project) return false;

  const sId = (student.id || '').trim();
  const sCode = (student.studentCode || '').trim().toUpperCase();
  const sEmail = (student.email || '').toLowerCase().trim();
  const sName = (student.name || '').toLowerCase().trim();
  const sAdm = (student.admissionNo || '').toLowerCase().trim();
  const sRoll = (student.rollNo || '').toString().trim().toLowerCase();

  const pStudentId = (project.studentId || '').trim();
  const pEmail = (project.email || '').toLowerCase().trim();
  const pName = (project.studentName || '').toLowerCase().trim();
  const pAdm = (project.admissionNo || '').toLowerCase().trim();
  const pRoll = (project.rollNo || '').toString().trim().toLowerCase();

  // 1. Direct ID / Code match
  if (sId && pStudentId && sId === pStudentId) return true;
  if (sCode && pStudentId && sCode === pStudentId.toUpperCase()) return true;

  // 2. Email match
  if (sEmail && pEmail && sEmail === pEmail) return true;

  // 3. Admission number match (if present)
  if (sAdm && pAdm && sAdm === pAdm) return true;

  // 4. Exact Author Name match (if both present and meaningful)
  if (sName && pName && sName === pName) return true;

  // 5. Partner Names in project: check if student is listed as a partner
  if (project.partnerNames && sName) {
    const partners = project.partnerNames
      .split(/[,;\n/]+/)
      .map(p => p.trim().toLowerCase())
      .filter(Boolean);
    if (partners.some(p => p === sName || (sName.length >= 4 && p.includes(sName)) || (p.length >= 4 && sName.includes(p)))) {
      return true;
    }
  }

  // 6. Partner Roll Nos in project: check if student's roll number is listed
  if (project.partnerRollNos && sRoll) {
    const partnerRolls = project.partnerRollNos
      .split(/[,;\s]+/)
      .map(r => r.trim().toLowerCase())
      .filter(Boolean);
    if (partnerRolls.includes(sRoll)) {
      return true;
    }
  }

  // 7. Team members checking
  if (Array.isArray(student.teamMembers)) {
    for (const m of student.teamMembers) {
      if (!m) continue;
      const mCode = (m.studentCode || '').trim().toUpperCase();
      const mName = (m.name || '').toLowerCase().trim();
      const mAdm = (m.admissionNo || '').toLowerCase().trim();
      const mId = (m.id || '').trim();
      if (sCode && mCode && mCode === sCode) return true;
      if (pStudentId && mCode && (pStudentId.toUpperCase() === mCode || pStudentId === mId)) return true;
      if (pName && mName && pName === mName) return true;
      if (pAdm && mAdm && pAdm === mAdm) return true;
    }
  }

  // Check if project author's team members include this student
  if (projectAuthor) {
    if (projectAuthor.id && sId && projectAuthor.id === sId) return true;
    if (projectAuthor.studentCode && sCode && projectAuthor.studentCode.toUpperCase() === sCode) return true;
    if (projectAuthor.email && sEmail && projectAuthor.email.toLowerCase().trim() === sEmail) return true;
    if (Array.isArray(projectAuthor.teamMembers)) {
      for (const m of projectAuthor.teamMembers) {
        if (!m) continue;
        const mCode = (m.studentCode || '').trim().toUpperCase();
        const mName = (m.name || '').toLowerCase().trim();
        const mAdm = (m.admissionNo || '').toLowerCase().trim();
        const mId = (m.id || '').trim();
        if (sCode && mCode && mCode === sCode) return true;
        if (sId && mId && mId === sId) return true;
        if (sName && mName && sName === mName) return true;
        if (sAdm && mAdm && sAdm === mAdm) return true;
      }
    }
  }

  return false;
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
    // Prevent students from voting for their own or their team's project!
    const student = await getStudentById(studentId);
    let author = null;
    if (project.studentId) {
      author = await getStudentById(project.studentId);
    } else if (project.email) {
      author = await getStudentByEmail(project.email);
    }

    if (isStudentProjectOwnerOrPartner(student, project, author)) {
      throw new Error("You cannot vote for your own project! Please vote for other students' exhibits to support them.");
    }

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

async function deleteStudent(studentId) {
  if (!studentId) throw new Error('Student ID is required');
  const list = await getStudents();
  const idx = list.findIndex(s => s.id === studentId);
  if (idx === -1) throw new Error('Student not found');
  const removed = list[idx];
  list.splice(idx, 1);
  await saveAllStudents(list);
  await logActivity('Student Deleted', 'Student "' + (removed.name || removed.email) + '" removed by admin');
  return { success: true };
}

/* ==================== ADMIN USERS ==================== */

async function getAdminUsers() {
  let list = [];
  const url = getFirebaseUrl('admin_users');
  if (url) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const val = await res.json();
        list = objectToArray(val);
      }
    } catch (e) {
      console.warn('Firebase getAdminUsers failed, using local store:', e.message);
    }
  }
  if (!list.length) {
    const store = readLocalStore();
    list = store.adminUsers || [];
  }
  if (!list.length) {
    const user = (process.env.ADMIN_USERNAME || 'admin').trim();
    const pass = process.env.ADMIN_PASSWORD || 'exhibition2026';
    const salt = generateSalt();
    const hash = hashPassword(pass, salt);
    const seeded = { id: uid('au_'), username: user, role: 'admin', salt, hash, createdAt: Date.now(), source: 'env' };
    list = [seeded];
    await saveAllAdminUsers(list);
  }
  return list.map(({ hash, salt, ...rest }) => rest);
}

async function _loadAdminUsersRaw() {
  const url = getFirebaseUrl('admin_users');
  if (url) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) return objectToArray(await res.json());
    } catch (e) {}
  }
  return readLocalStore().adminUsers || [];
}

async function getAdminUserRaw(username) {
  const list = await _loadAdminUsersRaw();
  let result = list.find(u => (u.username || '').toLowerCase() === (username || '').toLowerCase());
  if (!result && !list.length) {
    await getAdminUsers();
    const list2 = await _loadAdminUsersRaw();
    result = list2.find(u => (u.username || '').toLowerCase() === (username || '').toLowerCase());
  }
  return result || null;
}

async function getAdminUserByIdRaw(id) {
  const list = await _loadAdminUsersRaw();
  return list.find(u => u.id === id) || null;
}

async function saveAllAdminUsers(list) {
  const store = readLocalStore();
  store.adminUsers = list;
  writeLocalStore(store);
  const url = getFirebaseUrl('admin_users');
  if (url) {
    try {
      await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(arrayToObject(list)) });
    } catch (e) { console.error('Firebase saveAllAdminUsers failed:', e.message); }
  }
}

async function createAdminUser({ username, password, role }) {
  const clean = (username || '').trim();
  if (!clean) throw new Error('Username is required');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
  const existing = await getAdminUserRaw(clean);
  if (existing) throw new Error('An admin with this username already exists');
  const list = await _loadAdminUsersRaw();
  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  const user = { id: uid('au_'), username: clean, role: 'admin', salt, hash, createdAt: Date.now() };
  list.push(user);
  await saveAllAdminUsers(list);
  await logActivity('Admin User Created', 'Admin user "' + clean + '" created');
  const { hash: _, salt: __, ...safe } = user;
  return safe;
}

async function updateAdminUser(id, patch) {
  if (!id) throw new Error('Admin user ID is required');
  const list = await _loadAdminUsersRaw();
  const idx = list.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('Admin user not found');
  if (patch.username && patch.username.trim() && patch.username.trim().toLowerCase() !== list[idx].username.toLowerCase()) {
    const dup = list.find(u => u.id !== id && u.username.toLowerCase() === patch.username.trim().toLowerCase());
    if (dup) throw new Error('Username already in use');
    list[idx].username = patch.username.trim();
  }
  if (patch.password) {
    if (patch.password.length < 6) throw new Error('Password must be at least 6 characters');
    const salt = generateSalt();
    list[idx].salt = salt;
    list[idx].hash = hashPassword(patch.password, salt);
  }
  if (patch.role) list[idx].role = patch.role;
  list[idx].updatedAt = Date.now();
  await saveAllAdminUsers(list);
  await logActivity('Admin User Updated', 'Admin user "' + list[idx].username + '" updated');
  const { hash: _, salt: __, ...safe } = list[idx];
  return safe;
}

async function deleteAdminUser(id, currentUsername) {
  if (!id) throw new Error('Admin user ID is required');
  const list = await _loadAdminUsersRaw();
  const idx = list.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('Admin user not found');
  if (list.length <= 1) throw new Error('Cannot delete the last admin user');
  const removed = list[idx];
  if (currentUsername && removed.username.toLowerCase() === currentUsername.toLowerCase()) {
    throw new Error('You cannot delete your own account');
  }
  list.splice(idx, 1);
  await saveAllAdminUsers(list);
  await logActivity('Admin User Deleted', 'Admin user "' + removed.username + '" deleted');
  return { success: true };
}

async function verifyAdminCredentials(username, password) {
  const user = await getAdminUserRaw(username);
  if (!user) {
    const envUser = (process.env.ADMIN_USERNAME || 'admin').trim();
    const envPass = process.env.ADMIN_PASSWORD || 'exhibition2026';
    if (username.trim().toLowerCase() === envUser.toLowerCase() && password === envPass) {
      return { username: envUser, role: 'admin', id: null };
    }
    return null;
  }
  if (!user.hash || !user.salt) return null;
  const { verifyPassword } = require('./auth');
  if (!verifyPassword(password, user.hash, user.salt)) return null;
  return { username: user.username, role: user.role || 'admin', id: user.id };
}

/* ==================== SETTINGS ==================== */

const DEFAULT_SCHEDULE = [
  { id: 's1', date: '2026-11-12', time: '', label: 'Submissions open', note: 'Students can start submitting projects.' },
  { id: 's2', date: '2026-11-30', time: '23:59', label: 'Submission deadline', note: 'Last day to submit projects.' },
  { id: 's3', date: '2026-12-01', time: '', label: 'Panel review begins', note: 'Faculty review period starts.' },
  { id: 's4', date: '2026-12-05', time: '', label: 'Review complete', note: 'All projects reviewed.' },
  { id: 's5', date: '2026-12-08', time: '', label: 'Revision window', note: 'Students address feedback.' },
  { id: 's6', date: '2026-12-12', time: '09:00', label: 'Exhibition day', note: 'Doors open to visitors.' },
  { id: 's7', date: '2026-12-12', time: '17:00', label: 'Awards ceremony', note: 'Best Innovation, Best Design, Best Social Impact, People\'s Choice.' }
];

async function getSettings() {
  const url = getFirebaseUrl('settings');
  let settings = null;
  if (url) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const val = await res.json();
        if (val && typeof val === 'object') settings = val;
      }
    } catch (e) { console.warn('Firebase getSettings failed, using local store:', e.message); }
  }
  if (!settings) {
    const store = readLocalStore();
    settings = store.settings || {};
  }
  if (!settings.schedule || !Array.isArray(settings.schedule) || !settings.schedule.length) {
    settings.schedule = DEFAULT_SCHEDULE.map(s => ({ ...s }));
  }
  if (!settings.adminConfig) settings.adminConfig = {};
  return settings;
}

async function updateSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  if (patch.schedule) next.schedule = patch.schedule;
  const store = readLocalStore();
  store.settings = next;
  writeLocalStore(store);
  const url = getFirebaseUrl('settings');
  if (url) {
    try {
      await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    } catch (e) { console.error('Firebase updateSettings failed:', e.message); }
  }
  await logActivity('Settings Updated', 'Exhibition settings updated');
  return next;
}

/* ADMIN USERS + SETTINGS (placeholder marker) */

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
  lookupStudent,
  createStudent,
  updateStudent,
  findOrCreateGoogleStudent,
  getProjectsByStudentId,
  isStudentProjectOwnerOrPartner,
  getStudentVotesMap,
  getStudentVote,
  getVoteCounts,
  castStudentVote,
  getStats,
  getBackendInfo,
  saveAllStudents,
  deleteStudent,
  getAdminUsers,
  getAdminUserRaw,
  getAdminUserByIdRaw,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  verifyAdminCredentials,
  getSettings,
  updateSettings
};
