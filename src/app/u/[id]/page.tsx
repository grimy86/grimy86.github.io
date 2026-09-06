'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/components/SessionProvider'
import { useToast } from '@/components/ToastProvider'
import AchievementTile from '@/components/AchievementTile'
import AuthSubmitButton from '@/components/auth/AuthSubmitButton'
import { Skeleton } from '@/components/Skeleton'
import { getUserProfile, updateMyProfile, uploadMyAvatar, unwrapResult, getAssetSrc, roleLabel, type UserProfile } from '@/lib/authClient'
import Eyebrow from '@/components/Eyebrow'
import AccountShell from '@/components/AccountShell'

const fieldClass = "w-full border border-white/15 bg-[#17181B] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, loading: sessionLoading, refresh } = useSession()
  const queryClient = useQueryClient()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const profileQuery = useQuery({
    queryKey: ['userProfile', id],
    queryFn: () => unwrapResult(getUserProfile(Number(id))),
    enabled: !!user,
  })
  const profile = profileQuery.data

  const [bio, setBio] = useState('')
  const [displayName, setDisplayName] = useState('')
  // Seeds the bio/display name draft once per profile id, not on every
  // render of fresh query data — a background revalidation landing
  // mid-edit (this query's default 60s staleTime will eventually trigger
  // one) must never silently overwrite text the user is in the middle of
  // typing.
  const initializedForId = useRef<string | null>(null)
  useEffect(() => {
    if (profile && initializedForId.current !== id) {
      setBio(profile.bio ?? '')
      setDisplayName(profile.displayName)
      initializedForId.current = id
    }
  }, [id, profile])

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace('/login')
    }
  }, [sessionLoading, user, router])

  // Known as soon as the session loads, without waiting on the profile
  // fetch — so the dashboard shell (or its absence) doesn't flash in
  // partway through the page's own load.
  const isOwnProfile = Boolean(user && user.id === Number(id))

  const avatarMutation = useMutation({
    mutationFn: (file: File) => unwrapResult(uploadMyAvatar(file)),
    onSuccess: (data) => {
      queryClient.setQueryData<UserProfile>(['userProfile', id], (prev) => (prev ? { ...prev, avatarUrl: data.avatarUrl } : prev))
      toast.success('Profile picture updated.')
    },
    onError: (error) => toast.error(error.message),
  })
  const saveProfileMutation = useMutation({
    mutationFn: () => unwrapResult(updateMyProfile(displayName, bio)),
    onSuccess: () => {
      queryClient.setQueryData<UserProfile>(['userProfile', id], (prev) => (prev ? { ...prev, displayName, bio } : prev))
      // Session-wide user.displayName (header, account welcome message,
      // etc.) is separate cached state from this profile query, so it
      // needs its own refetch to pick up the change immediately.
      refresh()
      toast.success('Profile saved.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    avatarMutation.mutate(file)
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    saveProfileMutation.mutate()
  }

  // Whether this is your own profile depends on `user`, which isn't known
  // yet during this branch — defaulting to the dashboard shell here
  // (rather than the plain centered one below) means a cold load of your
  // own profile never has a moment where the sidebar hasn't mounted yet.
  // AccountShell already renders its own nav-loading state correctly
  // when `user` isn't there yet, so this composes for free.
  if (sessionLoading || !user) {
    return (
      <AccountShell>
        <ProfileSkeleton />
      </AccountShell>
    )
  }

  const body = (
    <>
      {profileQuery.error && <p className="text-sm text-[#F85149] animate-fade-in-up motion-reduce:animate-none">{profileQuery.error.message}</p>}

      {!profile && !profileQuery.error && <ProfileSkeleton />}

      {profile && (
        <>
          <div className="flex items-center gap-5">
            {isOwnProfile ? (
              // The whole square is the click target (works for touch,
              // which has no hover state) — the "Update" lip is a
              // hover/focus-only visual hint layered on top for desktop
              // pointers, not the only way in.
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarMutation.isPending}
                aria-label="Change profile picture"
                className="group relative h-20 w-20 shrink-0 disabled:cursor-not-allowed"
              >
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={handleAvatarChange} />
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- cross-subdomain, session-cookie-gated asset; next/image can't proxy this
                  <img src={getAssetSrc(profile.avatarUrl)} alt="" className="h-20 w-20 border border-white/10 object-cover" />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center border border-white/10 bg-[#17181B] text-2xl font-bold text-white/40">
                    {profile.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 flex h-6 items-center justify-center bg-black/70 text-[9px] font-medium uppercase tracking-[0.08em] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                >
                  {avatarMutation.isPending ? '…' : 'Update'}
                </span>
              </button>
            ) : profile.isAnonymous ? (
              // avatarUrl is already null server-side for an anonymized
              // profile, so falling through to the initial-letter
              // fallback below would just show "0" (the first character
              // of the 0x... handle) — a ghost reads as deliberately
              // anonymous rather than as a broken/missing avatar.
              <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-white/10 bg-[#17181B] text-3xl" title="This user has chosen to stay anonymous">
                👻
              </div>
            ) : profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- cross-subdomain, session-cookie-gated asset; next/image can't proxy this
              <img src={getAssetSrc(profile.avatarUrl)} alt="" className="h-20 w-20 shrink-0 border border-white/10 object-cover" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-white/10 bg-[#17181B] text-2xl font-bold text-white/40">
                {profile.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <Eyebrow>{roleLabel(profile.role)}</Eyebrow>
              <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">{profile.displayName}</h1>
              <p className="mt-1 text-xs text-white/40">Joined {new Date(profile.joinedAt).toLocaleDateString()}</p>
            </div>
          </div>

          {isOwnProfile ? (
            <form onSubmit={handleSaveProfile} className="mt-6 flex max-w-xl flex-col gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-white/40">Display name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  required
                  placeholder="Your name"
                  className={fieldClass}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-white/40">Bio</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Tell people a bit about yourself…"
                  className={fieldClass}
                />
              </label>

              <AuthSubmitButton loading={saveProfileMutation.isPending}>Save</AuthSubmitButton>
            </form>
          ) : (
            profile.bio && <p className="mt-6 max-w-xl text-sm leading-7 text-[#90939A]">{profile.bio}</p>
          )}

          <div className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">Achievements</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {profile.achievements.map((achievement) => (
                <AchievementTile key={achievement.slug} achievement={achievement} />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )

  // Your own profile is where profile editing lives now (no separate
  // /account/profile page), so it renders inside the same dashboard shell
  // as the rest of /account/* rather than dropping you onto a standalone
  // page — visiting someone else's profile has no dashboard to show, so
  // that case keeps the plain centered page.
  if (isOwnProfile) {
    return <AccountShell>{body}</AccountShell>
  }

  return (
    <main className="min-h-screen bg-[#0B0B0D]">
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">{body}</section>
    </main>
  )
}

function ProfileSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-5">
        <Skeleton className="h-20 w-20 shrink-0 border border-white/10" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="mt-10">
        <Skeleton className="h-3 w-24" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
    </div>
  )
}
