// Accessible on/off switch with a smooth knob.
export default function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        disabled:opacity-50 ${checked ? 'bg-brand' : 'bg-gray-300'}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out
        ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}
