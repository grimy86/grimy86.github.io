# LowLevelNotes working brief

## Product

LowLevelNotes (also branded **0xLLN**) began as a personal collection of technical
notes, books, and learning resources. Its direction is to become a modern,
full-featured learning platform for mastering software development, especially
low-level and systems-oriented topics.

Phase 0 (UI design and identity) established the current visual system — see
the design-system contract below. Phase 1 (SQL data model) and Phase 2
(course-catalog REST API) are both complete and live. Phase 3
(authentication primitives — registration, login/logout, session
management, password recovery, email verification, change-password) is
also complete and live, but scoped to auth only: the user-scoped course
endpoints it unblocked were deliberately deferred rather than bundled
in. Phase 4 (authorization roles — an admin panel, a request-and-approve
path from student to contributor/instructor, and a reviewed
resource-submission pipeline) is also complete and live. Those deferred
course endpoints (enroll, mark-lesson-complete, quiz-attempt,
`/me/progress`, `/me/statistics`) are now complete and live — see
"Data and API direction" below for the concrete design. Phase 7 (the
learning system UI) is complete: all four staged slices (see WORKLOG's
"Phase 7 scoping" entry) shipped — the session-gated course/lesson
catalog and R2-backed markdown content pipeline, enrollment/completion
actions, the interactive quiz UI, and progress surfacing via
`/account/courses` — plus a full instructor course-authoring pipeline
(browser-based course builder, admin review before publishing) that
superseded the original test-seed content. Course review, publish, and
removal, along with role- and resource-request review, live as tabs on
`/account/staff` — see "Data and API direction" below for the concrete
design, its "Security and roles" entry for why that review UI moved back
onto `/account/staff` after a stint as standalone `/account/approvals/*`
pages, and "Phase 7 (learning system UI), concrete decisions so far" for
how the two `postgresql`/`networks` proof-of-pipeline seed courses were
later replaced with real, fully authored curriculum.

## Current stack

- Frontend: React, Next.js, TypeScript, Tailwind CSS
- Backend/API (planned/current architecture): Cloudflare Workers API and
  Cloudflare D1 (SQLite)
- Delivery: GitHub push → GitHub Actions → Vercel build/deploy → Cloudflare domain
- `worker/` is deliberately untracked (`/worker/` in `.gitignore`) —
  confirmed with the user (2026-09-06) that it's deployed straight from
  local disk via `wrangler deploy`, no git history anywhere, not this
  repo or a separate one. Two real, currently-harmless-only-because-of-
  that consequences worth remembering: `worker/routes/staff.js` hardcodes
  the real Cloudflare zone ID (`CLOUDFLARE_ZONE_ID`) and
  `worker/wrangler.toml` has the real D1 `database_id` — both fine only
  because neither file is ever actually published; and the root-level
  `vitest.config.mjs`/`package.json` `test` script (see "Automated
  testing" below) *are* tracked here but reference paths under `worker/`,
  so `npm test` only works on a machine that already has that local
  `worker/` checkout — a fresh clone of this repo alone can't run it.

## Automated testing

Added 2026-09-06 — until then this project had zero automated tests
(confirmed: no test script, no test files, `npm audit` clean but that's
dependency scanning, not regression coverage). Scoped deliberately narrow
rather than attempting broad coverage: `worker/test/staff-users.test.js`
and `worker/test/requests.test.js` cover the highest-consequence,
hardest-to-undo Worker routes — ban/unban, role change, delete user
(including every self-protection and super-admin-protection check),
and role-/resource-request approve/reject — the ones where a bug means
banning the wrong account or promoting the wrong user, not a cosmetic
regression. Explicitly out of scope for this first pass: the Cloudflare
IP-block routes' actual proxying behavior (would need mocking real
outbound HTTP to `api.cloudflare.com`, e.g. via `@msw/cloudflare`, which
was 0.0.1 and experimental at the time — their auth/validation-only paths
that return before ever calling out are still easy to add later without
that dependency), and the AdminPanel tab-count question from the same
conversation (deliberately held off pending real usage data, not a
testing gap).

- Runner: `@cloudflare/vitest-plugin` (the current package — the
  similarly-named older `@cloudflare/vitest-pool-workers` also still
  exports a compatible `cloudflareTest`, but the dedicated plugin package
  is what Cloudflare's own current docs and fixture examples use, so that's
  what's installed) running real Worker code inside actual `workerd`
  against a local Miniflare-backed D1 — deliberately not hand-rolled
  `env.DB` mocks, so a test failure means a real SQL/schema/logic mistake,
  not a mock that quietly drifted from what production D1 actually does.
  Tests call `exports.default.fetch(url, init)` (the real
  `worker/index.js` fetch handler, matched-routes-and-all), not the
  individual route functions directly — this exercises the exact
  dispatch, auth, and status-code behavior a real request gets.
- `worker/test/helpers.js`'s `seedUser()` inserts a real `users` +
  `sessions` row directly via `env.DB` rather than going through
  `/v1/auth/register`/`/v1/auth/login` — those two require a genuine
  Cloudflare Turnstile round trip with no test bypass, which isn't
  reproducible locally. This only exercises what session-gated routes
  actually check (a valid, unexpired `sessions` row joined to `users`),
  the same shape `getSessionUser()` reads in production; it does not
  cover the register/login flow itself.
- Real discovery made getting this working, unrelated to anything asked
  for: replaying `worker/migrations/*.sql` in order against a genuinely
  empty database fails at `0005_phase4_authorization.sql` with `no such
  table: resources` — and the same happens for `site_settings`, `tools`,
  and `changelog`. None of the four is ever `CREATE TABLE`d by any
  tracked migration; they're referenced only via `ALTER TABLE`/`INSERT
  ... SELECT`, meaning **the tracked migrations alone cannot rebuild the
  real schema from scratch** — they assume a hand-created baseline from
  before `wrangler d1 migrations` existed (0011's own comment confirms
  this for `tools` specifically: "this table predates `wrangler d1
  migrations` entirely"), and that baseline was never captured anywhere
  in version control. Worked around for testing purposes only via
  `worker/test/pre-migration-baseline.sql` — a reconstruction good enough
  to satisfy what the tracked migrations and the routes under test
  actually touch, explicitly commented as *not* a real migration and
  *not* guaranteed to be byte-for-byte what production's real baseline
  schema actually is. This is a real disaster-recovery gap independent of
  testing (if the live D1 database were ever lost, `wrangler d1
  migrations apply` alone would not reproduce it) — flagged to the user,
  not fixed here; fixing it for real means dumping the actual production
  schema for those four tables (`sqlite_master` via `wrangler d1
  execute`) and adding it as a real numbered migration, not guessing at
  it the way the test fixture does.
- Run via `npm test` (`vitest run`).

## Roadmap

1. **Phase 0 (complete):** UI design and implementation.
2. **Phase 1 (complete):** SQL/data model for users, courses, modules, lessons,
   and related learning data. Schema is live in D1 and seeded with test
   content (`worker/migrations/`) — see "Data and API direction" below for
   the concrete tables and decisions.
3. **Phase 2 (complete):** REST API redesign with clear HTTP methods, status
   codes, validation, pagination, rate limiting, error handling, and API
   versioning. Shipped: the course catalog (`GET /v1/courses`,
   `GET /v1/courses/:slug`, `GET /v1/courses/:slug/lessons`). The
   user-scoped resources (enrollment, progress, quizzes, statistics) were
   deferred — they need real identity, which didn't exist until Phase 3,
   and were deliberately not bundled into it either (see Phase 3 below).
4. **Phase 3 (complete):** Authentication: registration, login/logout,
   password recovery, email verification, and session management, plus
   change-password. Shipped as `/v1/auth/*` in `worker/index.js` —
   PBKDF2-SHA256 password hashing (the platform's actual ceiling on
   Cloudflare Workers, see "Data and API direction"), D1-backed sessions
   and single-use tokens, Resend for email delivery. Deliberately did
   **not** include the deferred Phase 2 course endpoints (enroll,
   progress, quiz attempts, statistics) — those remain unbuilt, now
   unblocked by the `getSessionUser()` helper this phase added, but
   correctly belong to whichever next slice picks them up rather than
   having been silently smuggled into "auth."
5. **Phase 4 (complete):** Authorization roles: guest, student, contributor,
   instructor, administrator. Shipped as `/v1/staff/*`, `/v1/role-requests*`,
   and `/v1/resource-requests*` in `worker/index.js`, plus `/account/staff`
   (originally `/staff`, renamed later to nest under `/account` — see the
   WAF Rule 2 note below for why that's safe) and `/contribute` in the
   frontend — see "Data and API direction" below and
   the API endpoint reference for the concrete design.
6. **Phase 7 (complete):** Learning system: explanations, code examples,
   diagrams, interactive “try it yourself” exercises (informational only
   this phase — see "Data and API direction" below), questions, quizzes,
   and lesson completion. All Worker-side endpoints for Slices 1–3
   (session-gated catalog + R2-backed content pipeline; enroll +
   mark-complete; quiz grading) plus the instructor course-authoring
   write API are deployed and **live in production**; the matching
   frontend (quiz-taking UI, the instructor course builder at
   `/courses/builder`) has been **live on `main` since commit
   `585e81f`** (the "not yet committed" note that used to live here was
   stale — corrected during the admin-restructure pass below). Slice 4
   (progress surfacing) is confirmed satisfied by `/account/courses`
   (stats row + per-enrollment progress, built as Slice 2's follow-up) —
   all four staged slices are done; see WORKLOG's "Phase 7 scoping" entry
   for the original breakdown. The YAML/frontmatter scriptable pipeline
   that existed briefly alongside the instructor UI was removed the same
   day it shipped — content authoring is exclusively through
   `/courses/builder` now (write API + a browser course builder, with
   admin review before publishing), so an instructor no longer needs
   repo/Cloudflare access to build a course at all. Course review/
   publish/removal now lives at `/account/approvals/course-requests` (moved
   out of `/account/staff`, along with role- and resource-request review,
   into their own `/account/approvals/*` pages — see "Phase 7 (learning system UI), concrete
   decisions so far" below for the full design and why). See WORKLOG's
   "Phase 7 scoping" and "Instructor course builder" entries for the
   original staged-slice plan.
7. **Phase 8 (mostly complete):** Progress: course/lesson progress and quiz
   scores shipped as part of Phase 7 (Slices 2-4, `enrollments`/
   `lesson_progress`/`quiz_attempts`, surfaced on `/account/courses`); a new
   achievements system (unlockable milestones layered on that same
   progress data — see "Achievements" below) shipped in this pass.
   Exercise results stay blocked on End-Phase (below) — not scheduled.
8. **Phase 9:** Gamification: goals, XP, badges, levels, streaks, certificates,
   and leaderboards.

**End-Phase — Exercises** (standard-library-free programming tasks and
x86-64 assembly tasks): out of the numbered sequence on purpose. This isn't
scheduled — it gets picked up only if the platform grows past two real
users, since it's the one piece of this roadmap with an ongoing hosting
cost. Cloudflare Workers can't run a compiler/assembler in-process, so real
grading needs an external sandboxed execution backend; three options were
weighed (Cloudflare Containers, a self-hosted Piston instance, a
from-scratch client-side WASM/x86 emulator) and the pick was **self-hosted
Piston** — the VPS cost, not the tool, is what's actually being deferred.
Written out fully below so this is pure execution whenever it's picked up,
not re-research:

- **Why Piston:** open-source, purpose-built code-execution engine already
  used by several competitive-programming sites; supports C (via `gcc`) and
  NASM out of the box; does its own sandboxing internally (Linux
  namespaces, chroot, unprivileged users, cgroups, via its `isolate`
  dependency) — no need to hand-roll process isolation. Its public instance
  is explicitly rate-limited and not meant for real reliance, so this
  requires a private, self-hosted instance, not the public API.
- **Hosting:** one small VPS (a $5-6/mo tier — DigitalOcean, Hetzner, or
  Fly.io are all fine) running Piston via its official docker-compose
  setup, with the `gcc` and `nasm` language packages installed
  (`cli.js ppman install gcc nasm`). Put behind a reverse proxy that checks
  a shared-secret bearer token (a new Wrangler secret, e.g.
  `PISTON_API_KEY`) before forwarding to Piston's actual API — Workers have
  no static egress IP to firewall by IP alone.
- **Schema:** extend `exercises` (`worker/migrations/0001_phase1_learning_
  platform.sql`) with a `test_harness` column — instructor-authored code
  that wraps the student's submission (includes/calls it, feeds fixed
  inputs, and exits 0 on pass / nonzero on fail), matching the shape of
  this doc's own example exercises ("reverse a string without the standard
  library"; "write an x86-64 function returning the maximum of two
  integers" — see "Learning and motivation model" below). Add a new
  `exercise_attempts` table (id, user_id, lesson_id, submitted_code,
  stdout, exit_code, passed, attempted_at), mirroring `quiz_attempts`'s
  shape.
- **Grading flow:** a new endpoint, `POST /v1/lessons/:id/submit-exercise`
  (parallel to the existing `.../attempt` for quizzes) — session- and
  enrollment-gated the same way `completeLessonV1`/`attemptQuizV1` already
  are, rate-limited via the existing `countAuthEvents` pattern with a new
  `exercise_submit` event type (needs an `auth_events` CHECK-constraint
  migration, same as `course_content_write` did). The Worker concatenates
  the submission with the exercise's stored `test_harness`, POSTs it to
  Piston's `/api/v2/execute` with the right `language` and a
  `compile_timeout`/`run_timeout`/memory limit (all native Piston request
  params), reads back stdout/stderr/exit code, writes an
  `exercise_attempts` row, and calls `evaluateAchievementsV1` — making
  "exercise results" achievements (the original Phase 9 goal left out this
  pass) a one-line `criteria_type` addition once this lands.
- **Frontend:** `ExerciseBody` (`src/components/lesson/
  LessonContentViews.tsx`) already renders the prompt and starter code; it
  would need a real code editor (a new dependency — CodeMirror is a
  reasonable pick, nothing like it exists in this stack today) in place of
  the current read-only `RenderedCode`, a "Run" action hitting the new
  endpoint, and a pass/fail + stdout/stderr result panel.
- **Security boundary:** correctness of isolation is Piston's job, not this
  app's — the Worker only needs to be a disciplined caller (real timeouts,
  rate limits, never trusting output beyond the harness's own pass/fail
  exit code).
- **Verification, once built:** same pattern as every feature in this repo
  — a throwaway QA account (never a real user's session), submit both a
  passing and a failing solution to a real exercise, confirm the
  `exercise_attempts` row and achievement unlock are correct, and confirm
  a deliberately hanging submission (infinite loop) is killed by Piston's
  own timeout rather than hanging the Worker's request.

## Future implementation reference

These are planning notes, not authorization to begin future phases early.

### Next.js and TypeScript learning targets

- Next.js App Router: layouts, nested and dynamic routes, route groups, loading
  states, error boundaries, `not-found.tsx`, Server/Client Components, Server
  Actions, Route Handlers, middleware/proxy, caching, revalidation, and static
  versus dynamic rendering.
- Intended course URLs: `/courses`, `/courses/[course]`, and
  `/courses/[course]/[lesson]`. An example path is
  `/courses/computer-architecture/cpu`.
- TypeScript: types, interfaces, unions/intersections, generics, utility types,
  narrowing, discriminated unions, type guards, mapped/conditional types,
  `typeof`, `keyof`, `satisfies`, and `as const`.
- Lessons will have a stable identifier, title, and a type such as article,
  video, exercise, or quiz.

### Data and API direction

- **Worker source layout (2026-08-29):** `worker/index.js` grew to 5,237
  lines/~150 functions across this project's lifetime and was split into
  a thin entry point plus `worker/lib/{http,crypto,validate,session,
  rateLimit,email,mappers,courseAccess}.js` (cross-cutting helpers) and
  `worker/routes/{auth,courses,instructor,groups,profile,library,badges,
  requests,staff}.js` (one file per feature domain) and `worker/cron.js`
  (the three `scheduled()` jobs). Pure reorganization — every function
  body moved unchanged, only `export`/`import` lines were added; verified
  via `wrangler deploy --dry-run` (esbuild resolves the whole import
  graph — the correct syntax check here, since `worker/` has no
  `package.json` and plain `node --check` doesn't understand ESM
  `import`/`export` on a bare `.js` file the way esbuild does) before the
  real deploy. Mentions of "`worker/index.js`" elsewhere in this doc
  predate the split and point at logic that's now in one of these files
  instead — the split didn't move any of the reasoning, just the file it
  lives in. All of `worker/` (new files included) stays gitignored, same
  as before.
- Schema is live in D1 (`lowlevelnotes-db`), defined in
  `worker/migrations/0001_phase1_learning_platform.sql`: `users`, `courses`,
  `modules`, `lessons`, `enrollments`, `lesson_progress`, `exercises`,
  `questions`, `answers`, `quiz_attempts`. Seeded with test/placeholder
  content via `worker/migrations/0002_seed_test_content.sql` (one row per
  enum value — one user per role, one lesson per type — not real course
  material).
- `worker/` (the Worker source and its migrations) is intentionally **not
  tracked in git** — it lives only on disk, gitignored, to avoid publishing
  the API implementation and schema. `wrangler d1 migrations apply` still
  works normally since it reads local files regardless of git tracking; a
  fresh clone of this repo will not have `worker/` and needs it recreated
  from the live Worker source before running migrations.
- Core relationships: users enroll in courses and track lesson progress; courses
  contain modules; modules contain lessons.
- Lesson content lives in markdown files (path referenced by
  `lessons.content_path`), not as DB blobs — but **not in git either**.
  This reverses Phase 7 Slice 1's original call (see the Phase 7 block
  below for why): content lives in R2 (`lowlevelnotes-assets`,
  `content_path` doubling as the R2 key). Authored exclusively through
  the instructor UI (`/courses/builder`) now — `PUT /v1/instructor/
  lessons/:id/content` writes the markdown straight to R2 server-side,
  no local editing folder or push script involved (an earlier
  scriptable/YAML-based authoring pipeline existed briefly and was
  removed once the UI shipped — see "Instructor course builder" below).
  Never committed, never publicly downloadable — same non-CMS reasoning
  as before (no database blobs), just not git either.
- A quiz is a `lessons` row with `type = 'quiz'` (owning `questions` →
  `answers`), not a separate `quizzes` table.
- `users.role` does not include `guest` — a guest is an unauthenticated
  visitor with no row, not a stored role value.
- Schema changes go through `wrangler d1 migrations` (`worker/migrations/`),
  not ad-hoc SQL — apply with
  `wrangler d1 migrations apply lowlevelnotes-db --remote` from `worker/`.
- The API should serve the web app now and remain suitable for future mobile and
  CLI clients.
- New Phase 2+ endpoints are versioned under a `/v1` path prefix (e.g.
  `/v1/courses`), so a future breaking change can ship as `/v2` without
  disrupting existing clients. Pre-Phase-2 endpoints (`/resources`,
  `/people`, `/changelog`, `/resource/:id`, the `.svg` badges) are
  intentionally left unversioned at their current paths — they're
  already live and consumed by the site and external embeds, so adding a
  prefix now would itself be a breaking change.
- **User-scoped course endpoints, concrete decisions** — deferred during
  Phase 2 (no identity yet) and kept out of Phase 3 too (strict scoping —
  see WORKLOG's "Phase 2 kickoff" entry), then implemented as their own
  unnumbered slice once Phase 4 landed. See WORKLOG's "Deferred Phase 2
  endpoints" entry for the full reasoning and how it was verified:
  - Shipped: `POST /v1/courses/:slug/enroll`, `POST
    /v1/lessons/:id/complete`, `POST /v1/lessons/:id/attempt`,
    `GET /v1/me/progress`, `GET /v1/me/statistics`. No new tables — all
    of `enrollments`, `lesson_progress`, `quiz_attempts`, `questions`,
    `answers` already existed from Phase 1.
  - Courses are addressed **by slug**, lessons **by numeric id** —
    matches every other `/v1/courses/*` route for the former; lessons
    are only slug-unique within a module, not globally, so id is the
    only unambiguous handle for the latter.
  - No `/v1/quizzes/*` namespace — a quiz is a `lessons` row (Phase 1's
    decision), so attempts live at `/v1/lessons/:id/attempt`, one
    addressing scheme instead of two.
  - `/complete` rejects `type = 'quiz'` lessons (400) — a quiz only
    completes by being attempted, never by a bare "mark done" that
    bypasses answering anything.
  - Both `/complete` and `/attempt` require the session user be enrolled
    in the lesson's course (403 otherwise, no auto-enroll side effect) —
    but enrollment `status IN ('active', 'completed')` counts, only
    `dropped` excludes. A first cut that required `'active'` only was a
    real bug caught by local end-to-end testing: finishing a course
    (auto-completing its enrollment) immediately locked the same user
    out of reviewing lessons or retaking the quiz in it.
  - Completing every lesson in a course auto-flips its enrollment to
    `completed` with `completed_at` set (`maybeCompleteEnrollmentV1` in
    `worker/index.js`) — those columns existed since Phase 1 with
    nothing writing them until now.
  - Quiz attempts are rate-limited (20/hour/user, `quiz_attempt` in
    `auth_events` — `worker/migrations/0009_quiz_attempt_rate_limit.sql`,
    same recreate-the-table pattern as 0004/0006) since grading is
    server-side against a small answer set; unbounded attempts would let
    someone brute-force correct answers by repeated submission.
- **Phase 7 (learning system UI), concrete decisions so far** — scoping
  and Slice 1 (catalog + content pipeline) done; see WORKLOG's "Phase 7
  scoping" and "Course content moves to R2 + auth gate" entries for the
  full plans:
  - New endpoint: `GET /v1/lessons/:id` (session-gated, like the rest of
    the catalog) — the one gap found during scoping. `getCourseLessonsV1`
    (`GET /v1/courses/:slug/lessons`) only ever returns lesson metadata;
    the lesson detail page needs the type-specific payload too. Returns
    lesson metadata plus `exercise`
    (prompt/language/starterCode/solutionNotes, only when
    `type = 'exercise'`) or `quiz` (`questions[].answers[]`, only when
    `type = 'quiz'`) — both `null` otherwise. **`quiz.questions[].answers`
    never includes `is_correct`** — that stays secret until a real
    `POST /v1/lessons/:id/attempt`, same as the grading endpoint already
    guarantees. Per-user completion state still isn't in this response —
    the frontend cross-references `GET /v1/me/progress` separately.
  - The `exercise` lesson type is **informational only** in this phase —
    prompt, starter code, a solution-notes reveal, no submission or
    grading (confirmed with the user during scoping). There's no
    `exercise_attempts` table and no code-execution sandbox anywhere in
    this stack; real grading is the deferred End-Phase's ("Exercises")
    job, not this one's — see the Roadmap above for the full plan.
  - **`/courses/*` requires a session, same tier as `/resources`,
    `/people`** — `getCoursesV1`/`getCourseV1`/
    `getCourseLessonsV1`/`getLessonV1` all gate on `getSessionUser()`
    now (reversed from Slice 1's original "catalog is public" call, per
    explicit user correction). The three `/courses/*` frontend pages are
    therefore client-gated-fetch, same pattern as `src/app/library/page.tsx`
    — not server-rendered, since the Next.js server can never see the
    session cookie (host-only on `api.lowlevelnotes.com`). `getCourses`/
    `getCourse`/`getCourseLessons`/`getLesson` live in
    `src/lib/authClient.ts` now, not `src/lib/api.ts` — there's no more
    server-rendering path that needs the `x-internal-key` version.
  - **Lesson content never touches git.** Reversed from Slice 1's
    original "matches the site's git/PR contribution model" call — the
    user was explicit that content must not end up on GitHub. Content
    lives in R2 (`lowlevelnotes-assets`), `content_path` doubling as the
    R2 key. Written server-side via `PUT /v1/instructor/lessons/:id/
    content` (part of the instructor course builder — see below), never
    a local editing folder or push script. Reading a lesson's content
    bytes reuses the existing gated `GET /v1/library/assets/:key`
    endpoint (`getLibraryAssetV1`) as-is — no separate read endpoint for
    content, since `content_path` values are already valid keys into
    that same bucket. Accepted tradeoff: shares that endpoint's
    download-per-hour rate limit with real library downloads — originally
    60/hour, raised to 300/hour once real multi-lesson courses existed
    and both normal study sessions and the admin review UI (which loads
    every lesson's content on page load) were tripping it on ordinary
    use, not abuse.
  - Because content now requires an authenticated browser fetch (not a
    server-side file read), rendering moved to two new same-origin
    Route Handlers — `POST /api/render/markdown` and
    `POST /api/render/code` (`src/app/api/render/*/route.ts`, ~500KB
    body cap each). The browser fetches raw, already-authenticated
    content client-side via `authClient.ts`'s `getLessonContent()`, then
    POSTs it to these routes, which run the same server-side pipeline
    Slice 1 originally called directly from a Server Component
    (`renderLessonMarkdown()` for articles, `shiki`'s `codeToHtml()` for
    exercise starter code — replacing the `<CodeBlock>` Server Component
    on this page specifically; `CodeBlock.tsx` itself is untouched and
    still used on the homepage). Keeps the heavy deps (`shiki`,
    `rehype-pretty-code`, the `unified` pipeline) server-side only, no
    browser bundle-size hit.
  - Markdown → HTML via a `unified`/`remark`/`rehype` pipeline
    (`renderLessonMarkdown()` in `src/lib/markdown.ts`), with
    `rehype-pretty-code` for fenced code blocks — it uses `shiki`
    internally, so the theme object was pulled out of `CodeBlock.tsx`
    into `src/lib/shikiTheme.ts` and shared. `rehype-pretty-code@0.14`'s
    published types don't line up with `unified@11`'s `Plugin` generics
    (an upstream typing gap between the two packages, not a real type
    error) — silenced with a scoped `@ts-expect-error` right at that
    `.use()` call, not a broader suppression. Also runs
    `remark-frontmatter` — the real draft notes seeded as test courses
    (below) carry Pandoc-style YAML frontmatter (title/author/PDF-export
    settings); without stripping it, remark renders the `---` fences as
    thematic breaks and the YAML as a stray paragraph. And a custom
    rehype step (`rehypeRewriteImages`, same file) rewrites relative
    `<img src>` references to absolute gated URLs, resolved against the
    lesson's own `content_path` directory — verified this actually
    matches how the real drafts reference their images (sitting
    alongside the `.md` file, e.g. `drafts/Networks/p2p.png` referenced
    as just `p2p.png`), not assumed. Works cookie-wise with no extra
    plumbing: `api.lowlevelnotes.com` and `lowlevelnotes.com` share a
    registrable domain, so the `SameSite=Strict` session cookie still
    attaches to this same-site (cross-subdomain) `<img>` request.
  - Two courses were originally seeded from real existing content instead
    of more hand-written placeholders: `postgresql` (→
    `drafts/Data/postgresql.md`, text-only) and `networks` (→
    `drafts/Networks/networks.md`, ~50 embedded images) — both objects
    already sat in R2 under `drafts/` from before this pipeline existed.
    This proved the pipeline against real content without taking on a
    full curriculum build. Both were later deleted, alongside the
    original placeholder `computer-architecture` seed course, once judged
    incorrect/not real curriculum — deletion goes through
    `deleteCourseStaffV1` (see "Instructor course builder" below), which
    doesn't remove the underlying R2 objects, so `drafts/Data/
    postgresql.md` and `drafts/Networks/networks.md` still exist in the
    bucket, just unreferenced by any course row now. The full curriculum
    build did eventually happen, outside the instructor UI: three
    complete courses — **Programming Foundations**, **C-Style C++**, and
    a C# course — authored from the site owner's own archived notes and a
    779-page book, written directly via D1 SQL + R2 object puts rather
    than through `/courses/builder`, but reusing that same schema
    shape and `content_path` convention. All three have since been
    submitted, reviewed, and published.
  - Added `courses` to `Header.tsx`'s nav (`src/components/Header.tsx`).
    Cuts against the recent deliberate nav simplification (commit
    `27fd9d0`, "four topic links plus a single account slot") — judged
    acceptable since courses are the platform's core content, same tier
    as `library`, not an account-scoped action.
  - **Slice 2 (enroll + mark-complete)**: originally pure frontend
    wiring against the already-live enroll/complete/progress endpoints
    from the deferred-Phase-2-endpoints work — `enrollCourse`/
    `completeLesson`/`getMyProgress` in `authClient.ts`. Enrollment
    stays explicit everywhere — no page auto-enrolls, matching the
    Worker's own no-side-effect design. New
    `src/components/ActionButton.tsx` (filled-orange, loading state) is
    a sibling to `AuthSubmitButton`, not a reuse of it — that component
    is `type="submit"`/`w-full`, purpose-built for the single-form auth
    pages; Enroll/Mark-complete aren't form submissions. Once completed,
    "Mark complete" becomes a static "✓ Completed" label — there's no
    un-complete endpoint. Progress is fetched per-page (no global
    cache/store in this app) and mark-complete updates local state
    optimistically rather than refetching.
  - **Slice 2 follow-up, from user feedback on the above**:
    - **Lesson content is now gated behind enrollment at the page
      level** (a UX call, not a security one — the API itself still
      only requires a session to read, not enrollment, unchanged from
      Slice 1; enrollment still only gates the *write* actions
      server-side). A `LockedLesson` view (module/title/type badge +
      an Enroll button) replaces the old bottom-of-page "enroll to
      track progress" nag, which the user found "feels weird" —
      content just doesn't render at all pre-enrollment now, title and
      type are already visible from the course page's list.
    - **"Next lesson" nav** — computed client-side from the course's
      full lesson list (`modulePosition` then `position`, same sort as
      the course page's module grouping), shown next to the completion
      control for every enrolled lesson type including `quiz`, since
      it's navigation, not gated on completion. Last lesson → "Back to
      course" instead.
    - **Real bug fixed**: `QuizPlaceholder` said "Enroll in this course
      to take it" even for enrolled users — it never received
      `isEnrolled` in the first place, the copy was unconditional. Once
      page-level gating (above) ships, that branch is unreachable
      anyway (an unenrolled visitor never reaches `QuizPlaceholder` at
      all) — simplified to an unconditional "quiz-taking isn't built
      yet" message rather than re-threading enrollment state through.
    - **Unenroll**: `enrollments.status` already had an unused
      `'dropped'` value in its Phase 1 CHECK constraint — used it
      rather than deleting rows, so `lesson_progress` history (no FK
      between the two tables) survives an unenroll/re-enroll cycle.
      New `DELETE /v1/courses/:slug/enroll` (`unenrollCourseV1`).
      This required also fixing `enrollCourseV1`, previously a bare
      `INSERT` that would 409 forever on re-enrolling after a drop
      (the dropped row still exists, same `UNIQUE(user_id, course_id)`)
      — now an `INSERT ... ON CONFLICT(user_id, course_id) DO UPDATE
      SET status='active', ... WHERE enrollments.status = 'dropped'`
      upsert; `meta.changes === 0` after means the conflicting row
      wasn't `'dropped'` (already active/completed) → still 409.
      Uncovered two more real bugs while at it, both in queries that
      predate `'dropped'` ever being written and so never needed a
      status filter before: `getMyStatisticsV1`'s `coursesEnrolled`
      and `getMyProgressV1`'s `enrollments` list both did
      `WHERE user_id = ?` with no status scoping — either would have
      kept counting/listing a dropped course as still enrolled. Both
      now scope to `status IN ('active', 'completed')`. All three
      fixes verified locally (`wrangler dev` + the local test D1
      harness) before deploy — unenroll → re-enroll → confirm
      `lesson_progress` rows survive, confirm `coursesEnrolled`/
      `/me/progress` correctly exclude the dropped state in between.
    - **`/account/courses`** (new page) — every role gets an
      unconditional "Enrolled courses" `AccountLinkCard` on `/account`
      (unlike Contribute/Admin, which stay role-conditional). Shows a
      `getMyStatistics()` stat-tile row plus one card per enrollment
      with its progress count, a continue link, and the same Unenroll
      action as the course page (duplicated, not extracted into a
      shared hook — matches this app's existing low-abstraction style).
  - **Slice 3 (quiz-taking UI)**: `QuizBody` (inline in
    `src/app/courses/[course]/[lesson]/page.tsx`, alongside
    `ArticleBody`/`VideoBody`/`ExerciseBody`) replaces the old
    `QuizPlaceholder`. Wired against the already-live
    `POST /v1/lessons/:id/attempt` (new `attemptQuiz()` in
    `authClient.ts`) — every question answered exactly once via native
    radio inputs (custom-styled, square indicators, never circular —
    matches the no-rounding design contract), submitted as one
    `{ answers: [{questionId, answerId}] }` payload. The response's
    `correctAnswerId` (always revealed per question, win or lose) drives
    the post-submit coloring — green/red reusing the site's existing
    success/error tokens (`#3FB950`/`#F85149`), no new colors invented.
    Any successful attempt (any score) marks the lesson complete
    server-side, so `QuizBody` calls `onCompleted()` itself rather than
    using the generic `CompletionControl` (still excluded for quiz
    lessons, unchanged). Retakes are unlimited server-side (rate-limited
    20/hour, not "once ever"), so the form stays fully interactive after
    grading via a "Retake quiz" action that just clears local state.
  - **Content authoring is exclusively through the instructor UI now**
    (`/courses/builder`, see "Instructor course builder" just below).
    A YAML/frontmatter-based scriptable pipeline (`scripts/
    sync-content.mjs` + `scripts/push-content.mjs`, a `content/` local
    editing folder) was built and fully verified earlier the same day the
    instructor UI shipped, then deliberately removed once it did — the
    user's direct call: real instructors were never going to hand-author
    YAML, so a second content-authoring path with no users wasn't worth
    the maintenance surface. Removed: both scripts, the `js-yaml`
    devDependency, the `content:push`/`content:sync` npm scripts, the
    `content/` gitignore entry. See WORKLOG's "Phase 7 content-prep"
    entry if the format/script design is ever needed for reference.
  - **Instructor course builder** — a real write API plus a browser UI
    (`/courses/builder`, `/courses/builder/[id]`) so an instructor
    can build a course without repo/Cloudflare access at all, distinct
    from the YAML pipeline above (that stays as a separate, faster
    bulk-import path for the site owner specifically). `/courses/builder`
    was originally `/instructor/courses`, renamed to sit next to the
    public `/courses` catalog it authors content for — it's a static
    sibling of the dynamic `/courses/[course]` route, and Next.js
    resolves the literal `builder` segment before falling through to
    `[course]`, so there's no routing conflict; the one thing to avoid is
    ever slugging a real course exactly `builder` (it would become
    unreachable, shadowed by this route) — low risk, since slugs come
    from `slugify()` on instructor-authored titles, not open user input.
    See WORKLOG's "Instructor course builder" entry for the full
    design/verification; key decisions:
    - **Ownership**: `courses.created_by` — an instructor can only edit
      courses they created; administrators bypass ownership the same way
      they bypass every other staff-tier restriction. User's explicit
      choice over a flat role gate (the pattern used everywhere else in
      this app, e.g. any contributor can submit any resource).
    - **Publishing**: mirrors the existing resource-request/role-request
      review pattern — an instructor submits a finished course for
      review; an admin approves (goes live) or rejects (kicked back to
      draft with a reason). User's explicit choice over self-publish.
    - **`courses.status` is still only ever `'draft'`/`'published'` at
      the DB level** — "pending review" is `status='draft'` plus a new
      `submitted_for_review_at` timestamp column, not a third CHECK
      value. This was a real, load-bearing finding, not a style choice:
      widening the CHECK would need the usual recreate-the-table pattern
      (0007/0008/0009's precedent), but testing that locally found DROP
      TABLE on `courses` cascade-deletes `modules`/`lessons`/`exercises`/
      `questions`/`answers` in this D1 setup (`modules.course_id
      REFERENCES courses(id) ON DELETE CASCADE`) — **not** standard
      SQLite behavior (DROP TABLE isn't supposed to fire FK actions at
      all), but reproducible here even via rename-away-then-drop, since
      D1 also rewrites the child's FK reference on rename. Confirmed in
      isolation with a throwaway parent/child pair before touching the
      real schema. 0007/0008's own "recreate the table" precedent never
      actually tested this failure mode — both only ever used `ON DELETE
      SET NULL`, never `CASCADE`. **Any future migration that recreates a
      table with `ON DELETE CASCADE` children must account for this** —
      either avoid the recreate (prefer `ADD COLUMN`/a marker column, as
      done here) or explicitly test locally first the way this was.
    - New endpoints, all under `/v1/instructor/*` (instructor+admin,
      ownership-checked) and `/v1/staff/courses/*` (admin-only, review):
      create/read/update courses and modules, create/update/delete
      lessons (combined body — type-specific fields alongside title in
      one call), a dedicated `PUT .../lessons/:id/content` for article
      markdown (writes straight to R2 at a derived `content_path`,
      reusing `createResourceRequestV1`'s proven `env.ASSETS.put`
      mechanism, text body instead of multipart), a matching
      `POST .../lessons/:id/images` for article images (multipart, same
      `env.ASSETS.put` mechanism, returns the relative filename to
      reference from markdown), `POST .../submit-for-review`,
      `GET /v1/staff/courses?status=`, `PUT /v1/staff/courses/:id/review`,
      `DELETE /v1/staff/courses/:id`.
      Quiz questions/answers use a delete-and-reinsert-by-lesson approach
      keyed on `(lesson_id, position)` — simpler than diffing individual
      rows, and safe because `quiz_attempts` only stores an aggregate
      score/total per attempt, never a per-question/per-answer FK. Shares
      one rate-limit event type (`course_content_write`, 60/hour/user) across
      every mutating endpoint, added to `auth_events`' CHECK enum in the
      same migration — sized up from `resource_request_submit`'s 10/hour
      since building a course is legitimately many small saves.
    - Frontend: `/courses/builder` (list + create), `/courses/builder/
      [id]` (the builder — course details, modules, per-lesson
      inline editors including a quiz question/answer builder that's the
      authoring inverse of `QuizBody`), a new `PendingCoursesSection` in
      `AdminPanel.tsx` (mirrors `RoleRequestsSection`/
      `ResourceRequestsSection` exactly), and a role-gated "Build a
      course" card on `/account`. The article editor also has an "Insert
      image" control (a hidden `<input type="file">` behind a styled
      label, only png/jpg/jpeg/gif/svg, 10MB cap) that inserts
      `![](filename)` at the cursor — module-scoped upload
      (`POST /v1/instructor/modules/:id/images`, not lesson-scoped),
      since the R2 path only depends on course+module slugs, so an image
      can be uploaded before a brand-new article lesson is even saved.
    - **Ownership gap, fixed**: `GET /v1/library/assets/:key` (reused for
      the article-content preview/edit loop) was session-gated but not
      ownership-gated — any authenticated user who knew a draft course's
      exact `content_path` could read that draft's article text before
      it's published. `getLibraryAssetV1` now looks up the course by the
      slug segment of any `courses/<slug>/...` key and, if that course
      isn't `published`, requires `courseOwnedBy` (creator or
      administrator) before streaming the object — 403 otherwise. Any
      other key (ordinary library assets, the two `drafts/`-keyed seed
      courses, or a published course's content) keeps the original
      session-only gate; no behavior change for those. Verified live: the
      owning instructor and an admin both get the draft article, a third
      logged-in user gets 403 on the identical key, and the same key
      becomes readable by anyone once the course is approved.
  - **Review/approval moved to `/account/approvals/*`, admin-only, plus
    course deletion** — direct user feedback: `/account/staff`'s old
    `PendingCoursesSection`
    let an admin approve or reject a course without ever seeing a single
    lesson ("you just sort of have to trust the person"), and there was no
    way to remove a course in any state. Fixed by:
    - `GET /v1/instructor/courses/:id` needed no change — `courseOwnedBy`
      already bypasses ownership for administrators, so it already
      returns the full modules → lessons → quiz-answers-with-`correct`
      structure for *any* course, not just the caller's own. The new
      review page just calls it.
    - `GET /v1/staff/courses/pending` generalized into `GET
      /v1/staff/courses?status=pending|published|draft` (same `?status=`
      convention as `/v1/staff/role-requests` and `/v1/staff/
      resource-requests`), so admins can see and act on a course in any
      state, not just ones awaiting review. New `DELETE
      /v1/staff/courses/:id` (admin-only, any status) hard-deletes the
      row; confirmed live this cascades cleanly through `modules →
      lessons → exercises/questions/answers` and
      `enrollments`/`lesson_progress`/`quiz_attempts` via the existing
      `ON DELETE CASCADE` foreign keys — a real `DELETE`, unlike the
      `DROP TABLE`-during-migration case above, so none of that surprise
      cascade behavior applies. Doesn't clean up the course's R2 objects
      (markdown/images) — accepted orphaned-storage tradeoff, not a
      blocker. Logs `delete_course` to the audit log same as
      approve/reject (`staff_audit_log.action` has no CHECK constraint,
      so no migration needed for any of this).
    - Confirmed with the user: deletion is admin-only (not the owning
      instructor) and works on a course in any status, not just
      pending/rejected ones.
    - Frontend: `RoleRequestsSection`/`ResourceRequestsSection`/
      `PendingCoursesSection` moved out of `AdminPanel.tsx` verbatim into
      their own components (`src/components/admin/{RoleRequestsPanel,
      ResourceRequestsPanel,CourseRequestsPanel}.tsx`) behind new
      admin-gated pages at `/account/approvals/role-requests`,
      `/account/approvals/resource-requests`, `/account/approvals/
      course-requests` (plus an `/account/approvals` landing page), same
      guard pattern as `src/app/account/staff/page.tsx`.
      `/account/staff` (`AdminPanel.tsx`) now holds only Users, Blocked
      IPs, and the Activity log. `/account/approvals/course-requests`
      lists courses by
      status (tabs, same `StatusFilter` component generalized with a
      type parameter since courses don't share the
      pending/approved/rejected union) with each row linking to
      `/account/approvals/course-requests/[id]` instead of one-click approve/
      reject — that detail page (`CourseReviewPanel.tsx`) is what
      actually renders the content: `ArticleBody`/`VideoBody`/
      `ExerciseBody` (moved out of the lesson page into
      `src/components/lesson/LessonContentViews.tsx` so both it and the
      student-facing lesson page reuse the same markdown/shiki rendering
      pipeline, no duplication) per lesson type, plus a small read-only
      `QuizReview` for quiz lessons showing every answer with `correct`
      already flagged. Approve/Reject only show for `pending_review`;
      Delete shows for any status.
- **Phase 9 (achievements), concrete decisions:**
  - New migration `0015_achievements.sql`: `achievements` (slug, title,
    description, `criteria_type` CHECK-enum, nullable `criteria_value`,
    position) and `user_achievements` (`user_id`/`achievement_id`,
    `UNIQUE(user_id, achievement_id)`, `unlocked_at`). Seeded 7 starter
    achievements matching AGENTS.md's own "Learning and motivation model"
    examples (first lesson, first quiz, a seven-day streak) plus a few
    obvious additions — a perfect quiz score, 10/50 lessons completed, and
    a generic "finish your first course" (not tied to one specific course
    slug/title, since courses are now dynamically authored and can be
    deleted).
  - No new progress tracking — criteria are checked purely against
    `enrollments`/`lesson_progress`/`quiz_attempts`, which Phase 7 already
    populates. `evaluateAchievementsV1(env, userId)` computes the same
    aggregate stats `getMyStatisticsV1` already computes (lessons
    completed, quiz attempts, courses completed) plus one new check: the
    longest-ever run of consecutive calendar days with a completed
    lesson/quiz attempt, walked in JS over `date()`-distinct timestamps
    rather than a SQLite gaps-and-islands window-function query — this
    app's real data volume (two users) doesn't warrant that complexity.
    It's a lifetime-longest streak, not a "must still be active today"
    one, since an achievement only ever needs to unlock once.
  - Evaluated fire-and-forget right after the two places that can move
    those numbers — `completeLessonV1` and `attemptQuizV1`, both right
    after their existing `maybeCompleteEnrollmentV1` call — same pattern
    as `logAuthEvent` elsewhere in this file. No dedicated
    re-evaluation/backfill endpoint; a user's next qualifying action
    re-runs the check for everything still locked.
  - `GET /v1/me/achievements` (session-gated, same tier as `/v1/me/
    progress`/`/v1/me/statistics`) returns every achievement definition
    joined against the caller's `user_achievements` in one call, so the
    frontend can render locked/unlocked state without a second request.
  - Frontend: `getMyAchievements()` in `authClient.ts`; a new
    "Achievements" grid on `/account/courses` (not a new route — that
    page is already Phase 7's progress-surfacing home), each tile
    locked/unlocked with its unlock date on hover.
  - Verified end-to-end against production with a throwaway QA account
    (created directly in D1, never a fabricated session for a real user
    identity): completed lessons and quiz attempts through the real
    `/v1/lessons/:id/complete` and `/attempt` endpoints, confirmed each
    achievement unlocked at the right threshold (including the streak,
    tested by backdating `lesson_progress.completed_at` across 7
    consecutive dates and re-triggering evaluation via an unrelated
    lesson — completing an *already-backdated* lesson resets its own
    `completed_at` to now, a real gotcha hit during this verification),
    then deleted the QA account (cascades).
- **Course metadata, multi-author, and group-restricted visibility,
  concrete decisions** — migration `0017_course_groups_metadata.sql`:
  `courses` gains `icon_path`, `difficulty` (nullable enum), `visibility`
  (`'public'`/`'restricted'`, default public), `view_count`; new tables
  `course_authors` (co-authors beyond `created_by`, which stays the
  primary owner and is never duplicated in here), `groups`/`group_members`
  (reusable rosters an instructor builds once and reuses across courses —
  confirmed with the user over a per-course allowlist), and
  `course_group_access` (which groups a restricted course is open to).
  - **Co-authors get full edit rights**, same as the creator — every
    ownership gate on the instructor-authoring surface (`courseOwnedBy()`
    plus a repeated raw inline check across module/lesson create/update/
    delete and image upload, 12 call sites total) now goes through
    `isCourseAuthorV1(env, courseId, createdBy, sessionUser)` instead,
    which adds a `course_authors` membership check on top of the
    creator-or-admin check `courseOwnedBy` already did. Managing the
    authors list itself (`POST`/`DELETE .../authors`) stays owner-or-admin
    only, deliberately narrower — otherwise a co-author could remove the
    original owner or add someone uninvited. A co-author must already
    hold the `instructor` or `administrator` role — every course-editing
    endpoint gates on that role *before* it ever checks `course_authors`,
    so a plain student added as "co-author" would be listed but unable to
    use any of the rights it's supposed to grant; caught during this
    session's own verification, not by the user.
  - **Groups are instructor-managed rosters, not self-service** — an
    instructor (or admin) adds a student by email directly
    (`POST .../groups/:id/members`), no invite code/join flow, confirmed
    with the user. A group's owner (or an admin) is the only one who can
    rename/delete it or edit its roster (`groupOwnedBy`, same shape as
    `courseOwnedBy`). `PUT .../courses/:id/groups` (which groups a
    restricted course is open to) only accepts groups the caller actually
    owns (or, for an admin, any group) — otherwise an instructor could
    restrict their course to a group they don't control.
  - **A restricted course is fully invisible to non-members, not just
    locked** — confirmed with the user over a "visible but can't enroll"
    UX. `getCoursesV1`, `getCourseV1`, `getCourseLessonsV1`, `getLessonV1`,
    and `enrollCourseV1` all gained the same additional WHERE clause
    (`visibilityClause()`, written once and parameterized by whatever the
    courses table/JOIN alias is in that query, rather than five
    slightly-different copies): visible if `visibility = 'public'` OR the
    caller is an author OR an administrator OR a member of a group with
    `course_group_access` to it. A non-member gets the exact same 404
    "Course not found"/"Lesson not found" a nonexistent slug or id would
    — verified live that this holds at every layer (course detail, lesson
    list, guessing a lesson id directly, enroll), not just the catalog
    listing.
  - **Views count on the detail fetch only** (`getCourseV1`), not the
    catalog list — otherwise browsing `/courses` would inflate every
    course's count just by rendering the list. Enrolled/completed counts
    are plain live `COUNT(*)` queries against `enrollments`, no new
    schema. All three are instructor/admin-facing only
    (`mapCourseForInstructor`), never part of the public `mapCourse` shape.
  - **Authors resolved via one correlated subquery per course**
    (`authorsJsonSelect()` — a `UNION` of `created_by` and
    `course_authors.user_id` joined to `users`, built into a JSON array
    with `json_group_array`/`json_object`), not an N+1 lookup per course
    in list endpoints. The frontend never assumes array order reflects
    who owns the course (`UNION` doesn't guarantee it) — `createdBy` is
    its own explicit field on the instructor-facing shape specifically so
    the "who's the owner" UI decision (e.g. hiding the remove button for
    them) doesn't depend on it; a real ordering bug caught during this
    session's own frontend work, not shipped.
  - Course icon upload (`POST .../courses/:id/icon`) and avatar upload
    (Phase 9's `POST /v1/me/avatar`, above) share the same shape:
    deterministic key (`courses/<slug>/icon.<ext>`), old-key `env.ASSETS
    .delete()` on re-upload with a different extension, read back through
    the existing gated `GET /v1/library/assets/:key` (the `avatars/`/
    `courses/` prefixes need no new exemption there — `courses/` was
    already ownership-gated by status, and this doesn't change that logic
    for published courses).
  - Verified end-to-end against production with four throwaway QA
    accounts (never a real session): a co-author added to a course could
    immediately create modules/lessons in it and it showed up in their
    own course list; a student added to a group could see, enroll in, and
    complete a lesson in a course restricted to that group; a fourth,
    unrelated account got 404s (not 403s) on the course, its lessons, and
    enroll, and the course was absent from that account's own catalog
    listing entirely; icon upload/re-upload-with-different-extension
    cleanup confirmed the same way avatar upload was; group deletion
    confirmed to cascade `course_group_access` cleanly. All QA
    accounts/courses/groups deleted after.
- **"Administrator" renamed to "Staff" everywhere, including the database
  (2026-08-29, `worker/migrations/0019_administrator_to_staff.sql`).**
  This was initially shipped as a display-only rename (`roleLabel()` in
  `src/lib/authClient.ts` translating the stored value at render time)
  specifically because of the confirmed D1 bug where `DROP TABLE`
  cascade-deletes rows in any table referencing it `ON DELETE CASCADE` —
  see `0014_instructor_course_authoring.sql`'s comment for the original
  finding, and `0019_administrator_to_staff.sql`'s own comment for the
  corrected understanding of that bug: a rename-then-drop of just the
  parent isn't enough (0014's test only did that and still reproduced
  the bug); every child table's FK has to be repointed to the new parent
  *before* the old one is dropped, or it cascades the exact same way.
  Once that fuller sequence was worked out, the real migration was run
  directly against production: `users.role`'s CHECK constraint now says `'staff'`, not
  `'administrator'`, full stop — no display-layer translation left
  anywhere. 13 tables needed rebuilding, not just `users` — `groups` also
  has an `ON DELETE CASCADE` reference to `users`, and is itself
  referenced the same way by `group_members`/`course_group_access`, so
  the dependency graph was two levels deep. Verified via row-count checks
  at every stage (all 13 tables matched their pre-migration count exactly,
  both after the leaf-table rebuilds and again after the final `DROP
  TABLE users_old`/`groups_old` — the step that would have reproduced the
  bug if the sequence were wrong) and a live end-to-end test (a throwaway
  staff account correctly authorized against staff-only endpoints,
  `GET /v1/staff/users` showing the real owner account's `role` as
  `"staff"` through the actual API). A Time Travel bookmark and a full
  `wrangler d1 export` were both taken immediately before starting, as a
  restore path that was never needed.
  Every backend permission check (`role === "staff"`, `requireRole`,
  `courseOwnedBy`, `groupOwnedBy`, `visibilityClause`, `notifyAdminsV1`'s
  `WHERE role = 'staff'`, ~69 occurrences total) was updated to compare
  against the new real value — same call sites as before, just the
  literal changed. `roleLabel()` is now just a plain capitalizer (no
  special case needed — `'staff'` already capitalizes correctly), kept as
  the one shared place every UI surface gets a role label from rather
  than each page rendering the raw string or keeping its own copy (a few
  pages had done exactly that already — a hardcoded `<option>{r}
  </option>` in `AdminPanel.tsx`'s two role `<select>`s, and a duplicated
  `ROLE_LABEL` map on the public profile page that had drifted to still
  say "Administrator" — both call the shared helper instead). Also caught
  in the same earlier pass: several `/account/approvals/*` pages' *loaded*
  state rendered a hardcoded "Administration" eyebrow in a hand-rolled
  `<main>` layout, entirely separate from the `AuthPageShell` "Staff"
  eyebrow already fixed on those same pages' *loading* state — the two
  states are genuinely different render paths, and only one had been
  touched at the time.
- Session responses (`GET /v1/auth/session`, `POST /v1/auth/login`, and
  `getSessionUser()` itself) now carry `avatarUrl`, so `Header.tsx` can
  show a small picture next to a logged-in user's own name in the nav —
  the one place a user's name appears fleet-wide, not just on `/account`.
- **Full platform security review (2026-08-29)** — see WORKLOG's "Full
  platform security review" entry for the complete findings list,
  including everything checked and verified clean (SQL injection
  surface, XSS in the markdown pipeline, CSRF, password/token handling,
  file-serving content-type spoofing, CORS, `npm audit`). Four real
  findings were fixed the same session:
  - A `SECURITY_HEADERS` constant in `worker/index.js`
    (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
    `Content-Security-Policy: frame-ancestors 'none'`,
    `Referrer-Policy: strict-origin-when-cross-origin`) merged into
    every response path (`json()`, `svgResponse()`, both asset-streaming
    responses), plus an equivalent `headers()` block in `next.config.ts`.
    Deliberately just `frame-ancestors` for CSP — a real
    resource-loading policy (script/style/img/connect-src) needs actual
    browser testing before shipping (Turnstile's iframe, external
    fonts), which isn't available in this environment; that stays a
    separate, later effort. **Any new response-construction path added
    to the Worker should spread `SECURITY_HEADERS` in too**, the same
    way `corsHeaders()` already gets spread everywhere.
  - `addCourseAuthorV1`/`addGroupMemberV1` no longer distinguish "no
    such user" from "wrong role" in their error response — both are
    exactly the discipline `registerV1`/`forgotPasswordV1` already
    followed; these two were the one place that hadn't.
  - Neither avatars, course icons, nor lesson images accept `.svg`
    anymore (`AVATAR_EXTENSIONS`/`LESSON_IMAGE_EXTENSIONS`, both in
    `worker/index.js`) — an `<img>`-embedded SVG can't run script in a
    modern browser, but a direct navigation to the raw asset URL is a
    top-level document load, where it can.
  - Every mutation under `/v1/instructor/groups/*` and the course
    author/group-access endpoints now shares the existing
    `course_content_write` rate limit (`checkCourseWriteRateLimit`),
    same as the rest of the instructor-authoring surface. **For
    `addCourseAuthorV1`/`addGroupMemberV1` specifically, the rate-limit
    check runs and gets logged *before* the email lookup, unconditionally
    — not just before the eventual write.** Any endpoint where the
    lookup/validation step itself is the sensitive operation (not just
    the write that might follow it) needs this same ordering, or a
    limit that only counts successes leaves every failed probe — the
    actual thing being protected against — completely unthrottled. This
    was caught as a live bug in the fix itself, not designed in
    correctly the first time; see the WORKLOG entry for how it was
    found and re-verified.
- **Changelog: no fetch-level cache, and now posts live to Discord** —
  `src/lib/api.ts`'s `apiFetch()` (the changelog page's only data
  source) no longer uses `next: { revalidate: 60 }` — that page is
  already `export const dynamic = 'force-dynamic'`, so the cache bought
  nothing and once left a real published entry invisible on the live
  site for almost a day (see WORKLOG's "Changelog fetch stopped caching"
  entry for the full diagnosis). Separately, new changelog entries now
  post automatically to a Discord webhook — piggybacked on the existing
  5-minute cron (`scheduled()` in `worker/index.js`) rather than a
  publish-time hook, since changelog entries are written straight to D1
  and there's no endpoint to hook into. A `discord_posted_at` column on
  `changelog` (migration `0018`) tracks what's already gone out; **any
  future direct-SQL changelog insert doesn't need to set this column —
  leaving it `NULL` is exactly what makes a new entry eligible to post**.
  The webhook URL lives only as the `DISCORD_WEBHOOK_URL` Worker secret,
  never in any file; `postNewChangelogEntriesToDiscord()` no-ops
  entirely if it's unset. See WORKLOG's "Live Discord posting" entry for
  the backfill reasoning (why the migration didn't dump the entire
  changelog history into Discord on its first run) and how both the
  webhook itself and the real cron-driven pipeline were verified.
- **Phase 3 (authentication), concrete decisions** — see WORKLOG's "Phase
  3" entry for the full security reasoning:
  - Password hashing: PBKDF2-HMAC-SHA256, 100,000 iterations, via
    `crypto.subtle` — not a tuning choice, `workerd` hard-caps PBKDF2 at
    100,000 iterations regardless of plan (below OWASP's usual
    600,000-iteration recommendation, but the actual platform ceiling;
    Workers has no Node `crypto`, so no native bcrypt/argon2 either).
    Stored as a self-describing string in `users.password_hash`
    (`pbkdf2-sha256$<iterations>$<salt>$<hash>`, all base64) so a future
    algorithm change never needs a migration.
  - Sessions and single-use tokens live in D1 (`sessions`, `auth_tokens`,
    `auth_events` — `worker/migrations/0003_phase3_authentication.sql`),
    not KV/Durable Objects, since no such binding exists and D1 already
    holds `users`. Every token (session, email-verification,
    password-reset) is SHA-256 hashed before storage, same principle as
    passwords — the raw value is shown to the client exactly once.
  - Auth works via **both** `Authorization: Bearer <token>` (mobile/CLI)
    and an `HttpOnly`/`Secure`/`SameSite=Strict` cookie scoped to
    `api.lowlevelnotes.com` (a future browser client) — no frontend
    consumes either yet. Sessions are a flat 30-day expiry, no "remember
    me," no refresh-token rotation (deliberately excluded — see WORKLOG).
  - Email delivery is via **Resend** (`RESEND_API_KEY`, set as a Worker
    secret via `wrangler secret put`, never in `wrangler.toml` or
    `.env.local`). When unset, registration/resend-verification echo the
    link in the API response (labeled, for local testing); forgot-password
    **never** does this in any configuration state — echoing a
    password-reset link would let anyone read a working account-takeover
    token by just POSTing a known email, which defeats that endpoint's
    entire enumeration-safety property. It only ever logs server-side.
  - Full endpoint list: `POST /v1/auth/register`, `POST .../login`,
    `POST .../logout`, `GET .../session`, `PUT .../change-password`,
    `POST .../forgot-password`, `POST .../reset-password`,
    `GET .../verify-email`, `POST .../resend-verification`.
- **`api.lowlevelnotes.com`'s WAF blocks generic scripted HTTP clients**
  (bare `curl`, Node's own `fetch` — sends `User-Agent: node`) on almost
  every path except `/health`, regardless of the path being otherwise
  public. Discovered building the auth frontend: a Next.js Server
  Component's server-side `fetch()` to the Worker gets a 403 from
  Cloudflare, both locally and once deployed (Vercel's Node runtime hits
  the same block) — this is not a local-only artifact like the earlier
  bot-fight/Referer issue. Two ways through: a genuine browser's fetch
  (what every auth page now uses, client-side, exactly like
  `authClient.ts`), or the `x-internal-key` WAF-bypass header (what
  `src/lib/api.ts`'s server-only `apiFetch()` uses — appropriate only for
  genuinely internal, non-public calls, not for something like
  verify-email where the token itself is the public credential). Any
  future page that needs to call the Worker server-side must account for
  this rather than assuming a plain `fetch()` will work.
- **Every early-return response in `fetch()` must carry `corsHeaders()`,
  not just the ones going through `json()`.** The generic OPTIONS
  preflight handler sits *before* the rate limiter and the
  maintenance-mode check specifically so a preflight is never itself
  rate-limited or blocked — it's a permission question, not a real
  request. But the rate limiter's `429` and the maintenance check's
  `503` are real responses to real (non-preflight) requests, and both
  still need `corsHeaders()` merged in, or a legitimately-blocked
  browser request surfaces as an opaque "could not reach the server"
  instead of a readable error. Found the hard way: a page firing several
  parallel authenticated calls on mount (four sections × their own
  preflight, e.g.) can trip the 30-req/60s per-IP limiter during normal
  development, and every one of the resulting bare 429s broke CORS for
  whatever request came after it — including the session check itself,
  which read to the frontend as being logged out. Any new early-return
  path added to `fetch()` before the route table needs the same
  treatment.
- **`GET /resources`, `/people` now require a session** — the
  library is gated to logged-in users (user's explicit request); these
  return 401 without `getSessionUser()` succeeding. `/library`
  fetches them client-side only, after confirming a session, matching
  `/account`'s pattern — not server-rendered, since the Next.js server
  can't see the session cookie anyway (see the host-only cookie note
  above) and a server-rendered-then-hidden page wouldn't actually
  restrict the data. Any response carrying per-session data (these,
  plus `GET /v1/auth/session`) sets `Cache-Control: private, no-store`
  explicitly (the `NO_STORE` constant near `json()`) — don't rely on
  Cloudflare's default cache-bypass for dynamic Worker responses; it was
  observed serving a stale pre-deploy response for about a minute after
  this gate first shipped.
- **The standalone `tools` table is gone — merged into `resources` as
  `type = 'tool'`** (`worker/migrations/0011_merge_tools_into_resources.sql`).
  `GET /tools` no longer exists; `LibraryBrowser.tsx` already merged the
  two client-side before this, so the frontend now just talks to one
  endpoint instead of unifying two. `resources.type` has no CHECK
  constraint (this table predates `wrangler d1 migrations` entirely, so
  its real definition only ever lived on the live D1 instance — checked
  via `sqlite_master`, not assumed), so adding `'tool'` needed no schema
  change, just the data move. One real path collision found and handled
  during migration, not assumed clean: a tool and an existing resource
  pointed at the identical URL (`refactoring.guru`) — the tool row was
  dropped as a genuine duplicate, not inserted twice. Migrated rows get
  `author_id = NULL` (tools never had one — `mapResource()`'s
  `authorId` is now null-safe, `Resource.authorId` is `number | null`)
  and `description = ''`, not `NULL` (every other resource has always
  had a non-null description; `''` preserves that invariant rather than
  introducing a shape the frontend's `string`-typed field doesn't
  expect). View tracking (`POST /resource/:id`) now applies uniformly to
  former tools too — it already worked generically by id with no type
  check; only `LibraryBrowser.tsx`'s client-side guard was skipping
  them. `resource_requests.type` (the contribution pipeline) keeps its
  own separate `CHECK (type IN ('pdf','website','videos','git'))` and
  the `/contribute` form its own four options — deliberately not
  extended to `'tool'` here; that's a future call, not part of this
  merge.
- **Library asset files live in R2 (`lowlevelnotes-assets` bucket, `ASSETS`
  binding), not `public/`.** Gating the `/library` page and its JSON
  endpoints did nothing for the actual PDFs/notes as long as they sat in
  Next.js's `public/` folder — static files there are always served with
  no possible auth check, dirbustable regardless of what the app code
  does. `GET /v1/library/assets/*` (`getLibraryAssetV1` in
  `worker/index.js`) streams objects from R2 after the same
  `getSessionUser()` check, plus its own dedicated rate limit (60
  downloads/hour per user, `asset_download` in `auth_events` —
  `worker/migrations/0004_asset_download_rate_limit.sql` recreated that
  table to add the CHECK value, since SQLite has no `ALTER` for
  constraints). `resources.path` in D1 is unchanged (`./assets/pdfs/...`)
  — `LibraryBrowser.tsx`'s `resolveHref()` rewrites local paths to the
  gated endpoint URL at render time rather than the data being migrated.
  R2 object keys mirror the old `public/assets/` relative paths exactly
  (e.g. `pdfs/cpp.pdf`, `drafts/Networks/networks.md`).
- **Phase 4 (authorization roles), concrete decisions:**
  - Role upgrades (student → contributor/instructor) and resource
    submissions both go through an explicit request-and-approve pipeline
    (`role_requests`, `resource_requests` — `worker/migrations/0005`),
    not auto-grant/auto-publish — an admin reviews every one. One live
    `role_requests` row per user at a time, enforced by a partial unique
    index (`WHERE status = 'pending'`), not application logic alone.
  - A resource submission is either a link (`url`) or an uploaded file
    (`r2_key`), never both — enforced by a CHECK constraint
    (`(url IS NOT NULL) + (r2_key IS NOT NULL) = 1`), computed *before*
    the insert (the R2 key is a random token, not derived from the row's
    own id, avoiding a chicken-and-egg problem with an id that doesn't
    exist yet).
  - Uploaded files live under a `pending/<token>/<filename>` R2 prefix
    until reviewed. Approval copies the object to
    `contributed/<request_id>/<filename>` (R2 has no rename) and deletes
    the pending copy; rejection just deletes it. `resources.path` is set
    to that same key — no `./assets/` prefix needed, since
    `LibraryBrowser.tsx`'s `resolveHref()` only strips that prefix if
    present, and passes an unprefixed path through unchanged.
  - `resources.submitted_by_user_id` is a **separate** column from the
    older `author_id` (which points at `people.id`, a display-credit
    table for showcasing authors, external or not — unrelated to real
    accounts). The two can name different people: `author_id` is who
    should be *credited*, `submitted_by_user_id` is who *actually
    submitted it* through this pipeline. Both `submitted_by_user_id` and
    both request tables' `reviewed_by`/`resource_id` foreign keys use
    `ON DELETE SET NULL`, not the SQLite default — a resource or a
    request record should outlive the account that touched it, not block
    that account's deletion (`worker/migrations/0007`, `0008` — found by
    actually hitting the constraint while cleaning up test data, not
    anticipated in advance).
  - A ban (`users.banned_at`/`ban_reason`) kills the banned user's
    session **immediately** on the next `getSessionUser()` call (deletes
    the session row, not just refuses the one request) and blocks
    `loginV1` from issuing a new one — checked *after* the password
    check in login, so a ban never leaks to someone who doesn't already
    know the password. Deleting a user is a **separate**, harsher action
    (hard `DELETE`, cascades via the existing FKs) — both exist because
    they serve different needs: ban is the reversible day-to-day
    moderation tool, delete is for genuine cleanup. Both refuse to let an
    administrator act on their own account (no self-ban, no
    self-delete) — a safety guard against accidental lockout, not
    enforced by D1 in any way.
  - An admin-created account (`POST /v1/staff/users`) reuses the
    password-reset token/email machinery exactly as-is —
    `password_hash` starts `NULL` (the same state the Phase 1 seed users
    use), and a `password_reset` token is issued immediately so the
    "set your password" link is indistinguishable from a normal reset
    email. No separate flow was built for this.
  - IP blocking is a **real** Cloudflare edge block, not an in-app
    check: the admin panel's "block this IP" action calls Cloudflare's
    IP Access Rules API directly (`cloudflareApi()` in `worker/index.js`,
    zone `REDACTED/`), using a **new**,
    narrowly-scoped Worker secret, `CLOUDFLARE_WAF_TOKEN` (`Zone →
    Firewall Services: Edit` only on `lowlevelnotes.com` — deliberately
    separate from the developer's own `.env.local` token, which has
    broader D1/R2/WAF-*rule* edit and never leaves this machine). There's
    no D1 mirror of blocked IPs — the Cloudflare API is queried live, so
    it can never drift out of sync with what's actually enforced. When
    blocking an IP from a flagged user's IP list, the association is
    folded straight into that Cloudflare rule's own `notes` field
    (`"Blocked via admin panel — associated with user #42 (email)"`)
    rather than a separate table, so it's visible in the Cloudflare
    dashboard too, not just this admin panel.
  - `/v1/staff/*`, not `/v1/admin/*`, **and** the frontend page was put at
    `/staff`, not `/admin` — WAF Rule 2 blocks any path
    `contains "/admin"`. The API prefix was caught while planning this;
    the frontend page collision wasn't — it was only found after the
    fact, when the live page returned Cloudflare's own "Attention
    Required" block screen instead of the app, since the WAF matches on
    URL path alone and blocks before a request ever reaches Vercel,
    regardless of whether that route is even deployed yet. Both are
    avoided by renaming rather than carving an exemption into that rule.
    The frontend page later moved again, to `/account/staff` (nested
    under `/account` along with `/account/approvals/*`, and
    `/instructor/courses` became `/courses/builder` in the same pass) —
    checked against this exact rule before shipping: none of
    `/account/staff`, `/account/approvals*`, or `/courses/builder*`
    contain the `/admin` substring, so all three are clear.
  - `getUserIpsStaffV1` reads distinct IPs from **both** `sessions.ip`
    and `auth_events.ip` (`identifier = ` the user's numeric id as a
    string) — no new IP-tracking table, since Phase 3 already logs both
    on every login/session and every rate-limited action.
  - `CLOUDFLARE_WAF_TOKEN` is set and verified working (list/block/unblock
    all confirmed live). It must be created **without** a Client IP
    Address Filtering restriction — the Worker calls it from Cloudflare's
    distributed edge, not a fixed IP, so any IP restriction fails with an
    opaque "Authentication error" regardless of which IP is chosen (hit
    this exact issue once — see WORKLOG's "Two secrets, two real bugs").
    The permission scope alone (`Zone → Firewall Services: Edit`) is what
    keeps this token safe, not an IP filter.

#### API endpoint reference

The canonical list — kept in sync with the route dispatch table at the
top of `worker/index.js`'s `fetch()` handler (source of truth; this
table is a snapshot of it) whenever a route is added, removed, or its
auth requirement changes. Also what Rule 5's non-GET lockdown on the
main domain is scoped against — see below.

**`api.lowlevelnotes.com`** (Worker):

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | also handles its own `OPTIONS` |
| GET | `/status.svg`, `/history.svg`, `/stats.svg`, `/courses.svg` | none | SVG badges, embeddable |
| GET | `/resources`, `/people` | session | 401 without a valid session; `/resources` includes former `tools` rows as `type = 'tool'` |
| GET | `/changelog` | none | WAF still requires a browser or `x-internal-key` (see below) |
| GET | `/v1/courses`, `/v1/courses/:slug`, `/v1/courses/:slug/lessons` | none | |
| POST | `/v1/auth/register`, `/login`, `/forgot-password` | none | |
| POST | `/v1/auth/reset-password` | none | authenticates via the single-use token in the body, not a session |
| POST | `/v1/auth/logout` | none¹ | ¹no-ops the DB delete if there's no session, but always clears the cookie |
| POST | `/v1/auth/resend-verification` | session | 401 without one |
| GET | `/v1/auth/session` | session | 401 without one |
| GET | `/v1/auth/verify-email` | none | authenticates via the query-string token |
| PUT | `/v1/auth/change-password` | session | |
| GET | `/v1/library/assets/*` | session | streams from R2, own 300/hour/user rate limit |
| GET | `/resource/:id` | none | current view count |
| POST | `/resource/:id` | none | directly callable — WAF Rule 2 explicitly exempts `POST /resource/*` from its suspicious-UA check, unlike most other paths |
| POST | `/v1/role-requests` | session | request `contributor`/`instructor`; 409 if a pending request already exists |
| GET | `/v1/role-requests/me` | session | own request history |
| POST | `/v1/resource-requests` | contributor/instructor/administrator | `multipart/form-data`; exactly one of `url` or `file` |
| GET | `/v1/resource-requests/me` | session | own submission history |
| GET | `/v1/resource-requests/:id/file` | owner or administrator | streams a pending file for review |
| GET, PUT | `/v1/staff/role-requests`, `/v1/staff/role-requests/:id` | administrator | list (filterable `?status=`) / approve or reject |
| GET, PUT | `/v1/staff/resource-requests`, `/v1/staff/resource-requests/:id` | administrator | list (joined with requester email + role) / approve or reject |
| GET | `/v1/staff/courses` | administrator | list by `?status=pending\|published\|draft` (default `pending`) |
| PUT | `/v1/staff/courses/:id/review` | administrator | approve (publishes) or reject (back to draft with a reason) |
| DELETE | `/v1/staff/courses/:id` | administrator | hard delete, any status, cascades to modules/lessons/quiz data |
| GET, POST | `/v1/staff/users` | administrator | list / create (see below) |
| PUT | `/v1/staff/users/:id/role`, `/ban`, `/unban` | administrator | direct role change; ban kills active sessions; both ban and delete refuse the admin's own account |
| DELETE | `/v1/staff/users/:id` | administrator | hard delete, cascades |
| GET | `/v1/staff/users/:id/ips` | administrator | distinct IPs from `sessions`/`auth_events` |
| GET, POST, DELETE | `/v1/staff/blocked-ips` | administrator | proxies Cloudflare's IP Access Rules API directly — no D1 mirror |

**`lowlevelnotes.com`** (Next.js — the only server-side route handler in the app):

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/resource/[id]` | none (server-to-server via `x-internal-key`) | proxies to the Worker's `POST /resource/:id`, called by `LibraryBrowser.tsx` |
| POST | `/api/render/markdown`, `/api/render/code` | none (renders text the caller already fetched authenticated) | runs the server-side markdown/shiki pipeline (`src/lib/markdown.ts`) against content the browser fetched from the gated Worker endpoint; called from `src/app/courses/[course]/[lesson]/page.tsx`. **Any new POST/PUT/DELETE route added here needs a matching exemption in Rule 5 below** — these two were missed on first ship and silently WAF-blocked in production (zero errors anywhere, since the block happens at the edge before Vercel) until caught by a user report; see WORKLOG's "Real bug found live" entry for how it was diagnosed |

### Security and roles

- Understand and use established solutions for sessions, cookies, JWTs, refresh
  tokens, CSRF, XSS, OAuth, password hashing, and authorization; do not design
  bespoke authentication cryptography.
- Cloudflare Turnstile guards `/register`, `/login`, and `/forgot-password`
  (site key `0x4AAAAAAEdKEFa7n07s2OQ1` — public, safe to keep in client code;
  only the secret key needs protecting, held as the Worker secret
  `TURNSTILE_SECRET`, set via `wrangler secret put`, never in a tracked file).
  `TurnstileWidget.tsx` renders the challenge explicitly (not the implicit
  `cf-turnstile` div) so the token lands in form state; each form disables
  submit until a token exists and resets the widget after every attempt,
  since tokens are single-use regardless of outcome. `verifyTurnstile()` in
  `worker/index.js` checks the token against Cloudflare's `siteverify`
  endpoint, requiring the returned `action` to match the endpoint being hit
  (so a token solved on `/login` can't be replayed against `/register`) and
  the returned `hostname` to be ours — runs before any rate-limit bookkeeping
  or DB work in `registerV1`/`loginV1`/`forgotPasswordV1`.
- Students read courses, complete lessons, take quizzes, and track progress.
- Contributors create and edit lessons. Instructors create courses, manage
  exercises, and view student statistics. Administrators have full access.
- `/admin` (`src/app/admin/page.tsx`) is a decoy login page, unrelated to the
  real staff panel at `/account/staff` — never linked from `Header`/`Footer`/
  `sitemap.ts`, so anyone landing on it got there by guessing a common admin
  path. Every visit is logged server-side (not via a client beacon, so it
  also catches non-JS scanners) into `honeypot_hits`
  (`worker/migrations/0027_honeypot_hits.sql`) via `POST /v1/honeypot`
  (`worker/routes/security.js`'s `logHoneypotHitV1`, `INTERNAL_API_KEY`-gated
  like the rest of `src/lib/api.ts`), surfaced on the staff panel's Honeypot
  tab with a one-click block-IP action. The page's own login form never
  transmits what's typed — only the visit is logged, not attempted
  credentials, so a compromised table can't leak a real password someone
  reused out of habit. Deliberately not listed in a `robots.txt` Disallow
  (there isn't one yet) since that itself is a common way scanners discover
  "interesting" paths; a `noindex`/`nofollow` meta tag keeps it out of search
  results instead. The visitor's IP is read from `cf-connecting-ip`, not
  `x-forwarded-for` — the site sits behind Cloudflare in front of Vercel, so
  `x-forwarded-for`'s first entry is Cloudflare's own edge IP
  (`162.158.0.0/15`), not the visitor's (confirmed live: every early hit
  logged the same Cloudflare range). `cf-connecting-ip` is what Cloudflare
  itself sets to the real client IP and strips from anything the client
  sent, same reason the Worker trusts it everywhere else instead of
  `x-forwarded-for`.
- All Discord posting shares one webhook/channel now (2026-09-06) —
  changelog, new-user signups, display-name changes, staff audit actions,
  the daily security digest, and (new, same change) honeypot hits all
  post through the single `env.DISCORD_WEBHOOK_URL` secret, requested
  explicitly to replace the previous five separate per-feature webhooks
  (`DISCORD_WEBHOOK_SECURITY_URL`, `DISCORD_WEBHOOK_NEW_USERS_URL`,
  `DISCORD_WEBHOOK_NAME_CHANGES_URL`, `DISCORD_WEBHOOK_STAFF_LOGS_URL`,
  plus the original `DISCORD_WEBHOOK_URL` for changelog) as easier to
  manage. The four retired secrets were deleted outright from the live
  Worker (`wrangler secret delete`), not just left unused — each embed
  still sets its own distinct `footer.text` (`0xLLN changelog`/`new
  users`/`name changes`/`staff-logs`/`security digest`/`honeypot`) so a
  shared channel stays distinguishable message-by-message. See
  `worker/lib/discord.js`'s own top comment for the live list of callers.
  Honeypot hits (`logHoneypotHitV1`, `worker/routes/security.js`) newly
  post live rather than only ever landing in the staff panel/daily
  digest — but only the two cases the staff panel's own copy already
  calls out as genuinely alarming: a POST (credentials submitted without
  ever loading the page) or a matched real account (the probing IP/device
  is also on file for a real login) — a routine anonymous GET is just a
  scanner guessing a common path, and alerting on every one of those
  would page staff for background noise the daily digest/panel already
  cover.
- Per-course analytics for instructors/staff (2026-09-06) — new `GET
  /v1/instructor/courses/:id/analytics` (`getCourseAnalyticsV1`,
  `worker/routes/instructor.js`), same ownership gate as `GET
  /v1/instructor/courses/:id` (`isCourseAuthorV1`: owning instructor, any
  co-author, or staff). First of the three "what would take the platform
  to the next level" ideas discussed the same day (the other two —
  re-engagement emails, real code execution/grading for exercises — are
  intentionally deferred, in that order). Returns enrollment counts by
  status (active/completed/dropped) plus a per-lesson completion funnel
  and, for quiz lessons, attempt count and average score — the thing a
  per-student progress view can't show is *where* people give up, which
  this is for. Every count is a correlated scalar subquery per row (same
  style as `courseStatsSelect`/`authorsJsonSelect` in
  `worker/lib/courseAccess.js`), not a `LEFT JOIN` against
  `lesson_progress`/`quiz_attempts` — joining both against the same
  lesson row would fan out into a cartesian product and silently inflate
  every count. Deliberately doesn't break a quiz down per-question:
  `quiz_attempts` only ever stored the final score/total, never which
  answer was chosen per question (see `attemptQuizV1`), so "which
  question do people get wrong most" isn't answerable without a schema
  change — noted as a real follow-up, not attempted here. Frontend: a new
  "Analytics" toggle in the course builder header
  (`src/app/account/build/[id]/page.tsx`) swaps the right pane to
  `CourseAnalyticsPanel`, sibling to the existing "Course settings"
  toggle (`rightPaneView` state, independent of `selected` which still
  takes priority whenever a lesson is open). Covered by `worker/test/course-analytics.test.js` (auth gate, enrollment
  breakdown, the funnel + quiz average with a hand-computed expected
  value, and the nobody's-enrolled-yet divide-by-zero case) — all passed
  on the first run. Worth flagging for the next person touching this
  query anyway: it deliberately writes `score * 100.0 / total`, not
  `score / total * 100`, since SQLite does integer division when both
  operands are integers — the `.0` forces floating-point math before the
  `AVG()` runs, otherwise every per-attempt ratio truncates to 0 first.
- Re-engagement without email spam (2026-09-06) — second of the three
  "next level" ideas from the same day, but a recurring email digest was
  rejected outright ("I don't want to spam the users with emails"); Web
  Push was also discussed and set aside. Landed on two pieces instead:
  a free in-app streak-at-risk banner (`/account/courses`, shown whenever
  `currentStreak >= 1 && !streakActiveToday`) and a single narrow opt-in
  email trigger (not a digest — fires at most once/day, only for
  `currentStreak >= 3`, toggled off by default on `/account/security`).
  `worker/lib/streak.js`'s `getCurrentStreakStatus()` is the *current,
  still-alive* streak — deliberately a new, separate calculation from
  `routes/profile.js`'s `evaluateAchievementsV1`, which only ever tracks
  the *longest-ever* streak for the `streak_days` achievement (a lifetime
  milestone that never resets, so it can't answer "is today's streak
  actually at risk"). Both share the same UTC-calendar-day simplification
  via SQLite's `date()` on stored UTC timestamps. New migration
  `0031_streak_reminder_opt_in.sql`
  (`users.streak_reminder_opt_in`/`streak_reminder_last_sent_at`); the
  opt-in flag has its own tiny `GET`/`PUT /v1/me/streak-reminder-opt-in`
  endpoint rather than being folded into `GET /v1/auth/session` (checked
  on every authenticated request) — only the Security page ever needs
  it. `sendStreakReminderEmails` (`worker/cron.js`) piggybacks on the
  same once-daily `0 9 * * *` trigger `postDailySecurityDigest` already
  uses. Covered by `worker/test/streak.test.js` (10 tests: the streak
  math, the opt-in round-trip, and the cron function's filtering) —
  36/36 across the whole suite. See WORKLOG's "Re-engagement, minus the
  emails" entry for the full design reasoning.
- `/account`'s standalone "Overview" page/nav item was removed (2026-09-06)
  — its avatar/name/role greeting duplicated the Profile page (`/u/[id]`,
  which already shows all three plus bio and achievements) verbatim, so
  requested as clutter. Its two non-duplicated pieces — the
  email-verification-resend banner and the "continue learning" shortcut —
  moved into `/account/courses`, which is now the dashboard's de facto
  landing page. `/account` itself stays a live route (a server-side
  `redirect('/account/courses')` in `src/app/account/page.tsx`), not
  deleted, since `login`/`register` and `Header.tsx`'s account link all
  send users there; those three call sites were also pointed straight at
  `/account/courses` to skip the extra hop. Max sidebar for a staff
  member is now 6 items: Profile, Security, Courses, Contribute, Build,
  Staff — Security stays (confirmed explicitly; almost got dropped
  reflexively when a smaller target list was given verbally).
- `/account/build` (instructor/staff-only course creation + list) folded
  into `/account/contribute` (2026-09-06) as a `CourseBuildSection`,
  rendered only for instructor/staff — same motivation as the Overview
  fold-in above: two nav items that were both "what can this account
  submit or manage," split only because one happened to be role-gated.
  The course editor (`/account/build/[id]`) and group manager
  (`/account/build/groups`) stayed their own routes, linked from within
  that section — same reasoning that kept course review on its own route
  during the earlier approvals fold-back. Sidebar for a staff member is
  now 5 items: Profile, Security, Courses, Contribute, Staff.
- Role/resource/course-request review folded back into `/account/staff` as
  tabs (2026-09-06), reversing the earlier split into standalone
  `/account/approvals/*` pages (see "Data and API direction" above). That
  split was a deliberate content-depth decision — course review in
  particular needed a real content-review page, not a modal — but it also
  gave staff two separate top-level sidebar entries (`Staff` and
  `Approvals`) for what is functionally one audience and one workflow.
  Reducing that sidebar clutter is what drove the fold-back: `RoleRequestsPanel`/
  `ResourceRequestsPanel`/`CourseRequestsPanel` now render as `AdminPanel.tsx`
  tabs (`role-requests`/`resource-requests`/`course-requests`) instead of
  their own routes, with the same per-tab pending-count badge the sidebar
  used to show on `Approvals`. The one page that still needed its own
  route — course content review, since a tab can't hold a full
  modules→lessons→quiz review UI — moved to
  `/account/staff/course-requests/[id]`; its "back to list"/breadcrumb
  links now go to `/account/staff?tab=course-requests` so returning from a
  review lands back on that tab instead of resetting to Users.
  `/account/approvals/*` no longer exists.
  **Update (2026-09-06, same day):** those three separate tabs were
  themselves merged into one `requests` tab — `RoleRequestsPanel`/
  `ResourceRequestsPanel`/`CourseRequestsPanel` now render stacked in one
  scrollable column instead of three tab switches, and the course-review
  breadcrumb/back-link target is `?tab=requests`, not `?tab=course-requests`.
  Staff tab count: 7 → 5.
- First resource-loading CSP, shipped as `Content-Security-Policy-Report-Only`
  rather than enforced (2026-09-06) — `next.config.ts`'s own comment had
  flagged this as deferred pending real browser testing, which isn't
  available in this environment. Verified what the policy actually needs
  by inspecting the real built HTML (`next build && next start` + `curl`)
  instead of assuming: Next's App Router genuinely emits inline,
  nonce-less `<script>` tags for its RSC streaming payload, so
  `script-src`/`style-src` (the latter for dynamic `style={{ width }}`
  progress bars) both need `'unsafe-inline'` — the correct nonce-based
  fix needs `src/middleware.ts`'s matcher widened from `/admin`-only to
  every route, deliberately not attempted blind on a middleware
  convention this Next version already flags deprecated. No external
  fonts (checked, none found) so `font-src` stays `'self'` only,
  narrower than originally worried. `challenges.cloudflare.com` allowed
  in `script-src`/`connect-src`/`frame-src` for Turnstile. This lives in
  the Next.js app (Vercel), not the Worker — no `wrangler deploy` for it;
  takes effect only once pushed through the normal GitHub → Vercel
  pipeline. See WORKLOG's "First resource-loading CSP" entry for the
  full reasoning and the "browse with devtools open, then flip to
  enforced" follow-up.

### Learning and motivation model

- A lesson can combine explanation, code examples, diagrams, an interactive
  “try it yourself” area, questions, a quiz, and completion tracking.
- Example introductory course flow: What is a CPU? → Registers → Instruction
  cycle → ISA → ten-question quiz.
- Example exercises: reverse a string without the standard library; write an
  x86-64 function returning the maximum of two integers.
- Possible profile surface: a current level, XP total, course/lesson progress,
  quiz scores, exercise results, and unlocked achievements (for example, first
  lesson, first quiz, C fundamentals, or a seven-day streak).

## Visual identity

Keep the experience dark, technical, and legible. This file is the source of
truth for the current palette:

- Background (void — the page itself): `#0B0B0D`
- Surface (cards/panels): `#17181B` — deliberately *lighter* than the page
  background, not darker. Panels are meant to read as raised above the page,
  not receding into it. `text-[#0D0D0D]` (still called `--background-deep`
  in `globals.css`) survives as a separate, narrower role: text-on-accent
  (button labels) and `::selection`'s highlighted-text color, where a true
  near-black is what's wanted regardless of the surface/void relationship.
- Primary text: `#FFFFFF`; muted text: `#90939A`
- Accent: `#FF7A33`; hover: `#FF9459`; deep: `#C95E1A`; dark: `#3A2113`
- Success: `#3FB950`; error: `#F85149`

**Eyebrows read like source comments, not marketing labels.** Every section
label (`Eyebrow` — `src/components/Eyebrow.tsx`) renders as `// Label`, with
the `//` in `--accent-deep` (`#C95E1A`, a darker cut of the accent) and the
label itself in the full accent. This is also the answer to "where does a
secondary/muted accent color come from": reach for `--accent-deep` (darker)
or the accent at reduced opacity — never an unrelated hue (a cyan/teal
secondary was tried and explicitly rejected) — for anything that needs to
read as "accent, but quieter." `Eyebrow` takes an optional `as="h2"` for
section headings that need to be a real heading rather than a `<p>`;
`admin/shared.tsx`'s `SectionHeading` is a thin wrapper over it. Every raw
`text-xs font-medium uppercase tracking-[0.18em] text-[#FF7A33]` paragraph
across the site was migrated to this component — don't hand-roll a new one.

`/transparency` (the page showing the `status.svg`/`history.svg`/`stats.svg`/
`courses.svg` badges) was removed from the site entirely, 2026-08-30 — it
read as scattered, low-value marketing chrome once reviewed against the
redesign. The Worker endpoints that generate those SVGs are still live
(they're embeddable badges independent of any Next.js page, e.g. for the
GitHub README) — only the page that displayed them inline is gone.
`SvgBadge.tsx` (its only consumer) was deleted with it. Since these badges
render outside the site (no access to `globals.css`), their colors/font
are hand-copied constants at the top of `worker/routes/badges.js`
(`COLORS`, `FONT`) rather than CSS variables — updated 2026-08-30 to match
this section's palette (`#17181B` surface instead of the old `#0D0D0D`,
`#FF7A33` accent instead of `#FF8A3D`, `#90939A` muted instead of
`#A1A1AA`, JetBrains Mono) and the `// Label` eyebrow convention in place
of their old solid-square section markers. Keep `COLORS`/`FONT` in sync by
hand if the palette in this file ever changes again. The home page
now surfaces the same underlying numbers itself instead, via a new public
`GET /v1/stats/summary` endpoint (`getSiteStatsSummaryV1` in
`worker/routes/badges.js`) — same counts as `stats.svg`/`courses.svg`, JSON
instead of SVG.

`/account/*` is a real dashboard now, not a stack of pages that each
reinvent their own back-link. `src/app/account/layout.tsx` owns a persistent,
role-aware left nav (Overview/Profile/Courses/Contribute, plus Course
builder/Staff/Approvals once the role actually has them) shared across every
nested route — nested pages render only their own content, no `<main>`
wrapper, no back-link, no `AuthPageShell`. `/courses/builder/*` is
intentionally **not** nested under this layout — it's a separate, denser
workspace (two-pane module tree + editor) with its own header bar, not a
dashboard sub-page.

`#3FB950` (success) and the status badge's "degraded" amber `#D29922` are
both taken from GitHub's dark theme; `#F85149` (error, introduced for the
auth forms) is that same theme's danger/error red — keep pulling from
that lineage rather than introducing unrelated hues for future status
colors.

`src/lib/site.ts` is the source of truth for site branding and metadata. Preserve
the existing positioning: “Organized knowledge for mastering software
development.”

## UI consistency protocol

The homepage is the canonical visual reference for the platform. Future pages
and components must extend its established design system rather than introduce
a competing visual language.

- Before building or substantially restyling a UI surface, inspect the homepage
  and shared styling/components. Reuse their spacing, typography, color,
  border, shadow, icon, interaction, and responsive conventions.
- Do not invent one-off values or component variants when an existing token or
  pattern can be reused. Promote genuinely repeated values to shared tokens or
  components instead.
- Keep the visual character slick, modern, dark, technical, and intentionally
  restrained. Prioritize hierarchy, contrast, readability, and purposeful
  motion over decorative effects.
- Maintain a single shape language. Corner radius, border weight, and surface
  treatment must be consistent across cards, buttons, inputs, navigation, and
  dialogs. Do not mix sharply squared and heavily rounded components unless a
  documented semantic reason requires it.
- Maintain a single interaction language: matching hover, focus, active,
  disabled, loading, and mobile behavior for equivalent components. Preserve
  visible keyboard focus and accessible contrast.
- When a homepage visual decision is made, record its concrete values below
  before using it elsewhere. Treat this section as the design-system contract.

### Design-system contract

Complete these values during the homepage visual pass, then use them consistently
throughout the product:

- **Corner radius / shape language:** Square/straight edges; use no decorative
  rounding. The interface should feel precise and technical.
- **Border and surface treatment:** One-pixel, low-contrast white borders on
  deep charcoal surfaces. Use orange sparingly as an active or primary signal.
- **Typography scale and weights:** JetBrains Mono throughout; bold, tight,
  display-style headings with muted, comfortable body copy.
- **Spacing rhythm:** Use generous section spacing and a compact 24–32 px rhythm
  within panels; align content to the `max-w-6xl` page grid.
- **Shadows, glows, and depth:** Prefer borders, subtle charcoal contrast, and
  restrained amber radial light. Avoid soft card shadows.
- **Motion:** Dependency-free — plain CSS transitions/keyframes plus
  `src/lib/useReveal.ts` (a small `IntersectionObserver` hook) for scroll
  reveals. No motion library; matches the site's zero-animation-dependency,
  lean-and-fast baseline. Two tiers, both Tailwind defaults — no custom
  easing curves: `duration-150 ease-out` for hover/press/color
  micro-interactions, `duration-300 ease-out` for entrance/reveal
  transitions. Every transition/animation class must carry a
  `motion-reduce:` counterpart that removes it (maps to
  `prefers-reduced-motion: reduce`) — not optional.
  Four allowed categories, nothing else:
  1. **Press/hover feedback** — `active:scale-[0.98]` on every
     button-like control (real buttons, filled/bordered CTA links — not
     bare inline text links, which stay color-only like the rest of the
     site's nav/text links); a small `hover:-translate-y-0.5` (2px) lift
     on genuine card-grid links only.
  2. **Entrance reveals** — fade + small rise (`opacity-0 translate-y-3`
     → `opacity-100 translate-y-0`), via `useReveal` applied directly to
     the existing element (never a wrapper `<div>` — several grids use a
     shared-border technique, `border-l border-t` on the parent with
     `border-b border-r` per item, that an extra wrapper would double up
     or break). Stagger via inline `transitionDelay`, capped at 6 items.
     For above-the-fold, mount-triggered entrances (hero copy, inline
     messages) use the `animate-fade-in-up` keyframe utility
     (`globals.css`) instead — no scroll trigger needed.
  3. **State-change feedback** — inline success/error messages
     (`AuthMessage.tsx` and equivalent ad-hoc `<p>`s) fade in
     (`animate-fade-in-up`) instead of popping; `Loading…` placeholders
     get `animate-pulse`.
  4. **Nav active-state** — `Header.tsx`'s per-link underline animates in
     with `scale-x-0`/`scale-x-100` instead of appearing instantly.
  Explicitly out of scope: page/route transition animation (no built-in
  Next.js App Router primitive for this, meaningfully bigger and riskier
  for modest payoff), parallax/scroll-jacking, spring/bounce easing,
  continuous or looping decoration, hover-lift on dense data rows
  (library browser rows, admin panel rows, changelog entries — those
  stay color-only; a lift across a tightly packed list reads as noise,
  not polish). `/account/staff` (`AdminPanel.tsx`) stays the least-animated
  surface on the site — press feedback and loading-pulse only, no
  reveals or lift — it's a dense repeat-use utility page, not a
  showcase.
- **Form pattern:** `src/components/auth/{AuthPageShell,AuthTextField,AuthSubmitButton,AuthMessage}.tsx`
  are the canonical primitives for any single-form page (label + input,
  filled-orange submit with a loading/disabled state, inline
  success/error message with the small-square marker convention). Reuse
  these rather than hand-rolling form markup elsewhere.
- **Transactional email treatment:** `buildAuthEmailHtml()` in
  `worker/index.js` — table-based layout, inline styles only (mail
  clients strip `<style>` blocks and most webfonts), dark charcoal
  background, the `"0x"`/`"LLN"` split-color wordmark, filled-orange CTA
  button with a plain-text fallback link underneath. Reuse for any future
  transactional email rather than hand-writing new markup per message.

## Working principles

- The maintainer is new to web development: explain changes plainly and keep
  implementation steps approachable.
- Do not introduce later-phase functionality unless it is explicitly requested.
- Avoid duplication: reuse existing components, tokens, and data definitions
  where practical.
- Keep the `UI consistency protocol` and its design-system contract up to date
  whenever a homepage design decision becomes a reusable platform convention.
- **Verify visual/UI changes with a real screenshot, not just by reading the
  CSS/JSX.** No browser extension is connected in this environment, but
  Playwright's Chromium is already installed and cached
  (`~/.cache/ms-playwright`), so a real render is one command away:
  `npx --no-install playwright screenshot --viewport-size="<w>,<h>"
  --wait-for-timeout=800 http://localhost:3000<path> <output>.png`, then
  view the PNG with the Read tool (it renders images directly). Check at
  minimum a wide desktop width (e.g. 1920×1080), a common laptop width
  (1440×900), and a phone width (390×844) — several real bugs on the home
  hero (an opacity that read far more legible than intended, a glow radius
  that looked fine at one width but washed out the header/title at
  another) were only caught this way; reasoning about the code alone
  missed them both times. The dev server must already be running
  (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` to
  confirm) — this doesn't start one.
- Treat existing uncommitted changes as user work. Do not discard or overwrite
  unrelated edits.
- The user has granted standing permission to operate on the live Cloudflare
  Worker and D1 database (`lowlevelnotes-db`) via the Cloudflare MCP
  integration and the `CLOUDFLARE_API_TOKEN` in `.env.local`
  (`D1:Edit` + `Workers Scripts:Edit` scope) — no need to ask before running
  read or write operations through either path while auto mode is on. A
  `.claude/settings.local.json` permission rule allows `wrangler` CLI
  invocations (`npx wrangler ...`) without a prompt; the MCP D1 tool was
  never gated to begin with. This does not extend to git history rewrites,
  force-pushes, or revoking/rotating the token itself — those still get
  confirmed explicitly.
- `CLOUDFLARE_API_TOKEN` now also has **`Zone → WAF → Edit`** (scoped to
  the `lowlevelnotes.com` zone) and **`Workers R2 Storage: Edit`**
  (2026-08-26) — added specifically so custom WAF/Security Rules for the
  domain and R2 object management (used by the gated library-asset
  endpoint, see below) can be handled the same standing-permission way as
  D1/Worker changes already are. Note the WAF permission is `Zone WAF
  Write` — a *zone*-scoped grant, not the account-level `Rule Policies`
  permission that also appears in the token editor (that one is a
  separate, thinly-documented Account permission group, unrelated to this
  domain's Security Rules page; not added, not needed here).
- Zone security layers, outside-in: Cloudflare's **Managed Free
  Ruleset** (`http_request_firewall_managed` phase, 31 narrow CVE/exploit
  signatures — Log4Shell, Shellshock, WordPress plugin CVEs — enabled
  2026-08-26), then the 5 hand-written **custom rules**
  (`http_request_firewall_custom` phase: countries + AI-crawler UAs,
  suspicious-UA/path-probe blocklist, anchored referer checks on the API
  and on main-domain `/assets/`, non-GET lockdown on the main domain —
  currently exempts `POST /api/resource/*` and `POST /api/render/*`;
  **any new non-GET Next.js Route Handler needs adding here too, or it
  silently 403s at the edge with nothing in Vercel's logs to explain
  why** — this exact thing happened to `/api/render/*` on first ship,
  caught only by a user report, see WORKLOG's "Real bug found live"
  entry), then **IP Access Rules** (separate quota, single-IP blocks). The
  crawler UA list in rule 1 is meant to track this site's own
  `robots.txt` Content-Signal policy (`ai-train=no`, Cloudflare-managed
  block list) — if that policy ever changes, the WAF list needs a
  matching update, since robots.txt itself is advisory only and doesn't
  enforce anything on its own. Local point-in-time backups of the live
  config live in `/cloudflare-backups/` (gitignored, pulled via the API
  before/after a review pass — not automatically kept in sync).
  **The Free plan hard-caps custom rules at 5** — confirmed by hitting
  `exceeded the maximum number of rules in the phase
  http_request_firewall_custom: 6 out of 5` while adding a 6th; adding
  a new one means deleting or merging an existing one first (the
  currently-dormant `/assets/` hotlink rule is the natural one to
  temporarily sacrifice, since it protects nothing while that folder is
  empty — just remember to recreate it once it isn't).
- The country/crawler rule and the anchored-referer API rule both now
  carry `and not (http.request.headers["x-internal-key"][0] eq
  "<INTERNAL_API_KEY>")` — added 2026-08-29 while chasing a live
  `/changelog`+home-page outage, so verified internal (Vercel
  server-to-server) calls skip both checks. Neither one was actually the
  outage's cause; they're real, narrowly-scoped hardening left in place
  since discovering the gap.
- **Bot Fight Mode is now OFF, permanently, not a temporary state.**
  It was the real cause of the 2026-08-29 outage: Vercel's server-side
  `getChangelog()`/`getFeaturedCourses()`/`getLibraryCategoryStats()`
  calls (`apiFetch()` in `src/lib/api.ts`) were intermittently served
  Cloudflare's "Just a moment..." JS-challenge page (`cf-mitigated:
  challenge`) instead of a real response — a challenge only a browser
  can solve, so a server-to-server `fetch()` just gets a permanent `403`
  back, crashing `/changelog` (no try/catch there) and degrading the
  home page to its empty-state fallback (it does have one). **Confirmed
  via Cloudflare's own docs/community that Bot Fight Mode cannot be
  selectively exempted on the Free plan by any Custom Rule Skip
  action — it doesn't run on the Ruleset Engine at all; only the paid
  Super Bot Fight Mode (Pro+) supports Skip rules.** A `skip` rule
  targeting the `http_request_sbfm` phase was tried first and does
  nothing on Free — don't repeat that. The other WAF layers (suspicious-
  UA/path-probe blocking, referer checks, per-user rate limits on actual
  content endpoints) already cover most of what Bot Fight Mode
  targeted, so this was judged an acceptable trade rather than upgrading
  to Pro or re-architecting the fetch path to run client-side.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
