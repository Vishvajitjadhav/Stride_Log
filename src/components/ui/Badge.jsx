// Muted status labels. Colour is never the only signal: every badge has text.
const variants = {
  done:        'bg-mint-50 text-mint-700 ring-mint-200',
  in_progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  pending:     'bg-gray-50 text-gray-600 ring-gray-200',
  blocked:     'bg-red-50 text-red-700 ring-red-200',
  submitted:   'bg-mint-50 text-mint-700 ring-mint-200',
  missing:     'bg-red-50 text-red-700 ring-red-200',
  admin:       'bg-primary-50 text-primary-800 ring-primary-200',
  draft:       'bg-gray-50 text-gray-600 ring-gray-200',
  info:        'bg-primary-50 text-primary-700 ring-primary-200',
  extra:       'bg-accent-50 text-accent-700 ring-accent-100',
  off:         'bg-gray-50 text-gray-500 ring-gray-200',
}

export default function Badge({ children, variant = 'pending', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${variants[variant] ?? variants.pending} ${className}`}>
      {children}
    </span>
  )
}
