import { useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePeople } from '../../hooks/usePeople'
import { useProjects } from '../../hooks/useProjects'
import { periodOptions, buildReportData, reportFileName } from './buildReport'
import Sheet from '../ui/Sheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

// Download a weekly or monthly PDF. defaultScope: 'me' | 'all';
// personId / projectId preselect one employee or project.
export default function ReportButton({ defaultScope = 'me', personId, projectId, label = 'Download report' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="shrink-0">
        <Icon name="download" size={16} /><span className="hidden sm:inline">{label}</span>
      </Button>
      {open && <ReportDialog onClose={() => setOpen(false)} defaultScope={defaultScope} personId={personId} projectId={projectId} />}
    </>
  )
}

// Early in a week / month the previous one is usually what people want.
function defaultPeriodIndex(kind, now = new Date()) {
  if (kind === 'weekly') return [1, 2].includes(now.getDay()) ? 1 : 0
  return now.getDate() <= 5 ? 1 : 0
}

function Choice({ active, onClick, title, hint }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`text-left rounded-md border px-3 py-2.5 transition-colors ${active ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-gray-200 hover:bg-gray-50'}`}>
      <span className="block text-sm font-medium text-gray-900">{title}</span>
      {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
    </button>
  )
}

function ReportDialog({ onClose, defaultScope, personId, projectId }) {
  const { profile, can } = useAuth()
  const viewTeam = can('viewTeam')
  const viewAll = can('viewCompany')
  const { data: people = [] } = usePeople({ enabled: viewTeam })
  const { data: projects = [] } = useProjects()

  const fallback = defaultScope === 'all' && !viewAll ? (viewTeam ? 'person' : 'me') : defaultScope
  const [kind, setKind] = useState('weekly')
  const [periodIdx, setPeriodIdx] = useState(() => defaultPeriodIndex('weekly'))
  const [scope, setScope] = useState(personId ? 'person' : projectId ? 'project' : fallback)
  const [person, setPerson] = useState(personId ?? '')
  const [project, setProject] = useState(projectId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const periods = useMemo(() => periodOptions(kind), [kind])
  const scopes = [
    viewAll && { key: 'all', title: 'All employees', hint: 'Summary plus a section per employee' },
    viewTeam && projects.length > 0 && { key: 'project', title: 'One project' },
    viewTeam && { key: 'person', title: 'One employee' },
    { key: 'me', title: 'Only me' },
  ].filter(Boolean)

  async function generate() {
    setError('')
    if (scope === 'person' && !person) return setError('Choose an employee.')
    if (scope === 'project' && !project) return setError('Choose a project.')
    setBusy(true)
    try {
      // react-pdf is large; load it only when someone actually downloads.
      const [{ pdf }, { default: ReportDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ReportDocument'),
      ])
      const p = periods[periodIdx]
      const data = await buildReportData({
        kind,
        range: { from: p.from, to: p.to },
        scope: {
          kind: scope,
          userId: scope === 'me' ? profile.id : scope === 'person' ? person : undefined,
          projectId: scope === 'project' ? project : undefined,
        },
        generatedBy: profile.name,
      })
      const blob = await pdf(<ReportDocument data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = reportFileName(data)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not create the report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title="Download report"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={generate} loading={busy}><Icon name="download" size={16} /> Download PDF</Button></>}>
      <div className="space-y-5">
        <div>
          <span className="label">Report type</span>
          <div className="grid grid-cols-2 gap-2">
            <Choice active={kind === 'weekly'} onClick={() => { setKind('weekly'); setPeriodIdx(defaultPeriodIndex('weekly')) }}
              title="Weekly" hint="Day by day tasks for each employee" />
            <Choice active={kind === 'monthly'} onClick={() => { setKind('monthly'); setPeriodIdx(defaultPeriodIndex('monthly')) }}
              title="Monthly" hint="Week by week summary for each employee" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="r-period">Period</label>
          <select id="r-period" className="field" value={periodIdx} onChange={e => setPeriodIdx(Number(e.target.value))}>
            {periods.map((p, i) => <option key={p.from} value={i}>{p.label}</option>)}
          </select>
        </div>

        {scopes.length > 1 && (
          <div>
            <span className="label">Include</span>
            <div className="grid grid-cols-2 gap-2">
              {scopes.map(sc => <Choice key={sc.key} active={scope === sc.key} onClick={() => setScope(sc.key)} title={sc.title} hint={sc.hint} />)}
            </div>
          </div>
        )}

        {scope === 'person' && (
          <select className="field" value={person} onChange={e => setPerson(e.target.value)} aria-label="Employee">
            <option value="">Choose an employee</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {scope === 'project' && (
          <select className="field" value={project} onChange={e => setProject(e.target.value)} aria-label="Project">
            <option value="">Choose a project</option>
            {projects.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        <p className="text-xs text-gray-500 leading-relaxed">
          The PDF includes your company logo, the dates, headline numbers compared with the previous period,
          key observations and a detailed section for each employee.
        </p>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  )
}
