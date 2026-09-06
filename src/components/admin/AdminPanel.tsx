'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/components/SessionProvider'
import {
  getStaffUsers,
  createStaffUser,
  updateStaffUserRole,
  banStaffUser,
  unbanStaffUser,
  deleteStaffUser,
  getStaffUserIps,
  getStaffUserNameHistory,
  getStaffUserSecurityEvents,
  getStaffBlockedIps,
  blockIp,
  unblockIp,
  getStaffAuditLog,
  getStaffPendingCounts,
  getStaffHoneypotHits,
  confirmHoneypotHitBenign,
  unwrapResult,
  roleLabel,
  type Role,
} from '@/lib/authClient'
import { SectionHeading, inputClass, rowInputClass, buttonClass, blockButtonClass } from '@/components/admin/shared'
import Eyebrow from '@/components/Eyebrow'
import { useToast } from '@/components/ToastProvider'
import { Skeleton, SkeletonRow } from '@/components/Skeleton'
import RoleRequestsPanel from '@/components/admin/RoleRequestsPanel'
import ResourceRequestsPanel from '@/components/admin/ResourceRequestsPanel'
import CourseRequestsPanel from '@/components/admin/CourseRequestsPanel'

type Tab = 'users' | 'ips' | 'honeypot' | 'log' | 'requests'
const TAB_IDS: Tab[] = ['users', 'ips', 'honeypot', 'requests', 'log']

const ACTION_LABELS: Record<string, string> = {
  role_change: 'Role change',
  ban: 'Ban',
  unban: 'Unban',
  delete_user: 'Delete user',
  create_user: 'Create user',
  block_ip: 'Block IP',
  unblock_ip: 'Unblock IP',
  approve_role_request: 'Approve role request',
  reject_role_request: 'Reject role request',
  approve_resource_request: 'Approve resource request',
  reject_resource_request: 'Reject resource request',
  approve_course: 'Approve course',
  reject_course: 'Reject course',
  delete_course: 'Delete course',
  confirm_benign_honeypot_hit: 'Confirm honeypot hit benign',
}

const ROLES: Role[] = ['student', 'contributor', 'instructor', 'staff']

// Reads ?tab= without next/navigation's useSearchParams, which forces a
// Suspense boundary on the whole route — this page is already client-only
// and gated behind a session check, so a plain URL read is enough.
function initialTabFromUrl(): Tab {
  if (typeof window === 'undefined') return 'users'
  const tab = new URLSearchParams(window.location.search).get('tab')
  return TAB_IDS.includes(tab as Tab) ? (tab as Tab) : 'users'
}

export default function AdminPanel() {
  // Lets CourseReviewPanel's "back to list" and breadcrumb link land back
  // on the requests tab (?tab=requests) instead of always resetting to
  // Users, now that course review no longer has its own route to
  // redirect back to.
  const [tab, setTab] = useState<Tab>(initialTabFromUrl)

  // Each of these three queries is also run independently inside its own
  // tab's section component below — same query keys, so React Query
  // dedupes them into one shared cache entry apiece instead of this
  // needing an onXLoaded callback to lift the data up.
  const { data: users } = useQuery({ queryKey: ['staffUsers'], queryFn: () => unwrapResult(getStaffUsers()) })
  const { data: ips } = useQuery({ queryKey: ['staffBlockedIps'], queryFn: () => unwrapResult(getStaffBlockedIps()) })
  const { data: pendingCounts } = useQuery({ queryKey: ['staffPendingCounts'], queryFn: () => unwrapResult(getStaffPendingCounts()) })
  const { data: honeypotHits } = useQuery({ queryKey: ['staffHoneypotHits'], queryFn: () => unwrapResult(getStaffHoneypotHits()) })

  const userCount = users?.length ?? null
  const bannedCount = users ? users.filter((u) => u.bannedAt).length : null
  const ipCount = ips?.length ?? null
  const pendingTotal = pendingCounts ? pendingCounts.roleRequests + pendingCounts.resourceRequests + pendingCounts.courseRequests : null
  const honeypotCount = honeypotHits?.hits.length ?? null

  // Approvals used to live on their own /account/approvals nav item —
  // folded in here as tabs (with the same pending counts as badges) so
  // the account sidebar has one staff entry instead of two. The three
  // request types themselves later folded into one "Requests" tab
  // (2026-09-06) — three separate tabs for what's all "things awaiting
  // review" was one tab too many; scrolling through one combined list is
  // fine at this app's volume.
  const TABS: { id: Tab; label: string; badge?: number | null }[] = [
    { id: 'users', label: 'Users' },
    { id: 'ips', label: 'Blocked IPs' },
    { id: 'honeypot', label: 'Honeypot' },
    { id: 'requests', label: 'Requests', badge: pendingTotal },
    { id: 'log', label: 'Activity log' },
  ]

  return (
    <div>
      <Eyebrow>Staff</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] text-white">Staff</h1>

      <div className="mt-8 grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-5">
        <StatTile label="Total users" value={userCount} />
        <StatTile label="Banned" value={bannedCount} />
        <StatTile label="Blocked IPs" value={ipCount} />
        <StatTile label="Pending approvals" value={pendingTotal} accent={Boolean(pendingTotal)} />
        <StatTile label="Honeypot hits" value={honeypotCount} accent={Boolean(honeypotCount)} />
      </div>

      <div className="mt-10 flex flex-wrap gap-2 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium uppercase tracking-[0.1em] transition-colors ${
              tab === t.id ? 'border-[#FF7A33] text-white' : 'border-transparent text-[#90939A] hover:text-white'
            }`}
          >
            {t.label}
            {Boolean(t.badge) && (
              <span className="flex h-4 min-w-4 items-center justify-center bg-[#FF7A33] px-1 text-[10px] font-bold normal-case tracking-normal text-[#0D0D0D]">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'users' && <UsersSection />}
        {tab === 'ips' && <BlockedIpsSection />}
        {tab === 'honeypot' && <HoneypotSection />}
        {tab === 'requests' && (
          <div className="flex flex-col gap-12">
            <RoleRequestsPanel />
            <div className="border-t border-white/10 pt-12">
              <ResourceRequestsPanel />
            </div>
            <div className="border-t border-white/10 pt-12">
              <CourseRequestsPanel />
            </div>
          </div>
        )}
        {tab === 'log' && <AuditLogSection />}
      </div>
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div className="bg-[#17181B] p-4">
      <p className={`text-2xl font-bold tabular-nums tracking-[-0.03em] ${accent ? 'text-[#FF7A33]' : 'text-white'}`}>
        {value === null ? '—' : value}
      </p>
      <p className="mt-1 text-xs text-[#90939A]">{label}</p>
    </div>
  )
}

/* ==================== Users ==================== */

function UsersSection() {
  const { user: currentUser } = useSession()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: users, error } = useQuery({ queryKey: ['staffUsers'], queryFn: () => unwrapResult(getStaffUsers()) })
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [expandedNameIds, setExpandedNameIds] = useState<Set<number>>(new Set())
  const [expandedSecurityIds, setExpandedSecurityIds] = useState<Set<number>>(new Set())

  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<Role>('student')

  function invalidateUsers() {
    return queryClient.invalidateQueries({ queryKey: ['staffUsers'] })
  }

  const createMutation = useMutation({
    mutationFn: () => unwrapResult(createStaffUser(newEmail, newName, newRole)),
    onSuccess: () => {
      setNewEmail('')
      setNewName('')
      invalidateUsers()
    },
  })

  // One mutation instance per action type, shared across every row (not
  // one per row) — see the `refreshing` derivation below. Deleting or
  // banning a user removes their row and every row below it shifts up to
  // fill the gap: a real, reported incident was a fast second click right
  // after a delete landed on a *different* user's now-repositioned Delete
  // button, deleting an unrelated account by accident. Disabling every
  // row's mutating controls for the whole reflow window (not just the row
  // that was acted on) closes that window instead of just narrowing it —
  // sharing one mutation per action across all rows means `isPending` is
  // already "is ANY row doing this," with no extra bookkeeping needed.
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => unwrapResult(updateStaffUserRole(id, role)),
    onSuccess: () => {
      invalidateUsers()
      toast.success('Role updated.')
    },
    onError: (error) => toast.error(error.message),
  })
  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => unwrapResult(banStaffUser(id, reason)),
    onSuccess: () => {
      invalidateUsers()
      toast.success('User banned.')
    },
    onError: (error) => toast.error(error.message),
  })
  const unbanMutation = useMutation({
    mutationFn: (id: number) => unwrapResult(unbanStaffUser(id)),
    onSuccess: () => {
      invalidateUsers()
      toast.success('User unbanned.')
    },
    onError: (error) => toast.error(error.message),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => unwrapResult(deleteStaffUser(id)),
    onSuccess: () => {
      invalidateUsers()
      toast.success('User deleted.')
    },
    onError: (error) => toast.error(error.message),
  })
  const refreshing = roleMutation.isPending || banMutation.isPending || unbanMutation.isPending || deleteMutation.isPending

  const createResult = createMutation.isSuccess
    ? (createMutation.data.setPasswordLink ? `Created. Set-password link: ${createMutation.data.setPasswordLink}` : 'Created. Set-password email sent.')
    : createMutation.error?.message ?? null

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate()
  }

  function handleBan(id: number) {
    const reason = window.prompt('Ban reason (shown to no one but staff):')
    if (reason === null) return
    banMutation.mutate({ id, reason })
  }

  function handleDelete(id: number, email: string) {
    if (!window.confirm(`Permanently delete ${email}? This cannot be undone.`)) return
    deleteMutation.mutate(id)
  }

  function toggleIps(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleNames(id: number) {
    setExpandedNameIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSecurity(id: number) {
    setExpandedSecurityIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <SectionHeading>Users</SectionHeading>

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="email" required placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputClass} />
        <input type="text" required placeholder="Display name" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className={inputClass}>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <button type="submit" disabled={createMutation.isPending} className={buttonClass}>{createMutation.isPending ? '…' : 'Create user'}</button>
      </form>
      {createResult && <p className="mt-2 break-all text-xs text-[#90939A]">{createResult}</p>}

      {error && <p className="mt-4 text-sm text-[#F85149] animate-fade-in-up motion-reduce:animate-none">{error.message}</p>}

      <div className="mt-6 border-l border-t border-white/10">
        {users === undefined && <SkeletonRow count={3} />}
        {users?.map((u) => {
          const locked = u.isSuperAdmin && !currentUser?.isSuperAdmin
          return (
          <div key={u.id} className="border-b border-r border-white/10 bg-[#17181B] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-white">{u.displayName}</span>
              <span className="text-xs text-[#90939A]">{u.email}</span>
              {u.isSuperAdmin && <span className="text-xs uppercase tracking-[0.1em] text-[#FF7A33]">Super admin</span>}
              {u.bannedAt && <span className="text-xs uppercase tracking-[0.1em] text-[#F85149]">Banned{u.banReason ? `: ${u.banReason}` : ''}</span>}
              {!u.emailVerified && <span className="text-xs uppercase tracking-[0.1em] text-white/40">Unverified</span>}
              {u.securityEventCount > 0 && (
                <span className="text-xs uppercase tracking-[0.1em] text-[#F0B429]" title="Security signals logged for this account — see below">
                  ⚠ {u.securityEventCount}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select value={u.role} disabled={locked || refreshing} onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value as Role })} className={`${rowInputClass} disabled:opacity-50`}>
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              {u.bannedAt
                ? <button type="button" disabled={locked || refreshing} onClick={() => unbanMutation.mutate(u.id)} className={buttonClass}>Unban</button>
                : <button type="button" disabled={locked || refreshing} onClick={() => handleBan(u.id)} className={buttonClass}>Ban</button>}
              <button type="button" disabled={locked || refreshing} onClick={() => handleDelete(u.id, u.email)} className={buttonClass}>Delete</button>
              <button type="button" onClick={() => toggleIps(u.id)} className={buttonClass}>
                {expandedIds.has(u.id) ? 'Hide IPs' : 'View IPs'}
              </button>
              <button type="button" onClick={() => toggleNames(u.id)} className={buttonClass}>
                {expandedNameIds.has(u.id) ? 'Hide name history' : 'View name history'}
              </button>
              <button type="button" onClick={() => toggleSecurity(u.id)} className={buttonClass}>
                {expandedSecurityIds.has(u.id) ? 'Hide security events' : `View security events${u.securityEventCount > 0 ? ` (${u.securityEventCount})` : ''}`}
              </button>
            </div>

            {expandedIds.has(u.id) && <UserIpsList userId={u.id} />}
            {expandedNameIds.has(u.id) && <UserNameHistoryList userId={u.id} />}
            {expandedSecurityIds.has(u.id) && <UserSecurityEventsList userId={u.id} />}
          </div>
          )
        })}
      </div>
    </div>
  )
}

// Its own query (['staffUserIps', userId]) so re-expanding a row already
// viewed this session shows instantly from cache instead of refetching.
function UserIpsList({ userId }: { userId: number }) {
  const toast = useToast()
  const { data } = useQuery({ queryKey: ['staffUserIps', userId], queryFn: () => unwrapResult(getStaffUserIps(userId)) })
  const blockMutation = useMutation({
    mutationFn: ({ ip }: { ip: string }) => unwrapResult(blockIp(ip, undefined, userId)),
    onError: (error) => toast.error(error.message),
  })

  function handleBlockIp(ip: string) {
    if (!window.confirm(`Block ${ip} at the Cloudflare edge?`)) return
    blockMutation.mutate({ ip }, { onSuccess: () => toast.success(`${ip} blocked.`) })
  }

  if (!data) {
    return <Skeleton className="mt-3 h-4 w-32" />
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {data.ips.length === 0 && <span className="text-xs text-[#90939A]">No IPs on record.</span>}
      {data.ips.map((ip) => (
        <div key={ip} className="flex items-center gap-3 text-xs text-[#90939A]">
          <span className="font-mono">{ip}</span>
          <button type="button" onClick={() => handleBlockIp(ip)} className="text-[#F85149] underline underline-offset-2 hover:text-white">
            Block
          </button>
        </div>
      ))}
    </div>
  )
}

// Its own query (['staffUserNameHistory', userId]) for the same
// re-expand-from-cache reason as UserIpsList above.
function UserNameHistoryList({ userId }: { userId: number }) {
  const { data } = useQuery({ queryKey: ['staffUserNameHistory', userId], queryFn: () => unwrapResult(getStaffUserNameHistory(userId)) })

  if (!data) {
    return <Skeleton className="mt-3 h-4 w-32" />
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {data.history.length === 0 && <span className="text-xs text-[#90939A]">No name changes on record.</span>}
      {data.history.map((change, i) => (
        <div key={i} className="text-xs text-[#90939A]">
          <span className="text-white">{change.oldName}</span> → <span className="text-white">{change.newName}</span>
          <span className="ml-2 text-white/40">{new Date(change.changedAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

const SECURITY_EVENT_LABELS: Record<string, string> = {
  content_copy: 'Copied lesson content',
  text_select_large: 'Selected a large block of text',
  devtools_opened: 'Devtools opened (low confidence)',
  scrape_pattern: 'Bulk-download pattern',
  rate_limit_hit: 'Hit a rate limit',
  bot_user_agent: 'Non-browser user agent',
  multi_account_ip: 'Shares an IP with other accounts',
  honeypot_hit: 'Visited the decoy admin page',
}

// Its own query (['staffUserSecurityEvents', userId]) for the same
// re-expand-from-cache reason as UserIpsList/UserNameHistoryList above.
function UserSecurityEventsList({ userId }: { userId: number }) {
  const { data } = useQuery({ queryKey: ['staffUserSecurityEvents', userId], queryFn: () => unwrapResult(getStaffUserSecurityEvents(userId)) })

  if (!data) {
    return <Skeleton className="mt-3 h-4 w-32" />
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {data.events.length === 0 && <span className="text-xs text-[#90939A]">No security signals on record.</span>}
      {data.events.map((event, i) => (
        <div key={i} className="text-xs text-[#90939A]">
          <span className="text-white">{SECURITY_EVENT_LABELS[event.eventType] ?? event.eventType}</span>
          {event.detail && <span className="ml-2 text-[#90939A]">{event.detail}</span>}
          {event.ip && <span className="ml-2 font-mono text-white/40">{event.ip}</span>}
          <span className="ml-2 text-white/40">{new Date(event.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

/* ==================== Blocked IPs ==================== */

function BlockedIpsSection() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: ips, error } = useQuery({ queryKey: ['staffBlockedIps'], queryFn: () => unwrapResult(getStaffBlockedIps()) })
  const [newIp, setNewIp] = useState('')
  const [newNote, setNewNote] = useState('')

  function invalidateIps() {
    return queryClient.invalidateQueries({ queryKey: ['staffBlockedIps'] })
  }

  const addMutation = useMutation({
    mutationFn: () => unwrapResult(blockIp(newIp, newNote || undefined)),
    onSuccess: () => {
      setNewIp('')
      setNewNote('')
      invalidateIps()
      toast.success('IP blocked.')
    },
    onError: (error) => toast.error(error.message),
  })
  // Shared across every row, same reasoning as UsersSection's refreshing
  // guard — Unblock removes a row and shifts the rest.
  const removeMutation = useMutation({
    mutationFn: (id: string) => unwrapResult(unblockIp(id)),
    onSuccess: () => {
      invalidateIps()
      toast.success('IP unblocked.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    addMutation.mutate()
  }

  return (
    <div>
      <SectionHeading>Blocked IPs</SectionHeading>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="text" required placeholder="IP address" value={newIp} onChange={(e) => setNewIp(e.target.value)} className={inputClass} />
        <input type="text" placeholder="Note (optional)" value={newNote} onChange={(e) => setNewNote(e.target.value)} className={inputClass} />
        <button type="submit" disabled={addMutation.isPending} className={blockButtonClass}>{addMutation.isPending ? '…' : 'Block'}</button>
      </form>

      {error && <p className="mt-4 text-sm text-[#F85149] animate-fade-in-up motion-reduce:animate-none">{error.message}</p>}

      <div className="mt-6 border-l border-t border-white/10">
        {ips === undefined && !error && <SkeletonRow count={3} />}
        {ips?.length === 0 && <p className="border-b border-r border-white/10 bg-[#17181B] p-4 text-sm text-[#90939A]">Nothing blocked.</p>}
        {ips?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-r border-white/10 bg-[#17181B] p-4">
            <div>
              <span className="font-mono text-sm text-white">{r.ip}</span>
              {r.note && <span className="ml-3 text-xs text-[#90939A]">{r.note}</span>}
            </div>
            <button type="button" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(r.id)} className={buttonClass}>Unblock</button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==================== Honeypot ==================== */

// /admin (src/app/admin/page.tsx) is a decoy login page never linked from
// anywhere on the real site — no legitimate visitor has a reason to land
// on it, so every row here is a scanner, bot, or someone manually probing
// for an admin panel. Read-only besides the one-click block, same reason
// AuditLogSection is read-only: there's nothing to configure, just signal
// to watch.
function HoneypotSection() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data, error } = useQuery({ queryKey: ['staffHoneypotHits'], queryFn: () => unwrapResult(getStaffHoneypotHits()) })

  function invalidateHits() {
    return queryClient.invalidateQueries({ queryKey: ['staffHoneypotHits'] })
  }

  const blockMutation = useMutation({
    mutationFn: (ip: string) => unwrapResult(blockIp(ip, 'Honeypot hit')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffBlockedIps'] })
      toast.success('IP blocked.')
    },
    onError: (error) => toast.error(error.message),
  })
  // Shared across every row rather than one instance per row, same
  // reflow-safety reasoning as UsersSection's mutations — confirming one
  // row doesn't remove it here, but keeping the pattern consistent costs
  // nothing.
  const confirmMutation = useMutation({
    mutationFn: (id: number) => unwrapResult(confirmHoneypotHitBenign(id)),
    onSuccess: () => {
      invalidateHits()
      toast.success('Marked benign.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleBlock(ip: string) {
    if (!window.confirm(`Block ${ip} at the Cloudflare edge?`)) return
    blockMutation.mutate(ip)
  }

  return (
    <div>
      <SectionHeading>Honeypot</SectionHeading>
      <p className="mt-2 max-w-2xl text-sm text-[#90939A]">
        Visits to /admin — a decoy admin login not linked anywhere on the real site. Anyone here found it by guessing, so treat every row as a scanner or bot. A POST row means something submitted credentials directly, without ever loading the page — its payload is shown below the row. A blue tag means the IP matches a real account on file — that visit is also logged on that account&apos;s own security events.
      </p>

      {error && <p className="mt-4 text-sm text-[#F85149] animate-fade-in-up motion-reduce:animate-none">{error.message}</p>}

      <div className="mt-6 border-l border-t border-white/10">
        {data === undefined && !error && <SkeletonRow count={3} />}
        {data?.hits.length === 0 && <p className="border-b border-r border-white/10 bg-[#17181B] p-4 text-sm text-[#90939A]">No hits yet.</p>}
        {data?.hits.map((hit) => (
          <div key={hit.id} className={`flex flex-wrap items-center justify-between gap-3 border-b border-r border-white/10 bg-[#17181B] p-4 ${hit.confirmedBenignAt ? 'opacity-50' : ''}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`text-xs font-semibold uppercase tracking-[0.08em] ${hit.method === 'GET' ? 'text-white/40' : 'text-[#F0B429]'}`}
                  title={hit.method !== 'GET' ? 'A direct submission, not a page load — the client never rendered this as a browser would.' : undefined}
                >
                  {hit.method}
                </span>
                <span className="font-mono text-sm text-white">{hit.ip ?? 'unknown IP'}</span>
                <span className="text-xs text-white/40">{new Date(hit.createdAt).toLocaleString()}</span>
                {hit.matchedUser && (
                  <span className="text-xs uppercase tracking-[0.08em] text-[#58A6FF]" title="A session or login is on file from this IP">
                    matches {hit.matchedUser.displayName} ({hit.matchedUser.email})
                  </span>
                )}
              </div>
              {hit.path && hit.path !== '/admin' && <p className="mt-1 break-all font-mono text-xs text-white/40">{hit.path}</p>}
              {hit.userAgent && <p className="mt-1 break-all text-xs text-[#90939A]">{hit.userAgent}</p>}
              {hit.referrer && <p className="mt-1 break-all text-xs text-white/40">from {hit.referrer}</p>}
              {hit.body && (
                <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all border border-white/10 bg-black/30 p-2 text-xs text-[#F0B429]">
                  {hit.body}
                </pre>
              )}
              {hit.confirmedBenignAt && (
                <p className="mt-1 text-xs text-[#3FB950]">✓ Confirmed benign by {hit.confirmedBenignBy} on {new Date(hit.confirmedBenignAt).toLocaleString()}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!hit.confirmedBenignAt && (
                <button type="button" disabled={confirmMutation.isPending} onClick={() => confirmMutation.mutate(hit.id)} className="text-xs text-[#3FB950] underline underline-offset-2 hover:text-white">
                  Confirm non-malicious
                </button>
              )}
              {hit.ip && (
                <button type="button" disabled={blockMutation.isPending} onClick={() => handleBlock(hit.ip!)} className="text-xs text-[#F85149] underline underline-offset-2 hover:text-white">
                  Block
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==================== Audit log ==================== */

// What makes the super-admin role above actually mean something — a
// super admin isn't meant to do day-to-day administration, they're meant
// to spot-check this. Read-only, no filters yet: at this scale scrolling
// the latest 200 entries is enough, and every staff member can see it
// (not just super admins) — there's nothing here anyone could use to
// cover their tracks, so there's no reason to hide it.
function AuditLogSection() {
  const { data: entries, error } = useQuery({ queryKey: ['staffAuditLog'], queryFn: () => unwrapResult(getStaffAuditLog()) })

  return (
    <div>
      <SectionHeading>Activity log</SectionHeading>

      {error && <p className="mt-4 text-sm text-[#F85149] animate-fade-in-up motion-reduce:animate-none">{error.message}</p>}

      <div className="mt-6 border-l border-t border-white/10">
        {entries === undefined && !error && <SkeletonRow count={3} />}
        {entries?.length === 0 && <p className="border-b border-r border-white/10 bg-[#17181B] p-4 text-sm text-[#90939A]">Nothing logged yet.</p>}
        {entries?.map((e) => (
          <div key={e.id} className="border-b border-r border-white/10 bg-[#17181B] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-white">{ACTION_LABELS[e.action] ?? e.action}</span>
                {e.targetLabel && <span className="ml-2 text-xs text-[#90939A]">→ {e.targetLabel}</span>}
              </div>
              <span className="shrink-0 text-xs text-white/40">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-[#90939A]">by {e.actorEmail}</p>
            {e.detail && <p className="mt-2 text-sm text-[#90939A]">{e.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
