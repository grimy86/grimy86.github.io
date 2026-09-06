import type { ComponentType, CSSProperties } from 'react'
import type { UserAchievement } from '@/lib/authClient'
import {
  LightBulbIcon,
  ChecklistIcon,
  StarFillIcon,
  MilestoneIcon,
  RocketIcon,
  MortarBoardIcon,
  FlameIcon,
  BookIcon,
} from '@/components/icons'

// One in-house Octicon per achievement, keyed by slug -- same treatment
// as CourseIcon/typeIcons elsewhere, not a DB column: achievements are a
// small, fixed, migration-seeded set, so a plain mapping here is simpler
// than round-tripping an icon key through the schema and the API.
const achievementIcons: Record<string, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  'first-lesson': LightBulbIcon,
  'first-quiz': ChecklistIcon,
  'perfect-quiz': StarFillIcon,
  'lessons-10': MilestoneIcon,
  'lessons-50': RocketIcon,
  'first-course': MortarBoardIcon,
  'streak-7': FlameIcon,
  bookworm: BookIcon,
}

export default function AchievementTile({ achievement }: { achievement: UserAchievement }) {
  const Icon = achievementIcons[achievement.slug]

  return (
    <div
      className={`relative overflow-hidden border p-4 ${achievement.unlocked ? 'border-[#FF7A33]/40 bg-[#17181B]' : 'border-white/10 bg-[#17181B]'}`}
      title={achievement.unlockedAt ? `Unlocked ${new Date(achievement.unlockedAt).toLocaleDateString()}` : undefined}
    >
      {achievement.unlocked && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
          style={{ background: 'radial-gradient(circle, rgba(255,122,51,0.35), transparent 70%)' }}
        />
      )}

      <div className="relative flex items-start gap-3">
        {Icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center border ${
              achievement.unlocked ? 'border-[#FF7A33]/50 bg-[#FF7A33]/10 text-[#FF7A33]' : 'border-white/10 bg-white/5 text-white/20'
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${achievement.unlocked ? 'text-white' : 'text-[#90939A]'}`}>{achievement.title}</p>
          <p className={`mt-1 text-xs ${achievement.unlocked ? 'text-[#90939A]' : 'text-[#90939A]/60'}`}>{achievement.description}</p>
          {achievement.progress && (
            <div className="mt-2">
              <div className="h-1 w-full bg-white/10">
                <div
                  className="h-full bg-[#FF7A33]/60"
                  style={{ width: `${Math.round((achievement.progress.current / achievement.progress.target) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-[#90939A]/70">{achievement.progress.current}/{achievement.progress.target}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
