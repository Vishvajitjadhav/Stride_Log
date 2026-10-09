const variants = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
  secondary: 'border border-primary-600 text-primary-600 hover:bg-primary-50',
  outline:   'border border-gray-200 text-gray-700 bg-white hover:bg-gray-50',
  ghost:     'text-primary-600 hover:bg-primary-50',
  danger:    'bg-red-500 text-white hover:bg-red-600',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
}

export default function Button({ children, variant = 'primary', size = 'md', className = '', disabled = false, loading = false, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />}
      {children}
    </button>
  )
}
