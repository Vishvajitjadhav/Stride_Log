import Icon from '../ui/Icon'
import { STATUS_LABELS } from '../../lib/labels'
import { formatShort, todayISO } from '../../utils/dates'

const STATUS_ICON = {
  pending: { name: 'circle', cls: 'text-gray-300 hover:text-primary-500' },
  in_progress: { name: 'progress', cls: 'text-amber-600' },
  done: { name: 'check', cls: 'text-white bg-emerald-600 rounded-full p-0.5' },
  blocked: { name: 'block', cls: 'text-red-600' },
}

export default function TaskItem({ task, onStatus, onOpen, showOwner = false, contextDate = todayISO(), readOnly = false }) {
  const today = todayISO()
  const done = task.status === 'done'
  const carried = task.date < contextDate && !done
  const overdue = task.due_date && task.due_date < today && !done
  const icon = STATUS_ICON[task.status] ?? STATUS_ICON.pending

  const meta = [
    showOwner && task.owner && <span key="o" className="font-medium text-gray-700">{task.owner.name}</span>,
    task.source === 'teams' && (
      <span key="t" className="inline-flex items-center gap-1 text-[#4b53bc] font-medium" title={task.description ?? 'From your Teams calendar'}>
        <Icon name="calendar" size={12} />Teams{task.description ? `, ${task.description.replace('Teams meeting, ', '')}` : ''}
      </span>
    ),
    task.project && <span key="p" className="font-medium text-gray-600">{task.project.name}</span>,
    task.categories && (
      <span key="c" className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: task.categories.color }} />{task.categories.name}
      </span>
    ),
    (task.status === 'in_progress' || task.status === 'blocked') && (
      <span key="s" className={task.status === 'blocked' ? 'text-red-700 font-medium' : 'text-amber-700 font-medium'}>{STATUS_LABELS[task.status]}</span>
    ),
    task.assigner && !showOwner && <span key="a">Assigned by {task.assigner.name.split(' ')[0]}</span>,
    carried && <span key="r" className="text-amber-700">From {formatShort(task.date)}</span>,
    task.due_date && <span key="d" className={overdue ? 'text-red-700 font-medium' : ''}>{overdue ? 'Overdue, was due' : 'Due'} {formatShort(task.due_date)}</span>,
  ].filter(Boolean)

  return (
    <div className="flex items-start gap-3 py-3">
      <button
        disabled={readOnly}
        onClick={() => onStatus?.(task, done ? 'pending' : 'done')}
        className={`mt-px w-6 h-6 flex items-center justify-center rounded-full ${readOnly ? '' : 'active:scale-90'} transition`}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
      >
        <Icon key={task.status} name={icon.name} size={20} strokeWidth={done ? 3 : 1.8} className={`${icon.cls} ${done ? 'pop' : ''}`} />
      </button>

      <button onClick={() => onOpen?.(task)} className="flex-1 min-w-0 text-left rounded-md -mx-1.5 px-1.5 -my-1 py-1 transition-colors hover:bg-gray-50">
        <p className={`text-sm leading-snug ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title || <span className="italic text-gray-400">Untitled task</span>}
        </p>
        {meta.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">{meta}</p>
        )}
      </button>
    </div>
  )
}
