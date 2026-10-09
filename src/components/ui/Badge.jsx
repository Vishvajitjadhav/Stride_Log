const variants = {
  done:        'bg-green-100 text-green-800',
  in_progress: 'bg-amber-100 text-amber-800',
  pending:     'bg-gray-100 text-gray-600',
  blocked:     'bg-red-100 text-red-700',
  submitted:   'bg-green-100 text-green-800',
  missing:     'bg-red-100 text-red-700',
  admin:       'bg-primary-100 text-primary-700',
  draft:       'bg-gray-100 text-gray-600',
  info:        'bg-sky-100 text-sky-700',
  high:        'bg-red-50 text-red-600 ring-1 ring-red-200',
  low:         'bg-gray-50 text-gray-500 ring-1 ring-gray-200',
  extra:       'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}

export default function Badge({ children, variant = 'pending', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${variants[variant] ?? variants.pending} ${className}`}>
      {children}
    </span>
  )
}
