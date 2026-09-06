// Every section label on the site used to be a plain uppercase accent
// line. Prefixing it with "//" — in a deliberately darker cut of the
// accent color, not the full bright one — reads as a source comment
// instead of a marketing label, which fits a site about reading code far
// better than a generic eyebrow ever did.
export default function Eyebrow({
  children,
  className = '',
  as: Tag = 'p',
}: {
  children: React.ReactNode
  className?: string
  as?: 'p' | 'h2' | 'h3'
}) {
  return (
    <Tag className={`text-xs font-medium uppercase tracking-[0.18em] text-[#FF7A33] ${className}`}>
      <span className="text-[#C95E1A]">{'// '}</span>
      {children}
    </Tag>
  )
}
