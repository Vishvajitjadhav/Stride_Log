import { useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePeople } from '../../hooks/usePeople'
import { useTeams } from '../../hooks/useOrg'
import { periodOptions, buildReportData, reportFileName } from './buildReport'
import Sheet from '../ui/Sheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

// "Download PDF" — weekly or monthly report with company logo & dates.
// defaultScope: 'me' | 'company'; personId/teamId preselect a scope.
export default function ReportButton({ defaultScope = 'me', personId, teamId, label = 'PDF' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="chip flex items-center gap-1.5 shrink-0 !border-primary-300 !text-primary-700">
        <Icon name="download" size={14} /> {label}
      </button>
      {open && <ReportDialog onClose={() => setOpen(false)} defaultScope={defaultScope} personId={personId} teamId={teamId} />}
    </>
  )
}

function ReportDialog({ onClose, defaultScope, personId, teamId }) {
  const { profile, can } = useAuth()
  const viewTeam = can('viewTeam')
  const viewCompany = can('viewCompany')
  const { data: people = [] } = usePeople({ enabled: viewTeam })
  const { data: teams = [] } = useTeams()

  const initialScope = personId ? 'person' : teamId ? 'team' : defaultScope
  const [kind, setKind] = useState('weekly')
  const [periodIdx, setPeriodIdx] = useState(1)   // last full week / month by default
  const [scope, setScope] = useState(initialScope)
  const [person, setPerson] = useState(personId ?? '')
  const [team, setTeam] = useState(teamId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const periods = useMemo(() => periodOptions(kind), [kind])
  const scopes = [
    { key: 'me', label: 'Me' },
    viewTeam && { key: 'person', label: 'A person' },
    viewTeam && { key: 'team', label: 'A team' },
    viewCompany && { key: 'company', label: 'Company' },
  ].filter(Boolean)

  async function generate() {
    setError('')
    if (scope === 'person' && !person) return setError('Choose a person.')
    if (scope === 'team' && !team) return setError('Choose a team.')
    setBusy(true)
    try {
      // react-pdf is large — load it only when someone actually downloads.
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
          teamId: scope === 'team' ? team : undefined,
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
    <Sheet open onClose={onClose} title="Download report (PDF)"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={generate} loading={busy}><Icon name="download" size={16} /> Download</Button></>}>
      <div className="space-y-4">
        <div>
          <span className="label">Report type</span>
          <div className="grid grid-cols-2 gap-2">
            {['weekly', 'monthly'].map(k => (
              <button key={k} onClick={() => { setKind(k); setPeriodIdx(1) }}
                className={`py-2.5 rounded-xl border text-sm font-medium capitalize ${kind === k ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-200 text-gray-700'}`}>
                {k}
              </button>
            ))}
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
            <span className="label">Report for</span>
            <div className="flex flex-wrap gap-2">
              {scopes.map(sc => (
                <button key={sc.key} onClick={() => setScope(sc.key)} className={`chip ${scope === sc.key ? 'chip-active' : ''}`}>{sc.label}</button>
              ))}
            </div>
          </div>
        )}

        {scope === 'person' && (
          <select className="field" value={person} onChange={e => setPerson(e.target.value)} aria-label="Person">
            <option value="">Choose a person…</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {scope === 'team' && (
          <select className="field" value={team} onChange={e => setTeam(e.target.value)} aria-label="Team">
            <option value="">Choose a team…</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        <p className="text-xs text-gray-400">
          Includes your company logo, the selected dates, KPIs vs the previous period, charts, a per-person breakdown, highlights and blockers.
        </p>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  )
}
