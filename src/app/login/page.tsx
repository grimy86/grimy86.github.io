import type { Metadata } from 'next'
import LoginPageClient from './LoginPageClient'

// A thin Server Component wrapper purely so this route can export its own
// metadata — the actual page (session redirect, Turnstile, the login
// form) is 'use client', and Next.js only reads `metadata` from Server
// Components. Same split for /register and /forgot-password.
export const metadata: Metadata = {
  title: 'Log In',
  description: 'Log in to your lowlevelnotes account.',
}

export default function LoginPage() {
  return <LoginPageClient />
}
