'use client'

import { useQuery } from '@tanstack/react-query'
import AuthMessage from '@/components/auth/AuthMessage'

const AUTH_API_BASE = 'https://api.lowlevelnotes.com'

type CertificatePayload = { n: string; c: string; d: string }

// No `credentials: 'include'` -- deliberately not authClient's authFetch,
// since this is a public endpoint anyone can hit with no session at all,
// and there's nothing user-specific in the request to protect.
async function fetchPublicKey(): Promise<JsonWebKey> {
  const res = await fetch(`${AUTH_API_BASE}/v1/certificates/public-key`)
  if (!res.ok) throw new Error('Could not reach the verification service.')
  return res.json()
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// The actual check: entirely client-side, against the payload and
// signature carried in the certificate's own link -- this Worker is
// only ever asked for the (non-secret, cacheable) public key, never
// anything about this specific certificate.
async function verifyCertificate(p: string, s: string): Promise<{ valid: boolean; payload?: CertificatePayload }> {
  const jwk = await fetchPublicKey()
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])

  const payloadBytes = base64UrlDecode(p)
  const signatureBytes = base64UrlDecode(s)
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signatureBytes, payloadBytes)
  if (!valid) return { valid: false }

  const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as CertificatePayload
  return { valid: true, payload }
}

export default function VerifyResult({ p, s }: { p: string; s: string }) {
  const query = useQuery({
    queryKey: ['verifyCertificate', p, s],
    queryFn: () => verifyCertificate(p, s),
    retry: false,
  })

  if (query.isPending) {
    return <p className="text-sm text-[#90939A]">Checking…</p>
  }

  if (query.isError) {
    return <AuthMessage message={query.error.message} />
  }

  if (!query.data.valid || !query.data.payload) {
    return <AuthMessage message="This isn't a valid certificate. The link may have been altered." />
  }

  const { n: learnerName, c: courseTitle, d: completedAt } = query.data.payload
  const dateLabel = new Date(completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="animate-fade-in-up border border-[#3FB950]/40 bg-[#17181B] p-6 motion-reduce:animate-none">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#3FB950]">
        <span className="h-2 w-2 shrink-0 bg-[#3FB950]" aria-hidden="true" />
        Verified
      </p>
      <p className="mt-4 text-2xl font-bold text-white">{learnerName}</p>
      <p className="mt-2 text-[#90939A]">
        completed <span className="text-white">{courseTitle}</span>
      </p>
      <p className="mt-1 text-sm text-[#90939A]">on {dateLabel}</p>
    </div>
  )
}
