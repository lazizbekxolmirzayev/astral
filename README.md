# NEXUS

NEXUS is a **Space Mission Design Game** built for the 2026 NASA Space Apps Challenge. Players choose an objective, build a spacecraft, pick instruments, an orbit, and a rocket, fly the mission, and learn from a report that explains why it succeeded or failed. Solo play and four-role team play on one computer are both supported, in Uzbek, Russian, and English.

The game runs at `/` and needs no database. The interactive, explicitly **not to scale** solar system view and physics experiments are at `/universe`. Simulated positions are data-driven; visual sizes and the compressed scene layout are artistic.

Progress and next steps are tracked in [docs/PROGRESS.md](./docs/PROGRESS.md).

## Install and run

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run checks with `npm run typecheck`, `npm run lint`, and `npm test`.

Only the sharing and account features need a database. They require a MongoDB Atlas URI (or local MongoDB) in `MONGODB_URI`. Environment variables:

- `MONGODB_URI`: server-side MongoDB connection URI.
- `MONGODB_DB`: database name, for example `nexus`.
- `AUTH_SECRET`: long, random Auth.js secret; keep it private.
- `AUTH_URL`: Auth.js base URL, locally `http://localhost:3000/api/auth`.
- `AUTH_TRUST_HOST`: set to `true` when the deployment host is trusted by Auth.js.
- `AUTH_COOKIE_SECURE`: set to `true` for HTTPS deployments; use `false` only for local HTTP.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: optional admin seed-script credentials; registration does not grant admin roles.

Never expose these values through `NEXT_PUBLIC_` variables.

## Demo scenario

Open the home page and pick a mission. To see the universe view, open `/universe`, wait for the Solar System view, then zoom with the mouse wheel and click a body to focus it. The permanent “Not to scale” notice applies to the rendered layout.

## Browser tests

CI runs Vitest and Playwright in Chromium. It installs Playwright temporarily without changing the app dependency manifest. Browser tests that need shared-link data use the CI MongoDB service. To run locally, install `@playwright/test` temporarily and Chromium, provide MongoDB at `MONGODB_URI`, then run `npx playwright test`.

See [LICENSES.md](./LICENSES.md) for visual asset sources and licenses.
