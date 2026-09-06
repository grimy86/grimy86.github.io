import type { Metadata } from 'next'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthMessage from '@/components/auth/AuthMessage'
import ResetPasswordForm from './ResetPasswordForm'

// noindex — same reasoning sitemap.ts already documents for this route:
// URLs here carry a single-use token in the query string, so there's
// nothing worth a search engine caching, and no reason to encourage a
// crawler anywhere near a page whose whole point is a password-reset
// token, even though a used/expired one is harmless.
export const metadata: Metadata = {
  title: 'Reset Password',
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <AuthPageShell eyebrow="Password recovery" heading="Reset your password" maxWidth="max-w-md">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <AuthMessage message="This link is missing its token — check the link in your email." />
      )}
    </AuthPageShell>
  )
}
