import type { MetadataRoute } from 'next'

// Mirrors sitemap.ts's own reasoning, just phrased as directives instead
// of an allowlist: everything under /account, plus /courses, /leaderboard,
// /library, and /u/* (public profiles) all redirect an anonymous visitor
// to /login *client-side*, after an initial 200 response — there's no
// server-side redirect a crawler could follow, so what it actually fetches
// is a loading skeleton with no real content. Disallowing them isn't about
// hiding anything, it's not wasting crawl budget on pages that are
// guaranteed empty for anyone without a session. /reset-password,
// /verify-email, and /forgot-password carry single-use tokens or are pure
// utility flows (matches their own noindex meta tags). /api/* is
// server-to-server plumbing, not content.
//
// Deliberately does NOT list /admin — that's the honeypot decoy
// (src/app/admin/page.tsx already sets its own noindex/nofollow meta
// directly). Listing a path here is itself a common way scanners
// *discover* "interesting" paths, which would work against the whole
// point of a decoy; same reasoning sitemap.ts and admin/page.tsx already
// documented. /verify (certificate verification) joins the same
// utility-flow group — its content is entirely a per-certificate query
// string, nothing generic worth indexing.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account/',
        '/courses',
        '/leaderboard',
        '/library',
        '/u/',
        '/reset-password',
        '/verify-email',
        '/forgot-password',
        '/verify',
        '/api/',
      ],
    },
    sitemap: 'https://lowlevelnotes.com/sitemap.xml',
  }
}
