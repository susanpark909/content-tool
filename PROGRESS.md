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

---

## Fix: Flesh This Out follow-up questions were too long

**Requested:** Each generated question was packed with multiple sub-questions and "e.g." parenthetical examples. Simplify so each is one short, direct, conversational question.

**Done:** Rewrote the follow-up-question prompt to require exactly one short sentence per question, no bundled sub-questions, no "e.g." asides, casual tone ("like a friend asking, not a form"). Added a 140-character cap in the Zod schema as a structural backstop, not just a prompt instruction.

**Verify:** Click "Flesh this out" on any idea, pick a framework — the follow-up questions should now read as single short sentences (e.g. "What's the wrong reason people blame when their routine falls apart?") instead of multi-part questions with examples in parentheses.

---

## Research + Creator Results + Analyze Single Reel (standout-rate scoring)

**Requested:** Per the Master Plan's updated spec (bigger than the original chat plan — now bundles Research, Creator Results, Analyze Single Reel, and standout-rate scoring into one stage). Research page: paste a creator's IG profile URL, filter by sort metric/date range/post count, pull via Apify. Also supports Analyze Single Reel — paste one reel URL directly. Creator Results: sortable/filterable table with standout-rate scoring (comment rate, views/comment-rate vs. that creator's own batch average).

**Decisions made with you before building:**
- Researched Apify's actor store and picked **`apify/instagram-reel-scraper`** (official Apify actor, 146K users, 4.4★) — it's the one that actually matches the spec's name and is the only option (among the ones checked) that can return share counts at all; a more general scraper we checked first has no shares field.
- Share counts are a paid-Apify-plan-only add-on. You chose to **skip shares for now** — Creator Results shows views, likes, comments, and comment rate; shares/share rate can be turned on later by flipping one input flag once you're on a paid Apify plan.
- You explicitly don't want a binary "Standout" badge/tag (the Master Plan's literal wording) — instead each reel shows its actual multiplier vs. that creator's average (e.g. "3.2x avg views"), no threshold cutoff.

**Done:**
- New tables: `ct_research_batches` (one row per research run or single-reel analysis) and `ct_reels` (one row per reel, linked to a batch). RLS + grants + schema-cache reload all applied together this time (learned from the Idea Journal bugs).
- `/research`: two forms — profile research (URL, sort metric, date range, post count) and Analyze Single Reel (just a reel URL) — plus a list of past research runs.
- `/research/[batchId]` (Creator Results): sortable table (views, likes, comments, comment rate, or the views multiplier), thumbnail + caption + date per reel, checkboxes for selection. The batch header shows the creator's average views and comment rate across the pulled batch.
- "Transcribe Selected" is intentionally a disabled placeholder button here — per the Master Plan's updated Build Order, actually wiring it to the transcription API is its own later stage ("Reel Detail + transcription connection"), not part of this one.
- Fixed a real bug found while testing: the batch row was being created before the Apify call, so a failed call (e.g. missing token) left an empty orphan batch behind. Reordered so the Apify call happens first — nothing is written to Supabase unless it actually returns data. Also replaced an unhandled-error crash page with inline error messages on both forms, matching the pattern used elsewhere in the app.

**Verify:**
- Requires `APIFY_API_TOKEN` in `.env.local` (restart `npm run dev` after adding it).
- Go to http://localhost:3000/research, enter a public Instagram profile URL, run research, confirm it lands on a Creator Results table with real reels, sortable, with a multiplier column.
- Try Analyze Single Reel with one reel URL — should produce a one-row Creator Results table.
- Try research with a bad/missing token or an invalid profile — should show a red inline error, not a crash page, and should NOT create an empty entry under "Past research."

**Update — tested live with your real Apify token:** ran a real profile pull against @natgeo (5 reels), confirmed real data flows end-to-end into Creator Results with correct standout multipliers. Found and fixed one more bug: the sort dropdowns were showing the raw internal value ("commentsCount", "views") instead of a readable label ("Comments", "Views") — this shadcn Select is built on Base UI, not Radix, and Base UI's `Select.Value` doesn't auto-resolve a label from the item's children the way Radix does. Fixed by passing an explicit label-lookup function to both dropdowns. This @natgeo pull is real test data left in the app — let me know if you want it deleted.

---

## Fix: Research was pulling "most recent" instead of "best performing"

**Requested:** You wanted to give it a date range (e.g. last 2 months) and get back the creator's highest-viewed/highest-shared reels in that window — not just their most recent posts, which you can already see by just opening Instagram.

**What was actually wrong:** "Number of posts" defaulted to a tiny pool (5–12). Apify returns reels newest-first, so with a small pool and a date range set, you'd only ever see the last few days — the "Sort by" dropdown had nothing meaningful to sort among. On top of that, "Sort by" was being saved but never actually applied to the results table's initial order (always defaulted to Views regardless of what you picked).

**Done:**
- Bumped the default pool to 30 reels (max 100, enforced both in the form and server-side), and relabeled the field to make clear it's a pool you sort afterward, not a "give me the top N" count.
- Wired the chosen "Sort by" metric through to the Creator Results table's initial sort order — it's no longer just stored and ignored.
- Added a live estimated-cost line under the pool size field so you always see the worst-case cost (at Apify's free-tier rate) before clicking "Run research" — addresses your concern about not knowing what a run costs.

**Verify:** Tested live — ran @natgeo with a 30-reel pool and "Sort by: Likes." Confirmed the table opened already sorted by likes, highest first (523K down to 3K), spanning about 3 weeks of posts, not just the last few days.
