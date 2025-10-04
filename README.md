# Family Spending Tracker (PWA + IndexedDB)

A lightweight, offline‑first web app to track daily family spending per person, with categories and payment methods, plus backup/restore. Installable as an Android app (PWA).

## Features
- Add/remove family members
- Record expenses per person with categories & payment methods (Cash, UPI, Debit, Credit, etc.)
- Daily filters and quick totals
- IndexedDB for storage (offline-first)
- Export/Import JSON for backup/restore with de‑duplication
- PWA: installable on Android; works offline via Service Worker

## Quick Start (Local)
1. **Download & unzip** this project.
2. Open a terminal in the project folder and run any static server (PWA needs http/https):
   - Node: `npx serve .` or `npx http-server .`
   - Python: `python -m http.server`
3. Visit the printed URL (e.g., `http://localhost:3000` or `http://localhost:8000`).  
4. Add a few members and expenses. Try **Export** and then **Import** to test backup/restore.
5. To test offline: turn off your network and refresh — data persists in IndexedDB.

## Android Installation (as an app)
- Open the site in **Chrome** on Android → **⋮ Add to Home screen** → Install.
- A service worker caches core files, so it works offline.

## Notes
- Clearing site data or uninstalling the PWA removes IndexedDB data. Export regularly.
- Import is de‑duplicated by transaction/member IDs and category **name**.
- You can later integrate Google Drive sync by uploading the exported JSON and adding OAuth.

## Files
- `index.html` – UI layout
- `style.css` – styling
- `app.js` – UI logic
- `db.js` – IndexedDB wrapper & schema
- `sw.js` – service worker for offline
- `manifest.json` – PWA metadata
- `icons/` – app icons
