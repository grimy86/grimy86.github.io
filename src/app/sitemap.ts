import type { MetadataRoute } from 'next'
import { getChangelog } from '@/lib/api'

// Deliberately excludes every other route in src/app: /account, /login,
// /register, /forgot-password, /reset-password, and /verify-email have no
// SEO value (auth flows, some carrying single-use tokens in the query
// string), and /courses, /leaderboard, /library, and /u/* all require a
// session — an anonymous crawler would only ever see a loading skeleton
// that redirects client-side, not real content, so indexing them would be
// indexing an empty page (see robots.ts, which disallows the same set).
// /privacy and /terms are genuinely public and evergreen, so they're in.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // /changelog's lastModified reflects the actual latest release date
  // instead of always claiming "just changed" — falls back to now if the
  // API call fails, so a Worker hiccup can't take sitemap.xml down with it.
  let changelogLastModified = new Date()
  try {
    const entries = await getChangelog()
    if (entries[0]?.releaseDate) {
      changelogLastModified = new Date(entries[0].releaseDate)
    }
  } catch {
    // fall back to now
  }

  return [
    {
      url: 'https://lowlevelnotes.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://lowlevelnotes.com/changelog',
      lastModified: changelogLastModified,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: 'https://lowlevelnotes.com/privacy',
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: 'https://lowlevelnotes.com/terms',
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]
}