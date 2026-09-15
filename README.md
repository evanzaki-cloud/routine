# Routine and gym tracker

A phone-first checklist for the whole plan: morning shower routine, night skincare, daily body basics, a dumbbell/gym workout logger with progression, and upkeep on a cadence (stubble, antifungal wash, brows, haircut). Everything is rule-driven from a few dates you set in settings, and the built-in Guide holds all the instructions.

Runs entirely in the browser. No account, no server. Data is stored in the browser's localStorage, with export/import as a JSON backup in settings.

## Put it on GitHub Pages (once, about five minutes)

1. Create a new **public** repository on GitHub (any name, e.g. `routine`).
2. Upload everything in this folder to it (drag the files into the GitHub web UI, or `git push` from a terminal). Make sure the `.github/workflows/deploy.yml` file comes along; it is a hidden folder.
3. In the repo go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab. The "Deploy to GitHub Pages" workflow runs on every push to `main`; the first run takes about a minute. When it's green, the URL is shown on the workflow run (it looks like `https://<your-username>.github.io/<repo>/`).

## Put it on your phone

Open that URL in Safari on iPhone, tap Share, then **Add to Home Screen**. It opens full-screen like an app and works offline after the first load. On Android, Chrome offers "Install app" from the menu.

Your data lives in that browser, so don't clear Safari's website data. Export a backup from settings every few weeks (it downloads a small JSON file) and import it after a new phone.

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints. `npm run build` produces the static site in `dist/`.

## Layout

- `src/App.jsx` — the whole app: rules, program, logger, guide, styles
- `src/storage.js` — localStorage adapter
- `public/sw.js` — small service worker for offline use
- `public/manifest.webmanifest`, `public/icon-*.png` — home-screen install
- `.github/workflows/deploy.yml` — builds and publishes to GitHub Pages on push
