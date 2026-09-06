import type { Metadata } from 'next'
import RegisterPageClient from './RegisterPageClient'

// See src/app/login/page.tsx's comment for why this split exists.
export const metadata: Metadata = {
  title: 'Register',
  description: 'Create a free lowlevelnotes account to track course progress, submit resources, and unlock contributor/instructor access.',
}

export default function RegisterPage() {
  return <RegisterPageClient />
}
