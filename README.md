# React + TypeScript + Vite

InfoU Scan is a React + TypeScript + Vite web app for capturing images, generating PDFs, storing them in Supabase, and viewing them in-app. This README is for internal developers and contributors only.

---

## Quick Highlights 🔧
- Tech: React, TypeScript, Vite, TailwindCSS, Supabase (Auth & Edge Functions), PDF.js
- This repository is **private** — treat all contents as internal
- Dev is powered by Vite (see `package.json` scripts)

---

## Prerequisites 💡
- Node.js 18+ (or Bun)
- Access to a Supabase project with required tables, buckets, and edge functions
- Appropriate internal secrets/keys (request from the owning team)

---

## Environment Variables (local) 🔐
Create a local env file (e.g., `.env.local`) and **never** commit it. The app expects the following variables (no secrets in repo):

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_SECRET_KEY=
VITE_CLERK_PUBLISHABLE_KEY=
VITE_CLERK_SECRET_KEY=
VITE_GEMINI_API_KEY=
```

- See `src/utils/supabase-client.ts` for client setup.
- The code references edge function URLs; update them if you host functions in another environment.

---

## Local Setup & Run 👩‍💻
1. Create `.env.local` (or copy `.env.example`) with required values.
2. Install dependencies:
   - Bun: `bun install`
   - or npm: `npm install`
3. Start dev server:
   - `bun run dev` or `npm run dev`
4. Open: `http://localhost:5173`

Key npm scripts in `package.json`:
- `dev` — start dev server
- `build` — compile + bundle
- `preview` — preview the production build
- `lint` — run ESLint

---

## Supabase & Edge Functions 🧩
The app relies on Supabase for:
- Authentication (session persistence)
- `scans` table and storage buckets for PDFs/images
- Edge functions called by the client (examples):
  - `/functions/v1/scan` — accepts images and returns `scanId`
  - `/functions/v1/deleteScan` — deletes a scan
  - `/functions/v1/clever-service` — returns signed URLs for previews

Ensure the Supabase project has the correct schema, buckets, and functions deployed and accessible.

---

## Security & Secret Management ⚠️
- **Never commit** `.env` files or secrets.
- Rotate and revoke keys immediately if exposed.
- Use your organization's secret management for production.

---

## Contributing (Internal Only) 🤝
- This repo is internal; request access from the project owner or team lead to contribute.
- Follow internal PR and review guidelines.
- No external contributions are accepted.

---

## Files of Interest 🔎
- `src/pages/DashboardPage.tsx` — Dashboard with Dashboard/Recent views
- `src/pages/CameraPage.tsx` — Camera capture & upload logic
- `src/pages/PDFViewerPage.tsx` — PDF viewing UI
- `src/utils/supabase-client.ts` — Supabase client
- `src/components/` — UI building blocks

---

## Support & Contact 📬
For access requests, operational issues, or security concerns, contact the project owner or your team lead (internal channel).

---
