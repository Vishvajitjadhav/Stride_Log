import { format, parseISO } from 'date-fns'

const CELL = {
  logged: { cls: 'bg-mint-400', label: 'Logged' },
  missed: { cls: 'bg-red-200', label: 'Not logged' },
  holiday: { cls: 'bg-gray-200', label: 'Holiday' },
  before: { cls: 'border border-dashed border-gray-200', label: 'Not joined yet' },
  future: { cls: 'border border-gray-200', label: 'Upcoming' },
}
const LEGEND = ['logged', 'missed', 'holiday', 'future']

// Daily log heatmap: who logged on which working day. A gap before each
// Monday separates the weeks.
export default function LogHeatmap({ grid, holidayNames = {} }) {
  const { days, rows } = grid
  if (!days.length || !rows.length) return <p className="text-sm text-gray-500">No working days in this period.</p>
  const monday = d => parseISO(d).getDay() === 1
  const gap = i => (i > 0 && monday(days[i]) ? 'ml-2' : '')

  return (
    <div>
      <div className="overflow-x-auto scrollbar-none">
        <table className="border-separate border-spacing-y-1">
          <thead>
            <tr>
              <th />
              {days.map((d, i) => (
                <th key={d} className="p-0 pb-1 text-[10px] font-medium text-gray-400">
                  <span className={`block w-4 mx-px text-center ${gap(i)}`}>{format(parseISO(d), 'EEEEE')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="pr-4 text-sm text-gray-700 whitespace-nowrap max-w-44 truncate">{r.name}</td>
                {r.cells.map((s, i) => {
                  const d = days[i]
                  const what = s === 'holiday' && holidayNames[d] ? `Holiday, ${holidayNames[d]}` : CELL[s].label
                  return (
                    <td key={d} className="p-0">
                      <span title={`${r.name}, ${format(parseISO(d), 'EEE d MMM')}: ${what}`}
                        className={`block w-4 h-4 mx-px rounded-[4px] ${CELL[s].cls} ${gap(i)}`} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
        <span>{format(parseISO(days[0]), 'd MMM')} to {format(parseISO(days[days.length - 1]), 'd MMM')}</span>
        {LEGEND.map(k => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-[3px] ${CELL[k].cls}`} />{CELL[k].label}
          </span>
        ))}
      </div>
    </div>
  )
}
