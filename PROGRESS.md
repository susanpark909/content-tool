# Progress Log

Short entries after each completed stage/task: what was requested, what was done, how to verify.

---

## Stage 1: Project setup (Next.js + Tailwind + shadcn/ui + Supabase)

**Requested:** Set up Tailwind + shadcn/ui if not already present, set up a Supabase connection, confirm the app runs.

**Done:**
- Scaffolded a new Next.js 16 app (TypeScript, App Router, `src/` dir, Tailwind v4) in this folder. (The folder originally created under `C:\Users\Default\...` wasn't writable by this Windows account — project now lives at `C:\Users\Usuario\Documents\Claude Projects\Content Tool`.)
- Initialized shadcn/ui and added starter components: button, input, label, card, table, checkbox, select, badge, separator, sonner.
- Installed `@supabase/supabase-js` + `@supabase/ssr`.
- Connected to the existing **RBP KPI Tracker** Supabase project (chosen because the transcription tool, "LearnWith," already lives there and this tool will call it — nothing about that project's existing tables/code was touched). All new tables will be added later with a `ct_` prefix in the `public` schema, matching the existing `learnwith_` naming pattern, to avoid any collision with `leads`, `opportunities`, `learnwith_*`, etc.
- Added `src/lib/supabase/client.ts` (browser client) and `src/lib/supabase/server.ts` (server client, cookie-based) using `@supabase/ssr`.
- Added `.env.local` (gitignored, has real Supabase URL + publishable/anon key) and `.env.local.example` (blank template).
- Added `.claude/launch.json` so the dev server can be previewed via `npm run dev` on port 3000.
- Initialized git repo, first commit.

**Verify:**
- `npm run build` completes with no errors.
- `npm run dev`, open http://localhost:3000 — default Next.js starter page loads, no console errors.
- Supabase connection is live (tested via a direct REST call — reached the database and got a permission-denied response from Postgres itself, confirming the URL/key are valid and RLS is correctly blocking access to RBP's own tables).

---

## Idea Journal page

**Requested:** Free-text entry box, timestamped, past entries listed in a sidebar. Moved up in the build order (ahead of Research/Creator Results) to start using it right away.

**Done:**
- New `ct_journal_entries` table (RBP KPI Tracker Supabase project): `id`, `content`, `created_at`. RLS enabled with a policy + explicit grants for the `anon` role (had to add grants separately — RLS alone wasn't enough, Postgres denied at the table-privilege level first).
- `/journal` page: textarea + "Save entry" button (server action, no page reload), sidebar of past entries newest-first with a formatted timestamp on each.
- Added a minimal top nav (`Content Tool` / `Idea Journal`) to the root layout so built pages are reachable.

**Verify:**
- `npm run dev`, open http://localhost:3000/journal.
- Type something, click "Save entry" — it appears in the sidebar with today's date/time, and the textarea clears.
- Refresh the page — the entry is still there (confirms it's actually saved to Supabase, not just local state).

---

## Idea Journal upgrade: AI-assisted "Flesh this out"

**Requested:** Per the Master Plan's Idea Journal + Framework Library specs — seed a `ct_frameworks` table with 5 starter frameworks; add a "Flesh this out" button on each idea that (1) asks Claude (Anthropic API) to match the idea against the framework library and show 2-3 best-fit options with a one-line reason each, (2) once you pick one, asks Claude for 2-4 follow-up questions specific to that framework + idea, (3) saves your answers alongside the idea and marks it "fleshed out."

**Done:**
- New `ct_frameworks` table, seeded with the 5 starter patterns from the Master Plan (Problem→misconception→truth→solution, Story→struggle→realization→lesson, Hook→3 points→CTA, Before→turning point→after, Myth→proof→alternative).
- `ct_journal_entries` extended with `framework_id`, `flesh_out_answers` (jsonb), `fleshed_out` (boolean).
- Two Anthropic API calls (model `claude-opus-5`, structured JSON output via Zod): one matches the idea to 2-3 frameworks by index (never by fabricated name/id — structurally can't invent a framework not in the library, per the Master Plan's standing rule), one generates 2-4 tailored follow-up questions once a framework is picked.
- `FleshOutDialog` (not yet fleshed out) walks through: matching → pick one → answer questions → save. `FleshOutView` (already fleshed out) shows a "Fleshed out" badge that opens a read-only view of the saved framework + Q&A.
- Checked responsive behavior at mobile width (375px) — layout stacks cleanly, dialog usable.

**Bug fixes along the way:**
- New tables needed explicit `grant select` for `anon` in addition to RLS (same gap as the original journal table).
- After adding the `framework_id` foreign key via migration, PostgREST's schema cache was stale until `notify pgrst, 'reload schema'` — the embedded `framework:ct_frameworks(name)` join returned empty until that ran, and briefly returned array-shaped instead of object-shaped once fixed, which needed a small type-safe accessor in `page.tsx` to handle both shapes.

**Verify:**
- `npm run dev`, open http://localhost:3000/journal.
- Click "Flesh this out" on an idea → wait for 2-3 framework suggestions with reasons → pick one → answer the generated questions → Save.
- The entry now shows a "Fleshed out" badge; clicking it re-opens a read-only view with the framework name and your answers.
- Requires `ANTHROPIC_API_KEY` set in `.env.local` (restart `npm run dev` after adding it).
