import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useIntegrationStatus, useCompanyJira, useJiraProjects, useJiraLinks, useCompanyJiraMutations } from '../../hooks/useIntegrations'
import { useProjects } from '../../hooks/useProjects'
import { toast } from '../../lib/toast'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import ProjectPicker from '../tasks/ProjectPicker'

// Admins: read Jira for the whole company with one connection, and pick
// which Jira projects count (each tied to a StrideLog project).
export default function CompanyJira() {
  const { data: mine } = useIntegrationStatus('jira')
  const { data: company, isLoading } = useCompanyJira()
  const on = Boolean(company?.on)
  const { data: jiraProjects = [], isLoading: loadingProjects, error: projectsError } = useJiraProjects({ enabled: on && !company?.broken })
  const { data: links = [] } = useJiraLinks()
  const { data: projects = [] } = useProjects()
  const { use, stop, saveLinks } = useCompanyJiraMutations()

  // key -> StrideLog project id ('' = none); a key present means "read it".
  // Starts from the saved links until the admin changes something.
  const [edits, setEdits] = useState(null)
  const chosen = edits ?? Object.fromEntries(links.map(l => [l.jira_key, l.project_id ?? '']))
  const setPicked = fn => setEdits(fn(chosen))

  function toggle(p) {
    setPicked(c => {
      const next = { ...c }
      if (p.key in next) delete next[p.key]
      // Start with the StrideLog project of the same name, if there is one.
      else next[p.key] = projects.find(x => x.name.toLowerCase() === p.name.toLowerCase())?.id ?? ''
      return next
    })
  }

  async function run(m, message, arg) {
    try { await m.mutateAsync(arg); toast(message) } catch (e) { toast.error(e.message) }
  }

  const save = () => run(saveLinks, 'Jira projects saved. They are read on the next sync.',
    jiraProjects.filter(p => p.key in chosen).map(p => ({ jira_key: p.key, jira_name: p.name, project_id: chosen[p.key] || null })))

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[15px] font-semibold text-gray-900">Read Jira for the whole company</p>
        {on && <Badge variant={company.broken ? 'missing' : 'submitted'}>{company.broken ? 'Connection missing' : 'On'}</Badge>}
      </div>
      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
        One admin Jira connection reads every issue of the projects you pick. Everyone's work shows up, even people who never
        connected Jira, and unassigned issues appear on the Team board.
      </p>

      {isLoading ? <div className="h-10 mt-4 rounded-md skeleton" /> : !on ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {mine?.connected ? (
            <Button onClick={() => run(use, 'Your Jira connection now reads Jira for the company')} loading={use.isPending}>
              Use my Jira for the company
            </Button>
          ) : (
            <p className="text-sm text-gray-600">
              First connect your own Jira under <Link to="/profile" className="font-medium text-primary-700 hover:underline">Account, Connected apps</Link>.
              Use an account that can see every project.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-gray-600">
              Reading as <span className="font-medium text-gray-900">{company.owner}</span>
              {company.account_email && <> ({company.account_email})</>}
              {company.site_url && <> on {company.site_url.replace('https://', '')}</>}
            </p>
            <Button variant="outline" size="sm" onClick={() => confirm('Stop reading Jira for the company? Everyone goes back to their own connection.') && run(stop, 'Company Jira turned off')}
              loading={stop.isPending}>Stop</Button>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-900">Jira projects to read</p>
            <p className="text-xs text-gray-500">Tie each one to a StrideLog project so its issues count in that project's reports.</p>
            {projectsError ? <p className="text-sm text-red-700 mt-2">{projectsError.message}</p>
              : loadingProjects ? <div className="h-24 mt-2 rounded-md skeleton" /> : (
                <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {jiraProjects.map(p => (
                    <li key={p.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <label className="flex items-center gap-2.5 flex-1 min-w-48 cursor-pointer">
                        <input type="checkbox" checked={p.key in chosen} onChange={() => toggle(p)} className="w-4 h-4 accent-primary-600" />
                        <span className="text-sm text-gray-900">{p.name}</span>
                        <span className="text-xs text-gray-400">{p.key}</span>
                      </label>
                      {p.key in chosen && (
                        <ProjectPicker projects={projects} value={chosen[p.key]} aria-label={`StrideLog project for ${p.name}`}
                          className="field !h-9 !py-0 !w-48" onChange={v => setPicked(c => ({ ...c, [p.key]: v }))} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
          </div>
          <div className="flex justify-end">
            <Button onClick={save} loading={saveLinks.isPending} disabled={!jiraProjects.length}>Save projects</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
