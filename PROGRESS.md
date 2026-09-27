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

---

## Fix: Reel Detail back-link always went to Creator Results + merged Hook/Framework Library into one page

**Requested:** clicking a thumbnail in Hook Library to view a reel, then clicking "Back," landed on Creator Results instead of back on Hook Library — the back-link was hardcoded. Also asked whether Hook Library and Framework Library could be one page without getting cluttered.

**Done:**
- New `BackLink` component uses real browser history (`router.back()`) instead of a hardcoded destination, so it always returns to wherever you actually came from — Creator Results, All Reels, Library, wherever. Falls back to the batch's Creator Results page only if there's no history (e.g. a reel opened directly by URL).
- Merged `/hooks` and `/frameworks` into one `/library` page with a Hooks/Frameworks tab switcher (URL-synced via `?tab=hooks`/`?tab=frameworks` so deep links from Reel Detail still work) — only one list shows at a time, so it doesn't feel cluttered. Nav is down to 5 items.

**Verify — tested live:** opened a reel from Library → Hooks, clicked Back → landed back on Library with the Hooks tab still selected. Opened the same reel from Creator Results, clicked Back → landed back on Creator Results, confirming the fix is genuinely context-aware, not just switched to a different hardcoded target. `npm run build` passes clean; checked at 375px.

---

## Idea Journal: image/doc attachments + quick capture from Reel Detail

**Requested:** while reading a transcript on Reel Detail, you had a "cringe" reaction that turned into a contrarian-angle idea, and wanted an easy way to save that into the Idea Journal without breaking flow. Also wanted to upload docs/images and paste images directly into journal entries.

**Done:**
- New Supabase Storage bucket (`idea-journal-attachments`, public read) and `ct_journal_attachments` table. Idea Journal entries can now carry attachments: an "Attach" button (images, PDFs, docs, text files) and pasting an image directly into the textarea both upload immediately and show as a thumbnail/file chip before you save.
- Reel Detail's transcript card now has a "Save an idea from this reel" quick-capture box — type a reaction, save, done, no navigation required. These entries carry a new `source_reel_id` link and show a "From a reel" badge in the Idea Journal that links back to the source reel.
- `createJournalEntry` moved off the old `FormData` action signature to a plain function call so it can carry structured attachment data.

**Bug found and fixed:** the quick-capture widget's "Saved to your Idea Journal" confirmation never actually appeared — it collapsed back to the closed state in the same render as setting the "saved" flag, so that branch of the JSX never got a chance to show. Fixed by moving the confirmation message into the collapsed-state render.

**Verify — tested live:** saved a plain-text quick-capture entry from a real reel's transcript, confirmed it showed up in the Idea Journal with a working "From a reel" badge/link. Simulated a clipboard image paste on the main Idea Journal composer (file-picker dialogs aren't scriptable in this environment, so verified the paste path directly) — image uploaded, showed as a thumbnail chip, and persisted correctly after saving. Checked at 375px. `npm run build` passes clean.

**Follow-up fixes:** quick-capture placeholder assumed every idea was contrarian ("e.g. a contrarian angle...") — changed to a neutral "What idea do you want to save?" Pending attachment chips on the composer weren't clickable before saving, so there was no way to view/confirm a file — chips now link to the uploaded file.

---

## Rename "Idea Journal" → "Idea"; add scheduling + posted status

**Requested:** don't call it "Idea Journal," just "Idea." Also: ideas should have a way to be scheduled, and once "on the calendar" (a future stage) be marked as posted, updating the idea's status.

**Done:**
- Renamed all user-facing text from "Idea Journal" to "Idea" — nav label, page heading, quick-capture confirmation/button text. The route stays `/journal` internally (an implementation detail, not user-facing).
- Added scheduling + posted status to each idea, as groundwork for the not-yet-built Plan/calendar stage: a "Schedule" button opens a date picker; once set, shows a "Scheduled: <date>" badge with change/unschedule options. A separate "Mark as posted" action flips the idea to a "Posted" badge (reversible via "Unmark"). New `scheduled_date`, `posted`, `posted_at` columns on `ct_journal_entries` — when the calendar is eventually built, it reads/writes these same fields rather than needing its own separate scheduling data.

**Verify — tested live:** scheduled a real idea for Sep 25, 2026, confirmed the badge showed correctly and persisted after reload. Marked it posted — badge switched to "Posted," persisted after reload. Unmarked and unscheduled to restore. Checked at 375px. `npm run build` passes clean.

---

## Add "Add to Brand Profile" action on Idea entries

**Requested:** from Idea, an option to add things to the Brand Profile.

**Done:** each idea entry with text content gets an "Add to Brand Profile" button. Reuses the same AI merge logic the Brand Profile capture box already uses — one click sends the idea's content through the same organize-and-merge flow that sorts it into the right profile fields without overwriting anything already there.

**Verify — tested live:** clicked it on a real idea ("self image changes your reality") — confirmed on `/brand` that its content was correctly merged into Opinions/POVs, with the rest of the profile (Content pillars, etc.) left untouched. `npm run build` passes clean.

---

## Turn "Add to Brand Profile" into a review queue + Idea layout/wording fixes

**Requested:** you asked what "Add to Brand Profile" actually did and where content landed — the previous version called the AI merge and wrote straight to the live profile with zero visibility into what was sent or where it ended up. You wanted a holding area on the Brand Profile page instead: edit before it's actually added. Also: don't call the list "Past entries" (they're a working backlog, not a log), and don't put it in a narrow right sidebar — put it below.

**Done:**
- New `ct_brand_profile_pending` table. "Add to Brand Profile" on an idea now just queues the raw text — nothing touches the live profile yet.
- New "Waiting for review" section on `/brand`: each queued note is shown editable, with "Add to profile" (runs the same AI merge as the main capture box, then clears the queue item) or "Dismiss." The structured field form now refreshes immediately after an apply so the merged result is visible without a manual reload.
- Renamed "Past entries" to "Ideas to work on."
- Layout: moved the entries list out of the 320px sidebar into a full-width card grid below the composer (2–3 columns on larger screens) instead of beside it.

**Verify — tested live end-to-end:** queued a real idea from `/journal` → confirmed it appeared on `/brand` in "Waiting for review," editable, not yet in the profile. Clicked "Add to profile" → AI merge ran (~24s) → queue item cleared and the Opinions/POVs field updated with the merged content, everything else untouched. Checked layout at 375px. `npm run build` passes clean.

---

## Fix: Idea list layout, editable idea/fleshed-out text, Add to Brand Profile ignoring fleshed-out content

**Requested:** the "Ideas to work on" grid looked broken with a single card and two empty columns ("looks horrible, space it out"). Ideas should be editable. So should the fleshed-out answers. And: when adding to Brand Profile, is it sending the single sentence or the whole fleshed-out answer? (It was only ever sending the one-liner.)

**Done:**
- Switched the ideas list from a 3-column grid to a single-column stacked list (matching the rest of the app) with more padding — no more dead space with few items.
- Idea text is now editable inline: click it, edit, save (`updateJournalContent`).
- Fleshed-out framework answers are now editable too, via an "Edit" button inside the Fleshed-out dialog (`updateFleshOutAnswers`).
- "Add to Brand Profile" was silently dropping the fleshed-out Q&A and only sending the one-line idea text — usually the less valuable part. It now sends idea text + framework name + every question/answer when an idea has been fleshed out.

**Verify — tested live:** edited an idea's text inline, confirmed it saved. Edited a fleshed-out answer, confirmed it saved. Queued a fleshed-out idea to Brand Profile and confirmed via the review textarea that the full Q&A content was included, not just the single line. Checked at 375px. `npm run build` passes clean.

**Follow-up fix:** the single-column stacked list fixed the empty-grid-column problem but created a new one — a short card stretching across the full page width left a big empty gap inside the card itself. Cards are now a fixed ~360px width in a flex-wrap layout: full width on mobile, wrapping into a tidy multi-column arrangement on desktop as more ideas get added.

**Second follow-up:** still didn't look right — the composer spanned the full page width while the fixed-360px card sat below it looking like an orphaned box floating in empty space. Real fix: narrowed the whole page to one consistent column (`max-w-2xl`) so the composer and card list share the same width, with cards full-width within that column instead of a fixed size. Also renamed the heading to "Idea Collection" per your preference.

**Third follow-up — the actual root problem:** every card was rendering 4+ lines (date, text, status buttons, action buttons) no matter what, which you correctly called out as unworkable at any real scale (30 ideas = 120+ lines). Rebuilt as a collapsible single-line card, same pattern as the Hook Library: collapsed shows just the idea text + a compact Posted/Scheduled badge + attachment icon; click to expand for everything else (date, editable text, attachments, schedule/posted controls, flesh-out, Add to Brand Profile). Schedule/posted/content state is lifted up into the card component so the collapsed row updates immediately after an edit, no reload or re-expand needed.

**Verify:** confirmed collapsed view is a single line; expanded shows full detail with all actions working; scheduled a date while expanded, collapsed the card, confirmed the date badge appeared in the single-line view immediately. Checked at 375px. `npm run build` passes clean.

**Fourth follow-up — the expand/collapse itself was the problem:** even the collapsible version grew the row on expand (date, text, controls, actions each on their own line). Rebuilt with no expand/collapse concept at all — the row is a fixed h-9 height, always, full stop. Every action now opens in a small modal instead of pushing content below it: editing text opens an "Edit idea" dialog, Schedule/Mark as posted moved into a "Status" dialog (triggered by a calendar icon that becomes a checkmark once posted, or a short date label like "Oct 1" once scheduled — all still inside the fixed row height), attachments collapse to a paperclip icon opening a thumbnail dialog, and Flesh Out / Add to Brand Profile shrank to icon-only buttons. `idea-content.tsx` is no longer used and was deleted.

**Verify:** confirmed the row never changes height regardless of state — scheduled a date via the Status dialog, closed it, confirmed the row showed "Oct 1" inline at the same fixed height with zero layout shift. Checked at 375px. `npm run build` passes clean.

---

## Split idea schedule/posted into separate icons

**Requested:** the combined calendar icon (behind one "Status" dialog covering both scheduling and posted) should split — calendar icon only for scheduling, a separate icon for posted.

**Done:** calendar icon now only opens a Schedule dialog (date input + Save/Unschedule). A new circle-check icon toggles posted instantly with no dialog at all — it's just a boolean, doesn't need one. `idea-status.tsx` is no longer used and was removed.

**Verify:** tested both icons independently — calendar opens only the date picker, circle-check toggles posted immediately (icon fills in) with zero dialog. `npm run build` passes clean.

---

## Rename "Research" → "Analyze"

**Requested:** call it "Analyze," not "Research."

**Done:** renamed everywhere in the UI — nav label, page heading, "Research a creator" → "Analyze a creator," "Run research" → "Run analysis," "Past research" → "Past analyses," empty states, All Reels' "pulled across all research" → "...analyses," Library's subtitle, and the site's meta description. The `/research` route and `ct_research_batches` table stay as-is internally (same pattern as `/journal` staying the route when "Idea Journal" became "Idea").

**Verify:** checked the Analyze page end-to-end — every visible label updated, `npm run build` passes clean.

---

## Fix: Creator Results thumbnail/caption always opened Instagram, no way to reach Reel Detail

**Requested:** clicking the thumbnail or caption in Creator Results always opened the reel on Instagram — there was no way to get to the internal Reel Detail page from that table. Wanted the image to go to Reel Detail, and a separate "View Reel" link (where the caption text is) to open the actual post on Instagram.

**Done:** thumbnail and caption now link to `/research/reel/[id]` (Reel Detail); a new "View Reel" link under the caption opens the real Instagram post in a new tab. Applied to both the desktop table and mobile card layout.

**Verify — tested live:** confirmed via the page's link list that every row's thumbnail/caption point to Reel Detail and "View Reel" points to the real `instagram.com/p/...` URL. Checked at 1280px and 375px. `npm run build` passes clean.

---

## Fix: Back navigation lost filter/sort/search state; added Shares to All Reels

**Requested:** on All Reels, clicking "Transcribed only" then opening a reel then clicking Back landed on the unfiltered "All" view — not what you'd actually been looking at. Stated as a general principle: Back should always return to the exact page state you came from, not just the route. Also asked for a Shares column on All Reels.

**Done:**
- All Reels: search text, creator filter, All/Transcribed toggle, and sort now live in the URL (`?q=&creator=&filter=&sort=&dir=`) instead of only in client state, read on mount and updated via `router.replace` on every change. Back now restores the exact filtered/sorted view.
- Applied the same fix to the two other list pages with the identical bug: Creator Results' column sort (`?sort=&dir=`) and both Hook/Framework Library tabs' search box (`?q=`).
- Added a sortable Shares column to All Reels (desktop table + mobile cards) — the data was already being fetched but never shown.

**Verify — tested live end-to-end on all three pages:** filtered All Reels to "Transcribed only," opened a reel, clicked Back → still filtered. Sorted Creator Results by Likes, opened a reel, clicked Back → still sorted by Likes (confirmed via URL and visible order). Searched Hook Library for "spiritual," opened the match, clicked Back → search term still applied. `npm run build` passes clean.

---

## Script Writer, stage 1: editable "How Scripts Get Written" process page

**Requested:** before building the actual Script Writer flow, wanted a page that spells out the exact process AI goes through to write a script (pick hook → pick framework → ask questions → write), that Susan can read to understand it and edit directly if something isn't working — and every future script generation always reads its instructions from that page, not a hardcoded prompt.

**Done:**
- New table `ct_script_process_settings` (single row, same pattern as `ct_brand_profile`): `hook_instructions`, `framework_instructions`, `questions_instructions`, `script_instructions`, pre-filled with defaults matching the Master Plan's Create Flow spec.
- New page `/create/process` — 4 steps shown as cards (Recommend a hook / Recommend a framework / Ask follow-up questions / Write the script), each with an editable textarea of the actual instructions used at that step, plus a short plain-English description of what happens and who decides (AI recommends, Susan always picks).
- Added `getScriptProcessSettings()` in `src/lib/script-process.ts` so the real generation actions (built next) fetch these live instructions rather than embedding them in code.
- Added "How Scripts Work" to the site nav.

**Verify — tested live:** loaded `/create/process`, confirmed all 4 default instructions render, edited and saved, confirmed "Saved." feedback. `npm run build` passes clean.

---

## Script Writer, stage 2: the actual Create flow

**Requested:** build the real Script Writer — idea → angle → hook → framework → script, per the Master Plan's Create Flow spec, with two hard requirements from discussion: AI always *recommends* hooks/frameworks with reasons, Susan always makes the final pick (never auto-applied); and if an idea was already fleshed out on the Idea page for the chosen framework, reuse those answers instead of asking again.

**Done:**
- New table `ct_scripts`: idea_id, angle, hook_pattern_id, framework_id, questions (jsonb), content.
- New page `/create` — lists all ideas, click one to start.
- New page `/create/[ideaId]` with a step-by-step wizard (`script-wizard.tsx`):
  1. Pick an angle (contrarian / personal story / educational / mistake / myth / step-by-step / relatable rant / aspirational / hot take — from the Master Plan's Create Flow spec).
  2. AI recommends 2-3 hook structures from the Hook Library patterns with a one-line reason each — Susan picks one.
  3. AI recommends 2-3 frameworks from the Framework Library with a one-line reason each — Susan picks one.
  4. If the idea was already fleshed out for that exact framework, its saved Q&A is reused (shown with a "From your Idea flesh-out" badge, still editable); otherwise AI asks 2-4 fresh follow-up questions specific to this idea + angle + hook + framework.
  5. AI writes the full script from the idea, angle, hook, framework, answers, and the Brand Profile — using the live instructions from `/create/process`, not a hardcoded prompt.
  6. Script lands in an editable textarea with a Save button; "Start a new script" resets the wizard.
- Fixed a bug caught during testing: the `ANGLES` constant was exported from a `"use server"` actions file, which Next.js only allows for async functions — moved it to a plain `constants.ts` module.
- Renamed the "Library" nav item and page heading to "Frameworks" per request.

**Verify — tested live end-to-end:** picked "once i changed my self image i made $50k," chose Personal story, AI recommended sensible hooks (Before/after, Story opening, etc.) and frameworks (Before→turning point→after, Story→struggle→realization→lesson, etc.) each with accurate reasons, picked Story opening + Story→struggle→realization→lesson, answered the 4 generated follow-up questions, generated a script that actually used the answers naturally, edited and saved it — confirmed "Saved." Checked at mobile width (375px) — layout holds. `npm run build` passes clean.

---

## Script Writer, stage 3: reordered to reduce decision fatigue, hook picked last

**Requested:** too much picking up front — Susan doesn't always know which hook/framework will work best. Wanted AI to lead with a confident recommendation ("I think X because...") rather than a flat list of equal options, for both angle and framework. Also: the hook is the most important decision and should be picked *last*, after the script is actually written — informed by what got written, not guessed blind at the start.

**Done:**
- Reordered the flow: idea → **angle** (AI recommends, was previously not a recommend step at all) → **framework** (AI recommends) → follow-up questions → **draft** written → **hook** (AI recommends, reading the actual draft) → final script.
- Every recommend step (angle, framework, hook) now shows AI's top pick pre-selected with a "Recommended" badge and a reason that reads as a real suggestion, plus 1-2 alternates — one click to accept the recommendation, or switch.
- The hook step no longer guesses from the raw idea — it runs after the draft exists, reads the actual written content, recommends 2-3 hook structures that fit what was written, and on pick only rewrites the opening/hook lines, leaving the rest of the draft intact.
- `ct_script_process_settings` gained `angle_instructions`; `hook_instructions` rewritten to describe the post-draft recommend-and-rewrite behavior. `/create/process` renumbered to 5 steps in the new order.

**Verify — tested live end-to-end:** idea "self image changes your reality" → AI recommended Personal story ("I'd lead with a personal story...") pre-selected, then Story→struggle→realization→lesson pre-selected, answered 4 questions, draft generated, then hook step read the actual draft and recommended Confession ("the draft already opens with a raw admission...") quoting the real draft text — picked it, and only the opening was rewritten to a confession-style hook while the rest of the script stayed intact. `npm run build` passes clean.

---

## Post Grader

**Requested:** "the post sucks like a mother fucker" — the generated scripts weren't good enough, and rather than pause to hand-tune the writing prompt blind, build the Post Grader next (per the Master Plan spec) so there's concrete, scored feedback on *why* a script is weak instead of a gut feeling.

**Done:**
- Grading runs automatically right after the hook is finalized. Scores 0-10 on: hook strength (weighted highest — caps the overall score if weak), curiosity/specificity, emotional charge, share-worthiness, voice match (against Brand Profile), polarity/takeable position, and platform fit (against Instagram, the app's current focus — `TARGET_PLATFORM` constant, platform selection is a future addition). Also checks the Universal Voice Rules checklist from the Master Plan (contractions, active voice, no em dashes, no filler words/openers, digits not spelled out, one concrete idea per post) and lists every violation.
- If the overall score is below 7/10, it auto-revises using the grader's own top fixes (quoting actual lines to change) and re-grades — up to 2 rounds — so a weak first draft doesn't just get handed over. Matches the spec: "revises and re-checks until the score clears a real bar."
- Post Grader card shows live under the script: overall score, per-dimension breakdown, voice rule violations, top fixes, and a manual "Re-grade" button. A manual edit to the script clears the stale grade until re-checked.
- New `ct_scripts` columns: `overall_score`, `dimension_scores`, `top_fixes`, `voice_rule_violations`, `revision_count`, `graded_at`.
- Bug fix during testing: the grading call's `max_tokens` (2048) was too low for the 7-dimension structured schema at high effort and truncated mid-JSON — raised to 4096.

**Verify — tested live end-to-end:** generated a script, grading kicked in automatically, first grade came back 6.5/10 ("below 7/10 — revising and re-checking (attempt 1/2)"), auto-revised, re-graded 6.5 again, auto-revised a second time (attempt 2/2), final grade landed at 7.2/10 clearing the bar — with genuinely specific critique (e.g. "cut the duplicate climax... that alone gets you 60+ words closer to Reel length," exact line rewrites, a wrong psychology term flagged and corrected). `npm run build` passes clean.

**Follow-up:** tested live with real drafts — the auto-revision step was rewriting scripts into content that didn't match Susan's actual story or voice. Flagged as needing a more hands-on tuning pass (not a quick prompt fix) — deferred in favor of moving on to the Plan/Calendar page, per Susan's call.

---

## Fix: Analyze reel-pull cap blocked pulling a creator's fuller history

**Requested:** trying to analyze a creator's larger reel history, "Reels to pull" rejected anything over 100 with a browser validation error. Also wanted this to just work without needing a date range.

**Done:** raised the cap from 100 to 500 in both the input's `max` and the server-side clamp (`src/app/research/actions.ts`), and raised the Apify sync-call timeout from 180s to 300s so larger pulls have room to finish.

**Verify — tested live:** typed 200 into "Reels to pull" with no date range set — accepted with no validation error, cost estimate updated to ~$0.52. `npm run build` passes clean.

---

## Diagnosed: "Incomplete pull" warning on a 200-reel request

**Requested:** asked why a pull of 200 reels for @jessijeanhome came back "186 of 200" with an "Instagram likely blocked part of this request" warning.

**Explained (no code change):** the warning is a heuristic — compares the actor's raw returned count to the requested count. The actual shortfall happens on Instagram/Apify's side (the scraper's pagination gets rate-limited or soft-blocked after enough items in one session), which our code has no visibility into. Checked her pull history: pulls around 100 came back full or nearly full (100/100, 96/100); a 200-reel pull came back noticeably short (186/200, ~93%). Recommended keeping single pulls to ~100 or less for a reliable full pull, or splitting a larger request into multiple date-ranged pulls. Offered to add automatic retry-on-shortfall as a follow-up (not yet built — no explicit request to build it).

---

## Fix: date-range pulls silently capped to 30 instead of pulling everything in range

**Requested:** when a date range is selected but no explicit reel count is typed, the tool should pull *all* reels in that date range — not silently cap to a small default.

**Done:** a blank "reels to keep" count (the default once a date range is set — selecting a date preset or typing a date now clears the field) keeps every reel found in the date range instead of slicing to the old default of 30. Typing an explicit number still caps to the top N by views as before. Label changes to "optional" and help text explains the blank-means-all behavior when a date range is active.

**Verify — tested live:** clicked "Last 7 days" — count field auto-cleared, label read "Top reels to keep (by views) — optional," help text read "Leave this blank (default) to keep every reel found in your date range." `npm run build` passes clean.

---

## Plan: month calendar + post detail page

**Requested:** a large calendar view showing scheduled posts as cards — click a card to see the hook/script (or a way to create one if it doesn't exist yet), plus a status showing whether it's ready to record, recorded, and posted.

**Done:**
- New `/plan` page: full month-grid calendar with prev/next navigation (`?month=YYYY-MM`). Every scheduled idea appears as a compact card on its day, showing the topic (idea text) and hook name (from its latest script, if one's been written), plus three small status dots for ready-to-record / recorded / posted.
- Clicking a card opens `/plan/[ideaId]`: scheduled date, three status toggle buttons, and either the full script — angle/hook/framework/grade badges, full content, "Edit script" link back into the Create wizard — or a "Write script" prompt if the idea doesn't have one yet.
- New `ct_journal_entries` columns: `ready_to_record`, `ready_to_record_at`, `recorded`, `recorded_at` (posted/posted_at already existed from the earlier scheduling stage). Added `setReadyToRecord`/`setRecorded` actions in `journal/actions.ts` alongside the existing `setIdeaPosted`.
- Added "Plan" to the site nav.

**Verify — tested live:** scheduled an idea for today from the Idea page, confirmed it appeared on the correct day in the Plan calendar with its hook ("Confession") shown. Clicked into the post detail page — full script, badges (Personal story / Confession / Before → turning point → after / Grade: 7.2/10), and status toggles all rendered correctly. Toggled "Ready to record" — button filled in immediately, and the calendar card's status dot updated to match on next load. Checked at 375px — calendar grid holds, cards truncate gracefully. `npm run build` passes clean.

---

## Fix: Analyze warnings had no way to dismiss

**Requested:** the "Incomplete pull" / "Window may be incomplete" warnings on a batch page render permanently with no way to clear them.

**Done:** added an X button (new `DismissibleWarning` component) that persists the dismissal on the batch (`dismissed_incomplete_warning`/`dismissed_window_warning` columns on `ct_research_batches`), so it stays gone on reload and also hides the matching warning in the past-analyses list. Also fixed a stale `MAX_RESULTS_LIMIT` (100) in the batch detail page that hadn't been updated to match the 500 cap used everywhere else.

**Verify — tested live:** dismissed the "Incomplete pull" warning on the @jessijeanhome batch — disappeared immediately and stayed gone after reload. `npm run build` passes clean.

---

## Plan calendar: more room, manual add, drag-to-reschedule; direct script editing; scripted collection on Create

**Requested:** enough room in the calendar to fit more than one post per day if wanted; an Add button to manually create a post straight into a day; the ability to drag cards to move them between days. Also: clicking "Edit script" was re-running the entire Create wizard instead of letting her manually edit the script text — and Create should have a section showing posts that already have scripts, from which she can schedule them into the calendar directly.

**Done:**
- Plan day cells sized taller (`min-h-28` → `min-h-36`) to comfortably hold multiple cards.
- Every day cell has a `+` button opening a quick-add dialog that creates an idea already scheduled to that exact date — no detour through the Idea page.
- Cards are draggable between days (native HTML5 drag/drop) — dropping on a different day reschedules the idea there, with an optimistic UI update plus a `moveIdeaToDate` action.
- `/plan/[ideaId]`'s script is now directly editable in place (new `ScriptEditor` component using the existing `updateScriptContent` action) instead of only offering a link back into the full Create wizard. That wizard link is kept as a separate, clearly-labeled "Start over with a new script" option.
- `/create` now splits ideas into "Not yet scripted" and "Already scripted." Scripted entries show their angle/hook badges, link into the Plan detail page (where the script lives and is editable), and have an inline date input to schedule/reschedule them right from that list — no need to go to Plan or Idea first.

**Verify — tested live end-to-end:** added a new idea via the Plan calendar's + button on Sept 16, confirmed it saved with the correct `scheduled_date` in the database. Dragged an existing card from the 16th to the 17th — moved visually and persisted in the database. Scheduled an "Already scripted" idea from `/create` via the inline date field — appeared on the correct day in Plan. Opened a scripted idea's Plan detail page, edited the script text directly, saved — no wizard involved. `npm run build` passes clean.

---

## Fix: Creator Results' Date column wasn't sortable

**Requested:** wanted to be able to sort Creator Results by date, like All Reels already allows.

**Done:** made the Date column sortable, mirroring All Reels' existing pattern exactly — extended the sort comparator to handle date strings (not just numeric fields) for the new `postedAt` sort key.

**Verify — tested live:** clicked the Date header on a real batch — sorted newest-first with the chevron indicator showing, matching the existing Views/Likes/etc. sort behavior. `npm run build` passes clean.

---

## Fix: transcriptions stuck on "Processing..." forever in Creator Results

**Requested:** several reels showed "Processing..." for a long time with no sign of ever resolving.

**Root cause:** the transcription API has no webhook back to us — a reel's `transcription_status` only ever got refreshed when someone manually opened that reel's detail page and clicked "Check status." Creator Results just displayed whatever was last saved in the database, so a "Processing..." badge could sit there indefinitely even after the job actually finished, with nothing in the list view to trigger a re-check.

**Done:** Creator Results now auto-polls any still-processing reels in the background (self-scheduling `setTimeout`, re-checks ~8s after each render, naturally stops once nothing is processing) instead of requiring a manual per-reel check.

**Verify — tested live:** confirmed the poll actually fires a real check against the transcription API (network request observed). One specific reel (`a760b56f...`, from Dec 14, 2025) is still genuinely reported as "processing" by the transcription service itself even after a live re-check — that's a backlog/stall on the transcription app's side, not a bug in Content Tool's polling, and per the standing rule the transcription app itself is never modified from here. The fix ensures any reel that *does* finish (or error) on their end now surfaces that automatically instead of staying frozen. `npm run build` passes clean.

**Follow-up (same session):** confirmed live that once the underlying reels finished transcribing on the transcription tool's end, the poll picked it up automatically — all 6 previously-stuck reels in that batch flipped to "View transcript" with zero manual clicks.

---

## Pull existing reels + transcripts from the transcription tool into Analyze

**Requested:** ~20 Instagram reels already uploaded and transcribed in the transcription tool, wanted a lightweight way to pull them into Content Tool with their transcripts and real metrics (views/likes/comments/shares) — explicitly not a new page, kept as a small/temporary feature reusing what's there.

**Done:**
- "Analyze a single reel" renamed to "Analyze reels by URL" and now takes multiple URLs at once (one per line, textarea instead of a single input) — no new page, same card.
- For every URL, still always calls Apify for real stats. If a reel already has a ready transcript in the transcription tool (`learnwith_sources`), that transcript is copied in directly instead of submitting a new transcription job — matched by the Instagram short code extracted from the URL (robust to `/p/`, `/reel/`, `/reels/`, username-prefixed, or query-string URL variants all pointing at the same reel), not an exact URL string match.
- Required a new read-only RLS policy on `learnwith_sources` granting the anon role SELECT — confirmed with Susan first since it touches the transcription app's table. Purely additive read access; no change to that app's own code, data, or write permissions.
- Confirmed live that matched reels get **zero** transcription cost: `transcription_id` stays `null` for them (the paid re-transcribe path is never called), while the copied transcript text matches character-for-character.

**Bug found and fixed during this work:** `toReelRow` only ever read engagement metrics (views/likes/comments/shares) from the top level of the Apify response. The post-details actor (used by this flow and the pre-existing single-reel flow) actually nests them under a `metrics` object — every single-reel pull before this was silently recording 0s for all four fields. Fixed to read `metrics.*` first, falling back to the flat shape the profile-reels actor uses.

**Verify — tested live end-to-end:** pulled 2 new reels (devinmargan, calebboxx) not previously in Content Tool — both showed "View transcript" with the correct character counts and `transcription_id: null` in the database. Re-ran a 6-reel upspiral.life batch that had been pulled before the metrics fix (all showing 0 views) — after the fix, real stats came through (e.g. 3,419,101 views / 119,798 likes / 14,285 comments / 44,640 shares on one reel), transcripts still correctly attached. `npm run build` passes clean.

---

## Fix: Shares metric, duplicate reels, and a redirect leak in Analyze reels by URL

**Requested:** re-pulling reels through "Analyze reels by URL" showed wrong/duplicated data on All Reels, and one reel's Shares count (16,521) was way off from what's actually visible on Instagram (~1,200).

**Found and fixed three separate issues:**
- **Wrong Shares field.** Instagram's visible "share" icon (the circular-arrows repost count) maps to Apify's `repost_count`, not `share_count` — `share_count` is a much larger internal metric (DM sends) Instagram never shows publicly. Every pull, including profile pulls, was mapping the wrong one. Confirmed via raw Apify response: `repost_count: 1193` matches the "1.2K" shown on Instagram exactly, while `share_count: 16521` doesn't correspond to anything visible. This was wrong from the start, not something today's new feature introduced — historical `shares_count` values across all past pulls stay as originally recorded; only future pulls (or a manual re-analyze) get the corrected number.
- **Duplicate reels.** Re-analyzing a URL that's already in `ct_reels` used to insert a second copy instead of updating the existing row, so re-running the same URL piled up duplicates with stale 0-view data still showing on All Reels. Now it updates the existing row in place (same id, same original batch) — a new batch only gets created when at least one URL is genuinely new.
- **Redirect leak.** As a side effect of the above, `analyzeSingleReel` calling `redirect()` conditionally (batch created vs. not) surfaced the literal string "NEXT_REDIRECT" as an on-page error instead of navigating. Switched to returning `{ batchId }` and having the client navigate itself, with a clear "Already-analyzed reels refreshed with the latest stats" message when nothing new was created.

**Verify — tested live:** re-analyzed the "way better relationship" reel — `shares_count` updated from 15,915 to 1,193, matching Instagram's displayed count exactly. Confirmed re-running an already-analyzed URL no longer creates a duplicate row (single row per URL, same id) and shows the graceful refreshed message instead of a raw error. Re-pulled the two transcription-tool test reels that were still stuck at 0 from before these fixes — both now show real views/likes/comments/shares. Cleaned up the handful of stale zero-value duplicate rows created during today's testing (left untouched: legitimate historical duplicates from repeated profile re-analysis runs, which are intentional snapshots, not a bug). `npm run build` passes clean.

---

## Delete reels, to clean up duplicates manually

**Requested:** a way to delete reels — there were duplicates (from the bug above and from normal repeated profile pulls) cluttering the lists, wanted to remove them directly.

**Done:**
- New `deleteReels` action (`src/app/reels/actions.ts`).
- All Reels: a per-row delete (trash icon) on both the desktop table and mobile cards.
- Creator Results: a bulk "Delete selected" button reusing the existing row-selection checkboxes (already there for "Transcribe selected").
- Both confirm through a new shared in-app dialog (`ConfirmDeleteDialog`) instead of the browser's native `confirm()` — the native one doesn't match the app's UI and, discovered while testing, gets silently auto-dismissed in this session's browser tooling, which would have made the feature look broken. The confirmation text warns that deleting a reel also removes any hooks or framework examples saved from it (a real cascade via an existing foreign key), since that's genuine permanent data loss worth knowing before confirming.

**Verify — tested live:** searched All Reels for a reel with 6 duplicate rows, deleted one via the trash icon and confirm dialog — count dropped from 381 to 380 total reels and from 6 to 5 matching rows, confirming the right row was removed and the dialog flow works end-to-end. `npm run build` passes clean.

---

## Fix: All Reels delete icon was invisible without scrolling

**Requested:** the new delete icon on All Reels wasn't visible at all.

**Root cause:** it was the last column, after Shares, on a wide horizontally-scrolling table — past the visible edge on any normal viewport with no hint that more columns existed off to the right.

**Done:** moved it to the first column, right next to the thumbnail, so it's always visible without scrolling on both the desktop table and mobile cards.

**Verify — tested live:** confirmed the trash icon renders immediately on page load at both desktop and 375px mobile width, no scrolling needed. `npm run build` passes clean.

---

## Fix: All Reels was boxed into a fixed max-width regardless of screen size — then that fix overcorrected

**Requested:** "everything is not showing... I don't want a limit" — the page was capped at `max-w-5xl` (1024px) no matter how wide the actual browser window was, so the 9-column table always needed horizontal scrolling even on a big monitor with room to spare.

**First attempt:** removed the width cap entirely so the table would stretch to the full window. This backfired — with no intrinsic content wide enough to fill a very wide window, it left a large dead gap between columns instead of showing more, which is worse, not better ("too wide. too much gap... this is ridiculous").

**Actual fix:** bounded the width again, but wider than before (`max-w-6xl` instead of `max-w-5xl`) — enough headroom to avoid the original cramped scrolling on most screens, without the empty-gap overcorrection.

**Verify — tested live:** confirmed the layout is compact and gap-free at normal widths, matching how it looked before either width change. `npm run build` passes clean.

---

## Fix: reel captions still cut off short in All Reels and Creator Results

**Requested:** after the column-width fixes, captions were "still cut off" — turned out to be a separate issue: the caption text itself was hard-truncated to one line at a narrow max-width, unrelated to the table/page width.

**Done:** widened the caption to `max-w-xs` and switched from single-line `truncate` to `line-clamp-2` in both All Reels and Creator Results, so captions get two lines of room instead of being clipped after a few words.

**Verify — tested live:** confirmed captions on All Reels now show substantially more text (e.g. "Inspired, annoyed, mixed emotions...? it's is the reason I..." instead of cutting off after "Inspired, annoyed, mixed emoti..."). `npm run build` passes clean.

---

## Fix: caption widening pushed Shares off-screen again

**Requested:** "still cut off" — after the last fix, the Shares column was now the one getting clipped at the right edge.

**Root cause:** widening the caption to `max-w-xs` (320px) to show more text made the table's total width exceed the page container, pushing the last column off-screen — trading one cutoff problem for another.

**Actual fix:** reverted the caption back to its original width (`max-w-48` / `max-40-56`) — kept `line-clamp-2` instead of `truncate`, which alone already shows roughly double the text at the *same* width by wrapping to two lines instead of hard-clipping one. No extra width needed at all.

**Verify — tested live:** at 1470px width (matching the screenshot that showed the cutoff), all 9 columns — Reel, Creator, Transcript, Saved, Date, Views, Likes, Comments, Shares — render fully with no clipping and no excess gap. `npm run build` passes clean.

---

## Add comment/share rate percentages to All Reels

**Requested:** "the comment or share % is missing" — Creator Results already shows "count (rate%)" for both; All Reels only had raw counts.

**Done:** computed `commentRate`/`shareRate` (count ÷ views) server-side and rendered them the same "count (rate%)" way as Creator Results, in both the desktop table and mobile cards.

**Verify — tested live:** at 1470px, Comments and Shares both show percentages (e.g. "156 (0.71%)," "1,190 (1.51%)") with all columns still fitting without clipping. `npm run build` passes clean.

---

## Remove reel thumbnail images app-wide

**Requested:** "what happened to all the images. its broken" — reel thumbnails were showing as broken-image icons. Diagnosed as Instagram's CDN thumbnail/video URLs being signed with an expiration token that goes dead after about a week, so any batch older than that slowly fills up with broken icons — not a bug in Content Tool's code. Explained that the real fix (downloading and storing our own copy per reel) is a real scope/cost decision, and asked which way to go. Susan: "let's remove the images all together. I don't want to make it complicated."

**Done:** removed `<img>` thumbnails everywhere they appeared — All Reels (table + mobile cards), Creator Results (table + mobile cards), the Analyze past-analyses list, Hook Library, Framework Library, and Reel Detail. Left the underlying `thumbnail_url` column/data alone (harmless to keep). Where a thumbnail had doubled as a link to the reel (Hook/Framework Library), confirmed the existing separate "View reel" link in each row still covers that navigation.

**Verify — tested live:** checked All Reels, Analyze's past-analyses list, and Frameworks — all render clean text-only rows with no broken-image icons anywhere. `npm run build` passes clean.

---

## Edit Views/Likes/Comments/Shares; hide delete behind a single Edit toggle

**Requested:** on both All Reels and Reel Detail, wanted the ability to manually correct Views/Likes/Comments/Shares. Separately: "I don't want an ugly f***ing trashcan button next to every single line" on All Reels — wanted a single edit/checkmark-style control instead of a permanent delete icon on every row.

**Done:**
- New `updateReelStats` action, shared by both pages.
- Reel Detail: a single pencil icon on the stats card switches Views/Likes/Comments/Shares into editable inputs with Save/Cancel.
- All Reels: replaced the always-visible trash icon with a single "Edit" toggle in the toolbar. Default (off): clean read-only rows, no icons. On: per-row delete icons appear and all four stats become inline-editable inputs that save on blur. Percentages now compute live from the current row values instead of a stale server-computed rate, so an edit updates the shown rate immediately without a reload.

**Verify — tested live:** edited a reel's Comments count on All Reels (156 → 999) with the table in Edit mode, confirmed it saved to the database, reverted it. Confirmed Edit off shows zero icons on any row. On Reel Detail, clicked the pencil, saw all four stats turn into editable inputs with Save/Cancel, Cancel left the data untouched. `npm run build` passes clean.

---

## All Reels: View Reel link, Analyzed date, Transcribed/Hook/Body checkmark columns

**Requested:** a link to the real Instagram post; a column showing when the reel was analyzed (pulled into Content Tool), distinct from the existing posted date; rename "Transcript"/"Saved" to "Transcribed"/"Hook"/"Body" as three columns, each checked off instead of showing text badges like "Ready" or "Framework."

**Done:**
- Added a "View Reel" link (to the real Instagram post) under the caption, both desktop table and mobile cards — matching the pattern already on Creator Results.
- Added an "Analyzed" column (`created_at`, when the reel entered Content Tool) alongside the existing "Date" column (`posted_at`, when it went up on Instagram).
- Replaced "Transcript" + "Saved" with three columns: Transcribed, Hook, Body — each a simple checkmark icon when done (Transcribed still shows a small Processing/Error badge for those in-progress states, since that's actionable info worth keeping). "Framework" is renamed to "Body" everywhere on this page (display-only — the underlying `ct_framework_examples` table/field names are unchanged).
- Restructured the mobile card markup: it used to be one giant `<Link>` wrapping the whole card, which would've made the new View Reel link an invalid nested anchor. Caption is now its own `Link`, View Reel is a sibling anchor — same shape as the desktop cell.

**Verify — tested live:** confirmed real Instagram URLs on every "View Reel" link. Confirmed Transcribed/Hook/Body show checkmark icons for reels that have them, dashes for reels that don't, matching the correct rows. Checked mobile at 375px — card layout holds with the new link and date. `npm run build` passes clean.

**Follow-up:** renamed the "Date" column header to "Created" (still sorts by `posted_at`, the Instagram post date) for clarity next to the new "Analyzed" column.

---

## Idea: free-write option in "Flesh this out"

**Requested:** the flesh-out flow only ever offered AI-matched frameworks to pick from — wanted a way to just write the idea out freely instead of being forced through a framework.

**Done:** clicking the wand icon now opens straight to a choice — "Suggest a framework" (the existing AI-matching flow) or "Just free-write instead" — rather than always running the framework-matching AI call first. Free write is a single open textarea, saved as one Q&A pair (`{question: "Your notes", answer: <text>}`) with `framework_id` left null, reusing the existing `flesh_out_answers`/`fleshed_out` storage. The "view fleshed-out idea" dialog now shows "Free write" instead of a framework name when there isn't one.

**Verify — tested live:** opened Flesh this out, confirmed the choice appears immediately (no AI wait). Picked free-write, typed notes, saved — the idea's wand icon lit up as fleshed-out, and reopening it showed "Free write" with the notes intact and editable. `npm run build` passes clean.

---

## Removed Script Writer (Create) and Instructions pages

**Requested:** completely remove the Create and Instructions pages for now — Susan will write all scripts herself; the tool should only edit scripts, as a future feature.

**Done:**
- Deleted the entire `/create` route tree (idea-to-script wizard, hook/framework selection, grading) and `/create/process` (Instructions/process settings page), plus the now-orphaned `src/lib/script-process.ts` helper.
- Removed "Create" and "Instructions" from the site nav.
- Plan still needs to create/edit scripts, so moved that logic into a new `src/app/plan/script-actions.ts` (`updateScriptContent`, plus a new `createManualScript`). An idea with no script now shows a plain textarea + "Save script" button (`ManualScriptForm`) instead of a link into the deleted wizard; an idea with a script keeps its existing editable textarea with the "Start over with a new script" link removed.
- No database changes — `ct_scripts` and `ct_script_process_settings` are untouched, so nothing is lost if script generation comes back later.

**Verify — tested live:** confirmed nav no longer shows Create/Instructions. Opened a scripted idea in Plan — script editor still works, no dead link. `npm run build` passes clean with the reduced route list (`/create` and `/create/process` gone; no other route references them — confirmed via grep).

---

## Left sidebar nav + Settings tab (Brand Profile moved in)

**Requested:** Brand Profile should live in a Settings tab, with Settings pinned at the bottom-left of the page.

**Done:**
- Replaced the top nav bar with a left sidebar on desktop (Idea, Analyze, All Reels, Frameworks, Plan stacked, "Content Tool" at top), with a "Settings" link pinned to the bottom of the sidebar via its own bordered footer section. Mobile keeps the existing scrollable top bar, with Settings appended as its last link.
- Moved Brand Profile from `/brand` to `/settings/brand` (route + component files renamed, all `revalidatePath`/import references updated). Added a `/settings` index that redirects to `/settings/brand`, and a shared Settings layout with a tab bar above the content — currently just the one "Brand Profile" tab, built to hold more settings tabs later.
- Root layout switched to a `flex-row` shell on desktop (sidebar + main content side by side) while staying `flex-col` on mobile (top bar above content).

**Verify — tested live:** desktop (1440px) shows the sidebar with Settings at the bottom; clicking it loads Settings > Brand Profile with all existing data and functionality intact. Mobile (375px) shows the top scrollable bar with Settings reachable at the end. `npm run build` passes clean.

---

## Sidebar collapse toggle

**Requested:** the sidebar should be able to collapse to the left with a button.

**Done:** added a chevron button next to "Content Tool" in the sidebar header. Collapsing shrinks the sidebar to a slim strip — nav links abbreviate to their first letter (with a title tooltip), Settings stays icon-only — and expands the main content area to fill the freed space. State is saved to `localStorage` so it stays collapsed/expanded across page navigation.

**Verify — tested live:** collapsed and expanded the sidebar, confirmed nav links still work in both states, and that navigating to a different page (Idea → Analyze) kept the collapsed state. `npm run build` passes clean.

---

## Renamed "Framework" to "Body" across the reel-body-copy feature

**Requested:** the Library's second tab (previously "Frameworks") should say "Body" instead — and anywhere else that refers to this same saved-body-copy concept as "Framework" should also change to "Body". The "Frameworks" nav label itself stays as-is.

**Done:**
- Library page: tab label "Frameworks (5)" → "Body (5)", subtitle now says "Saved hooks and body examples from your analyses."
- Library's Body tab content: search placeholder, "Add framework" → "Add body", "Save framework" → "Save body", empty states, and the Edit/Delete aria-labels all now say "body" instead of "framework".
- Reel Detail's analysis panel: "Hook & framework analysis" → "Hook & body analysis", the "Framework" section → "Body", "Matched framework"/"No framework" → "Matched body"/"No body", "Save/Update framework example" → "Save/Update body example", "Framework Library" link text → "Body Library".
- Delete-confirmation copy on All Reels and Creator Results now says "hooks or body examples" instead of "hooks or framework examples".
- Left untouched: the "Frameworks" nav link/label, the Library page's own `<h1>` (still "Frameworks", same as the nav), and the separate "Suggest a framework" flow in Idea's "Flesh this out" dialog — that's a different feature (picking a content structure to help write an idea), not the saved-body-copy library.
- No database/schema changes — `ct_frameworks`/`ct_framework_examples` table and column names, and internal function/component names, are unchanged; only user-facing text moved to "Body".

**Verify — tested live:** Library page shows "Hooks (4)" / "Body (5)" tabs with all body-example cards intact. Reel Detail's analysis panel shows "Hook & body analysis", "Body" section, "Matched body", "Update body example", and a working "Body Library" link. `npm run build` passes clean.

---

## Renamed "Flesh out" to "Script" / "Scripted"

**Requested:** "Flesh out" should turn into "Script" / "Scripted" everywhere.

**Done:** on the Idea page, the wand-icon dialog now reads "Script this out" (was "Flesh this out"), and once an idea has been filled in, its wand icon shows "Scripted idea" ("View scripted idea" tooltip) instead of "Fleshed-out idea". Internal names — `FleshOutDialog`, `saveFleshOut`, the `fleshed_out`/`flesh_out_answers` DB columns — are unchanged; only the visible text changed.

**Verify — tested live:** created a test idea, confirmed its wand icon reads "Script this out" and opens a dialog titled "Script this out"; confirmed an already-filled-in idea's wand icon opens a "Scripted idea" dialog. Cleaned up the test idea afterward. `npm run build` passes clean.

---

## Removed "Script this out" from the Idea page

**Requested:** remove all "Script this out" (the wand icon) from idea rows.

**Done:** deleted the wand-icon dialog entirely — both the "Script this out" trigger (framework matching, follow-up questions, free-write) and the "Scripted idea" view — from every idea row on the Idea page. Removed the now-dead server actions that powered it (`matchFrameworks`, `getFollowUpQuestions`, `saveFleshOut`, `updateFleshOutAnswers`) and their schemas from `journal/actions.ts`. No database changes — the `fleshed_out`/`flesh_out_answers` columns are untouched, and for ideas that already have saved answers, that content still feeds into the "Add to Brand" text.

**Verify — tested live:** Idea page now shows only Schedule/Posted/Add-to-Brand icons on every row, no wand icon anywhere. `npm run build` passes clean.

---

## Large blurred-background script editor from the Idea page

**Requested:** since Susan is writing everything herself now (no AI writing), clicking an idea should go directly into a large script page, with the background blurred out so it's not distracting.

**Done:**
- Clicking an idea's text now opens a large modal (94vw × 88vh) instead of the old small "Edit idea" box: idea text as a plain heading-style field at the top, a big writing area for the script below, and "Save script" in the footer.
- The script is stored in the same `ct_scripts` table Plan already uses (via the shared `createManualScript`/`updateScriptContent` actions), so writing here and writing from Plan stay in sync — whichever was edited most recently is what shows in both places.
- Added an optional `overlayClassName` to the shared Dialog component so this one dialog can use a much stronger backdrop blur (`backdrop-blur-md`) without changing every other dialog in the app.

**Verify — tested live:** clicked an idea, confirmed the large modal opens with a clearly blurred background, typed a script, saved it, reloaded the page, and confirmed the script persisted. Cleaned up the test script afterward. `npm run build` passes clean.

---

## Fixed script dialog scroll + added Schedule and Scripted controls

**Requested:** the script dialog's bottom was cut off with no way to scroll to it; wanted a Save button, a button to schedule the idea on the calendar, and something showing this is a final, "Scripted" script.

**Done:**
- Root cause of the cutoff: the script textarea used the browser's `field-sizing-content` behavior (via the shared `Textarea` component), so it grew to fit all of its text regardless of the dialog's height, pushing the footer off-screen with nothing scrollable. Replaced it with a plain textarea that properly scrolls inside a fixed-height flex layout, so the footer (Save button included) now always stays visible.
- Added a date picker directly in the dialog's footer to schedule the idea (same `scheduleIdea` action used elsewhere), plus an "Unschedule" option.
- Added a "Mark as Scripted" toggle in the footer — becomes a "Scripted" badge once set, shown both in the dialog header and on the idea's row in the list, so scripted ideas are visible at a glance. Reuses the `fleshed_out` column (otherwise unused since the AI flesh-out feature was removed) rather than adding a new one.

**Verify — tested live:** opened an idea with a long saved script, confirmed the textarea now scrolls internally with the footer always visible. Toggled "Scripted" off and back on, confirmed the badge and row indicator update correctly. `npm run build` passes clean.
