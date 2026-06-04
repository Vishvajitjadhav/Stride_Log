const variants = {
  done:        'bg-green-100 text-green-800',
  in_progress: 'bg-amber-100 text-amber-800',
  pending:     'bg-gray-100 text-gray-600',
  submitted:   'bg-green-100 text-green-800',
  missing:     'bg-red-100 text-red-700',
  admin:       'bg-primary-100 text-primary-700',
  draft:       'bg-gray-100 text-gray-600',
}

export default function Badge({ children, variant = 'pending', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] ?? variants.pending} ${className}`}>
      {children}
    </span>
  )
}
