import type { Metadata } from 'next'
import { getChangelog } from '@/lib/api'
import ChangelogEntryCard from '@/components/ChangelogEntryCard'
import ChangelogJumpNav from '@/components/ChangelogJumpNav'
import Eyebrow from '@/components/Eyebrow'
import type { ChangelogEntry } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Everything shipped on lowlevelnotes, newest first — new courses, features, and fixes.',
}

// A release's year, for grouping — falls back to null (no divider) rather
// than throwing if release_date is ever in a format Date() can't parse,
// since a malformed date shouldn't take the whole page down.
function yearOf(releaseDate: string): number | null {
  const year = new Date(releaseDate).getFullYear()
  return Number.isNaN(year) ? null : year
}

// A plain reduce rather than a mutable `let` tracked across the render
// map — entries are already sorted newest-first, so a year marker goes
// wherever the year changes from the entry before it.
function withYearMarkers(entries: ChangelogEntry[]) {
  return entries.reduce<{ list: { entry: ChangelogEntry; showYear: boolean; year: number | null }[]; lastYear: number | null }>(
    (acc, entry) => {
      const year = yearOf(entry.releaseDate)
      const showYear = year !== null && year !== acc.lastYear
      return { list: [...acc.list, { entry, showYear, year }], lastYear: year ?? acc.lastYear }
    },
    { list: [], lastYear: null }
  ).list
}

export default async function ChangelogPage() {
  const entries = await getChangelog()
  const withYears = withYearMarkers(entries)
  const years = withYears
    .filter((e): e is typeof e & { year: number } => e.showYear && e.year !== null)
    .map((e) => e.year)

  return (
    <main className="min-h-screen bg-[#0B0B0D]">
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-20 sm:pt-28">
        <Eyebrow>Version history</Eyebrow>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl">Changelog</h1>
        <p className="mt-4 max-w-xl leading-7 text-[#90939A]">Every release, in order—from the first notes to whatever&apos;s shipping today.</p>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 pb-24 sm:grid-cols-[140px_1fr]">
        {years.length > 1 && <ChangelogJumpNav years={years} />}

        <div className="relative order-1 min-w-0 sm:order-2">
          <div aria-hidden="true" className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-white/10" />
          {withYears.map(({ entry, showYear, year }, i) => (
            <div key={entry.version}>
              {showYear && (
                <div id={`y${year}`} className={`relative scroll-mt-24 pl-8 ${i === 0 ? '' : 'mt-2'} mb-5`}>
                  <Eyebrow className="text-[11px]">{year}</Eyebrow>
                </div>
              )}
              <ChangelogEntryCard entry={entry} index={i} isLatest={i === 0} isLast={i === withYears.length - 1} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
