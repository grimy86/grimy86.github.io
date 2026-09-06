import type { Metadata } from 'next'
import Eyebrow from '@/components/Eyebrow'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Plain rules for using lowlevelnotes — acceptable use, content ownership, and account responsibilities. Not a wall of boilerplate.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0D]">
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl">Terms of Use</h1>
        <p className="mt-4 max-w-xl leading-7 text-[#90939A]">
          Plain rules for using the site, not a wall of boilerplate. By creating an account or using lowlevelnotes, you agree to these terms.
        </p>

        <div className="prose-lesson mt-12 max-w-3xl animate-fade-in-up motion-reduce:animate-none [&_a]:text-[#FF7A33] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h2]:text-white [&_li]:leading-7 [&_p]:mt-4 [&_p]:leading-7 [&_p]:text-[#90939A] [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 text-sm">
          <h2>Your account</h2>
          <p>You&apos;re responsible for keeping your password secure and for anything that happens under your account. Tell us right away if you think someone else has access to it. Accounts are for individuals, not shared logins.</p>

          <h2>Acceptable use</h2>
          <p>This is an educational platform covering low-level programming, reverse engineering, and security topics for learning and defensive purposes. That means:</p>
          <ul>
            <li>No using anything you learn here to attack, exploit, or gain unauthorized access to systems you don&apos;t own or don&apos;t have explicit permission to test.</li>
            <li>No harassment, hate speech, or targeted abuse of other members, on the site or in the Discord.</li>
            <li>No uploading malware, illegal content, or material you don&apos;t have the rights to share.</li>
            <li>No scraping, bulk-downloading, or reselling the site&apos;s content.</li>
            <li>No impersonating another user, instructor, or staff member.</li>
          </ul>

          <h2>Content you submit</h2>
          <p>If you submit a resource request, write course content as an instructor, or post anything else on the platform, you keep ownership of it. By submitting it, you give us permission to host, display, and distribute it as part of the site. Don&apos;t submit anything you don&apos;t have the rights to share.</p>

          <h2>Our content</h2>
          <p>The notes, courses, and written material on this site are original work and protected by copyright, separate from the site&apos;s codebase. You&apos;re welcome to learn from them and reference them; you&apos;re not permitted to republish or redistribute them elsewhere without permission.</p>

          <h2>Enforcement</h2>
          <p>If you break these rules, we may remove the content, warn you, suspend your account, or ban it permanently, depending on severity. Every staff action against an account is logged. Illegal activity (like actual unauthorized system access, not the educational kind this site teaches about) may be reported to the relevant authorities.</p>

          <h2>No warranty</h2>
          <p>The site and its content are provided as-is. We do our best to keep information accurate and the service running, but we don&apos;t guarantee it&apos;ll be uninterrupted, error-free, or fit for any particular purpose.</p>

          <h2>Changes</h2>
          <p>We may update these terms as the site evolves. Meaningful changes will be reflected here with an updated date.</p>
        </div>
      </section>
    </main>
  )
}
