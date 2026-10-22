const variants = {
  primary:   'text-white bg-gradient-to-b from-[#6c6af0] to-brand hover:brightness-110 shadow-[0_1px_2px_rgb(20_26_41/.08),0_4px_12px_-4px_rgb(79_76_227/.45)] hover:shadow-[0_2px_4px_rgb(20_26_41/.08),0_8px_20px_-6px_rgb(79_76_227/.55)]',
  secondary: 'border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100 hover:border-primary-300',
  outline:   'border border-gray-300 text-gray-700 bg-surface hover:bg-gray-50 hover:border-gray-400/70 shadow-[0_1px_2px_rgb(20_26_41/.04)]',
  ghost:     'text-primary-700 hover:bg-primary-50',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm',
}

const sizes = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 sm:h-9 px-4 text-sm rounded-lg',
  lg: 'h-11 px-5 text-[15px] rounded-xl',
}

export default function Button({ children, variant = 'primary', size = 'md', className = '', disabled = false, loading = false, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 active:scale-[0.97] disabled:active:scale-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-100 disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />}
      {children}
    </button>
  )
}
