const variants = {
  primary:   'bg-brand text-white hover:bg-brand-hover shadow-sm',
  secondary: 'border border-primary-300 text-primary-700 bg-surface hover:bg-primary-50',
  outline:   'border border-gray-300 text-gray-700 bg-surface hover:bg-gray-50',
  ghost:     'text-primary-700 hover:bg-primary-50',
  danger:    'bg-red-700 text-white hover:bg-red-800',
}

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
}

export default function Button({ children, variant = 'primary', size = 'md', className = '', disabled = false, loading = false, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1 disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />}
      {children}
    </button>
  )
}
