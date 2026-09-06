'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from './SessionProvider'
import { getAssetSrc } from '@/lib/authClient'

const links = [
  { href: '/', label: 'home' },
  { href: '/courses', label: 'courses' },
  { href: '/library', label: 'library' },
  { href: '/leaderboard', label: 'leaderboard' },
  { href: '/changelog', label: 'changelog' },
]

export default function Header() {
  const pathname = usePathname()
  const { user, loading } = useSession()

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0D]/90 backdrop-blur-md">
      <nav aria-label="Primary navigation">
        <div className="mx-auto flex max-w-6xl items-center px-6">
          <Link href="/" className="mr-6 flex shrink-0 items-baseline py-4 text-sm font-bold tracking-[-0.06em] text-white transition-colors hover:text-[#FF7A33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A33]" aria-label="0xLLN home">
            <span className="text-[#FF7A33]">0x</span>LLN
          </Link>

          <div className="-mx-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {links.map((link) => {
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative shrink-0 px-3 py-4 text-xs font-medium uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#FF7A33] ${
                    active
                      ? 'text-white'
                      : 'text-[#90939A] hover:text-white'
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute inset-x-3 bottom-0 h-px origin-center scale-x-0 bg-[#FF7A33] transition-transform duration-150 motion-reduce:transition-none ${active ? 'scale-x-100' : ''}`}
                    aria-hidden="true"
                  />
                </Link>
              )
            })}
          </div>

          {!loading && (
            <div className="ml-5 shrink-0 border-l border-white/10 pl-5">
              {user ? (
                <Link
                  href="/account/courses"
                  className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[#90939A] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A33]"
                >
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- cross-subdomain, session-cookie-gated asset; next/image can't proxy this
                    <img src={getAssetSrc(user.avatarUrl)} alt="" className="h-5 w-5 shrink-0 object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center bg-white/10 text-[9px] font-bold normal-case text-white/60">
                      {user.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {user.displayName}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="text-xs font-medium uppercase tracking-[0.12em] text-[#FF7A33] transition-colors hover:text-[#FF9459] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A33]"
                >
                  Login
                </Link>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}
