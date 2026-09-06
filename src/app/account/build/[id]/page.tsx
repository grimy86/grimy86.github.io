'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ActionButton from '@/components/ActionButton'
import Eyebrow from '@/components/Eyebrow'
import { useSession } from '@/components/SessionProvider'
import { useToast } from '@/components/ToastProvider'
import { Skeleton } from '@/components/Skeleton'
import {
  getMyCourse,
  updateCourse,
  submitCourseForReview,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
  saveLessonContent,
  getLessonContent,
  uploadLessonImage,
  uploadCourseIcon,
  addCourseAuthor,
  removeCourseAuthor,
  setCourseGroups,
  getMyGroups,
  unwrapResult,
  getAssetSrc,
  type InstructorCourseDetail,
  type InstructorModule,
  type InstructorLesson,
  type LessonType,
  type LessonFields,
  type CourseDifficulty,
  type CourseVisibility,
} from '@/lib/authClient'

// Same style constants as AdminPanel.tsx / the instructor courses list —
// duplicated rather than shared, matching this app's existing
// low-abstraction convention.
const inputClass = "border border-white/15 bg-[#17181B] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
// Lighter-on-darker, for controls sitting on a bg-[#17181B] row rather
// than the page background — same reasoning as AdminPanel.tsx's
// rowInputClass, applied one level deeper here (module row -> lesson row
// -> lesson editor each alternate #17181B/#0B0B0D so nothing blends into
// its own container).
const rowInputClass = "border border-white/15 bg-[#0B0B0D] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
const buttonClass = "border border-[#FF7A33]/50 px-3 py-1.5 text-xs font-medium text-[#FF7A33] transition-colors transition-transform duration-150 hover:border-[#FF7A33] hover:bg-[#FF7A33]/10 active:scale-[0.98] motion-reduce:transition-none disabled:opacity-50 disabled:active:scale-100"

const TYPE_LABEL: Record<LessonType, string> = {
  article: 'Article',
  video: 'Video',
  exercise: 'Exercise',
  quiz: 'Quiz',
}

const STATUS_LABEL: Record<InstructorCourseDetail['status'], string> = {
  draft: 'Draft',
  pending_review: 'In review',
  published: 'Published',
}

// Bordered chip, not just colored text — a course's status is the single
// most important thing on this screen (it gates whether Submit for
// review even does anything), so it gets a persistent, at-a-glance
// marker in the header instead of being buried in the settings pane.
const STATUS_CHIP_CLASS: Record<InstructorCourseDetail['status'], string> = {
  draft: 'border-white/20 text-white/60',
  pending_review: 'border-[#FF7A33]/40 text-[#FF7A33]',
  published: 'border-[#3FB950]/40 text-[#3FB950]',
}

const PROSE_LESSON_CLASS =
  "prose-lesson [&_a]:text-[#FF7A33] [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-4 [&_blockquote]:text-[#90939A] [&_code]:bg-white/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_h1]:mt-10 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-[-0.04em] [&_h1]:text-white [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h2]:text-white [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_hr]:border-white/10 [&_img]:max-w-full [&_li]:leading-7 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_p]:leading-7 [&_p]:text-[#90939A] [&_pre]:my-4 [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/[0.03] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-white [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 text-sm"

function dirnameOf(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

// Which lesson (if any) is open in the right-hand editor pane —
// lessonId: null means "new lesson" (moduleId is the target to create it
// in). null overall means the pane shows the course-settings view instead.
type Selection = { moduleId: number; lessonId: number | null } | null

export default function InstructorCourseBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const courseId = Number(id)
  const router = useRouter()
  const { user, loading: sessionLoading } = useSession()
  const [selected, setSelected] = useState<Selection>(null)

  const canBuild = !!user && (user.role === 'instructor' || user.role === 'staff')
  const courseQuery = useQuery({
    queryKey: ['myCourse', courseId],
    queryFn: () => unwrapResult(getMyCourse(courseId)),
    enabled: canBuild,
  })
  const course = courseQuery.data

  useEffect(() => {
    if (sessionLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role !== 'instructor' && user.role !== 'staff') {
      router.replace('/')
    }
  }, [sessionLoading, user, router])

  if (sessionLoading || !user || !canBuild || !course) {
    if (courseQuery.error) {
      return <p className="text-sm text-[#F85149]">{courseQuery.error.message}</p>
    }
    return <BuilderSkeleton />
  }

  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0)

  // Keep an open editor pointed at a real lesson — if it was just deleted,
  // or a course reload otherwise drops it from the tree, fall back to the
  // course-settings view rather than rendering a stale/missing lesson.
  const selectedModule = selected ? course.modules.find((m) => m.id === selected.moduleId) : undefined
  const selectedLesson = selectedModule && selected?.lessonId != null
    ? selectedModule.lessons.find((l) => l.id === selected.lessonId)
    : undefined
  const showingLessonEditor = Boolean(selectedModule) && (selected?.lessonId === null || Boolean(selectedLesson))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <Link href="/account/contribute" className="text-xs uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white">
            ← Your courses
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-[-0.04em] text-white">{course.title}</h1>
            <span className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${STATUS_CHIP_CLASS[course.status]}`}>
              {STATUS_LABEL[course.status]}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/40">
            {course.modules.length} module{course.modules.length === 1 ? '' : 's'} · {lessonCount} lesson{lessonCount === 1 ? '' : 's'} · {course.viewCount} views
          </p>
        </div>
        <button type="button" onClick={() => setSelected(null)} className={buttonClass}>
          Course settings
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
        <div className="border-white/10 py-6 md:border-r md:pr-6">
          <div className="flex flex-col gap-4">
            {course.modules.map((mod) => (
              <ModuleRow
                key={mod.id}
                mod={mod}
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </div>
          <AddModuleForm courseId={course.id} />
        </div>

        <div className="min-w-0 py-6 md:pl-8">
          {showingLessonEditor && selectedModule ? (
            <LessonEditor
              courseId={course.id}
              moduleId={selectedModule.id}
              lesson={selectedLesson}
              onSaved={() => setSelected(null)}
              onCancel={() => setSelected(null)}
            />
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-px border border-white/10 bg-white/10">
                <StatTile label="Views" value={course.viewCount} />
                <StatTile label="Enrolled" value={course.enrolledCount} />
                <StatTile label="Completed" value={course.completedCount} />
              </div>

              <CourseIconUpload course={course} />
              <CourseDetailsForm course={course} />
              <CourseAuthorsSection course={course} />
              <CourseVisibilitySection course={course} />

              {course.status === 'draft' && course.rejectionReason && (
                <p className="mt-4 text-sm text-[#F85149]">Rejected: {course.rejectionReason}</p>
              )}

              <SubmitForReviewControl course={course} lessonCount={lessonCount} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BuilderSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-56" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-3 py-6 md:border-r md:border-white/10 md:pr-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="py-6 md:pl-8">
          <div className="grid grid-cols-3 gap-px border border-white/10 bg-white/10">
            <Skeleton className="h-16 bg-[#17181B]" />
            <Skeleton className="h-16 bg-[#17181B]" />
            <Skeleton className="h-16 bg-[#17181B]" />
          </div>
          <Skeleton className="mt-6 h-32" />
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#17181B] p-4">
      <p className="text-2xl font-bold tracking-[-0.03em] text-white">{value}</p>
      <p className="mt-1 text-xs text-[#90939A]">{label}</p>
    </div>
  )
}

function CourseIconUpload({ course }: { course: InstructorCourseDetail }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => unwrapResult(uploadCourseIcon(course.id, file)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCourse', course.id] })
      toast.success('Icon updated.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
  }

  return (
    <div className="mt-6 flex items-center gap-4">
      {course.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- cross-subdomain, session-cookie-gated asset; next/image can't proxy this
        <img src={getAssetSrc(course.iconUrl)} alt="" className="h-16 w-16 shrink-0 border border-white/10 object-cover" />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-white/10 bg-[#17181B] text-xs text-white/40">No icon</div>
      )}
      <div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml" className="hidden" onChange={handleChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className={buttonClass}
        >
          {uploadMutation.isPending ? 'Uploading…' : 'Change icon'}
        </button>
      </div>
    </div>
  )
}

const DIFFICULTY_OPTIONS: { value: CourseDifficulty; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

function CourseDetailsForm({ course }: { course: InstructorCourseDetail }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description ?? '')
  const [category, setCategory] = useState(course.category ?? '')
  const [difficulty, setDifficulty] = useState<CourseDifficulty | ''>(course.difficulty ?? '')
  const [iconGlyph, setIconGlyph] = useState(course.iconGlyph ?? '')

  const saveMutation = useMutation({
    mutationFn: () =>
      unwrapResult(
        updateCourse(course.id, {
          title,
          description: description || undefined,
          category: category || undefined,
          difficulty: difficulty || undefined,
          visibility: course.visibility,
          iconGlyph: iconGlyph || undefined,
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCourse', course.id] })
      toast.success('Course details saved.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    saveMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Title" className={inputClass} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className={inputClass} />
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className={inputClass} />
      <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as CourseDifficulty | '')} className={inputClass}>
        <option value="">No difficulty set</option>
        {DIFFICULTY_OPTIONS.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/40">Icon badge (shown when no icon image is uploaded, e.g. &quot;C#&quot; or &quot;/24&quot;)</span>
        <input value={iconGlyph} onChange={(e) => setIconGlyph(e.target.value)} maxLength={8} placeholder="Icon badge, e.g. C#" className={inputClass} />
      </label>
      <button type="submit" disabled={saveMutation.isPending} className={`self-start ${buttonClass}`}>{saveMutation.isPending ? '…' : 'Save course details'}</button>
    </form>
  )
}

function CourseAuthorsSection({ course }: { course: InstructorCourseDetail }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [email, setEmail] = useState('')

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['myCourse', course.id] })
  }

  const addMutation = useMutation({
    mutationFn: () => unwrapResult(addCourseAuthor(course.id, email)),
    onSuccess: () => {
      setEmail('')
      invalidate()
      toast.success('Author added.')
    },
    onError: (error) => toast.error(error.message),
  })
  const removeMutation = useMutation({
    mutationFn: (userId: number) => unwrapResult(removeCourseAuthor(course.id, userId)),
    onSuccess: () => {
      invalidate()
      toast.success('Author removed.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    addMutation.mutate()
  }

  return (
    <div className="mt-8">
      <Eyebrow as="h2">Authors</Eyebrow>
      <div className="mt-3 flex flex-col gap-2">
        {course.authors.map((author) => (
          <div key={author.id} className="flex items-center justify-between gap-3 border border-white/10 bg-[#17181B] px-4 py-2 text-sm text-white">
            <span>{author.displayName}{author.id === course.createdBy && ' (owner)'}</span>
            {author.id !== course.createdBy && (
              <button type="button" onClick={() => removeMutation.mutate(author.id)} className="text-xs text-white/50 underline underline-offset-2 hover:text-white">
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Add a co-author by email"
          className={inputClass}
        />
        <button type="submit" disabled={addMutation.isPending} className={buttonClass}>{addMutation.isPending ? '…' : 'Add'}</button>
      </form>
      <p className="mt-1 text-xs text-white/40">Must already be an instructor or staff member on the site.</p>
    </div>
  )
}

function CourseVisibilitySection({ course }: { course: InstructorCourseDetail }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  // Same key as /account/build/groups — shares that page's cache instead
  // of firing a second request for the same roster.
  const { data: groups } = useQuery({ queryKey: ['myGroups'], queryFn: () => unwrapResult(getMyGroups()) })
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set(course.groupIds))

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['myCourse', course.id] })
  }

  const visibilityMutation = useMutation({
    mutationFn: (visibility: CourseVisibility) =>
      unwrapResult(
        updateCourse(course.id, {
          title: course.title,
          description: course.description || undefined,
          category: course.category || undefined,
          difficulty: course.difficulty || undefined,
          visibility,
        })
      ),
    onSuccess: () => {
      invalidate()
      toast.success('Visibility updated.')
    },
    onError: (error) => toast.error(error.message),
  })
  const groupsMutation = useMutation({
    mutationFn: () => unwrapResult(setCourseGroups(course.id, [...selectedGroupIds])),
    onSuccess: () => {
      invalidate()
      toast.success('Group access saved.')
    },
    onError: (error) => toast.error(error.message),
  })
  const saving = visibilityMutation.isPending || groupsMutation.isPending

  function toggleGroup(id: number) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-8">
      <Eyebrow as="h2">Visibility</Eyebrow>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => visibilityMutation.mutate('public')}
          disabled={saving}
          className={course.visibility === 'public' ? buttonClass : inputClass}
        >
          Open to everyone
        </button>
        <button
          type="button"
          onClick={() => visibilityMutation.mutate('restricted')}
          disabled={saving}
          className={course.visibility === 'restricted' ? buttonClass : inputClass}
        >
          Restricted to groups
        </button>
      </div>

      {course.visibility === 'restricted' && (
        <div className="mt-4">
          <p className="text-xs text-white/40">Only students in the checked groups can see or enroll in this course.</p>
          <div className="mt-2 flex flex-col gap-2">
            {groups === undefined && <Skeleton className="h-5 w-40" />}
            {groups?.length === 0 && (
              <p className="text-sm text-[#90939A]">
                No groups yet — <Link href="/account/build/groups" className="text-[#FF7A33] underline underline-offset-2">create one</Link>.
              </p>
            )}
            {groups?.map((group) => (
              <label key={group.id} className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={selectedGroupIds.has(group.id)}
                  onChange={() => toggleGroup(group.id)}
                />
                {group.name} ({group.memberCount} students)
              </label>
            ))}
          </div>
          {groups && groups.length > 0 && (
            <button type="button" onClick={() => groupsMutation.mutate()} disabled={saving} className={`mt-3 ${buttonClass}`}>
              {saving ? '…' : 'Save group access'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SubmitForReviewControl({
  course,
  lessonCount,
}: {
  course: InstructorCourseDetail
  lessonCount: number
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const submitMutation = useMutation({
    mutationFn: () => unwrapResult(submitCourseForReview(course.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCourse', course.id] })
      toast.success('Submitted for review.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (course.status === 'published') {
    return <p className="mt-6 text-sm text-[#3FB950]">✓ Published — live on the site.</p>
  }
  if (course.status === 'pending_review') {
    return <p className="mt-6 text-sm text-[#FF7A33]">In review — a staff member will approve or reject it soon.</p>
  }
  if (lessonCount === 0) {
    return <p className="mt-6 text-sm text-[#90939A]">Add at least one lesson before you can submit this course for review.</p>
  }

  return (
    <div className="mt-6">
      <ActionButton onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>Submit for review</ActionButton>
    </div>
  )
}

function AddModuleForm({ courseId }: { courseId: number }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const createMutation = useMutation({
    mutationFn: () => unwrapResult(createModule(courseId, { title, description: description || undefined })),
    onSuccess: () => {
      setTitle('')
      setDescription('')
      queryClient.invalidateQueries({ queryKey: ['myCourse', courseId] })
      toast.success('Module added.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Module title" className={inputClass} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className={inputClass} />
      <button type="submit" disabled={createMutation.isPending} className={buttonClass}>{createMutation.isPending ? '…' : '+ Add module'}</button>
    </form>
  )
}

function ModuleRow({
  mod,
  selected,
  onSelect,
}: {
  mod: InstructorModule
  selected: Selection
  onSelect: (s: Selection) => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(mod.title)
  const [description, setDescription] = useState(mod.description ?? '')

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['myCourse', mod.courseId] })
  }

  const saveMutation = useMutation({
    mutationFn: () => unwrapResult(updateModule(mod.id, { title, description: description || undefined })),
    onSuccess: () => {
      setEditing(false)
      invalidate()
      toast.success('Module saved.')
    },
    onError: (error) => toast.error(error.message),
  })
  const deleteModuleMutation = useMutation({
    mutationFn: () => unwrapResult(deleteModule(mod.id)),
    onSuccess: () => {
      invalidate()
      toast.success('Module deleted.')
    },
    onError: (error) => toast.error(error.message),
  })
  const deleteLessonMutation = useMutation({
    mutationFn: (lessonId: number) => unwrapResult(deleteLesson(lessonId)),
    onSuccess: () => {
      invalidate()
      toast.success('Lesson deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSaveModule(e: React.FormEvent) {
    e.preventDefault()
    saveMutation.mutate()
  }

  function handleDeleteModule() {
    if (!window.confirm(`Delete "${mod.title}" and all its lessons? This can't be undone.`)) return
    deleteModuleMutation.mutate()
  }

  function handleDeleteLesson(lessonId: number) {
    if (!window.confirm('Delete this lesson? This can\'t be undone.')) return
    if (selected?.moduleId === mod.id && selected.lessonId === lessonId) onSelect(null)
    deleteLessonMutation.mutate(lessonId)
  }

  return (
    <div>
      {editing ? (
        <form onSubmit={handleSaveModule} className="flex flex-col gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className={rowInputClass} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className={rowInputClass} />
          <div className="flex gap-2">
            <button type="submit" disabled={saveMutation.isPending} className={buttonClass}>{saveMutation.isPending ? '…' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="group flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">{mod.title}</span>
          <span className="flex shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" onClick={() => setEditing(true)} className="text-[10px] uppercase tracking-[0.08em] text-white/40 hover:text-white">Edit</button>
            <button type="button" onClick={handleDeleteModule} className="text-[10px] uppercase tracking-[0.08em] text-white/40 hover:text-[#F85149]">Delete</button>
          </span>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-1 border-l border-white/10 pl-3">
        {mod.lessons.map((lesson) => {
          const isSelected = selected?.moduleId === mod.id && selected.lessonId === lesson.id
          return (
            <div
              key={lesson.id}
              className={`group flex items-center justify-between gap-2 border-l-2 py-1.5 pl-3 pr-2 text-sm transition-colors ${
                isSelected ? 'border-[#FF7A33] bg-white/5 text-white' : 'border-transparent text-[#90939A] hover:text-white'
              }`}
            >
              <button type="button" onClick={() => onSelect({ moduleId: mod.id, lessonId: lesson.id })} className="min-w-0 flex-1 truncate text-left">
                <span className="mr-2 text-[10px] uppercase tracking-[0.08em] text-white/40">{TYPE_LABEL[lesson.type]}</span>
                {lesson.title}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLesson(lesson.id)}
                className="shrink-0 text-white/30 opacity-0 transition-opacity hover:text-[#F85149] group-hover:opacity-100"
                aria-label={`Delete ${lesson.title}`}
              >
                ×
              </button>
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => onSelect({ moduleId: mod.id, lessonId: null })}
          className={`self-start py-1.5 pl-3 text-xs transition-colors ${
            selected?.moduleId === mod.id && selected.lessonId === null ? 'text-[#FF7A33]' : 'text-white/40 hover:text-white'
          }`}
        >
          + Add lesson
        </button>
      </div>
    </div>
  )
}

type AnswerDraft = { body: string; correct: boolean }
type QuestionDraft = { prompt: string; answers: AnswerDraft[] }

function LessonEditor({
  courseId,
  moduleId,
  lesson,
  onSaved,
  onCancel,
}: {
  courseId: number
  moduleId: number
  lesson?: InstructorLesson
  onSaved: () => void
  onCancel?: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const isEditing = Boolean(lesson)

  const [title, setTitle] = useState(lesson?.title ?? '')
  const [type, setType] = useState<LessonType>(lesson?.type ?? 'article')
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? '')
  const [prompt, setPrompt] = useState(lesson?.exercise?.prompt ?? '')
  const [language, setLanguage] = useState(lesson?.exercise?.language ?? '')
  const [starterCode, setStarterCode] = useState(lesson?.exercise?.starterCode ?? '')
  const [solutionNotes, setSolutionNotes] = useState(lesson?.exercise?.solutionNotes ?? '')
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    lesson?.quiz?.questions.map((q) => ({
      prompt: q.prompt,
      answers: q.answers.map((a) => ({ body: a.body, correct: a.correct })),
    })) ?? []
  )

  const needsContentFetch = isEditing && lesson?.type === 'article' && Boolean(lesson.contentPath)
  const contentQuery = useQuery({
    queryKey: ['lessonContent', lesson?.contentPath],
    queryFn: () => unwrapResult(getLessonContent(lesson!.contentPath!)),
    enabled: needsContentFetch,
  })
  const [markdown, setMarkdown] = useState('')
  // Seeds the draft once per contentPath rather than on every fresh query
  // response — a background revalidation landing mid-edit must never
  // silently overwrite text being typed, same reasoning as the profile
  // bio field.
  const seededContentPath = useRef<string | null>(null)
  useEffect(() => {
    if (contentQuery.data !== undefined && seededContentPath.current !== lesson?.contentPath) {
      setMarkdown(contentQuery.data)
      seededContentPath.current = lesson?.contentPath ?? null
    }
  }, [contentQuery.data, lesson?.contentPath])
  const markdownLoaded = !needsContentFetch || contentQuery.data !== undefined

  const [preview, setPreview] = useState<string | null>(null)
  const markdownRef = useRef<HTMLTextAreaElement>(null)

  const imageMutation = useMutation({
    mutationFn: (file: File) => unwrapResult(uploadLessonImage(moduleId, file)),
    onSuccess: (data) => {
      // Insert at the cursor rather than always appending, so uploading an
      // image mid-paragraph doesn't force a rewrite of the surrounding text.
      const markup = `![](${data.filename})`
      const textarea = markdownRef.current
      const cursor = textarea?.selectionStart ?? markdown.length
      setMarkdown((prev) => prev.slice(0, cursor) + markup + prev.slice(cursor))
    },
    onError: (error) => toast.error(error.message),
  })

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    imageMutation.mutate(file)
  }

  async function handlePreview() {
    // basePath only resolves relative image references correctly for an
    // existing lesson (a brand-new lesson's content_path doesn't exist
    // until the first save) — acceptable for a preview-while-drafting tool.
    const basePath = lesson?.contentPath ? dirnameOf(lesson.contentPath) : ''
    const res = await fetch('/api/render/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown, basePath }),
    })
    if (!res.ok) return
    const { html } = await res.json()
    setPreview(html)
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, { prompt: '', answers: [{ body: '', correct: true }, { body: '', correct: false }] }])
  }
  function removeQuestion(qi: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== qi))
  }
  function updateQuestionPrompt(qi: number, value: string) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, prompt: value } : q)))
  }
  function addAnswer(qi: number) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, answers: [...q.answers, { body: '', correct: false }] } : q)))
  }
  function removeAnswer(qi: number, ai: number) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, answers: q.answers.filter((_, j) => j !== ai) } : q)))
  }
  function updateAnswerBody(qi: number, ai: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === qi ? { ...q, answers: q.answers.map((a, j) => (j === ai ? { ...a, body: value } : a)) } : q))
    )
  }
  function setCorrectAnswer(qi: number, ai: number) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === qi ? { ...q, answers: q.answers.map((a, j) => ({ ...a, correct: j === ai })) } : q))
    )
  }

  const quizValid =
    type !== 'quiz' ||
    (questions.length > 0 &&
      questions.every((q) => q.prompt.trim() && q.answers.length >= 2 && q.answers.every((a) => a.body.trim()) && q.answers.filter((a) => a.correct).length === 1))

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fields: LessonFields = {
        title,
        type,
        ...(type === 'video' ? { videoUrl } : {}),
        ...(type === 'exercise' ? { prompt, language: language || undefined, starterCode: starterCode || undefined, solutionNotes: solutionNotes || undefined } : {}),
        ...(type === 'quiz' ? { questions: questions.map((q) => ({ prompt: q.prompt, answers: q.answers.map((a) => ({ body: a.body, correct: a.correct })) })) } : {}),
      }

      let lessonId: number
      if (isEditing) {
        await unwrapResult(updateLesson(lesson!.id, fields))
        lessonId = lesson!.id
      } else {
        const created = await unwrapResult(createLesson(moduleId, fields))
        lessonId = created.id
      }

      if (type === 'article') {
        await unwrapResult(saveLessonContent(lessonId, markdown))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCourse', courseId] })
      toast.success(isEditing ? 'Lesson saved.' : 'Lesson created.')
      onSaved()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Lesson title" className={inputClass} />
        {!isEditing && (
          <select value={type} onChange={(e) => setType(e.target.value as LessonType)} className={inputClass}>
            <option value="article">Article</option>
            <option value="video">Video</option>
            <option value="exercise">Exercise</option>
            <option value="quiz">Quiz</option>
          </select>
        )}
        {isEditing && <span className="text-xs uppercase tracking-[0.1em] text-white/40">{TYPE_LABEL[type]}</span>}
      </div>

      {type === 'article' && (
        <div>
          {!markdownLoaded ? (
            <Skeleton className="h-[420px] w-full" />
          ) : (
            <>
              <textarea
                ref={markdownRef}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                rows={20}
                placeholder="Markdown content…"
                className="w-full resize-y border border-white/15 bg-[#17181B] px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={handlePreview} className={buttonClass}>Preview</button>
                <label className={`cursor-pointer ${buttonClass} ${imageMutation.isPending ? 'pointer-events-none opacity-50' : ''}`}>
                  {imageMutation.isPending ? 'Uploading…' : '+ Insert image'}
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml" onChange={handleImageUpload} disabled={imageMutation.isPending} className="hidden" />
                </label>
              </div>
              {preview && <div className={`mt-4 border border-white/10 bg-[#17181B] p-6 ${PROSE_LESSON_CLASS}`} dangerouslySetInnerHTML={{ __html: preview }} />}
            </>
          )}
        </div>
      )}

      {type === 'video' && (
        <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} required placeholder="Video URL" className={inputClass} />
      )}

      {type === 'exercise' && (
        <div className="flex flex-col gap-3">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} required rows={4} placeholder="Prompt" className={`${inputClass} resize-y`} />
          <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Language (e.g. c, asm)" className={inputClass} />
          <textarea value={starterCode} onChange={(e) => setStarterCode(e.target.value)} rows={6} placeholder="Starter code" className={`${inputClass} resize-y font-mono`} />
          <textarea value={solutionNotes} onChange={(e) => setSolutionNotes(e.target.value)} rows={4} placeholder="Solution notes" className={`${inputClass} resize-y`} />
        </div>
      )}

      {type === 'quiz' && (
        <div className="flex flex-col gap-4">
          {questions.map((q, qi) => (
            <fieldset key={qi} className="border border-white/10 bg-[#0B0B0D] p-4">
              <div className="flex items-start justify-between gap-3">
                <input
                  value={q.prompt}
                  onChange={(e) => updateQuestionPrompt(qi, e.target.value)}
                  placeholder={`Question ${qi + 1}`}
                  className={`${inputClass} flex-1`}
                />
                <button type="button" onClick={() => removeQuestion(qi)} className={buttonClass}>Remove</button>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {q.answers.map((a, ai) => (
                  <div key={ai} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Mark correct"
                      onClick={() => setCorrectAnswer(qi, ai)}
                      className={`h-4 w-4 shrink-0 border ${a.correct ? 'border-[#3FB950] bg-[#3FB950]' : 'border-white/30'}`}
                    />
                    <input
                      value={a.body}
                      onChange={(e) => updateAnswerBody(qi, ai, e.target.value)}
                      placeholder={`Answer ${ai + 1}`}
                      className={`${inputClass} flex-1`}
                    />
                    <button type="button" disabled={q.answers.length <= 2} onClick={() => removeAnswer(qi, ai)} className={buttonClass}>×</button>
                  </div>
                ))}
                <button type="button" onClick={() => addAnswer(qi)} className={`self-start ${buttonClass}`}>+ Add answer</button>
              </div>
            </fieldset>
          ))}
          <button type="button" onClick={addQuestion} className={`self-start ${buttonClass}`}>+ Add question</button>
          {!quizValid && questions.length > 0 && (
            <p className="text-xs text-[#90939A]">Every question needs at least 2 answers with exactly one marked correct.</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" disabled={saveMutation.isPending || !quizValid} onClick={() => saveMutation.mutate()} className={buttonClass}>
          {saveMutation.isPending ? '…' : isEditing ? 'Save lesson' : 'Create lesson'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className={buttonClass}>Cancel</button>}
      </div>
    </div>
  )
}
