import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../contexts/AuthContext'
import { usePeople } from '../hooks/usePeople'
import { useImport } from '../hooks/useImport'
import { mapRows } from '../utils/importMap'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { STATUS_LABELS } from '../lib/labels'

// Fields we map sheet columns onto, with header auto-detection hints.
const FIELDS = [
  { key: 'date',     label: 'Date',     required: true,  hints: ['date', 'day'] },
  { key: 'title',    label: 'Task',     required: false, hints: ['task', 'title', 'work', 'activity', 'description'] },
  { key: 'status',   label: 'Status',   required: false, hints: ['status', 'state', 'progress'] },
  { key: 'category', label: 'Category', required: false, hints: ['category', 'type', 'tag', 'project'] },
  { key: 'notes',    label: 'Notes',    required: false, hints: ['note', 'summary', 'detail', 'comment'] },
]

function autoMap(columns) {
  const map = {}
  FIELDS.forEach(f => {
    const match = columns.find(c => f.hints.some(h => c.toLowerCase().includes(h)))
    if (match) map[f.key] = match
  })
  return map
}

export default function ImportData() {
  const { userId: myId, profile, can } = useAuth()
  const isAdmin = can('importForOthers')
  const { data: members = [] } = usePeople({ enabled: isAdmin })
  const importMutation = useImport()

  const [fileName, setFileName] = useState('')
  const [columns, setColumns] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [columnMap, setColumnMap] = useState({})
  const [targetUser, setTargetUser] = useState('')
  const [parseError, setParseError] = useState('')
  const [result, setResult] = useState(null)

  // Non-admins can only import into their own account.
  const effectiveTarget = isAdmin ? (targetUser || myId) : myId

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError('')
    setResult(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!rows.length) { setParseError('That sheet appears to be empty.'); return }
      const cols = Object.keys(rows[0])
      setFileName(file.name)
      setColumns(cols)
      setRawRows(rows)
      setColumnMap(autoMap(cols))
    } catch (err) {
      setParseError(`Could not read file: ${err.message}`)
    }
  }

  const preview = useMemo(() => {
    if (!rawRows.length || !columnMap.date) return null
    return mapRows(rawRows, columnMap)
  }, [rawRows, columnMap])

  async function handleCommit() {
    if (!preview || !effectiveTarget) return
    const res = await importMutation.mutateAsync({
      userId: effectiveTarget,
      days: preview.days,
      autoCreateCategories: can('manageCategories'),
    })
    setResult(res)
  }

  function reset() {
    setFileName(''); setColumns([]); setRawRows([]); setColumnMap({}); setResult(null); setParseError('')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Import from Excel / CSV</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Upload a sheet of tasks by date and turn it into work logs.
          {isAdmin ? ' You can import on behalf of any team member.' : ' Imports into your own history.'}
        </p>
      </div>

      {result ? (
        <Card className="p-6 text-center space-y-3">
          <p className="text-3xl">✅</p>
          <p className="text-sm text-gray-700">
            Imported <strong>{result.logsCreated}</strong> day{result.logsCreated === 1 ? '' : 's'} and{' '}
            <strong>{result.tasksCreated}</strong> task{result.tasksCreated === 1 ? '' : 's'}.
          </p>
          <button onClick={reset} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
            Import another file
          </button>
        </Card>
      ) : (
        <>
          {/* Step 1: file */}
          <Card className="p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">1. Choose a file</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium cursor-pointer hover:bg-primary-100">
              ↥ Select .xlsx or .csv
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </label>
            {fileName && <span className="ml-3 text-sm text-gray-500">{fileName}</span>}
            {parseError && <p className="text-sm text-red-500 mt-2">{parseError}</p>}
          </Card>

          {columns.length > 0 && (
            <>
              {/* Step 2: target + column mapping */}
              <Card className="p-5 space-y-4">
                <p className="text-sm font-semibold text-gray-900">2. Map columns</p>

                {isAdmin && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Import for</label>
                    <select value={targetUser || myId} onChange={e => setTargetUser(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400">
                      <option value={myId}>{profile?.name} (me)</option>
                      {members.filter(m => m.id !== myId).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {FIELDS.map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-medium text-gray-500 block mb-1">
                        {f.label}{f.required && <span className="text-red-400"> *</span>}
                      </label>
                      <select
                        value={columnMap[f.key] ?? ''}
                        onChange={e => setColumnMap(m => ({ ...m, [f.key]: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
                      >
                        <option value="">— none —</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {!columnMap.date && <p className="text-sm text-amber-600">Map a <strong>Date</strong> column to continue.</p>}
              </Card>

              {/* Step 3: preview */}
              {preview && (
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">3. Preview</p>
                    <p className="text-sm text-gray-500">
                      {preview.days.length} days · {preview.taskCount} tasks
                      {preview.warnings.length > 0 && <span className="text-amber-600"> · {preview.warnings.length} skipped</span>}
                    </p>
                  </div>

                  {preview.warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 max-h-28 overflow-y-auto">
                      {preview.warnings.slice(0, 20).map((w, i) => (
                        <p key={i} className="text-xs text-amber-800">Row {w.row}: {w.message}</p>
                      ))}
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
                    {preview.days.slice(0, 10).map(day => (
                      <div key={day.date} className="px-4 py-2">
                        <p className="text-xs font-semibold text-gray-700">{day.date}</p>
                        {day.tasks.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 mt-1">
                            <Badge variant={t.status}>{STATUS_LABELS[t.status]}</Badge>
                            <span className="text-sm text-gray-700">{t.title}</span>
                            {t.category && <span className="text-[10px] text-gray-400">· {t.category}</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                    {preview.days.length > 10 && (
                      <p className="px-4 py-2 text-xs text-gray-400">…and {preview.days.length - 10} more days</p>
                    )}
                  </div>

                  <button
                    onClick={handleCommit}
                    disabled={!preview.days.length || importMutation.isPending}
                    className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
                  >
                    {importMutation.isPending ? 'Importing…' : `Import ${preview.taskCount} tasks`}
                  </button>
                  {importMutation.isError && (
                    <p className="text-sm text-red-500">Import failed: {importMutation.error.message}</p>
                  )}
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
