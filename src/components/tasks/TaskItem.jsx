import Icon from '../ui/Icon'
import Badge from '../ui/Badge'
import { STATUS_LABELS } from '../../lib/labels'
import { formatShort, todayISO } from '../../utils/dates'

const STATUS_ICON = {
  pending: { name: 'circle', cls: 'text-gray-300 hover:text-primary-500' },
  in_progress: { name: 'progress', cls: 'text-amber-500' },
  done: { name: 'check', cls: 'text-white bg-green-500 rounded-full p-0.5' },
  blocked: { name: 'block', cls: 'text-red-500' },
}

export default function TaskItem({ task, onStatus, onOpen, showOwner = false, contextDate = todayISO(), readOnly = false }) {
  const today = todayISO()
  const done = task.status === 'done'
  const carried = task.date < contextDate && !done
  const overdue = task.due_date && task.due_date < today && !done
  const icon = STATUS_ICON[task.status] ?? STATUS_ICON.pending

  return (
    <div className="flex items-start gap-3 py-3 px-1 group">
      <button
        disabled={readOnly}
        onClick={() => onStatus?.(task, done ? 'pending' : 'done')}
        className={`mt-0.5 w-7 h-7 -m-0.5 flex items-center justify-center rounded-full ${readOnly ? '' : 'active:scale-90'} transition`}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
      >
        <Icon name={icon.name} size={22} strokeWidth={done ? 3 : 1.8} className={icon.cls} />
      </button>

      <button onClick={() => onOpen?.(task)} className="flex-1 min-w-0 text-left">
        <p className={`text-sm leading-snug ${done ? 'line-through text-gray-400' : 'text-gray-900 font-medium'}`}>
          {task.title || <span className="italic text-gray-400">Untitled task</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {showOwner && task.owner && <span className="text-[11px] font-medium text-gray-600">{task.owner.name}</span>}
          {task.categories && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: task.categories.color + '1f', color: task.categories.color }}>
              {task.categories.name}
            </span>
          )}
          {task.status === 'in_progress' && <Badge variant="in_progress">{STATUS_LABELS.in_progress}</Badge>}
          {task.status === 'blocked' && <Badge variant="blocked">Blocked</Badge>}
          {task.priority === 'high' && <Badge variant="high">High priority</Badge>}
          {task.assigner && !showOwner && <Badge variant="info">From {task.assigner.name.split(' ')[0]}</Badge>}
          {carried && <span className="text-[11px] text-amber-600">↻ from {formatShort(task.date)}</span>}
          {task.due_date && (
            <span className={`text-[11px] ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
              Due {formatShort(task.due_date)}
            </span>
          )}
        </div>
      </button>
    </div>
  )
}
