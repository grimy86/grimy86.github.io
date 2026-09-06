'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { getStaffCourses, unwrapResult, type StaffCourseStatus } from '@/lib/authClient'
import { SectionHeading, StatusFilter } from '@/components/admin/shared'
import { SkeletonRow } from '@/components/Skeleton'

const STATUS_OPTIONS: StaffCourseStatus[] = ['pending', 'published', 'draft']

export default function CourseRequestsPanel() {
  const [status, setStatus] = useState<StaffCourseStatus>('pending')

  const { data: courses } = useQuery({
    queryKey: ['staffCourses', status],
    queryFn: () => unwrapResult(getStaffCourses(status)),
  })

  return (
    <div>
      <SectionHeading>Course requests</SectionHeading>

      <StatusFilter status={status} options={STATUS_OPTIONS} onChange={setStatus} />

      <div className="mt-4 border-l border-t border-white/10">
        {courses === undefined && <SkeletonRow count={3} />}
        {courses?.length === 0 && <p className="border-b border-r border-white/10 bg-[#17181B] p-4 text-sm text-[#90939A]">Nothing here.</p>}
        {courses?.map((c) => (
          <Link
            key={c.id}
            href={`/account/staff/course-requests/${c.id}`}
            className="block border-b border-r border-white/10 bg-[#17181B] p-4 transition-colors hover:bg-white/[0.03]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-white">{c.title}</span>
                <span className="ml-2 text-xs text-[#90939A]">{c.instructorEmail}</span>
                {c.category && <span className="ml-2 text-xs uppercase tracking-[0.1em] text-[#FF7A33]">{c.category}</span>}
              </div>
              <span className="text-xs text-white/50">Review →</span>
            </div>
            {c.description && <p className="mt-2 text-sm text-[#90939A]">{c.description}</p>}
            {c.rejectionReason && <p className="mt-2 text-xs text-[#F85149]">Rejected: {c.rejectionReason}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}
