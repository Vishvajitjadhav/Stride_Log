export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-white rounded-xl border border-primary-100 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  )
}
