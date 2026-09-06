import type { Metadata } from 'next'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthMessage from '@/components/auth/AuthMessage'
import VerifyResult from './VerifyResult'

// noindex — same reasoning as reset-password/verify-email: everything
// meaningful here lives in the query string (a specific certificate's
// signed data), not generic page content worth a search engine caching.
export const metadata: Metadata = {
  title: 'Verify Certificate',
  robots: { index: false, follow: false },
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; s?: string }>
}) {
  const { p, s } = await searchParams

  return (
    <AuthPageShell eyebrow="Certificate verification" heading="Verify a certificate" maxWidth="max-w-md">
      {p && s ? (
        <VerifyResult p={p} s={s} />
      ) : (
        <AuthMessage message="This link is missing its verification data — check the URL from the certificate." />
      )}
    </AuthPageShell>
  )
}
