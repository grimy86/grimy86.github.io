'use client'

// Client-safe wrappers for everything that runs on the session cookie —
// /v1/auth/* plus the now-gated library data — deliberately separate
// from src/lib/api.ts (server-only, uses the INTERNAL_API_KEY secret).
// These calls run in the browser and rely on the session cookie instead,
// which is HttpOnly and host-only on api.lowlevelnotes.com — the browser
// must therefore talk to that domain directly (credentials: 'include'),
// not through a same-origin Next.js proxy, or the cookie would end up
// scoped to the wrong host.

import type { Resource, Person } from '@/lib/api'

const AUTH_API_BASE = 'https://api.lowlevelnotes.com'

export type AuthUser = {
  id: number
  email: string
  displayName: string
  role: string
  avatarUrl: string | null
  emailVerified: boolean
  isSuperAdmin: boolean
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number }

// Carries the HTTP status through the throw, so a queryFn/mutationFn
// caller can still tell a 404 apart from any other failure the way the
// old .then(result => ...) call sites used to via result.status.
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Bridges this file's Result<T> convention (never throws, always resolves)
// with TanStack Query's contract (a queryFn/mutationFn must throw to
// signal an error — a resolved promise is always treated as success).
// Wrap any of the functions below in a query/mutation with this instead
// of teaching every call site to throw.
export async function unwrapResult<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) throw new ApiError(result.error, result.status)
  return result.data
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response
  try {
    res = await fetch(`${AUTH_API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection.', status: 0 }
  }

  if (res.status === 204) {
    return { ok: true, data: undefined as T }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, error: 'Unexpected response from the server.', status: res.status }
  }

  if (!res.ok) {
    const error = (body as { error?: string })?.error ?? 'Something went wrong.'
    return { ok: false, error, status: res.status }
  }

  return { ok: true, data: body as T }
}

// Separate from authFetch because lesson content comes back as raw
// markdown text (from the gated R2 asset stream), not JSON — reusing
// authFetch's res.json() would throw on every call.
async function authFetchText(path: string): Promise<Result<string>> {
  let res: Response
  try {
    res = await fetch(`${AUTH_API_BASE}${path}`, { credentials: 'include' })
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection.', status: 0 }
  }

  if (!res.ok) {
    let error = 'Something went wrong.'
    try {
      error = ((await res.json()) as { error?: string })?.error ?? error
    } catch {
      // Non-JSON error body (e.g. a plain-text 404) — fall back to the default.
    }
    return { ok: false, error, status: res.status }
  }

  return { ok: true, data: await res.text() }
}

// Separate from authFetch because a multipart body needs the browser to
// set its own Content-Type (with the boundary) — sending a fixed
// 'application/json' header, or JSON.stringify-ing a FormData object,
// would silently break the upload rather than fail loudly.
async function authFetchForm<T>(path: string, form: FormData, method = 'POST'): Promise<Result<T>> {
  let res: Response
  try {
    res = await fetch(`${AUTH_API_BASE}${path}`, { method, credentials: 'include', body: form })
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection.', status: 0 }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, error: 'Unexpected response from the server.', status: res.status }
  }

  if (!res.ok) {
    const error = (body as { error?: string })?.error ?? 'Something went wrong.'
    return { ok: false, error, status: res.status }
  }

  return { ok: true, data: body as T }
}

export function getSession() {
  return authFetch<AuthUser>('/v1/auth/session')
}

export function login(email: string, password: string, turnstileToken: string, fingerprint?: string | null) {
  return authFetch<{ token: string; expiresAt: string; user: AuthUser }>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, turnstileToken, fingerprint: fingerprint ?? undefined }),
  })
}

export function register(email: string, password: string, displayName: string, turnstileToken: string) {
  return authFetch<{ message: string; email: string; verificationLink?: string; note?: string }>(
    '/v1/auth/register',
    { method: 'POST', body: JSON.stringify({ email, password, displayName, turnstileToken }) }
  )
}

export function logout() {
  return authFetch<void>('/v1/auth/logout', { method: 'POST' })
}

export function deleteMyAccount(password: string) {
  return authFetch<void>('/v1/me', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  })
}

export function changePassword(currentPassword: string, newPassword: string) {
  return authFetch<{ message: string }>('/v1/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function forgotPassword(email: string, turnstileToken: string) {
  return authFetch<{ message: string }>('/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email, turnstileToken }),
  })
}

export function resetPassword(token: string, newPassword: string) {
  return authFetch<{ message: string }>('/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
}

export function verifyEmail(token: string) {
  return authFetch<{ message: string }>(`/v1/auth/verify-email?token=${encodeURIComponent(token)}`)
}

export function resendVerification() {
  return authFetch<{ message: string; verificationLink?: string; note?: string }>(
    '/v1/auth/resend-verification',
    { method: 'POST' }
  )
}

// Library data now requires a session — gated server-side (not just a
// frontend redirect), so a logged-out request genuinely gets a 401 with
// no data, not just a hidden-but-fetched response.
export async function getLibrary() {
  const [resources, people] = await Promise.all([
    authFetch<Resource[]>('/resources'),
    authFetch<Person[]>('/people'),
  ])

  if (!resources.ok) return resources
  if (!people.ok) return people

  return {
    ok: true as const,
    data: { resources: resources.data, people: people.data },
  }
}

/* ==================== Phase 7: learning system ==================== */
// Course/lesson catalog now requires a session, same tier as
// /resources|/people above — moved here from src/lib/api.ts,
// which has no way to send the session cookie server-side (host-only on
// api.lowlevelnotes.com, never visible to the Next.js server).

// Only on the public Course type below (getCourses/getCourse) — id is
// null when this author has anonymize_course_authorship on, so the real
// numeric id is withheld too, not just the name, and there's no way to
// take it straight to /u/:id and see their (possibly still fully public)
// real profile. The instructor-facing InstructorCourse/CourseAuthor pair
// further down never anonymizes (an owner managing their own course sees
// real co-authors, same as every other "own data" view on this site), so
// that one stays non-nullable rather than sharing this type.
export type PublicCourseAuthor = { id: number | null; displayName: string }
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type CourseVisibility = 'public' | 'restricted'

export type Course = {
  id: number
  slug: string
  title: string
  description: string | null
  category: string | null
  position: number
  iconUrl: string | null
  iconGlyph: string | null
  difficulty: CourseDifficulty | null
  authors: PublicCourseAuthor[]
}

export type LessonType = 'article' | 'video' | 'exercise' | 'quiz'

export type Lesson = {
  id: number
  slug: string
  title: string
  type: LessonType
  contentPath: string | null
  videoUrl: string | null
  position: number
  moduleSlug: string
  moduleTitle: string
  modulePosition: number
}

export type Exercise = {
  prompt: string
  language: string | null
  starterCode: string | null
  solutionNotes: string | null
}

export type QuizAnswer = { id: number; body: string; position: number }
export type QuizQuestion = { id: number; prompt: string; position: number; answers: QuizAnswer[] }
export type Quiz = { questions: QuizQuestion[] }

export type LessonDetail = {
  id: number
  slug: string
  title: string
  type: LessonType
  contentPath: string | null
  videoUrl: string | null
  position: number
  moduleSlug: string
  moduleTitle: string
  courseSlug: string
  courseTitle: string
  exercise: Exercise | null
  quiz: Quiz | null
}

export function getCourses() {
  return authFetch<{ data: Course[]; pagination: { total: number; limit: number; offset: number } }>('/v1/courses')
}

export function getCourse(slug: string) {
  return authFetch<Course>(`/v1/courses/${slug}`)
}

export function getCourseLessons(slug: string) {
  return authFetch<Lesson[]>(`/v1/courses/${slug}/lessons`)
}

export function getLesson(id: number) {
  return authFetch<LessonDetail>(`/v1/lessons/${id}`)
}

// Raw lesson content bytes (markdown, images) stream from R2 through the
// existing gated library-asset endpoint — content_path values are
// already valid keys into that same bucket, no separate endpoint needed.
export function getLessonContent(contentPath: string) {
  return authFetchText(`/v1/library/assets/${contentPath}`)
}

// Enroll/complete — live since the deferred Phase 2 endpoints work,
// wired into the UI here for Slice 2. Enrollment is always explicit:
// neither endpoint auto-enrolls, matching the Worker's own design.
export function enrollCourse(slug: string) {
  return authFetch<{ message: string }>(`/v1/courses/${slug}/enroll`, { method: 'POST' })
}

// Soft-drop — lesson_progress history is preserved, re-enrolling later
// (enrollCourse) picks back up rather than starting over.
export function unenrollCourse(slug: string) {
  return authFetch<{ message: string }>(`/v1/courses/${slug}/enroll`, { method: 'DELETE' })
}

export function completeLesson(id: number) {
  return authFetch<{ message: string }>(`/v1/lessons/${id}/complete`, { method: 'POST' })
}

export type QuizAttemptResult = {
  score: number
  total: number
  results: { questionId: number; correct: boolean; correctAnswerId: number | null }[]
}

export function attemptQuiz(lessonId: number, answers: { questionId: number; answerId: number }[]) {
  return authFetch<QuizAttemptResult>(`/v1/lessons/${lessonId}/attempt`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
}

export type MyEnrollment = {
  id: number
  courseId: number
  courseSlug: string
  courseTitle: string
  status: 'active' | 'completed'
  enrolledAt: string
  completedAt: string | null
  totalLessons: number
  completedLessons: number
}

export type MyLessonProgress = {
  lessonId: number
  lessonSlug: string
  lessonTitle: string
  lessonType: LessonType
  moduleSlug: string
  courseSlug: string
  status: 'not_started' | 'in_progress' | 'completed'
  completedAt: string | null
}

export function getMyProgress() {
  return authFetch<{ enrollments: MyEnrollment[]; lessonProgress: MyLessonProgress[] }>('/v1/me/progress')
}

export type MyStatistics = {
  coursesEnrolled: number
  coursesCompleted: number
  lessonsCompleted: number
  quizAttempts: number
  averageQuizScorePercent: number | null
  currentStreak: number
  streakActiveToday: boolean
}

export function getMyStatistics() {
  return authFetch<MyStatistics>('/v1/me/statistics')
}

export function getStreakReminderOptIn() {
  return authFetch<{ enabled: boolean }>('/v1/me/streak-reminder-opt-in')
}

export function setStreakReminderOptIn(enabled: boolean) {
  return authFetch<{ message: string }>('/v1/me/streak-reminder-opt-in', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  })
}

export type UserAchievement = {
  slug: string
  title: string
  description: string
  unlocked: boolean
  unlockedAt: string | null
}

export type UserProfile = {
  id: number
  displayName: string
  avatarUrl: string | null
  role: 'student' | 'contributor' | 'instructor' | 'staff'
  bio: string | null
  joinedAt: string
  achievements: UserAchievement[]
  // True only when anonymous_mode hid this profile's real data from the
  // current viewer — never true for the owner viewing their own profile
  // or for staff, who always see real data regardless of the setting.
  isAnonymous: boolean
}

export function getUserProfile(id: number) {
  return authFetch<UserProfile>(`/v1/users/${id}/profile`)
}

export function getAnonymousMode() {
  return authFetch<{ enabled: boolean }>('/v1/me/anonymous-mode')
}

export function setAnonymousMode(enabled: boolean) {
  return authFetch<{ message: string }>('/v1/me/anonymous-mode', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  })
}

export function getAnonymizeCourseAuthorship() {
  return authFetch<{ enabled: boolean }>('/v1/me/anonymize-course-authorship')
}

export function setAnonymizeCourseAuthorship(enabled: boolean) {
  return authFetch<{ message: string }>('/v1/me/anonymize-course-authorship', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  })
}

export function updateMyProfile(displayName: string, bio: string) {
  return authFetch<{ message: string }>('/v1/me/profile', {
    method: 'PUT',
    body: JSON.stringify({ displayName, bio }),
  })
}

export function uploadMyAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  return authFetchForm<{ avatarUrl: string }>('/v1/me/avatar', form)
}

// Per-user, non-repeatable — distinct from incrementResourceViews (src/lib/api.ts),
// which is the anonymous public view counter. Awards leaderboard XP (and,
// via the Bookworm achievement, evaluates achievements) the first time
// this user opens a given resource; every open after that silently
// no-ops server-side, so this is safe to call on every click.
export function openResource(id: number) {
  return authFetch<{ message: string }>(`/v1/library/${id}/open`, { method: 'POST' })
}

export type LeaderboardEntry = {
  rank: number
  id: number
  displayName: string
  avatarUrl: string | null
  xp: number
  isAnonymous: boolean
}

export function getLeaderboard() {
  return authFetch<LeaderboardEntry[]>('/v1/leaderboard')
}

// A bare R2 key (avatarUrl, a course's iconUrl, content_path, ...) — this
// builds the actual <img src>, same gated-assets base every other
// cross-subdomain image on this site already uses (see
// getResourceRequestFileUrl above).
export function getAssetSrc(key: string) {
  return `${AUTH_API_BASE}/v1/library/assets/${key}`
}

// users.role is genuinely 'staff' in D1 now (see
// worker/migrations/0019_administrator_to_staff.sql — a real schema
// migration, not just a display-label translation; that display-only
// approach was the interim state before this one shipped). This is just
// a plain capitalizer now, kept as the one place every UI surface gets
// a role label from, rather than each page rendering the raw string or
// keeping its own copy of the capitalization logic.
export function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/* ==================== Phase 4: authorization roles ==================== */

export type Role = 'student' | 'contributor' | 'instructor' | 'staff'
export type RequestStatus = 'pending' | 'approved' | 'rejected'

export type RoleRequest = {
  id: number
  userId: number
  requestedRole: Role
  message: string | null
  status: RequestStatus
  reviewedBy: number | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdAt: string
}

export type StaffRoleRequest = RoleRequest & {
  requesterEmail: string
  requesterDisplayName: string
}

export type ResourceRequest = {
  id: number
  userId: number
  title: string
  description: string | null
  type: 'pdf' | 'website' | 'videos' | 'git'
  category: string | null
  url: string | null
  hasFile: boolean
  status: RequestStatus
  reviewedBy: number | null
  reviewedAt: string | null
  rejectionReason: string | null
  resourceId: number | null
  createdAt: string
}

export type StaffResourceRequest = ResourceRequest & {
  requesterEmail: string
  requesterRole: Role
}

export type StaffUser = {
  id: number
  email: string
  displayName: string
  role: Role
  emailVerified: boolean
  bannedAt: string | null
  banReason: string | null
  isSuperAdmin: boolean
  createdAt: string
  securityEventCount: number
}

export type BlockedIp = {
  id: string
  ip: string
  note: string
  createdOn: string
}

// -------- Role requests --------

export function submitRoleRequest(requestedRole: 'contributor' | 'instructor', message: string) {
  return authFetch<{ message: string }>('/v1/role-requests', {
    method: 'POST',
    body: JSON.stringify({ requestedRole, message }),
  })
}

export function getMyRoleRequests() {
  return authFetch<RoleRequest[]>('/v1/role-requests/me')
}

export function getStaffRoleRequests(status?: RequestStatus) {
  return authFetch<StaffRoleRequest[]>(`/v1/staff/role-requests${status ? `?status=${status}` : ''}`)
}

export function reviewRoleRequest(id: number, action: 'approve' | 'reject', reason?: string) {
  return authFetch<{ message: string }>(`/v1/staff/role-requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action, reason }),
  })
}

// -------- Resource requests --------

export function submitResourceRequest(fields: {
  title: string
  description: string
  type: 'pdf' | 'website' | 'videos' | 'git'
  category: string
  url?: string
  file?: File
}) {
  const form = new FormData()
  form.set('title', fields.title)
  form.set('description', fields.description)
  form.set('type', fields.type)
  form.set('category', fields.category)
  if (fields.url) form.set('url', fields.url)
  if (fields.file) form.set('file', fields.file)

  return authFetchForm<{ message: string; id: number }>('/v1/resource-requests', form)
}

export function getMyResourceRequests() {
  return authFetch<ResourceRequest[]>('/v1/resource-requests/me')
}

export function getResourceRequestFileUrl(id: number) {
  return `${AUTH_API_BASE}/v1/resource-requests/${id}/file`
}

export function getStaffResourceRequests(status?: RequestStatus) {
  return authFetch<StaffResourceRequest[]>(`/v1/staff/resource-requests${status ? `?status=${status}` : ''}`)
}

export function reviewResourceRequest(id: number, action: 'approve' | 'reject', reason?: string) {
  return authFetch<{ message: string; resourceId?: number }>(`/v1/staff/resource-requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action, reason }),
  })
}

// -------- Staff: users --------

export function getStaffUsers() {
  return authFetch<StaffUser[]>('/v1/staff/users')
}

export function createStaffUser(email: string, displayName: string, role: Role) {
  return authFetch<{ message: string; id: number; setPasswordLink?: string; note?: string }>('/v1/staff/users', {
    method: 'POST',
    body: JSON.stringify({ email, displayName, role }),
  })
}

export function updateStaffUserRole(id: number, role: Role) {
  return authFetch<{ message: string }>(`/v1/staff/users/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  })
}

export function banStaffUser(id: number, reason: string) {
  return authFetch<{ message: string }>(`/v1/staff/users/${id}/ban`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  })
}

export function unbanStaffUser(id: number) {
  return authFetch<{ message: string }>(`/v1/staff/users/${id}/unban`, { method: 'PUT' })
}

export function deleteStaffUser(id: number) {
  return authFetch<{ message: string }>(`/v1/staff/users/${id}`, { method: 'DELETE' })
}

export function getStaffUserIps(id: number) {
  return authFetch<{ ips: string[] }>(`/v1/staff/users/${id}/ips`)
}

export type DisplayNameChange = { oldName: string; newName: string; changedAt: string }

export function getStaffUserNameHistory(id: number) {
  return authFetch<{ history: DisplayNameChange[] }>(`/v1/staff/users/${id}/name-history`)
}

export type SecurityEventType =
  | 'content_copy'
  | 'text_select_large'
  | 'devtools_opened'
  | 'scrape_pattern'
  | 'rate_limit_hit'
  | 'bot_user_agent'
  | 'multi_account_ip'
  | 'honeypot_hit'

export type SecurityEvent = { eventType: SecurityEventType; ip: string | null; detail: string | null; createdAt: string }

export function getStaffUserSecurityEvents(id: number) {
  return authFetch<{ events: SecurityEvent[] }>(`/v1/staff/users/${id}/security-events`)
}

// Client-observable signals only (server-observed ones — rate limit
// hits, bot user agents, multi-account IPs — are logged directly from
// the Worker, never through this). Fire-and-forget by every caller: a
// failure here should never interrupt whatever the user was doing.
export function reportSecurityEvent(type: 'content_copy' | 'text_select_large' | 'devtools_opened', detail?: string) {
  return authFetch<{ message: string }>('/v1/me/security-event', {
    method: 'POST',
    body: JSON.stringify({ type, detail }),
  })
}

export type HoneypotHit = {
  id: number
  path: string
  method: string
  ip: string | null
  userAgent: string | null
  referrer: string | null
  body: string | null
  confirmedBenignAt: string | null
  confirmedBenignBy: string | null
  matchedUser: { id: number; email: string; displayName: string } | null
  createdAt: string
}

export function getStaffHoneypotHits() {
  return authFetch<{ hits: HoneypotHit[] }>('/v1/staff/honeypot-hits')
}

export function confirmHoneypotHitBenign(id: number) {
  return authFetch<{ message: string }>(`/v1/staff/honeypot-hits/${id}/confirm-benign`, { method: 'PUT' })
}

// Grouped by (violatedDirective, blockedUri) server-side, not raw
// rows — the same broken directive fires once per blocked resource per
// pageload across every visitor, so a raw list would be mostly
// near-duplicates.
export type CspReportGroup = {
  violatedDirective: string | null
  blockedUri: string | null
  sourceFile: string | null
  count: number
  firstSeenAt: string
  lastSeenAt: string
}

export function getStaffCspReports() {
  return authFetch<{ groups: CspReportGroup[] }>('/v1/staff/csp-reports')
}

// -------- Staff: blocked IPs --------

export function getStaffBlockedIps() {
  return authFetch<BlockedIp[]>('/v1/staff/blocked-ips')
}

export function blockIp(ip: string, note?: string, userId?: number) {
  return authFetch<{ message: string; id: string }>('/v1/staff/blocked-ips', {
    method: 'POST',
    body: JSON.stringify({ ip, note, userId }),
  })
}

export function unblockIp(id: string) {
  return authFetch<{ message: string }>(`/v1/staff/blocked-ips/${id}`, { method: 'DELETE' })
}

// -------- Audit log --------

export type AuditLogEntry = {
  id: number
  actorEmail: string
  action: string
  targetLabel: string | null
  detail: string | null
  createdAt: string
}

export function getStaffAuditLog() {
  return authFetch<AuditLogEntry[]>('/v1/staff/audit-log')
}

// -------- Instructor: course authoring --------
// Write endpoints for the instructor course builder — distinct from the
// read-only Course/Lesson types above (getCourses/getLesson etc.), which
// are the public catalog shape. These carry status/rejectionReason and,
// for quiz answers, the actual `correct` flag — never exposed to the
// public read endpoints.

export type InstructorCourseStatus = 'draft' | 'pending_review' | 'published'

// Real id always present — see PublicCourseAuthor's comment above for
// why the instructor-facing shape doesn't share that type.
export type CourseAuthor = { id: number; displayName: string }

export type InstructorCourse = {
  id: number
  slug: string
  title: string
  description: string | null
  category: string | null
  status: InstructorCourseStatus
  rejectionReason: string | null
  position: number
  iconUrl: string | null
  iconGlyph: string | null
  difficulty: CourseDifficulty | null
  visibility: CourseVisibility
  createdBy: number
  authors: CourseAuthor[]
  viewCount: number
  enrolledCount: number
  completedCount: number
}

export type InstructorQuizAnswer = { id: number; body: string; correct: boolean; position: number }
export type InstructorQuizQuestion = { id: number; prompt: string; position: number; answers: InstructorQuizAnswer[] }

export type InstructorLesson = {
  id: number
  moduleId: number
  slug: string
  title: string
  type: LessonType
  contentPath: string | null
  videoUrl: string | null
  position: number
  exercise?: Exercise
  quiz?: { questions: InstructorQuizQuestion[] }
}

export type InstructorModule = {
  id: number
  courseId: number
  slug: string
  title: string
  description: string | null
  position: number
  lessons: InstructorLesson[]
}

export type InstructorCourseDetail = InstructorCourse & { modules: InstructorModule[]; groupIds: number[] }

export function createCourse(fields: { title: string; description?: string; category?: string }) {
  return authFetch<{ message: string; id: number; slug: string }>('/v1/instructor/courses', {
    method: 'POST',
    body: JSON.stringify(fields),
  })
}

export function getMyCourses() {
  return authFetch<InstructorCourse[]>('/v1/instructor/courses')
}

export function getMyCourse(id: number) {
  return authFetch<InstructorCourseDetail>(`/v1/instructor/courses/${id}`)
}

export type CourseAnalyticsLesson = {
  id: number
  title: string
  type: LessonType
  moduleId: number
  moduleTitle: string
  completedCount: number
  completionRatePercent: number | null
  quiz: { attemptCount: number; averageScorePercent: number | null } | null
}

export type CourseAnalytics = {
  courseId: number
  courseTitle: string
  enrollment: {
    active: number
    completed: number
    dropped: number
    total: number
    completionRatePercent: number | null
  }
  lessons: CourseAnalyticsLesson[]
}

export function getCourseAnalytics(id: number) {
  return authFetch<CourseAnalytics>(`/v1/instructor/courses/${id}/analytics`)
}

export function updateCourse(
  id: number,
  fields: { title: string; description?: string; category?: string; difficulty?: CourseDifficulty; visibility?: CourseVisibility; iconGlyph?: string }
) {
  return authFetch<{ message: string }>(`/v1/instructor/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  })
}

export function deleteCourse(id: number) {
  return authFetch<{ message: string }>(`/v1/instructor/courses/${id}`, { method: 'DELETE' })
}

export function uploadCourseIcon(courseId: number, file: File) {
  const form = new FormData()
  form.append('file', file)
  return authFetchForm<{ iconUrl: string }>(`/v1/instructor/courses/${courseId}/icon`, form)
}

export function addCourseAuthor(courseId: number, email: string) {
  return authFetch<{ message: string }>(`/v1/instructor/courses/${courseId}/authors`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function removeCourseAuthor(courseId: number, userId: number) {
  return authFetch<{ message: string }>(`/v1/instructor/courses/${courseId}/authors/${userId}`, { method: 'DELETE' })
}

export function setCourseGroups(courseId: number, groupIds: number[]) {
  return authFetch<{ message: string }>(`/v1/instructor/courses/${courseId}/groups`, {
    method: 'PUT',
    body: JSON.stringify({ groupIds }),
  })
}

export type StudentGroup = { id: number; name: string; createdAt: string; memberCount: number }
export type GroupMember = { id: number; email: string; displayName: string; addedAt: string }

export function getMyGroups() {
  return authFetch<StudentGroup[]>('/v1/instructor/groups')
}

export function createGroup(name: string) {
  return authFetch<{ id: number; message: string }>('/v1/instructor/groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function updateGroup(id: number, name: string) {
  return authFetch<{ message: string }>(`/v1/instructor/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export function deleteGroup(id: number) {
  return authFetch<{ message: string }>(`/v1/instructor/groups/${id}`, { method: 'DELETE' })
}

export function getGroupMembers(id: number) {
  return authFetch<GroupMember[]>(`/v1/instructor/groups/${id}/members`)
}

export function addGroupMember(id: number, email: string) {
  return authFetch<{ message: string }>(`/v1/instructor/groups/${id}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function removeGroupMember(id: number, userId: number) {
  return authFetch<{ message: string }>(`/v1/instructor/groups/${id}/members/${userId}`, { method: 'DELETE' })
}

export function submitCourseForReview(id: number) {
  return authFetch<{ message: string }>(`/v1/instructor/courses/${id}/submit-for-review`, { method: 'POST' })
}

export function createModule(courseId: number, fields: { title: string; description?: string }) {
  return authFetch<{ message: string; id: number }>(`/v1/instructor/courses/${courseId}/modules`, {
    method: 'POST',
    body: JSON.stringify(fields),
  })
}

export function updateModule(id: number, fields: { title: string; description?: string }) {
  return authFetch<{ message: string }>(`/v1/instructor/modules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  })
}

export function deleteModule(id: number) {
  return authFetch<{ message: string }>(`/v1/instructor/modules/${id}`, { method: 'DELETE' })
}

// Combined create/update body shape — type-specific fields alongside
// title, matching the Worker's own combined-body convention. type is only
// read on create; updateLesson always operates on the lesson's existing
// type (fixed at creation, same principle as slug).
export type LessonFields = {
  title: string
  type: LessonType
  videoUrl?: string
  prompt?: string
  language?: string
  starterCode?: string
  solutionNotes?: string
  questions?: { prompt: string; answers: { body: string; correct: boolean }[] }[]
}

export function createLesson(moduleId: number, fields: LessonFields) {
  return authFetch<{ message: string; id: number; slug: string }>(`/v1/instructor/modules/${moduleId}/lessons`, {
    method: 'POST',
    body: JSON.stringify(fields),
  })
}

export function updateLesson(id: number, fields: LessonFields) {
  return authFetch<{ message: string }>(`/v1/instructor/lessons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  })
}

export function deleteLesson(id: number) {
  return authFetch<{ message: string }>(`/v1/instructor/lessons/${id}`, { method: 'DELETE' })
}

// Article body only — writes straight to R2, separate from createLesson/
// updateLesson since content is markdown text, not a DB column.
export function saveLessonContent(lessonId: number, markdown: string) {
  return authFetch<{ message: string }>(`/v1/instructor/lessons/${lessonId}/content`, {
    method: 'PUT',
    body: JSON.stringify({ markdown }),
  })
}

// Module-scoped, not lesson-scoped — the R2 path only depends on
// course+module slugs, so an image can be uploaded before a new article
// lesson is even saved. Returns the filename to reference from markdown
// (e.g. `![alt](filename.png)`), same directory the article's own
// content_path resolves relative images against.
export function uploadLessonImage(moduleId: number, file: File) {
  const form = new FormData()
  form.set('file', file)
  return authFetchForm<{ message: string; filename: string }>(`/v1/instructor/modules/${moduleId}/images`, form)
}

// -------- Staff: pending counts --------

export type StaffPendingCounts = {
  roleRequests: number
  resourceRequests: number
  courseRequests: number
  totalUsers: number
}

export function getStaffPendingCounts() {
  return authFetch<StaffPendingCounts>('/v1/staff/pending-counts')
}

// -------- Staff: courses --------

export type StaffCourseStatus = 'pending' | 'published' | 'draft'

export type StaffPendingCourse = InstructorCourse & { instructorEmail: string }

export function getStaffCourses(status?: StaffCourseStatus) {
  return authFetch<StaffPendingCourse[]>(`/v1/staff/courses${status ? `?status=${status}` : ''}`)
}

export function deleteStaffCourse(id: number) {
  return authFetch<{ message: string }>(`/v1/staff/courses/${id}`, { method: 'DELETE' })
}

export function reviewCourse(id: number, action: 'approve' | 'reject', reason?: string) {
  return authFetch<{ message: string }>(`/v1/staff/courses/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify({ action, reason }),
  })
}
