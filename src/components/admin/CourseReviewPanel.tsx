'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getMyCourse,
  reviewCourse,
  deleteStaffCourse,
  unwrapResult,
  type InstructorQuizQuestion,
} from '@/lib/authClient'
import { ArticleBody, VideoBody, ExerciseBody } from '@/components/lesson/LessonContentViews'
import { SectionHeading, buttonClass } from '@/components/admin/shared'
import Eyebrow from '@/components/Eyebrow'
import { useToast } from '@/components/ToastProvider'
import { Skeleton } from '@/components/Skeleton'

export default function CourseReviewPanel({ id }: { id: number }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: course, error: courseError } = useQuery({
    queryKey: ['myCourse', id],
    queryFn: () => unwrapResult(getMyCourse(id)),
  })

  // Every action here navigates away on success, back to the list this
  // course was reviewed from — invalidating it there keeps that list from
  // showing this course under its old status/still in the pending filter.
  // The toast fires here but renders on whatever page router.push lands
  // on next, since ToastProvider lives above the route content.
  function backToList(message: string) {
    queryClient.invalidateQueries({ queryKey: ['staffCourses'] })
    queryClient.invalidateQueries({ queryKey: ['staffPendingCounts'] })
    toast.success(message)
    router.push('/account/staff?tab=course-requests')
  }

  const reviewMutation = useMutation({
    mutationFn: ({ action, reason }: { action: 'approve' | 'reject'; reason?: string }) => unwrapResult(reviewCourse(id, action, reason)),
    onSuccess: (_, { action }) => backToList(action === 'approve' ? 'Course approved.' : 'Course rejected.'),
    onError: (error) => toast.error(error.message),
  })
  const deleteMutation = useMutation({
    mutationFn: () => unwrapResult(deleteStaffCourse(id)),
    onSuccess: () => backToList('Course deleted.'),
    onError: (error) => toast.error(error.message),
  })

  const acting = reviewMutation.isPending || deleteMutation.isPending

  function handleReject() {
    const reason = window.prompt('Rejection reason (shown to the instructor):')
    if (reason === null) return
    reviewMutation.mutate({ action: 'reject', reason })
  }

  function handleDelete() {
    if (!course) return
    if (!window.confirm(`Permanently delete "${course.title}"? This removes every module, lesson, and quiz in it. This cannot be undone.`)) return
    deleteMutation.mutate()
  }

  if (courseError && !course) {
    return <p className="text-sm text-[#F85149] animate-fade-in-up motion-reduce:animate-none">{courseError.message}</p>
  }

  if (!course) {
    return (
      <div>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-9 w-72 max-w-full" />
        <Skeleton className="mt-8 h-40" />
      </div>
    )
  }

  return (
    <div>
      <Link href="/account/staff?tab=course-requests" className="text-xs uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white">
        ← Course requests
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>{course.category ?? 'Uncategorized'} · {course.status.replace('_', ' ')}</Eyebrow>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-white">{course.title}</h1>
          {course.description && <p className="mt-2 max-w-2xl text-sm text-[#90939A]">{course.description}</p>}
          {course.rejectionReason && <p className="mt-2 text-xs text-[#F85149]">Previously rejected: {course.rejectionReason}</p>}
        </div>

        <div className="flex shrink-0 gap-2">
          {course.status === 'pending_review' && (
            <>
              <button type="button" disabled={acting} onClick={() => reviewMutation.mutate({ action: 'approve' })} className={buttonClass}>Approve</button>
              <button type="button" disabled={acting} onClick={handleReject} className={buttonClass}>Reject</button>
            </>
          )}
          <button
            type="button"
            disabled={acting}
            onClick={handleDelete}
            className="border border-[#F85149]/50 px-3 py-1.5 text-xs font-medium text-[#F85149] transition-colors transition-transform duration-150 hover:border-[#F85149] hover:bg-[#F85149]/10 active:scale-[0.98] motion-reduce:transition-none disabled:opacity-50 disabled:active:scale-100"
          >
            Delete
          </button>
        </div>
      </div>

      {courseError && <p className="mt-4 text-sm text-[#F85149] animate-fade-in-up motion-reduce:animate-none">{courseError.message}</p>}

      <div className="mt-10 flex flex-col gap-10">
        {course.modules.length === 0 && <p className="text-sm text-[#90939A]">This course has no modules yet.</p>}
        {course.modules.map((mod) => (
          <div key={mod.id}>
            <SectionHeading>{mod.title}</SectionHeading>
            {mod.description && <p className="mt-2 text-sm text-[#90939A]">{mod.description}</p>}

            <div className="mt-4 flex flex-col gap-6">
              {mod.lessons.length === 0 && <p className="text-sm text-[#90939A]">No lessons in this module yet.</p>}
              {mod.lessons.map((lesson) => (
                <div key={lesson.id} className="border border-white/10 bg-[#17181B] p-5">
                  <p className="text-xs uppercase tracking-[0.1em] text-white/40">{lesson.type}</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{lesson.title}</h3>
                  <div className="mt-4">
                    {lesson.type === 'article' && <ArticleBody contentPath={lesson.contentPath} />}
                    {lesson.type === 'video' && <VideoBody videoUrl={lesson.videoUrl} />}
                    {lesson.type === 'exercise' && lesson.exercise && <ExerciseBody exercise={lesson.exercise} />}
                    {lesson.type === 'quiz' && lesson.quiz && <QuizReview questions={lesson.quiz.questions} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Read-only inverse of the student-facing QuizBody — shows every question
// with its correct answer already flagged, since this response (unlike
// the public catalog's) is allowed to carry `answers[].correct` for an
// owner/admin. No submission, just a review view.
function QuizReview({ questions }: { questions: InstructorQuizQuestion[] }) {
  return (
    <div className="flex flex-col gap-5">
      {questions.map((q, i) => (
        <div key={q.id}>
          <p className="text-sm font-medium text-white">{i + 1}. {q.prompt}</p>
          <div className="mt-2 flex flex-col gap-1">
            {q.answers.map((a) => (
              <p key={a.id} className={`text-sm ${a.correct ? 'text-[#3FB950]' : 'text-[#90939A]'}`}>
                {a.correct ? '✓' : '·'} {a.body}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
