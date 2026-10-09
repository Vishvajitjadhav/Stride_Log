export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-surface rounded-lg border border-gray-200 ${className}`} {...props}>
      {children}
    </div>
  )
}

// Card with a title row (and optional hint / actions on the right).
export function Section({ title, hint, tip, actions, children, className = '', bodyClassName = 'p-5' }) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="section-title flex items-center gap-1.5">{title}{tip}</h2>
          {hint && <p className="section-hint">{hint}</p>}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </Card>
  )
}
