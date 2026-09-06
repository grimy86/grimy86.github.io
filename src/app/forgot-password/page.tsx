import type { Metadata } from 'next'
import ForgotPasswordPageClient from './ForgotPasswordPageClient'

// See src/app/login/page.tsx's comment for why this split exists.
export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Reset your lowlevelnotes account password.',
  robots: { index: false, follow: true },
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />
}
