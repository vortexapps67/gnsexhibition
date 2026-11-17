# Expo 2026 — School Exhibition Website

A modern, premium multi-page website for a school project exhibition, with a full admin panel for reviewing submissions.

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Home — hero, featured projects, process steps, categories, scroll-story, latest submissions, CTA |
| `projects.html` | Project gallery with search, category/status filters, sorting and "Load more" paging |
| `project.html` | Individual project detail page |
| `submit.html` | Student submission form |
| `schedule.html` | Timeline of key dates from submissions to the awards ceremony |
| `judges.html` | Review panel members and judging criteria breakdown |
| `faq.html` | Accordion-based frequently asked questions |
| `about.html` | About the exhibition, how it works and committee |
| `admin.html` | Admin login + dashboard (review, edit, approve, reject, delete, activity log, analytics) |

## Admin access

Open `admin.html` and sign in with:

- **Username:** `admin`
- **Password:** `exhibition2026`

Demo credentials are shown on the login screen. Change them in `js/store.js` (`ADMIN_CREDS`) for a real deployment.

## Admin capabilities

- Dashboard stats (total / approved / pending / rejected)
- Filter and search all submissions
- Review full project details
- Edit every project field (title, category, student, description, links, tags, review note, status, featured flag)
- **Approve**, **Reject** (with reason), **Delete**, and **Feature** projects
- Category analytics bars on the overview
- Recent-activity log recording every approve, reject, edit, delete and reset
- Export all data as JSON
- Clear all projects (with confirmation)

## Backend (Firebase Realtime Database)

`js/store.js` is wired to the Firebase Realtime Database at `https://du-spoofer-default-rtdb.firebaseio.com` using the Firebase v8 compat SDK. All data lives under the `/expo2026` root so it cannot collide with other data in the project:

```
expo2026/
  projects/    all submissions, keyed by project id
  activity/    last 40 admin actions, keyed by entry id
```

The admin session stays in `sessionStorage` (client-side demo auth).

**Live sync is active.** The database rules have been opened for the `/expo2026` path, so every page reads and writes directly against Firebase in real time:

```json
{
  "rules": {
    "expo2026": {
      ".read": true,
      ".write": true
    }
  }
}
```

The gallery starts empty — there are no hardcoded demo projects. Projects appear only when students submit them through `submit.html`. Changes made in `admin.html` (approve, reject, edit, delete, clear) are written straight to Firebase. `ExpoStore.subscribeProjects()` and `ExpoStore.subscribeActivity()` notify registered pages whenever a new snapshot arrives, so open tabs repaint in place — no reload needed. The gallery shows a pulsing **Live sync** badge, and the admin dashboard shows a **Firebase connected** badge when the live backend is in use. Open `admin.html` and `projects.html` side by side to see an approval appear in the gallery instantly.

These rules are suitable for a public demo only. For production, restrict writes to authenticated reviewers:

```json
{
  "rules": {
    "expo2026": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

If Firebase is ever unreachable (offline or denied rules), the site automatically falls back to `localStorage` so it stays fully usable. Check the active backend in the browser console with `ExpoStore.backend` (`firebase` or `localStorage`).

### Local fallback keys

| Key | Purpose |
|-----|---------|
| `expo_projects_v2` | Cached project submissions |
| `expo_activity_v2` | Cached admin actions |
| `expo_admin_session_v1` | Admin login session |

## Motion & interaction

- **Lenis smooth scroll** on every page, with native anchor scrolling and a reduced-motion guard
- **Scroll-locked story section** on the homepage — pinned "Imagine / Build / Share" text with synced captions, progress bar and counter
- Staggered scroll reveals, directional slide-ins, count-up statistics, hero parallax and a category marquee
- FAQ accordion, animated judging-criteria bars, card hover sweeps and a thin scroll-progress indicator
- All motion respects `prefers-reduced-motion`

## Design

- Editorial light aesthetic — warm paper background, ink typography and a vermilion accent
- Typography — DM Serif Display for large display headings, DM Sans for UI and body
- Hairline rules, numbered sections, paper grain and generous magazine-style spacing
- Clean line-art SVG icons throughout — no emoji glyphs anywhere
- Soft paper cards with subtle lift-on-hover
- School logo (`school_logo.png`) in every nav, footer and admin brand mark
- School building photo (`gns front.jpg`) in the home hero and as the About-page banner
- Custom animated SVG project artwork in `assets/` used as project thumbnails
- Responsive layout for desktop, tablet and mobile

## Run locally

Just open `index.html` in any modern browser, or serve the folder with a local static server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

Note: Firebase, Lenis and the fonts load from CDNs, so an internet connection is needed for the live backend, smooth scroll and the intended typography. The site still works offline with fallback fonts, native scrolling and the local data store.
