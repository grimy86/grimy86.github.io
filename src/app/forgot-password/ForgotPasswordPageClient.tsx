'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthTextField from '@/components/auth/AuthTextField'
import AuthSubmitButton from '@/components/auth/AuthSubmitButton'
import AuthMessage from '@/components/auth/AuthMessage'
import TurnstileWidget, { type TurnstileHandle } from '@/components/auth/TurnstileWidget'
import { forgotPassword, ApiError } from '@/lib/authClient'

export default function ForgotPasswordPageClient() {
  const turnstileRef = useRef<TurnstileHandle>(null)

  const [email, setEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const submitMutation = useMutation({
    mutationFn: async () => {
      const result = await forgotPassword(email, turnstileToken!)
      // The API returns the identical message whether or not the account
      // exists, by design (see Phase 3) — this must not undermine that by
      // branching on it. A 429 is a rate-limit signal, not an
      // account-existence signal, and neither is a 403 (a failed
      // Turnstile check) — those two are the only outcomes treated as
      // real errors; any other failure intentionally reads the same as
      // success, same as the API's own non-enumeration design.
      if (!result.ok && result.status === 429) throw new ApiError('rate_limited', 429)
      if (!result.ok && result.status === 403) throw new ApiError(result.error, 403)
    },
    onSettled: () => {
      turnstileRef.current?.reset()
      setTurnstileToken(null)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken) return
    submitMutation.mutate()
  }

  const rateLimited = submitMutation.error instanceof ApiError && submitMutation.error.status === 429
  const error = submitMutation.error && !rateLimited ? submitMutation.error.message : null

  if (submitMutation.isSuccess) {
    return (
      <AuthPageShell eyebrow="Password recovery" heading="Check your email" maxWidth="max-w-md">
        <AuthMessage message="If that email is registered, a password reset link has been sent." tone="success" />
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      eyebrow="Password recovery"
      heading="Forgot your password?"
      subtext="Enter your email and we'll send you a link to reset it."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthTextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />

        <TurnstileWidget ref={turnstileRef} action="forgot_password" onToken={setTurnstileToken} />

        {rateLimited && <AuthMessage message="Too many requests. Try again later." />}
        {error && <AuthMessage message={error} />}

        <AuthSubmitButton loading={submitMutation.isPending} disabled={!turnstileToken}>Send reset link</AuthSubmitButton>
      </form>

      <p className="mt-6 text-sm text-[#90939A]">
        <Link href="/login" className="text-white/70 underline underline-offset-2 transition-colors hover:text-white">
          Back to login
        </Link>
      </p>
    </AuthPageShell>
  )
}
