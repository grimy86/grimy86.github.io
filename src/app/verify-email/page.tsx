import type { Metadata } from 'next'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthMessage from '@/components/auth/AuthMessage'
import VerifyEmailResult from './VerifyEmailResult'

// noindex — same reasoning as reset-password/page.tsx: a single-use
// token in the query string, nothing here worth a search engine caching.
export const metadata: Metadata = {
  title: 'Verify Email',
  robots: { index: false, follow: false },
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <AuthPageShell eyebrow="Email verification" heading="Verify your email">
      {token ? (
        <VerifyEmailResult token={token} />
      ) : (
        <AuthMessage message="This link is missing its token — check the link in your email." />
      )}
    </AuthPageShell>
  )
}
