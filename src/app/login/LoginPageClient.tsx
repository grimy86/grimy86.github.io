'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthTextField from '@/components/auth/AuthTextField'
import AuthSubmitButton from '@/components/auth/AuthSubmitButton'
import AuthMessage from '@/components/auth/AuthMessage'
import TurnstileWidget, { type TurnstileHandle } from '@/components/auth/TurnstileWidget'
import { useSession } from '@/components/SessionProvider'
import { login, unwrapResult } from '@/lib/authClient'
import { computeDeviceFingerprint } from '@/lib/securityMonitor'

export default function LoginPageClient() {
  const router = useRouter()
  const { user, loading: sessionLoading, refresh } = useSession()
  const turnstileRef = useRef<TurnstileHandle>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const loginMutation = useMutation({
    mutationFn: async () => unwrapResult(login(email, password, turnstileToken!, await computeDeviceFingerprint())),
    // Tokens are single-use regardless of outcome — fetch a fresh one
    // before the next attempt.
    onSettled: () => {
      turnstileRef.current?.reset()
      setTurnstileToken(null)
    },
    onSuccess: async () => {
      await refresh()
      router.push('/account/courses')
    },
  })

  useEffect(() => {
    if (!sessionLoading && user) {
      router.replace('/account/courses')
    }
  }, [sessionLoading, user, router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken) return
    loginMutation.mutate()
  }

  return (
    <AuthPageShell eyebrow="Welcome back" heading="Login" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthTextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <AuthTextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />

        <TurnstileWidget ref={turnstileRef} action="login" onToken={setTurnstileToken} />

        {loginMutation.error && <AuthMessage message={loginMutation.error.message} />}

        <AuthSubmitButton loading={loginMutation.isPending} disabled={!turnstileToken}>Login</AuthSubmitButton>
      </form>

      <p className="mt-6 text-sm text-[#90939A]">
        No account?{' '}
        <Link href="/register" className="text-white/70 underline underline-offset-2 transition-colors hover:text-white">
          Register
        </Link>
      </p>
      <p className="mt-2 text-sm text-[#90939A]">
        <Link href="/forgot-password" className="text-white/70 underline underline-offset-2 transition-colors hover:text-white">
          Forgot your password?
        </Link>
      </p>
    </AuthPageShell>
  )
}
