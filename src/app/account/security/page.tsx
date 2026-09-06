'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AuthTextField from '@/components/auth/AuthTextField'
import AuthSubmitButton from '@/components/auth/AuthSubmitButton'
import AuthMessage from '@/components/auth/AuthMessage'
import { useSession } from '@/components/SessionProvider'
import { useToast } from '@/components/ToastProvider'
import {
  changePassword,
  deleteMyAccount,
  getStreakReminderOptIn,
  setStreakReminderOptIn,
  getAnonymousMode,
  setAnonymousMode,
  getAnonymizeCourseAuthorship,
  setAnonymizeCourseAuthorship,
  unwrapResult,
} from '@/lib/authClient'
import Eyebrow from '@/components/Eyebrow'
import { Skeleton } from '@/components/Skeleton'

export default function AccountSecurityPage() {
  const router = useRouter()
  const { user, loading: sessionLoading, refresh } = useSession()
  const toast = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  // Suppresses the redirect-to-/login guard below during account
  // deletion — otherwise refresh()'s setUser(null) and this effect's own
  // router.replace('/login') race handleAccountDeleted's router.push('/'),
  // and whichever navigation settles last silently wins. (Logging out
  // itself lives in AccountShell now, which sidesteps this race by
  // navigating away before it ever clears session state.)
  const loggingOutRef = useRef(false)

  const changePasswordMutation = useMutation({
    mutationFn: () => unwrapResult(changePassword(currentPassword, newPassword)),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      toast.success('Password changed.')
    },
  })

  useEffect(() => {
    if (!sessionLoading && !user && !loggingOutRef.current) {
      router.replace('/login')
    }
  }, [sessionLoading, user, router])

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    changePasswordMutation.mutate()
  }

  // deleteMyAccount already clears the session cookie server-side on
  // success, so this only needs to sync client state and navigate away —
  // guarded by loggingOutRef for the same reason described above (avoid
  // racing the redirect-to-/login effect).
  async function handleAccountDeleted() {
    loggingOutRef.current = true
    await refresh()
    router.push('/')
  }

  if (sessionLoading || !user) {
    return (
      <div>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-9 w-64" />
        <Skeleton className="mt-8 h-16 max-w-md" />
      </div>
    )
  }

  return (
    <div>
      <Eyebrow>Security</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] text-white">Account security</h1>

      <div className="mt-8 max-w-md border border-white/10 bg-[#17181B]">
        <PasswordSection
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          error={changePasswordMutation.error?.message ?? null}
          submitting={changePasswordMutation.isPending}
          onSubmit={handleChangePassword}
        />
      </div>

      <div className="mt-6 max-w-md border border-white/10 bg-[#17181B] p-5">
        <StreakReminderToggle />
      </div>

      <div className="mt-6 max-w-md border border-white/10 bg-[#17181B] p-5 flex flex-col gap-5">
        <AnonymousModeToggle />
        {(user.role === 'instructor' || user.role === 'staff') && <AnonymizeCourseAuthorshipToggle />}
      </div>

      <div className="mt-10 max-w-md border border-[#F85149]/30 bg-[#17181B]">
        <DangerZone onDeleted={handleAccountDeleted} />
      </div>
    </div>
  )
}

// A single opt-in checkbox, not a collapsible section like Password/
// Danger zone below — there's nothing to expand, just one preference.
// Deliberately not a recurring digest: fires at most once a day, and
// only once someone opts in here (see sendStreakReminderEmails,
// worker/cron.js) — the explicit alternative discussed to a broader
// re-engagement email campaign, which was rejected as too spammy.
function StreakReminderToggle() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data } = useQuery({
    queryKey: ['streakReminderOptIn'],
    queryFn: () => unwrapResult(getStreakReminderOptIn()),
  })

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => unwrapResult(setStreakReminderOptIn(enabled)),
    onSuccess: (_, enabled) => {
      queryClient.setQueryData(['streakReminderOptIn'], { enabled })
      toast.success(enabled ? 'Streak reminders on.' : 'Streak reminders off.')
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={data?.enabled ?? false}
        disabled={!data || mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7A33] disabled:opacity-50"
      />
      <span>
        <span className="block text-sm font-medium text-white">Email me if I&apos;m about to lose a streak</span>
        <span className="mt-1 block text-xs text-white/40">
          At most once a day, and only when you have a streak of 3+ days going and haven&apos;t studied yet that day.
        </span>
      </span>
    </label>
  )
}

// Hides real name/avatar/bio from other users on your public profile and
// the leaderboard — replaced with a 👻 and a stable per-account handle
// (0xA3F9C2-style) instead of a plain "REDACTED" so two anonymous users
// never look identical. Doesn't hide achievements (not personally
// identifying) and never hides anything from you or from staff — this is
// only about what other regular users see. Independent of the
// course-authorship toggle below: this one's about your social profile,
// that one's about content credit, and a user might want either without
// the other.
function AnonymousModeToggle() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data } = useQuery({
    queryKey: ['anonymousMode'],
    queryFn: () => unwrapResult(getAnonymousMode()),
  })

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => unwrapResult(setAnonymousMode(enabled)),
    onSuccess: (_, enabled) => {
      queryClient.setQueryData(['anonymousMode'], { enabled })
      toast.success(enabled ? 'Profile anonymized.' : 'Profile no longer anonymous.')
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={data?.enabled ?? false}
        disabled={!data || mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7A33] disabled:opacity-50"
      />
      <span>
        <span className="block text-sm font-medium text-white">Hide my identity from other users</span>
        <span className="mt-1 block text-xs text-white/40">
          Your public profile and leaderboard entry show a ghost and an anonymous handle instead of your real name/avatar/bio. Achievements still show. You and staff always see your real info.
        </span>
      </span>
    </label>
  )
}

// Only shown for instructor/staff — separate from AnonymousModeToggle
// above on purpose (see that one's comment): this only affects the "by
// <author>" byline on courses you've published or co-authored, nothing
// about your profile/leaderboard presence.
function AnonymizeCourseAuthorshipToggle() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data } = useQuery({
    queryKey: ['anonymizeCourseAuthorship'],
    queryFn: () => unwrapResult(getAnonymizeCourseAuthorship()),
  })

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => unwrapResult(setAnonymizeCourseAuthorship(enabled)),
    onSuccess: (_, enabled) => {
      queryClient.setQueryData(['anonymizeCourseAuthorship'], { enabled })
      toast.success(enabled ? 'Course authorship anonymized.' : 'Course authorship no longer anonymous.')
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={data?.enabled ?? false}
        disabled={!data || mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7A33] disabled:opacity-50"
      />
      <span>
        <span className="block text-sm font-medium text-white">Hide my name on courses I&apos;ve published</span>
        <span className="mt-1 block text-xs text-white/40">
          Shows an anonymous handle instead of your name in the &quot;by&quot; byline on your published courses. Doesn&apos;t affect the course builder itself, only what other users see.
        </span>
      </span>
    </label>
  )
}

// Collapsed by default — password change is a rare action and shouldn't
// be expanded by default even on its own dedicated page.
function PasswordSection({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  error,
  submitting,
  onSubmit,
}: {
  currentPassword: string
  setCurrentPassword: (value: string) => void
  newPassword: string
  setNewPassword: (value: string) => void
  error: string | null
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[#151515] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#FF7A33]"
      >
        <span>
          <span className="block text-sm font-medium text-white">Change password</span>
          <span className="mt-1 block text-xs text-white/40">Update the password used to sign in</span>
        </span>
        <span aria-hidden="true" className={`text-xl leading-none text-white/40 transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-45' : ''}`}>+</span>
      </button>

      {open && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t border-white/10 px-5 py-5 animate-fade-in-up motion-reduce:animate-none">
          <AuthTextField label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" required />
          <AuthTextField label="New password" type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" required />

          {error && <AuthMessage message={error} />}

          <AuthSubmitButton loading={submitting}>Change password</AuthSubmitButton>
        </form>
      )}
    </>
  )
}

// Collapsed by default, same reasoning as PasswordSection — plus its own
// red accent throughout (header, border, submit button) instead of the
// site's orange, so this reads as a distinct, more severe category of
// action rather than just another settings panel. Requires re-entering
// the current password (self-contained state, not lifted to the parent —
// nothing else on the page needs it) so a session left open on a shared
// device can't delete the account with a single stray click.
function DangerZone({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')

  const deleteMutation = useMutation({
    mutationFn: () => unwrapResult(deleteMyAccount(password)),
    onSuccess: onDeleted,
  })

  function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    deleteMutation.mutate()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[#151515] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#F85149]"
      >
        <span>
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-[#F85149]">{'// '}Danger zone</span>
          <span className="mt-1 block text-sm text-white">Delete account</span>
        </span>
        <span aria-hidden="true" className={`text-xl leading-none text-white/40 transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-45' : ''}`}>+</span>
      </button>

      {open && (
        <form onSubmit={handleDelete} className="flex flex-col gap-4 border-t border-white/10 px-5 py-5 animate-fade-in-up motion-reduce:animate-none">
          <p className="text-xs leading-5 text-[#90939A]">
            This permanently deletes your account, enrollments, progress, and submissions. This can&apos;t be undone.
          </p>
          <AuthTextField label="Confirm your password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />

          {deleteMutation.error && <AuthMessage message={deleteMutation.error.message} />}

          <button
            type="submit"
            disabled={deleteMutation.isPending}
            className="inline-flex w-full items-center justify-center gap-3 border border-[#F85149]/40 bg-[#F85149]/10 px-5 py-3.5 text-sm font-semibold text-[#F85149] transition-colors transition-transform duration-150 hover:bg-[#F85149]/20 active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F85149] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteMutation.isPending ? '…' : 'Permanently delete my account'}
          </button>
        </form>
      )}
    </>
  )
}
