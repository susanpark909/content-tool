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

---

## Research UX pass + data accuracy investigation

**Requested:** Four UI fixes from annotated screenshots (clickable creator link, clickable sortable column headers instead of a dropdown, remove "Sort by" from the pull form, creator thumbnails in "Past research"), plus a request to see search date/parameters/reel-count per batch. Then a serious data-accuracy report: reels visible on the live Instagram grid (839K and 448K views) were missing or showed very different numbers in our Creator Results table.

**UI fixes — done:**
- Creator name/header now links out to their real Instagram profile.
- Results table columns (Views, Likes, Comments, Comment rate, Views vs. avg) are now clickable to sort — click again to flip direction. Replaces the old dropdown.
- Removed "Sort by" from the Research pull form entirely (redundant now that the results table sorts interactively) and cleaned up the now-dead `sort_metric` plumbing.
- "Past research" list now shows each batch's most recent reel thumbnail, the pull timestamp, the date-range window used, and "X of Y reels" (requested vs. actually returned) — same info added to the Creator Results page header. A batch that came back short of what was requested now shows a visible red warning.

**Data accuracy investigation — two confirmed, separate problems:**
1. **View count mismatch is real but explained, not a bug**: confirmed with Apify's own support (via their issue tracker) that this actor reads Instagram's logged-*out* view count. Your browser was logged in, and logged-in counts can include cross-posted Facebook views, which is why the live number (839K) ran higher than ours (623K).
2. **Missing/substituted reels is a real, more serious problem**: found a closed issue on the actor's own tracker — *"Reels feed API return rate dropped to ~5% — proxy sessions getting blocked"* — where Instagram's anti-scraping defenses caused the actor to silently return incomplete or wrong reel sets while the run still reported "SUCCEEDED," no error surfaced. That specific case was fixed 3 weeks ago, but it's a structural risk with this actor, not a one-off. Our upspiral.life pull got exactly the requested count (10 of 10) but the wrong 10 reels — a failure mode the new "X of Y" warning above can't catch, since the count matched.

**Empirical actor comparison (with your go-ahead):** tested an alternative actor (`data-slayer/instagram-profile-reels` + its sibling `instagram-post-details`) against the same upspiral.life profile and the same known reel:
- All 10 reels matched Instagram's live grid exactly (vs. our current actor missing/substituting several).
- View counts matched the live displayed numbers almost exactly (840,694 vs. Instagram's live 839K), instead of being off by up to 35%.
- Shares are included for free (`share_count: 1112` returned directly) — no paid-plan gate, unlike our current actor.
- Slightly cheaper too: $2.50/1,000 vs. $2.60/1,000 on the free tier.
- Tradeoff: it's newer and far less reviewed (287 users, no star ratings yet, vs. 145K users on the current one) — less battle-tested, despite performing better on this test.

**Status: switched.** You said go ahead — rewired Research and Analyze Single Reel to `data-slayer/instagram-profile-reels` + `instagram-post-details`.

**Done:**
- Rewrote `lib/apify.ts` and the reel field-mapping for the new actors (`play_count`, `like_count`, `share_count`, `caption.text`, `taken_at_date`, `user.username`).
- Shares/share rate are now real, free columns in Creator Results — sortable like everything else, no more paid-plan gate.
- Date range is now filtered client-side after pulling (this actor has no native date-filter input, unlike the old one), using `taken_at_date` on both bounds.
- Tried showing the creator's real profile picture (this actor returns one) in place of a reel thumbnail — reverted after finding Instagram's CDN blocks it via `Cross-Origin-Resource-Policy` (confirmed via a real broken-image bug during testing, not just theory). Not worth adding a proxy for a cosmetic nice-to-have; kept the already-working reel-thumbnail approach.
- Also fixed a real bug hit while testing: a stale Turbopack dev-server cache was throwing a `ReferenceError` for a variable removed two commits earlier — cleared with a full `.next` cache wipe + restart. Not a source bug, but worth knowing if a similar "error that isn't in the file" shows up again.

**Verify — retested live on upspiral.life, 30-reel pool:** "Six spiritual signs..." now shows 840,694 views (vs. Instagram's live ~839K — matches). Shares populated for every reel (e.g. 5,812 shares / 2.91% share rate on that same reel). Batch header now also shows avg share rate.

---

## Fix: date-range research was silently missing older matching reels

**Requested:** You caught a 1.2M-view reel visible on Instagram's live grid that never showed up in our results, for a date range you explicitly set (Aug 31 – Sep 17).

**Root cause:** this actor has no native date filter — we fetch `maxResults` most-recent reels first, then filter by date afterward. "Reels to pull" was set to 10, but the window spans 18 days on a creator who posts almost daily. The raw fetch of 10 never reached back past ~10 days, so anything earlier in the window — including that 1.2M reel — was never fetched at all, not just filtered out. Same underlying shape of bug as the earlier "wrong 10 reels" issue, just triggered a different way.

**Done:**
- When any date bound is set, we now always fetch up to the 100-reel safety cap (ignoring the typed pool size) so the search reaches deep enough to actually cover the requested window.
- Stopped truncating the date-filtered results afterward — capping by recency could itself cut out an older top performer, which is exactly the bug we just found. Now everything that qualifies is shown, sortable, no further cap.
- Added real tracking (`raw_fetch_count`, `earliest_fetched_at` per batch) and a new "window may be incomplete" warning that fires if we hit the 100-reel ceiling before reaching the requested start date — honest signal instead of silent wrongness, for creators prolific enough that even 100 reels doesn't reach back far enough.
- Updated the "Reels to pull" field and cost estimate: disabled + relabeled when a date range is active, cost estimate switches to reflect the 100-reel worst case (~$0.26) instead of the typed number.

**Verify — retested live with your exact scenario:** ran upspiral.life for Aug 31–Sep 17 again. The 1.2M-view reel ("You might be in a way better relationship than you think...") now appears at the top, sorted by views. 33 reels found in the window vs. 10 before.

---

## Fix: date range was ignoring "reels to pull" entirely

**Requested:** typed 10 for "reels to pull," got back 33. Wanted the count respected.

**Done:** still searches deep (up to 100) to cover the date window fully, but now keeps only the top N by views (not by recency, so it still can't drop an older top performer). Field re-enabled and relabeled "Top reels to keep (by views)" when a date range is set.

**Verify:** upspiral.life, Aug 31–Sep 17, limit 10 → "10 of 10 reels," 1.2M-view reel still ranked #1.

---

## Fix: leading zero stuck in "Reels to pull" field

**Requested:** typing into that field left a "0" stuck in front (e.g. "010") that couldn't be deleted.

**Done:** the field was controlled by a number, so typing a value that parses the same (like "010" → 10) skipped React's re-render and left the stray zero on screen. Switched to a string-backed input that strips leading zeros on every keystroke.

**Verify:** typed "010" into the field — now normalizes to "10" instead of sticking.

---

## Add date-range presets to Research

**Requested:** quick buttons for "last 7 days," "last 2 weeks," "last 30 days" instead of typing dates by hand.

**Done:** three buttons above From/To that fill both fields in one click.

**Verify:** clicked "Last 7 days" — From/To filled correctly (today minus 7, today).

---

## Reel Detail + transcription connection

**Requested:** Wire the existing (disabled) "Transcribe Selected" button in Creator Results to actually call your real transcription app, and add a Reel Detail page to view a reel's stats + transcript together.

**API discovery:** got the URL (`https://transcribe-6zsy.onrender.com/`) and HTTP Basic Auth credentials. Confirmed the contract by testing directly (a scratch script, outside the app): `POST /api/sources/video` with `{url}` returns 202 immediately with a job (`status: "processing"`), then `GET /api/sources/{id}` is polled until `status: "ready"` with the transcript filled in. Verified against one of your real reels — got a full, accurate transcript back.

**Done:**
- `ct_reels` gained `transcription_id`, `transcript`, `transcription_status`, `transcription_error` columns.
- `src/lib/transcription.ts` — thin wrapper around the transcription API (`startTranscription`, `getTranscriptionStatus`), reading the URL/credentials from `.env.local`.
- Server actions: `transcribeSelectedReels` (kicks off a real job per selected reel, saves the job id + status), `refreshTranscriptionStatus` (polls one reel's job and saves the result once ready).
- Creator Results: "Transcribe selected" now actually works; added a "Transcript" column with a status badge (—/Processing/View transcript/Error) linking to the new Reel Detail page.
- New page `/research/reel/[reelId]`: stats (views/likes/comments/comment rate/shares/share rate), caption, thumbnail, and the transcript panel — shows a "Transcribe this reel" button if untouched, "Check status" while processing, the error + retry option if it failed, or the full transcript once ready.
- **Scope note:** the AI hook-extraction / "why this worked" breakdown and "Save to Hook Library" button are NOT part of this stage — per the Master Plan's Build Order they belong to the next stage (Hook Library + Framework Library). Flagging this now since it wasn't explicitly confirmed with you first.

**Verify — tested live end-to-end:** on upspiral.life's results, selected the 1.2M-view "way better relationship" reel, clicked "Transcribe selected" → status flipped to "Processing..." → opened its Reel Detail page → clicked "Check status" a few times until it flipped to "Ready" → full accurate transcript displayed. Back on Creator Results, that reel's badge now reads "View transcript" and links to the same page. `npm run build` passes clean.

**Note:** transcription jobs on the real API can take 1-2+ minutes (likely a cold-start delay on their Render free tier) — "Check status" may need a few clicks before a job flips to "Ready."

---

## Fix: Creator Results table overflow + not responsive on mobile

**Requested:** the table's rightmost column ("Views vs. avg") was getting cut off on screen, and it wasn't usable on mobile at all.

**Done:** combined the Comments/Comment rate and Shares/Share rate columns into one each ("516 (0.04%)") to cut two columns, which fits the table without horizontal scroll at normal desktop widths. Below the `sm` breakpoint, the table is replaced with a stacked card layout (thumbnail + caption, then a 2-column stat grid) so it's usable on phone screens.

**Verify:** tested live at 1024px and 1280px — table fits fully, no cutoff. At 375px (phone) — cards render cleanly, all stats readable.

---

## Hook Library + Framework Library

**Requested:** per the Master Plan's Build Order, this stage. Asked you to clarify scope first since the spec only explicitly wired hook-saving to Reel Detail, not framework-saving — you confirmed you want both: the AI should say "this reel's story follows the Problem→misconception→truth→solution framework" AND "the hook is like this," tag both, and the library pages should link back to the real reels that used them.

**Done:**
- New tables: `ct_hook_patterns` (seeded with the 11 starter hook patterns from the Master Plan — "You think X but actually Y," Story opening, Confession, Mistake, Prediction, List, Unpopular opinion, Before/after, etc.), `ct_hooks` (one saved hook per reel), `ct_framework_examples` (links a reel to one of the 5 existing `ct_frameworks` as a real example, with a note).
- Reel Detail page (once transcript is ready): "Analyze for hook & framework" button calls Claude to extract the verbatim opening hook, match it against the hook-pattern library (or, if nothing fits, suggest a new pattern name — never auto-added, requires an explicit "Add to the library" click, per your standing rule), identify the emotional mechanism and CTA, write a short "why it worked" breakdown, and separately match the whole post's structure against the framework library the same way. Both extracted results are editable before saving. "Save to Hook Library" and "Save framework example" persist independently.
- New `/hooks` page: searchable (text/pattern/emotion/creator) list of saved hooks, each showing the hook text, pattern badge, emotional mechanism, CTA, why-it-worked, and a link back to the source reel with its stats.
- New `/frameworks` page: all 5 frameworks with their linked real-world examples (thumbnail, note, stats, link back to the reel).
- Added "Hook Library" and "Framework Library" to the top nav.

**Verify — tested live end-to-end:** on the same 1.2M-view upspiral.life reel, clicked "Analyze for hook & framework" — it correctly matched the "List" hook pattern and "Hook → 3 points → CTA" framework, with a specific, accurate why-it-worked writeup for both. Saved both; confirmed they now show up on `/hooks` and `/frameworks` with correct stats and working links back to the reel. Fixed a mobile bug found during testing (long AI-generated text like the emotional-mechanism string was overflowing the screen edge in a pill badge) by switching those to plain labeled text instead of badges. `npm run build` passes clean; tested at 375px (phone) and desktop widths.

---

## Add All Reels page + automatic hook/framework analysis

**Requested:** two follow-up requests after the Hook/Framework Library stage. (1) A page to browse everything pulled and everything transcribed, since the only way in was clicking into one research batch at a time — you asked for naming options, we landed on "All Reels" with a filter toggle rather than two separate pages. (2) Whether "Transcribe" auto-runs the hook/framework analysis — it didn't; you asked for it to (chose "Automatic" over manual or manual-batched).

**Done:**
- New `/reels` page ("All Reels"): every reel pulled across all research batches in one sortable/searchable list, with an "All / Transcribed only" filter toggle and Hook/Framework "saved" badges per reel. Desktop table + mobile card layout, same responsive pattern as Creator Results.
- Hook & framework analysis now runs automatically the moment a transcript flips to "ready" (triggered from the existing "Check status" click) — no more manual "Analyze" click needed. The raw AI result is cached on `ct_reels` (`analysis_status`/`analysis_result`/`analysis_error`) and pre-fills the review form on Reel Detail. Saving to the actual Hook/Framework Library libraries is still a deliberate click — auto-analysis doesn't auto-save, so nothing lands in your libraries without you choosing to keep it.
- Extracted the shared analysis logic into `src/lib/reel-analysis.ts` so both the automatic and manual ("Re-analyze") paths use the same code.
- Fixed a mobile nav overflow bug found while testing (5 nav links now overflowed the header on phone width) — the nav scrolls horizontally instead of clipping the last item.

**Verify — tested live:** transcribed a second real upspiral.life reel through the actual UI, clicked "Check status" until ready, and confirmed the Reel Detail page loaded with the hook/framework analysis already filled in (matched "List" pattern, "Hook → 3 points → CTA" framework) with zero extra clicks. `/reels` page loads all 187 pulled reels, filter and search both work. `npm run build` passes clean; nav verified scrollable at 375px.

---

## Hook Library redesign + full CRUD on both libraries + creator filter

**Requested:** three things after using the libraries for real. (1) Hook Library cards were too busy — wanted just the hook text visible, rest expandable. (2) The pattern badge ("List") looked clickable but did nothing. (3) Wanted to edit/add/delete entries directly on both Hook Library and Framework Library, not just via Reel Detail. Also asked separately for a way to organize All Reels by creator.

**Done:**
- Hook Library cards collapse to just the hook text; click to expand and see pattern, emotion, CTA, why-it-worked, stats, and Edit/Delete. The pattern badge is now functional — clicking it filters the list to that pattern.
- Full CRUD on both libraries: "Add hook" / "Add framework" buttons, inline Edit forms, Delete with an inline two-step confirm (see bug below). Framework examples can be individually removed without deleting the whole framework.
- All Reels: added a creator filter dropdown, made the Creator column sortable, and made each row's creator name clickable to filter to that creator.

**Bugs found and fixed along the way:**
- Native `confirm()` dialogs silently do nothing in the dev sandbox browser used for testing (returns false without prompting) — and blocking browser dialogs are generally poor UX anyway. Replaced every delete confirmation with an inline "Delete this...? Yes, delete / Cancel" pattern instead.
- Real permissions bug: `ct_frameworks` had only ever been granted `SELECT` for the `anon` role (it was read-only from the app until this stage) — every insert/update/delete silently failed with "permission denied" / RLS violation. Added the missing grants and a full-access RLS policy, matching every other `ct_` table.

**Verify — tested live:** created and deleted a test framework end-to-end (hit both bugs above, fixed both, retested clean). Edited a saved hook's text and confirmed it persisted. Clicked the "List" pattern badge and confirmed it filtered the Hook Library to matching entries. On All Reels, filtered to @natgeo both via the dropdown and by clicking a creator name in a row — both narrowed to the same 32 reels. `npm run build` passes clean; Hook Library verified responsive at 375px.

---

## Fix: shares missing from Hook Library

**Requested:** collapsed Hook Library cards should show views/likes/comments/shares at a glance.

**Done:** added the stats row to the collapsed card. Along the way found shares wasn't even being fetched from `ct_reels` in the Hook Library query, so it was missing from the expanded view too — fixed both.

**Verify:** collapsed and expanded views both now show all four stats; checked at desktop and 375px.

---

## Fix: Edit/Delete buttons too visually heavy + no way to reach Reel Detail from Hook Library

**Requested:** the bordered "Edit"/"Delete" buttons on every Hook/Framework Library card looked cluttered — wanted practical but clean, not ugly. Separately flagged there was no obvious click-through to a reel's detail page from the Hook Library.

**Done:**
- Replaced the bordered Edit/Delete buttons with small muted ghost icon buttons (pencil/trash) on both libraries — same actions, much less visual weight.
- Made each hook's thumbnail a direct link to its Reel Detail page (previously the only path was a small "View reel" text link buried inside the expanded card).

**Verify:** checked both libraries at desktop and 375px — icon buttons read clearly, thumbnail click navigates straight to Reel Detail.

---

## Brand Profile

**Requested:** next stage per the Master Plan's Build Order — a place to store what makes generated content sound like you, not generic AI.

**Done:**
- New `/brand` page: a single-profile form (one row, always edited in place — not a list) with sections for Voice & audience (voice/tone, phrases to use/avoid, audience, content pillars), Stories & opinions (personal stories, opinions/POVs), a visually distinct Strong opinion / wedge card (flagged "Highest-value field" per the spec — the single best source for polarizing, high-engagement hooks), and Offers & examples (offers/products, examples of content that feels like you, examples you hate).
- New `ct_brand_profile` table, singleton row, RLS + grants set up correctly from the start this time (no repeat of the `ct_frameworks` permissions bug).
- Added "Brand Profile" to the nav.
- **Scope note:** the Master Plan also defines "Universal Voice Rules" (contractions, active voice, no em dashes, no filler words, etc.) — these are fixed rules checked automatically by the not-yet-built Post Grader, not editable fields on this page, so they're not part of this stage's UI.

**Verify:** filled in Voice/tone and the Strong opinion/wedge field, saved, reloaded the page — both persisted correctly. Checked responsive layout at 375px and desktop. `npm run build` passes clean.

---

## Rebuild: Brand Profile as AI capture-and-organize, not manual fields

**Requested:** right after shipping, you said filling out 11 separate fields by hand was too much — you want to just type, paste, upload, or speak whatever's on your mind, and have AI sort it into the right categories, continuously, over time.

**Done:**
- Replaced the primary entry point with one "Tell me about your brand" box at the top: type/paste freely, upload a `.txt`/`.md` file, or speak (browser Speech Recognition — Chrome/Edge only, feature-detected so the Speak button just doesn't appear on unsupported browsers).
- "Update Brand Profile" sends that raw text plus your current profile to Claude, which merges new information into the right fields — preserving what's already there, never overwriting good content, never fabricating. Updated fields get a visible "Updated" badge + highlight so you can see what changed.
- The 11 structured fields are still shown below for direct review/editing (with a separate "Save manual edits" button), but they're no longer the primary way to fill this out.

**Bugs found and fixed during testing:**
- Hydration mismatch on the "Speak" button — speech-recognition support can only be detected in the browser, so checking it in a `useState` initializer made the server and client render different HTML. Fixed by detecting it in a `useEffect` after mount instead.
- The merge prompt used the literal text "(empty)" as a placeholder for blank fields when showing the AI the current profile — it started echoing that placeholder text back as if it were real content. Reworded so blank fields stay genuinely blank.

**Verify — tested live:** pasted a paragraph of real notes (audience, phrases used/avoided, a personal story, an offer) — AI correctly sorted every piece into its right field, left untouched fields genuinely blank (after the placeholder-text bug was fixed), and flagged exactly which fields changed. `npm run build` passes clean.
