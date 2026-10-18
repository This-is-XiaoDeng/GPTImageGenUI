# Repository Guidelines

## Project Structure & Module Organization

This repository is a **pure-frontend** Vue 3 + Vite WebUI for GPT/NewAPI image generation. All data lives in the browser (localStorage + IndexedDB); there is no backend.

- `index.html` — Vite entry shell (loads Font Awesome from CDN and `/src/main.js`).
- `src/main.js` — app bootstrap, imports global stylesheet.
- `src/styles.css` — global styles (responsive layout, components, themes).
- `src/store.js` — reactive global state; persists config to `localStorage` (`imagegen.config`) and image/prompt metadata to `imagegen.db`.
- `src/lib/upstream.js` — direct browser calls to OpenAI-compatible `/images/generations` and `/images/edits`.
- `src/lib/tasks.js` — client-side task runner (parallel tasks, retries, cancel, saving results).
- `src/lib/imageDb.js` — IndexedDB helpers storing image blobs; exposes a reactive object-URL cache (`urlStore`).
- `src/lib/util.js` — small shared helpers.
- `src/components/` — page components (`WorkbenchPage`, `TasksPage`, `GalleryPage`, `PromptsPage`, `SettingsPage`), shared cards (`TaskCard`, `ImageCard`, `PromptCard`), dialogs (`PromptDialog`, `ImageEditDialog`, `ConfirmDialog`, `Lightbox`, `MaskPainter`), and `TagFilter`.
- `.github/workflows/deploy.yml` — builds and deploys to GitHub Pages on pushes to `main`.

Runtime images (blobs) are keyed by id in IndexedDB; metadata records reference them via `image_id`. Task history is intentionally memory-only and clears on reload.

## Build, Test, and Development Commands

```powershell
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
npm run preview    # serve the production build locally
```

No automated test framework is configured. After changes, run `npm run build` and manually verify the workbench generation flow, task polling, gallery actions, prompt editing, mask painting, and mobile navigation.

## Coding Style & Naming Conventions

- 2-space indentation for HTML, CSS, and JavaScript.
- Vue single-file components with `<script setup>`; component and file names in PascalCase.
- Frontend functions/variables use `camelCase`. Keep descriptive UI ids/class names (e.g. `maskCanvasWrap`, `galleryGrid`).
- Keep the dependency footprint small: runtime dependency is `vue` only; dev dependencies are Vite + the Vue plugin.
- Avoid broad rewrites; keep one concern per component and keep lib modules free of Vue component logic.

## Commit & Pull Request Guidelines

Use concise imperative commit messages, for example:

```text
Add tag filter to gallery
Fix mask painter undo stack
```

Pull requests should include a short summary, verification commands run, and screenshots or screen recordings for UI changes.

## Security & Configuration Tips

- API keys and endpoints are stored in the user's browser localStorage; never commit real keys.
- Do not commit `dist/`, `node_modules/`, or any exported gallery images.
- If an API key is exposed in chat, logs, or commits, rotate it immediately.
