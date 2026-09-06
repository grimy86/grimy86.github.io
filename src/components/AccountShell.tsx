'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/components/SessionProvider'
import { useToast } from '@/components/ToastProvider'
import { getStaffPendingCounts, logout, unwrapResult, type StaffPendingCounts } from '@/lib/authClient'
import { Skeleton } from '@/components/Skeleton'

// How often a staff session polls for new users/requests while a
// dashboard page is open, to surface them as a toast without needing a
// manual refresh. 30s balances "feels live" against hammering the
// endpoint — this is a plain count query, not a push subscription.
const STAFF_POLL_MS = 30000

type NavItem = { href: string; label: string; badge?: number | null }

// The persistent sidebar + content grid shared across every /account/*
// route (via account/layout.tsx) — and, separately, by the public profile
// page when you're viewing your own: profile editing was folded into
// /u/[id] rather than kept as its own /account/profile page, but it should
// still read as part of the dashboard rather than a page that drops you
// out of it, so it renders inside this same shell instead of a plain
// standalone <main>.
export default function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, refresh } = useSession()
  const toast = useToast()
  // Same ['staffPendingCounts'] key as AdminPanel's approvals tabs — this
  // sidebar badge and those tabs' own counts now share one cached fetch
  // instead of each independently hitting the endpoint. refetchInterval
  // keeps it polling in the background for as long as a staff member has
  // any /account page open, which is what makes the toasts below live
  // rather than only updating on the next manual navigation.
  const { data: pendingCounts } = useQuery({
    queryKey: ['staffPendingCounts'],
    queryFn: () => unwrapResult(getStaffPendingCounts()),
    enabled: user?.role === 'staff',
    refetchInterval: user?.role === 'staff' ? STAFF_POLL_MS : false,
  })

  // Toasts on an increase in any count since the last time this ran —
  // seeded (not toasted) on the very first load, so opening the
  // dashboard with 3 pending requests doesn't fire 3 "new" toasts for
  // things that were already sitting there. Compares against a ref
  // rather than component state so a background poll's setState doesn't
  // itself retrigger this effect before the comparison happens.
  const previousCounts = useRef<StaffPendingCounts | null>(null)
  useEffect(() => {
    if (!pendingCounts) return
    const prev = previousCounts.current
    previousCounts.current = pendingCounts

    if (!prev) return
    if (pendingCounts.roleRequests > prev.roleRequests) toast.info('New role request.')
    if (pendingCounts.resourceRequests > prev.resourceRequests) toast.info('New resource request.')
    if (pendingCounts.courseRequests > prev.courseRequests) toast.info('New course submitted for review.')
    if (pendingCounts.totalUsers > prev.totalUsers) toast.info('New user registered.')
  }, [pendingCounts, toast])

  const pendingTotal = pendingCounts
    ? pendingCounts.roleRequests + pendingCounts.resourceRequests + pendingCounts.courseRequests
    : 0

  // Navigates away before clearing session state, not after — every
  // /account page has its own "redirect to /login if logged out" effect,
  // and nulling `user` while one of them is still mounted races that
  // effect against this navigation (whichever settles last silently
  // wins). Leaving the page while `user` is still (stale) truthy means
  // none of them ever observe the logged-out state, so nothing fires.
  async function handleLogout() {
    await logout()
    router.push('/')
    await refresh()
  }

  const items: NavItem[] = user
    ? [
        { href: `/u/${user.id}`, label: 'Profile' },
        { href: '/account/security', label: 'Security' },
        { href: '/account/courses', label: 'Courses' },
        { href: '/account/contribute', label: 'Contribute' },
        ...(user.role === 'staff'
          ? [{ href: '/account/staff', label: 'Staff', badge: pendingTotal > 0 ? pendingTotal : null }]
          : []),
      ]
    : []

  return (
    <main className="min-h-screen bg-[#0B0B0D]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 pb-24 pt-20 sm:pt-28 md:grid-cols-[200px_1fr]">
        <nav aria-label="Account navigation" className="md:sticky md:top-24 md:self-start">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-white/40">Dashboard</p>
          {loading || !user ? (
            // Sized and shaped like real nav rows (not a single generic
            // blob) — the plain h-32 box this replaced didn't read as
            // "nav is loading" and was shorter than the real list, so
            // the sidebar visibly jumped taller the moment it resolved.
            <div className="flex flex-col gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="ml-0.5 h-5 w-24" />
              ))}
            </div>
          ) : (
            <div className="flex flex-row flex-wrap gap-1 md:flex-col md:flex-nowrap">
              {items.map((item) => {
                // The course editor (/account/build/[id]) and group
                // manager (/account/build/groups) stayed their own routes
                // when the old standalone /account/build landing page
                // folded into Contribute — they're reached from there, so
                // Contribute should still read as active while on either.
                const active = pathname.startsWith(item.href) || (item.href === '/account/contribute' && pathname.startsWith('/account/build'))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 border-l-2 px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A33] ${
                      active ? 'border-[#FF7A33] bg-white/5 text-white' : 'border-transparent text-[#90939A] hover:text-white'
                    }`}
                  >
                    {item.label}
                    {Boolean(item.badge) && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center bg-[#FF7A33] px-1 text-[10px] font-bold text-[#0D0D0D]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 border-l-2 border-transparent px-3 py-2 text-left text-sm text-[#90939A] transition-colors hover:text-[#F85149] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A33] md:mt-4 md:border-t md:border-white/10 md:pt-4"
              >
                Log out
              </button>
            </div>
          )}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  )
}
