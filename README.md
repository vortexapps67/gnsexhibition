# Expo 2026 — School Exhibition Platform

A modern, high-performance website and full admin review platform for school project exhibitions, built with editorial typography, serverless backend functions, secure authentication, and real-time database integration.

## Key Highlights

- **Zero secrets in frontend**: No database URLs, passwords, or Firebase config are stored in client-side code (`js/` or HTML).
- **Vercel Serverless API**: Robust Node.js serverless endpoints in `/api/` reading environment variables via `process.env`.
- **Flexible Data Store**: Backed by Firebase Realtime Database (via server-side REST API) or local persistent storage.
- **Enhanced Admin Panel**:
  - Secure server-verified login (HMAC-SHA256 signed session tokens)
  - Real-time search by title, student name, grade, email, and tags
  - Dynamic status tabs with live count badges (Pending, Approved, Rejected, Featured)
  - 1-click Quick Approve and Quick Toggle Featured
  - Rejection Reason modal with reusable templates and custom feedback
  - Project Detail Drawer / Preview Modal
  - Bulk actions (Bulk Approve, Bulk Reject, Bulk Delete) with multi-row checkboxes
  - Export to CSV (spreadsheet format) and Export to JSON
  - Visual category breakdown analytics & audit activity timeline
  - Custom confirmation dialogs replacing browser alerts

---

## Environment Variables (.env & Vercel)

All sensitive settings are loaded from environment variables on the server. Copy `.env.example` to `.env` for local development, and configure them in **Vercel Project Settings -> Environment Variables**:

| Variable | Description | Default / Example |
|---|---|---|
| `ADMIN_USERNAME` | Admin panel login username | `admin` |
| `ADMIN_PASSWORD` | Admin panel login password | Set your secure password |
| `SESSION_SECRET` | Secret key used to cryptographically sign session tokens | Random secret string |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database URL | `https://your-project-default-rtdb.firebaseio.com` |
| `FIREBASE_AUTH_SECRET` | Optional database auth token/secret | (leave blank if public rules) |
| `SITE_NAME` | Exhibition display name | `Expo 2026 School Exhibition` |
| `EXHIBITION_YEAR` | Exhibition year | `2026` |
| `ALLOW_PUBLIC_SUBMISSIONS` | Enable or disable public submission form | `true` |

---

## Serverless API Endpoints (`/api`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate admin with credentials | Public |
| `GET` | `/api/auth/verify` | Verify active admin session token | Yes (Bearer / Cookie) |
| `POST` | `/api/auth/logout` | Revoke session and clear cookies | Public |
| `GET` | `/api/projects` | Get projects (supports `?cat=`, `?status=`, `?q=`) | Public |
| `POST` | `/api/projects` | Submit a student project | Public |
| `GET` | `/api/projects/:id` | Get details for a single project | Public |
| `PATCH` | `/api/projects/:id` | Approve, reject, edit, or feature project | Yes (Admin) |
| `DELETE` | `/api/projects/:id` | Delete a project | Yes (Admin) |
| `GET` | `/api/activity` | Get recent admin audit log | Public |
| `DELETE` | `/api/activity` | Clear audit log | Yes (Admin) |
| `POST` | `/api/admin/reset` | Clear all project submissions | Yes (Admin) |
| `GET` | `/api/config` | Public client configuration | Public |
| `GET` | `/api/health` | Backend status and diagnostic report | Public |

---

## Running Locally

1. Ensure Node.js (v18+) is installed.
2. Ensure `.env` is created (a template is provided in `.env.example`).
3. Start the local server:
   ```bash
   node server.js
   ```
   or:
   ```bash
   npm run dev
   ```
4. Visit `http://localhost:3000` in your browser.
5. Open `http://localhost:3000/admin.html` to access the Admin Panel.

---

## Deploying to Vercel

1. Push this repository to GitHub / GitLab / Bitbucket.
2. In Vercel, click **Add New Project** and import the repository.
3. In **Settings -> Environment Variables**, add:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
   - `FIREBASE_DATABASE_URL` (optional, for cloud sync)
4. Click **Deploy**. Vercel will automatically serve the static website and deploy the `/api` directory as serverless functions.
