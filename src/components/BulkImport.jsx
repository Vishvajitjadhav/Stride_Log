import { useRef, useState } from 'react'
import { readSheet, downloadTemplate } from '../lib/sheets'
import Sheet from './ui/Sheet'
import Button from './ui/Button'
import Icon from './ui/Icon'

// Admin bulk import in four steps: get the template, upload, review, import.
//   template: PEOPLE_TEMPLATE / HOLIDAY_TEMPLATE (utils/bulkImport.js)
//   lists:    extra value lists for the Excel template's help sheet
//   parse(rows) → { valid, errors, missingColumns }
//   columns:  [{ key, label }] shown for each valid row in the preview
//   run(valid, onProgress) → { done: [...], failed: [{ label, message }] }
//   options:  controls shown above the import button (e.g. how people get access)
//   result(done) → extra content after a successful import
export default function BulkImport({ title, noun, template, lists, parse, columns, run, options, result, onClose }) {
  const input = useRef(null)
  const [step, setStep] = useState('pick')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState(null)
  const [readError, setReadError] = useState('')
  const [progress, setProgress] = useState(0)
  const [outcome, setOutcome] = useState(null)
  const [dragging, setDragging] = useState(false)

  async function pickFile(file) {
    if (!file) return
    setReadError('')
    try {
      const rows = await readSheet(file)
      if (!rows.length) return setReadError('That file has no rows under the header.')
      const p = parse(rows)
      if (p.missingColumns.length) return setReadError(`Columns not found: ${p.missingColumns.join(', ')}. Use the template so the headers match.`)
      if (!p.valid.length && !p.errors.length) return setReadError('That file has no filled rows.')
      setFileName(file.name)
      setParsed(p)
      setStep('review')
    } catch (e) {
      setReadError(`Could not read the file: ${e.message}`)
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  async function start() {
    setStep('running')
    setProgress(0)
    const res = await run(parsed.valid, n => setProgress(n))
    setOutcome(res)
    setStep('done')
  }

  const total = parsed?.valid.length ?? 0
  const footer = {
    pick: <Button variant="outline" onClick={onClose}>Cancel</Button>,
    review: <>
      <Button variant="outline" onClick={() => { setStep('pick'); setParsed(null) }}>Choose another file</Button>
      <Button onClick={start} disabled={!total}>Import {total} {total === 1 ? noun.one : noun.many}</Button>
    </>,
    running: <Button disabled loading>Importing</Button>,
    done: <Button onClick={onClose}>Done</Button>,
  }[step]

  return (
    <Sheet open onClose={step === 'running' ? undefined : onClose} title={title} wide footer={footer}>
      {step === 'pick' && (
        <div className="space-y-5 page-in">
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600">
            {['Download the template', 'Fill one row each', 'Upload it here'].map((s, i) => (
              <li key={s} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center text-[11px]">{i + 1}</span>{s}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadTemplate(template, 'xlsx', lists)}><Icon name="download" size={16} /> Excel template</Button>
            <Button variant="outline" onClick={() => downloadTemplate(template, 'csv')}><Icon name="download" size={16} /> CSV template</Button>
          </div>

          <label
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50/40'}`}>
            <span className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center"><Icon name="upload" size={22} /></span>
            <span className="text-sm font-semibold text-gray-900">Drop your file here or tap to choose</span>
            <span className="text-xs text-gray-500">Excel (.xlsx) or CSV. The first row must be the header.</span>
            <input ref={input} type="file" className="sr-only" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={e => pickFile(e.target.files?.[0])} />
          </label>
          {readError && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{readError}</p>}
        </div>
      )}

      {step === 'review' && parsed && (
        <div className="space-y-4 page-in">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-500"><Icon name="today" size={15} />{fileName}</span>
            <span className="flex-1" />
            <span className="rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200 px-2.5 py-0.5 text-xs font-semibold">{total} ready</span>
            {parsed.errors.length > 0 && (
              <span className="rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 px-2.5 py-0.5 text-xs font-semibold">{parsed.errors.length} need fixing</span>
            )}
          </div>

          {parsed.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/50">
              <p className="px-4 pt-3 text-sm font-semibold text-red-800">These rows will be skipped</p>
              <p className="px-4 text-xs text-red-700/80">Fix them in the file and upload again, or import the rest now.</p>
              <ul className="mt-2 max-h-40 overflow-y-auto divide-y divide-red-100 text-sm">
                {parsed.errors.map(e => (
                  <li key={e.row} className="px-4 py-2 flex gap-3">
                    <span className="text-xs font-semibold text-red-700 tabular-nums w-12 shrink-0 pt-0.5">Row {e.row}</span>
                    <span className="text-gray-700"><b className="font-medium text-gray-900">{e.label}</b>: {e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {total > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="max-h-64 overflow-auto">
                <table className="table">
                  <thead><tr><th className="w-14">Row</th>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {parsed.valid.map(v => (
                      <tr key={v.row}>
                        <td className="tabular-nums text-gray-400">{v.row}</td>
                        {columns.map(c => <td key={c.key} className="whitespace-nowrap">{c.render ? c.render(v) : v[c.key]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {options}
        </div>
      )}

      {step === 'running' && (
        <div className="py-10 text-center space-y-4 page-in" role="status">
          <p className="text-sm font-semibold text-gray-900">Importing {progress} of {total}</p>
          <div className="mx-auto max-w-sm h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-mint-500 transition-[width] duration-300" style={{ width: `${total ? (progress / total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-gray-500">Keep this window open until it finishes.</p>
        </div>
      )}

      {step === 'done' && outcome && (
        <div className="space-y-4 page-in">
          <div className="flex items-center gap-3">
            <span className={`w-10 h-10 rounded-full flex items-center justify-center pop ${outcome.done.length ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              <Icon name={outcome.done.length ? 'check' : 'alert'} size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {outcome.done.length} {outcome.done.length === 1 ? noun.one : noun.many} imported
              </p>
              {outcome.failed.length > 0 && <p className="text-xs text-red-700">{outcome.failed.length} could not be imported</p>}
            </div>
          </div>
          {outcome.failed.length > 0 && (
            <ul className="rounded-xl border border-red-200 divide-y divide-red-100 text-sm max-h-40 overflow-y-auto">
              {outcome.failed.map((f, i) => <li key={i} className="px-4 py-2"><b className="font-medium text-gray-900">{f.label}</b>: <span className="text-gray-700">{f.message}</span></li>)}
            </ul>
          )}
          {outcome.done.length > 0 && result?.(outcome.done)}
        </div>
      )}
    </Sheet>
  )
}
