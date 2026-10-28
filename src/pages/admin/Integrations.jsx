import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useOrgSettings, useUpdateOrg } from '../../hooks/useOrg'
import { useIntegrationStatus, useIntegrationSync, useSyncRuns, useConnectionCounts } from '../../hooks/useIntegrations'
import { toast } from '../../lib/toast'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Switch from '../../components/ui/Switch'
import AppLogo from '../../components/integrations/AppLogo'
import CompanyJira from '../../components/integrations/CompanyJira'
import { useAuth } from '../../contexts/AuthContext'

// Where Microsoft and Atlassian send people back after they sign in.
const CALLBACK = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://<project>.supabase.co'}/functions/v1/connect`

const APPS = {
  teams: {
    title: 'Microsoft Teams meetings',
    enabledKey: 'teams_sync_enabled',
    about: 'Each person connects their own Microsoft work account under Account, Connected apps. Their Teams and Outlook meetings then become tasks: finished ones Done, upcoming ones To do. Syncs every 30 minutes on working days and when they open their day.',
    footnote: 'Private meetings are added as "Private meeting". Declined, cancelled and all day entries are skipped.',
    guideTitle: 'Register StrideLog with Microsoft (about 5 minutes, one time)',
    guideHint: 'Any work account that can open App registrations. Free.',
    steps: [
      ['Open App registrations', 'Sign in at portal.azure.com with your work account, search for App registrations and choose New registration.'],
      ['Name and redirect', 'Name: StrideLog. Supported account types: Accounts in this organizational directory only. Redirect URI: platform Web, with this address. Then Register.', CALLBACK],
      ['Permissions', 'API permissions, Add a permission, Microsoft Graph, Delegated permissions: Calendars.Read and User.Read (offline_access is added automatically). No admin consent needed unless your company blocks user consent.'],
      ['Create a secret', 'Certificates and secrets, New client secret, 24 months. Copy the Value straight away.'],
      ['Add to Supabase', 'Supabase, Edge Functions, Secrets: add MS_CLIENT_ID (Application ID), MS_TENANT_ID (Directory ID) and MS_CLIENT_SECRET (the secret value).'],
      ['Turn it on', 'Switch on "Turn on for the company" above. Everyone can then press Connect under Account, Connected apps.'],
    ],
  },
  jira: {
    title: 'Jira issues',
    enabledKey: 'jira_sync_enabled',
    about: 'Each person connects their own Atlassian account under Account, Connected apps. Issues assigned to them become tasks that follow the Jira status: To do, In progress, In review and Done. Syncs every 15 minutes on working days and when they open their day.',
    footnote: 'Open issues stay on today until they are done. Finished work is kept in history; issues reassigned to someone else move with them.',
    guideTitle: 'Register StrideLog with Atlassian (about 5 minutes, one time)',
    guideHint: 'Any Atlassian account. Free.',
    steps: [
      ['Create the app', 'Open developer.atlassian.com, your profile, Developer console, Create, OAuth 2.0 integration. Name it StrideLog.'],
      ['Permissions', 'Permissions: add Jira API with scopes read:jira-work and read:jira-user, and User identity API with read:me.'],
      ['Callback URL', 'Authorization, OAuth 2.0 (3LO): set the callback URL to this address.', CALLBACK],
      ['Let colleagues use it', 'Distribution: Edit, Sharing, fill in the short form (vendor: your company, privacy policy: your website) and save. Without this only you can connect.'],
      ['Add to Supabase', 'Settings: copy Client ID and Secret. In Supabase, Edge Functions, Secrets, add ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET.'],
      ['Turn it on', 'Switch on "Turn on for the company" above. Everyone can then press Connect under Account, Connected apps.'],
    ],
  },
}

const TRIGGERS = { schedule: 'Automatic', admin: 'Everyone', person: 'One person', webhook: 'From Jira' }

function Copy({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}
      className="shrink-0 h-7 px-2.5 rounded text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors">
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function Panel({ kind }) {
  const app = APPS[kind]
  const { data: org } = useOrgSettings()
  const update = useUpdateOrg()
  const { data: status, isLoading } = useIntegrationStatus(kind)
  const sync = useIntegrationSync(kind)
  const { data: runs = [] } = useSyncRuns(kind)
  const { data: counts = {} } = useConnectionCounts()
  const [guide, setGuide] = useState(false)
  const { profile } = useAuth()
  const connected = status?.configured
  const enabled = Boolean(org?.[app.enabledKey])
  const name = kind === 'teams' ? 'Teams' : 'Jira'

  async function setOrg(fields, message) {
    await update.mutateAsync(fields)
    toast(message)
  }

  async function syncAll() {
    try {
      const r = await sync.mutateAsync('all')
      toast(`Synced ${r.people} ${r.people === 1 ? 'person' : 'people'}: ${r.created} new, ${r.updated} updated, ${r.removed} removed${r.warning ? `. Some could not sync: ${r.warning}` : ''}`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4 page-in" key={kind}>
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <AppLogo app={kind} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold text-gray-900">{app.title}</p>
              {isLoading ? <Badge variant="draft">Checking</Badge>
                : connected ? <Badge variant="submitted">{status.mock ? 'Ready (test mode)' : 'Ready'}</Badge>
                : <Badge variant="missing">Not set up</Badge>}
              {connected && <span className="text-xs text-gray-500">{counts[kind] ?? 0} {counts[kind] === 1 ? 'person has' : 'people have'} connected</span>}
            </div>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{app.about}</p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-gray-100 border-t border-gray-100">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Turn on for the company</p>
              <p className="text-xs text-gray-500">Each person can still switch it off for themselves under Account, Connected apps.</p>
            </div>
            <Switch checked={enabled} disabled={!connected || update.isPending}
              onChange={v => setOrg({ [app.enabledKey]: v }, v ? `${name} sync turned on` : `${name} sync turned off`)} label={`Turn on ${name} sync`} />
          </div>
          {kind === 'teams' && (
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-gray-900">Only Teams meetings</p>
                <p className="text-xs text-gray-500">When off, every busy calendar entry (for example in person meetings) is added too.</p>
              </div>
              <Switch checked={Boolean(org?.teams_only_online)} disabled={update.isPending}
                onChange={v => setOrg({ teams_only_online: v }, 'Saved')} label="Only Teams meetings" />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <p className="text-xs text-gray-500 max-w-md">{app.footnote}</p>
            <Button onClick={syncAll} loading={sync.isPending} disabled={!connected || !enabled}>
              <Icon name="refresh" size={16} /> Sync everyone now
            </Button>
          </div>
        </div>
      </Card>

      {kind === 'jira' && connected && enabled && profile?.role === 'admin' && <CompanyJira />}

      <Card>
        <button onClick={() => setGuide(g => !g)} className="w-full flex items-center justify-between px-5 py-4 text-left group">
          <span>
            <span className="block text-sm font-semibold text-gray-900">{connected ? 'Setup guide' : app.guideTitle}</span>
            <span className="block text-xs text-gray-500">{app.guideHint}</span>
          </span>
          <Icon name="down" size={18} className={`text-gray-400 group-hover:text-gray-700 transition-transform ${guide || !connected ? 'rotate-180' : ''}`} />
        </button>
        {(guide || !connected) && (
          <ol className="px-5 pb-5 space-y-4">
            {app.steps.map(([title, text, code], i) => (
              <li key={title} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold flex items-center justify-center shrink-0 ring-1 ring-primary-200">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{title}</p>
                  <p className="text-sm text-gray-600">{text}</p>
                  {code && (
                    <div className="mt-2 flex items-center gap-2 rounded-md bg-[#0f172a] pl-3 pr-1 py-1.5">
                      <code className="flex-1 min-w-0 text-xs text-[#c8d4e6] overflow-x-auto whitespace-nowrap scrollbar-none">{code}</code>
                      <Copy text={code} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {runs.length > 0 && (
        <Card>
          <p className="section-title px-5 pt-4">Recent syncs</p>
          <ul className="divide-y divide-gray-100 mt-2">
            {runs.map(r => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-gray-50/60">
                <span className={`w-2 h-2 rounded-full shrink-0 ${r.error ? 'bg-red-500' : r.finished_at ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className="flex-1 min-w-0 text-gray-700 truncate" title={r.error ?? undefined}>
                  {r.error ? r.error : r.finished_at
                    ? `${r.people} ${r.people === 1 ? 'person' : 'people'}, ${r.created} new, ${r.updated} updated, ${r.removed} removed`
                    : 'Running'}
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {TRIGGERS[r.trigger]} · {formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

export default function Integrations() {
  const [kind, setKind] = useState(() => { try { return localStorage.getItem('stridelog:integration') ?? 'teams' } catch { return 'teams' } })
  const pick = k => { setKind(k); try { localStorage.setItem('stridelog:integration', k) } catch { /* private mode */ } }

  return (
    <div className="space-y-4">
      <div className="segmented" role="group" aria-label="App">
        {[['teams', 'Microsoft Teams'], ['jira', 'Jira']].map(([k, l]) => (
          <button key={k} aria-pressed={kind === k} onClick={() => pick(k)} className="inline-flex items-center gap-2">
            <AppLogo app={k} size={16} />{l}
          </button>
        ))}
      </div>
      <Panel key={kind} kind={kind} />
    </div>
  )
}
