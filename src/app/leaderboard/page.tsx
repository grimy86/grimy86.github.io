'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/components/SessionProvider'
import { getLeaderboard, unwrapResult, getAssetSrc } from '@/lib/authClient'
import Eyebrow from '@/components/Eyebrow'
import { Skeleton, SkeletonRow } from '@/components/Skeleton'

// Session-gated read, same tier as /library and /u/[id] — not opt-in,
// not admin-only. Ranks every user with at least one XP event
// (worker/routes/leaderboard.js), same data that's already visible
// per-user on a public profile's achievements list.
export default function LeaderboardPage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useSession()

  const { data: entries, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => unwrapResult(getLeaderboard()),
    enabled: !!user,
  })

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace('/login')
    }
  }, [sessionLoading, user, router])

  if (sessionLoading || !user) {
    return (
      <main className="min-h-screen bg-[#0B0B0D]">
        <section className="mx-auto max-w-3xl px-6 pb-10 pt-20 sm:pt-28">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-10 w-48" />
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0B0B0D]">
      <section className="mx-auto max-w-3xl px-6 pb-10 pt-20 sm:pt-28">
        <Eyebrow>Ranked by XP</Eyebrow>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl">Leaderboard</h1>
        <p className="mt-4 max-w-lg leading-7 text-[#90939A]">
          Lessons, modules, quizzes, and courses completed, plus resources opened from the library — everything earns XP, once.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        {error && <p className="text-sm text-[#F85149] animate-fade-in-up motion-reduce:animate-none">{error.message}</p>}
        {entries ? (
          entries.length === 0 ? (
            <p className="border border-white/10 bg-[#17181B] p-6 text-sm text-[#90939A]">
              Nobody has earned any XP yet — complete a lesson or open a library resource to be the first on the board.
            </p>
          ) : (
            <ol className="border-l border-t border-white/10">
              {entries.map((entry) => {
                const isMe = entry.id === user.id
                return (
                  <li
                    key={entry.id}
                    className={`flex items-center gap-4 border-b border-r border-white/10 p-4 ${isMe ? 'bg-[#FF7A33]/10' : 'bg-[#17181B]'}`}
                  >
                    <span
                      className={`w-8 shrink-0 text-right text-sm font-bold tabular-nums ${
                        entry.rank <= 3 ? 'text-[#FF7A33]' : 'text-white/30'
                      }`}
                    >
                      {entry.rank}
                    </span>

                    {entry.isAnonymous ? (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-[#0B0B0D] text-base" title="This user has chosen to stay anonymous">
                        👻
                      </span>
                    ) : entry.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- cross-subdomain, session-cookie-gated asset; next/image can't proxy this
                      <img src={getAssetSrc(entry.avatarUrl)} alt="" className="h-9 w-9 shrink-0 border border-white/10 object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-[#0B0B0D] text-sm font-bold text-white/40">
                        {entry.displayName.slice(0, 1).toUpperCase()}
                      </span>
                    )}

                    {entry.isAnonymous ? (
                      // No link — an anonymized entry shouldn't offer a
                      // path to a profile page at all, even though that
                      // page would just show the same anonymized view.
                      <span className="flex-1 truncate text-sm font-semibold text-white/70">
                        {entry.displayName}
                        {isMe && <span className="ml-2 text-xs font-normal text-[#FF7A33]">(you)</span>}
                      </span>
                    ) : (
                      <Link href={`/u/${entry.id}`} className="flex-1 truncate text-sm font-semibold text-white transition-colors hover:text-[#FF7A33]">
                        {entry.displayName}
                        {isMe && <span className="ml-2 text-xs font-normal text-[#FF7A33]">(you)</span>}
                      </Link>
                    )}

                    <span className="shrink-0 text-sm font-bold tabular-nums text-white">{entry.xp.toLocaleString()} XP</span>
                  </li>
                )
              })}
            </ol>
          )
        ) : (
          !error && (
            <div className="border-l border-t border-white/10">
              <SkeletonRow count={8} />
            </div>
          )
        )}
      </section>
    </main>
  )
}
