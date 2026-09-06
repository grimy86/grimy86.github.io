'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AuthTextField from '@/components/auth/AuthTextField'
import AuthTextArea from '@/components/auth/AuthTextArea'
import AuthSelect from '@/components/auth/AuthSelect'
import AuthSubmitButton from '@/components/auth/AuthSubmitButton'
import AuthMessage from '@/components/auth/AuthMessage'
import Eyebrow from '@/components/Eyebrow'
import { useSession } from '@/components/SessionProvider'
import { useToast } from '@/components/ToastProvider'
import { Skeleton, SkeletonRow } from '@/components/Skeleton'
import {
  getMyRoleRequests,
  submitRoleRequest,
  getMyResourceRequests,
  submitResourceRequest,
  getMyCourses,
  createCourse,
  deleteCourse,
  unwrapResult,
  type InstructorCourse,
} from '@/lib/authClient'

const RESOURCE_TYPES = [
  { value: 'pdf', label: 'File (PDF, doc, etc.)' },
  { value: 'website', label: 'Website' },
  { value: 'videos', label: 'Videos' },
  { value: 'git', label: 'Git repository' },
]

// Same style constants as AdminPanel.tsx/build's old page — duplicated
// rather than shared, matching this app's existing low-abstraction
// convention (each admin/instructor section owns its own small set of
// these rather than importing a shared style module for three classes).
const inputClass = "border border-white/15 bg-[#17181B] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
const buttonClass = "border border-[#FF7A33]/50 px-3 py-1.5 text-xs font-medium text-[#FF7A33] transition-colors transition-transform duration-150 hover:border-[#FF7A33] hover:bg-[#FF7A33]/10 active:scale-[0.98] motion-reduce:transition-none disabled:opacity-50 disabled:active:scale-100"

const COURSE_STATUS_LABEL: Record<InstructorCourse['status'], string> = {
  draft: 'Draft',
  pending_review: 'In review',
  published: 'Published',
}

const COURSE_STATUS_CLASS: Record<InstructorCourse['status'], string> = {
  draft: 'text-white/40',
  pending_review: 'text-[#FF7A33]',
  published: 'text-[#3FB950]',
}

// Shared eyebrow/heading/subtext block — every branch below (loading,
// pending, done, the two real forms) renders one of these instead of a
// standalone AuthPageShell, since this page now lives inside the account
// dashboard's own shell rather than being a separate page.
function ContributeHeader({ heading, subtext }: { heading: string; subtext?: string }) {
  return (
    <>
      <Eyebrow>Contribute</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] text-white">{heading}</h1>
      {subtext && <p className="mt-4 max-w-xl leading-7 text-[#90939A]">{subtext}</p>}
    </>
  )
}

// Also absorbs the former standalone /account/build landing page (course
// creation + list) — that page and this one were both "what can this
// account submit or manage" content gated by role, just split across two
// nav items for what's really one workflow. An instructor/staff account
// now sees both sections stacked on one page instead of switching tabs;
// the course editor (/account/build/[id]) and group management
// (/account/build/groups) stay their own routes since a full
// modules/lessons/quiz editor and a roster manager don't fit inline here.
export default function ContributePage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useSession()

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace('/login')
    }
  }, [sessionLoading, user, router])

  if (sessionLoading || !user) {
    return (
      <div>
        <ContributeHeader heading="Contribute" />
        <Skeleton className="mt-6 h-32 max-w-md" />
      </div>
    )
  }

  if (user.role === 'student') {
    return <RoleRequestPanel />
  }

  const canBuild = user.role === 'instructor' || user.role === 'staff'

  return (
    <div>
      <ResourceRequestPanel />
      {canBuild && <CourseBuildSection />}
    </div>
  )
}

function RoleRequestPanel() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: requests } = useQuery({
    queryKey: ['myRoleRequests'],
    queryFn: () => unwrapResult(getMyRoleRequests()),
  })

  const [requestedRole, setRequestedRole] = useState<'contributor' | 'instructor'>('contributor')
  const [message, setMessage] = useState('')

  const submitMutation = useMutation({
    mutationFn: () => unwrapResult(submitRoleRequest(requestedRole, message)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myRoleRequests'] }),
    onError: (error) => toast.error(error.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submitMutation.mutate()
  }

  if (requests === undefined) {
    return (
      <div>
        <ContributeHeader heading="Contribute" />
        <Skeleton className="mt-6 h-32 max-w-md" />
      </div>
    )
  }

  const pending = requests.find((r) => r.status === 'pending')
  const latest = requests[0]

  if (pending) {
    return (
      <div>
        <ContributeHeader heading="Request pending" />
        <p className="mt-6 text-sm leading-6 text-[#90939A]">
          Your request to become a {pending.requestedRole} is waiting on review.
        </p>
        <div className="mt-4 max-w-md">
          <AuthMessage message="Pending — you'll be able to submit resources once this is approved." />
        </div>
      </div>
    )
  }

  // Shown right after a successful submit, until the invalidated query
  // above refetches and this branch is superseded by the "pending" one.
  if (submitMutation.isSuccess) {
    return (
      <div>
        <ContributeHeader heading="Request sent" />
        <div className="mt-6 max-w-md">
          <AuthMessage message="Your request has been submitted for review." tone="success" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md">
      <ContributeHeader
        heading="Request access"
        subtext="Contributors and instructors can submit resources for the library. Every submission is reviewed before it goes live."
      />

      {latest?.status === 'rejected' && (
        <div className="mt-6">
          <AuthMessage
            message={latest.rejectionReason ? `Your last request was declined: ${latest.rejectionReason}` : 'Your last request was declined.'}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <AuthSelect
          label="Role"
          value={requestedRole}
          onChange={(v) => setRequestedRole(v as 'contributor' | 'instructor')}
          options={[
            { value: 'contributor', label: 'Contributor' },
            { value: 'instructor', label: 'Instructor' },
          ]}
        />
        <AuthTextArea label="Why do you want access?" value={message} onChange={setMessage} required />

        <AuthSubmitButton loading={submitMutation.isPending}>Submit request</AuthSubmitButton>
      </form>
    </div>
  )
}

function ResourceRequestPanel() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: requests } = useQuery({
    queryKey: ['myResourceRequests'],
    queryFn: () => unwrapResult(getMyResourceRequests()),
  })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'pdf' | 'website' | 'videos' | 'git'>('website')
  const [category, setCategory] = useState('')
  const [mode, setMode] = useState<'link' | 'file'>('link')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const submitMutation = useMutation({
    mutationFn: () =>
      unwrapResult(
        submitResourceRequest({
          title,
          description,
          type,
          category,
          url: mode === 'link' ? url.trim() : undefined,
          file: mode === 'file' && file ? file : undefined,
        })
      ),
    onSuccess: () => {
      setTitle('')
      setDescription('')
      setCategory('')
      setUrl('')
      setFile(null)
      queryClient.invalidateQueries({ queryKey: ['myResourceRequests'] })
      toast.success('Submitted for review.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (mode === 'link' && !url.trim()) {
      toast.error('Provide a link.')
      return
    }
    if (mode === 'file' && !file) {
      toast.error('Choose a file.')
      return
    }

    submitMutation.mutate()
  }

  return (
    <div className="max-w-md">
      <ContributeHeader heading="Submit a resource" subtext="Every submission is reviewed before it appears in the library." />

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <AuthTextField label="Title" value={title} onChange={setTitle} required />
        <AuthTextArea label="Description" value={description} onChange={setDescription} />
        <AuthSelect label="Type" value={type} onChange={(v) => setType(v as typeof type)} options={RESOURCE_TYPES} />
        <AuthTextField label="Category" value={category} onChange={setCategory} required />

        <div className="flex gap-4 text-sm text-[#90939A]">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} />
            Link
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === 'file'} onChange={() => setMode('file')} />
            File
          </label>
        </div>

        {mode === 'link' ? (
          <AuthTextField label="URL" type="url" value={url} onChange={setUrl} required />
        ) : (
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#90939A]">File</span>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 w-full border border-white/15 bg-[#17181B] px-4 py-2.5 text-sm text-white file:mr-4 file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
            />
          </label>
        )}

        <AuthSubmitButton loading={submitMutation.isPending}>Submit</AuthSubmitButton>
      </form>

      <Eyebrow as="h2" className="mt-12">Your submissions</Eyebrow>
      <div className="mt-4 border-l border-t border-white/10">
        {requests === undefined && <SkeletonRow count={2} />}
        {requests?.length === 0 && (
          <p className="border-b border-r border-white/10 bg-[#17181B] p-4 text-sm text-[#90939A]">Nothing submitted yet.</p>
        )}
        {requests?.map((r) => (
          <div key={r.id} className="border-b border-r border-white/10 bg-[#17181B] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">{r.title}</span>
              <span className={`text-xs uppercase tracking-[0.1em] ${r.status === 'approved' ? 'text-[#3FB950]' : r.status === 'rejected' ? 'text-[#F85149]' : 'text-[#90939A]'}`}>
                {r.status}
              </span>
            </div>
            {r.status === 'rejected' && r.rejectionReason && (
              <p className="mt-1 text-xs text-[#90939A]">{r.rejectionReason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Formerly the whole of /account/build — course creation and the course
// list, now a stacked section below ResourceRequestPanel instead of its
// own page. mt-16 + a top border reads as a new section rather than a
// continuation of the resource-request form above it, same way "Your
// submissions" above separates from its own form with a plain Eyebrow.
function CourseBuildSection() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: courses } = useQuery({ queryKey: ['myCourses'], queryFn: () => unwrapResult(getMyCourses()) })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const createMutation = useMutation({
    mutationFn: () => unwrapResult(createCourse({ title, description: description || undefined, category: category || undefined })),
    onSuccess: () => {
      setTitle('')
      setDescription('')
      setCategory('')
      queryClient.invalidateQueries({ queryKey: ['myCourses'] })
      toast.success('Course created.')
    },
    onError: (error) => toast.error(error.message),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => unwrapResult(deleteCourse(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCourses'] })
      toast.success('Course deleted.')
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setDeletingId(null),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate()
  }

  // Drafts only, matching the Worker's own restriction — once a course is
  // submitted for review or published it has real reviewer/student
  // investment, so removing it becomes a staff-only action instead of
  // instructor self-service.
  function handleDelete(e: React.MouseEvent, id: number, title: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return
    setDeletingId(id)
    deleteMutation.mutate(id)
  }

  return (
    <div className="mt-16 border-t border-white/10 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Eyebrow as="h2">Manage courses</Eyebrow>
        <Link href="/account/build/groups" className="text-sm text-white/70 underline underline-offset-2 transition-colors hover:text-white">
          Manage student groups
        </Link>
      </div>

      <form onSubmit={handleCreate} className="mt-6 flex flex-wrap items-end gap-3">
        <input type="text" required placeholder="Course title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        <input type="text" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        <input type="text" placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
        <button type="submit" disabled={createMutation.isPending} className={buttonClass}>{createMutation.isPending ? '…' : 'New course'}</button>
      </form>
      <div className="mt-6 border-l border-t border-white/10">
        {courses === undefined && <SkeletonRow count={3} />}
        {courses?.length === 0 && <p className="border-b border-r border-white/10 bg-[#17181B] p-4 text-sm text-[#90939A]">No courses yet — create one above.</p>}
        {courses?.map((c) => (
          <Link
            key={c.id}
            href={`/account/build/${c.id}`}
            className="block border-b border-r border-white/10 bg-[#17181B] p-4 transition-colors hover:bg-[#0B0B0D]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">{c.title}</span>
              <span className="flex items-center gap-3">
                <span className={`text-xs uppercase tracking-[0.1em] ${COURSE_STATUS_CLASS[c.status]}`}>{COURSE_STATUS_LABEL[c.status]}</span>
                {c.status === 'draft' && (
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, c.id, c.title)}
                    disabled={deletingId === c.id}
                    className="text-xs text-white/40 underline underline-offset-2 transition-colors hover:text-[#F85149] disabled:opacity-50"
                  >
                    {deletingId === c.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </span>
            </div>
            {c.description && <p className="mt-2 text-sm text-[#90939A]">{c.description}</p>}
            {c.status === 'draft' && c.rejectionReason && (
              <p className="mt-2 text-xs text-[#F85149]">Rejected: {c.rejectionReason}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
