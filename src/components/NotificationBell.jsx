import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications } from '../hooks/useNotifications'
import Icon from './ui/Icon'

const TYPE_ICON = {
  task_assigned: 'assign',
  task_updated: 'edit',
  account_approved: 'check',
  log_reminder: 'bell',
  weekly_summary: 'analytics',
}

export default function NotificationBell() {
  const { data: items = [], unread, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread) markAllRead.mutate()
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative p-2 -mr-2 text-gray-500 hover:text-gray-800 rounded-lg" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}>
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-11 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 && <p className="text-sm text-gray-400 text-center py-10">You're all caught up.</p>}
            {items.map(n => (
              <button
                key={n.id}
                onClick={() => { setOpen(false); if (n.link) navigate(n.link) }}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 ${n.read_at ? '' : 'bg-primary-50/50'}`}
              >
                <span className="mt-0.5 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                  <Icon name={TYPE_ICON[n.type] ?? 'bell'} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                  {n.body && <span className="block text-sm text-gray-500 truncate">{n.body}</span>}
                  <span className="block text-[11px] text-gray-400 mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
