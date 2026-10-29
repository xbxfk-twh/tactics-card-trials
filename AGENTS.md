# Repository guide

- `apps/web` is the authoritative game and room server. `apps/android` packages the same runtime in a WebView.
- In `apps/web`, run `npm ci`, `npm test` and `npm run build`. Root one-click startup is `启动游戏.cmd`.
- Keep rules in `js/core`, encounters/progression in `js/campaign`, networking in `js/network`, and presentation in `js/ui`.
- `runtime.json` and `tools/check-assets.cjs` define what ships. Do not ship unused resources.
- Root `dist/` holds builds; root `artifacts/` holds screenshots, reports and source art. Both stay out of Git.
- Never add private deployment scripts, player stores, environment files, SSH credentials, Android signing keys, local caches, archived prototypes or raw art archives.
- The public root is allowlisted in `.gitignore`. Amend it intentionally for new source directories.
- Before committing, run `node scripts/audit-public.cjs`; review the staged file list and diff.
- Public network tests are opt-in: `public-room-smoke.cjs` creates real rooms. CI uses local servers only.
- CI does not deploy production. Release signing keys remain outside the repository.
