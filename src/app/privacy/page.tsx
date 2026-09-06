import type { Metadata } from 'next'
import Eyebrow from '@/components/Eyebrow'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What data lowlevelnotes collects and why, based on what the code actually does — no analytics, no ad tracking, nothing sold or shared for marketing.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0D]">
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
        <Eyebrow>Full disclosure</Eyebrow>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl">Privacy</h1>
        <p className="mt-4 max-w-xl leading-7 text-[#90939A]">
          What data we collect and why, based on what the code actually does.
        </p>

        {/* Narrower than the section's own max-w-6xl (which only exists so
            this page's left edge lines up with the header) — a wall of
            legal prose stretched to 1152px would be far past a readable
            line length. */}
        <div className="prose-lesson mt-12 max-w-3xl animate-fade-in-up motion-reduce:animate-none [&_a]:text-[#FF7A33] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h2]:text-white [&_li]:leading-7 [&_p]:mt-4 [&_p]:leading-7 [&_p]:text-[#90939A] [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 text-sm">
          <h2>What we collect, and why</h2>
          <p>Everything below is collected because a specific feature needs it, nothing is gathered speculatively.</p>
          <ul>
            <li><strong className="text-white">Account details:</strong> your email, display name, and password. Passwords are hashed using a secure Key Derivation Function (KDF) with many iterations and unique salting. We can&apos;t see or recover your actual password, only verify it.</li>
            <li><strong className="text-white">Profile extras:</strong> an avatar image and a short bio, both optional, both only stored if you add them yourself.</li>
            <li><strong className="text-white">IP addresses:</strong> recorded against your sessions and login/security events. Used for rate limiting, abuse prevention, and fraud detection.</li>
            <li><strong className="text-white">Learning activity:</strong> course enrollments, lesson progress, and quiz scores, so your progress and statistics pages actually mean something.</li>
            <li><strong className="text-white">Content you submit:</strong> resource requests (links or files) submitted to the library, and, if you&apos;re an instructor, any course content you author.</li>
          </ul>

          <h2>What we don&apos;t collect</h2>
          <p>No analytics or tracking scripts run anywhere on this site. No advertising networks, no ad identifiers, no behavioral profiling. Your data is never sold, rented, or shared for marketing purposes.</p>

          <h2>Cookies</h2>
          <p>Exactly one cookie exists: the session cookie that keeps you logged in. It&apos;s <code>HttpOnly</code>, <code>Secure</code>, and <code>SameSite=Strict</code>. It can&apos;t be read by page scripts and is never sent on cross-site requests.</p>

          <h2>How long we keep it</h2>
          <p>Expired sessions and one-time tokens (email verification, password reset) are deleted automatically. Security event logs used for rate limiting are purged after 7 days. Everything else is kept until the account is deleted.</p>

          <h2>Security</h2>
          <p>Passwords are never stored, logged, or transmitted in plaintext. Every meaningful staff action against another account (ban, role change, deletion) is written to an append-only audit log that nothing can quietly edit or remove after the fact.</p>
        </div>
      </section>
    </main>
  )
}
