import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Allows the dev server's JS chunks/HMR to load when testing over the LAN
     (e.g. from a phone) instead of localhost — Next.js blocks this by
     default as a DNS-rebinding protection. Dev-only; irrelevant in
     production, where the app is served from the real domain. */
  allowedDevOrigins: ['192.168.1.144'],

  // Baseline defensive headers found missing in a security review — none
  // of these touch script/style/resource-loading policy (no CSP beyond
  // frame-ancestors), so nothing about how the site actually works
  // should change; this is purely closing gaps a browser would otherwise
  // leave open.
  //
  // The full resource-loading CSP below (2026-09-06) ships as
  // Report-Only, not enforced — deliberately, since it can't be verified
  // in a real browser in this environment (no browser tooling available
  // this session) and a wrong enforced policy would break the live site
  // silently for every visitor. Report-Only never blocks anything; a
  // browser just logs a console warning for anything that would have
  // been blocked. Multiple Content-Security-Policy(-Report-Only) headers
  // are independent per the spec, so this layers on top of the existing
  // enforced frame-ancestors policy above rather than replacing it.
  //
  // script-src/style-src need 'unsafe-inline' — confirmed empirically,
  // not assumed: the built production HTML was inspected directly (`next
  // start` + curl) and Next.js's App Router genuinely emits inline
  // `<script>` tags with no `src` and no `nonce` carrying the RSC
  // streaming payload (`self.__next_f.push(...)`) as a core part of how
  // it hydrates — blocking those breaks the entire site's
  // interactivity, not just this app's own code. The correct fix is a
  // per-request nonce threaded through middleware (Next.js's documented
  // pattern), but that requires widening `src/middleware.ts`'s matcher
  // from `/admin`-only to every route — new latency and behavior on
  // every single request, on a middleware convention this exact Next
  // version already flags as deprecated ("use proxy instead") — real
  // surface area to get wrong with no way to verify it here. Left as a
  // known, explicit gap rather than attempted blind. Same reasoning for
  // style-src: dynamic inline `style={{ width: ... }}` (progress bars
  // etc., 12 files) can't use a static nonce/hash either.
  //
  // No external fonts (checked: no `next/font`, no Google Fonts link, no
  // @font-face — grepped across src/, confirmed clean) so font-src stays
  // 'self' only. img-src allows api.lowlevelnotes.com (avatars/course
  // icons, served via getAssetSrc/library assets) and data: (inline
  // SVG/placeholder images). connect-src/frame-src allow
  // challenges.cloudflare.com for Turnstile (its script, background
  // verification calls, and the challenge iframe itself all need it).
  async headers() {
    const reportOnlyCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://api.lowlevelnotes.com",
      "font-src 'self'",
      "connect-src 'self' https://api.lowlevelnotes.com https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Content-Security-Policy-Report-Only', value: reportOnlyCsp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
};

export default nextConfig;
