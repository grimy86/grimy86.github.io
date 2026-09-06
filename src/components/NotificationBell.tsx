'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from './SessionProvider'
import { getMyNotifications, markNotificationsSeen, unwrapResult, type Notification } from '@/lib/authClient'
import { BellIcon } from './icons'

// Same "feels live without a push subscription" tradeoff as
// AccountShell's staff pending-count poll, just for every logged-in
// session rather than staff only — a plain count query, polled while a
// page is open, not a websocket.
const POLL_MS = 60000

function href(n: Notification, ownUserId: number) {
  if (n.type === 'achievement_unlocked') return `/u/${ownUserId}`
  return `/account/build/${n.courseId}`
}

function copy(n: Notification): { line: string; sub?: string } {
  switch (n.type) {
    case 'achievement_unlocked':
      return { line: `Achievement unlocked: ${n.title}` }
    case 'course_approved':
      return { line: `Your course "${n.courseTitle}" was approved` }
    case 'course_rejected':
      return { line: `Your course "${n.courseTitle}" was rejected`, sub: n.reason ?? undefined }
    case 'added_as_coauthor':
      return { line: `You were added as a co-author on "${n.courseTitle}"` }
  }
}

export default function NotificationBell() {
  const { user } = useSession()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['myNotifications'],
    queryFn: () => unwrapResult(getMyNotifications()),
    enabled: Boolean(user),
    refetchInterval: user ? POLL_MS : false,
  })

  // Close on an outside click — a dropdown with no backdrop needs this
  // or it just stays open forever once opened.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Marking seen happens on open, not on every poll — the list itself
  // stays visible either way, only the unread count/dot clears.
  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && data && data.unseenCount > 0) {
      queryClient.setQueryData(['myNotifications'], { ...data, unseenCount: 0 })
      markNotificationsSeen().catch(() => {})
    }
  }

  if (!user) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={data && data.unseenCount > 0 ? `Notifications (${data.unseenCount} unread)` : 'Notifications'}
        className="relative flex h-5 w-5 items-center justify-center text-[#90939A] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A33]"
      >
        <BellIcon className="h-4 w-4" />
        {data && data.unseenCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#FF7A33] px-0.5 text-[9px] font-bold text-[#0B0B0D]"
          >
            {data.unseenCount > 9 ? '9+' : data.unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-80 border border-white/10 bg-[#17181B] shadow-xl">
          <p className="border-b border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-white/40">Notifications</p>
          {!data || data.notifications.length === 0 ? (
            <p className="p-4 text-sm text-[#90939A]">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.notifications.map((n, i) => {
                const { line, sub } = copy(n)
                return (
                  <li key={`${n.type}-${n.at}-${i}`} className="border-b border-white/5 last:border-0">
                    <Link
                      href={href(n, user.id)}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      {line}
                      {sub && <span className="mt-1 block text-xs text-[#90939A]">{sub}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
