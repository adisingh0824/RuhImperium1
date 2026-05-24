# Ruh Imperium

Indian fragrance e-commerce store — pure attars, modern fragrances, and Kannauj perfumery. A vanilla HTML/JS SPA with a Node.js/Express API backend.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/ruh-imperium run dev` — run the frontend (port 19502)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: vanilla HTML/JS/CSS SPA served via Vite static serving (no React)
- API: Express 5 with full TypeScript routes
- DB: node:sqlite (`DatabaseSync`) for local; optional MongoDB or Supabase for hosted
- Auth: JWT (HMAC-SHA256), OTP via MSG91 or preview mode
- Payments: Razorpay (optional), COD always available
- AI scent assistant: OpenAI (optional), local keyword fallback always works
- Email: Nodemailer SMTP (optional)

## Where things live

- `artifacts/ruh-imperium/` — Vite-served static frontend
  - `index.html` — the original app HTML (the entry point, served by Vite directly)
  - `public/` — static assets (images, CSS, JS, service worker)
  - `vite.config.ts` — proxies `/api/*` to the API server on port 8080
- `artifacts/api-server/` — Express API server
  - `src/routes/ruh-imperium.ts` — all Ruh Imperium API routes (1000 LOC)
  - `database/products.js` — product catalog (69 products, loaded via vm)
  - `database/data/` — SQLite file + optional legacy JSON seeds

## Architecture decisions

- Frontend is vanilla HTML/JS — NOT React. The React scaffold was replaced with the original HTML served directly via Vite's root `index.html`.
- Vite is used only as a dev server with hot reload and `/api` proxy; in production it's a static file server.
- All backend logic is ported from the original monolithic `server.js` into a single Express Router file (`ruh-imperium.ts`) to stay within the TypeScript workspace.
- SQLite via Node.js built-in `DatabaseSync` (Node 22+) is the default storage; MongoDB and Supabase are supported via env vars.
- API routes use relative paths (`/api/...`) so no CORS or host config is needed — frontend and API are always on the same origin.

## Product

- 69 Indian fragrances across 7 categories (Authentic Indian Attars, Modern Attars, Next Gen Fragrances, Discovery Sets, Ruh/Absolute Oil, Eau De Parfum, Wellness)
- Cart, wishlist, checkout (Razorpay online + COD + Partial COD)
- User accounts with JWT auth + OTP login
- Admin panel (orders, subscribers, CSV export, shipping updates)
- AI scent assistant (OpenAI with local fallback)
- Newsletter subscription, coupon validation
- Order invoice/packing slip PDF views
- PWA manifest + service worker

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Vite dev server proxies `/api/*` to `localhost:8080` (the api-server). Both must be running.
- `node:sqlite` (DatabaseSync) requires Node 22+; Node 24 is fine but logs an experimental warning.
- The original HTML uses inline `<script>` tags with `@media` queries in CSS that conflict with Tailwind 4 — keep the `@tailwindcss/vite` plugin REMOVED from `vite.config.ts`.
- The root `index.html` in `artifacts/ruh-imperium/` IS the app — not the React scaffold. Do not overwrite it with a React entry point.
- Products are loaded at server startup from `artifacts/api-server/database/products.js` via Node.js `vm.runInContext`.
- `process.cwd()` when the API server runs is `artifacts/api-server/` — all data paths are relative to that.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Missing element IDs (`accountLabel`, `accountInitial`, `wishCount`) were added to `index.html` header — they exist in `app.js` but were absent from the original HTML
