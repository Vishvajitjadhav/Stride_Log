import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import { INTEGRATIONS, useIntegrationStatus, useIntegrationSync, useConnect, useDisconnect } from '../../hooks/useIntegrations'
import { toast } from '../../lib/toast'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Sheet from '../ui/Sheet'
import Icon from '../ui/Icon'
import AppLogo from './AppLogo'

const APPS = [
  {
    kind: 'teams', name: 'Microsoft Teams', account: 'Microsoft', noun: ['meeting', 'meetings'],
    about: 'Your calendar meetings are added to your day. Finished ones are marked done.',
  },
  {
    kind: 'jira', name: 'Jira', account: 'Atlassian', noun: ['issue', 'issues'],
    about: 'Issues assigned to you appear as tasks and follow their Jira status: To do, In progress, In review, Done.',
  },
]

function AppRow({ app }) {
  const { profile } = useAuth()
  const { data: status, isLoading } = useIntegrationStatus(app.kind)
  const sync = useIntegrationSync(app.kind)
  const connect = useConnect(app.kind)
  const disconnect = useDisconnect(app.kind)
  const [asking, setAsking] = useState(false)
  const available = Boolean(status?.configured && status.enabled)
  const connected = Boolean(status?.connected)
  const syncedAt = profile[INTEGRATIONS[app.kind].syncedAt]

  async function syncNow() {
    try {
      const r = await sync.mutateAsync('me')
      const [one, many] = app.noun
      toast(r.created ? `${r.created} new ${r.created === 1 ? one : many} added` : r.updated ? `${r.updated} ${r.updated === 1 ? 'task' : 'tasks'} updated` : `Your ${many} are up to date`)
    } catch (e) { toast.error(e.message) }
  }

  async function stop(remove) {
    try {
      const r = await disconnect.mutateAsync({ remove })
      setAsking(false)
      toast(remove && r.removed ? `${app.name} disconnected, ${r.removed} open ${r.removed === 1 ? 'task' : 'tasks'} removed` : `${app.name} disconnected`)
    } catch (e) { toast.error(e.message) }
  }

  const state = isLoading ? 'Checking'
    : connected ? 'Connected'
    : !status?.configured ? 'Not set up by your admin yet'
    : !status.enabled ? 'Turned off for the company'
    : 'Not connected'

  return (
    <div className="px-5 py-4 transition-colors hover:bg-gray-50/60">
      <div className="flex items-start gap-3">
        <AppLogo app={app.kind} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{app.name}</p>
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full
              ${connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-600" />}
              {state}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{app.about}</p>
          {connected && (
            <p className="text-xs text-gray-400 mt-1">
              Signed in as {status.account_email ?? status.account_name ?? `your ${app.account} account`}
              {status.site_url && app.kind === 'jira' ? ` on ${status.site_url.replace('https://', '')}` : ''}
              {', '}{syncedAt ? `last synced ${formatDistanceToNow(new Date(syncedAt), { addSuffix: true })}` : 'not synced yet'}
            </p>
          )}
          {connected && status.last_error && <p className="text-xs text-red-600 mt-1">Last sync had a problem: {status.last_error}</p>}
        </div>
        {!connected && available && (
          <Button size="sm" onClick={() => connect.mutate(undefined, { onError: e => toast.error(e.message) })} loading={connect.isPending}>
            Connect
          </Button>
        )}
      </div>

      {connected && (
        <div className="mt-3 pl-12 flex flex-wrap gap-2">
          {available && (
            <Button size="sm" variant="outline" loading={sync.isPending} onClick={syncNow}>
              <Icon name="refresh" size={14} /> Sync now
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-gray-600 hover:text-red-700" onClick={() => setAsking(true)}>Disconnect</Button>
        </div>
      )}

      <Sheet open={asking} onClose={() => setAsking(false)} title={`Disconnect ${app.name}?`}
        footer={<>
          <Button variant="outline" size="sm" loading={disconnect.isPending && !disconnect.variables?.remove} onClick={() => stop(false)}>Keep my tasks</Button>
          <Button variant="danger" size="sm" loading={disconnect.isPending && disconnect.variables?.remove} onClick={() => stop(true)}>Remove open tasks</Button>
        </>}>
        <p className="text-sm text-gray-600">
          StrideLog forgets your {app.account} sign in and new {app.noun[1]} stop appearing in your day. Finished tasks always
          stay in your history. Do you also want to remove the unfinished ones that came from {app.name}?
        </p>
      </Sheet>
    </div>
  )
}

// Account card: connect your own Microsoft and Atlassian accounts.
export default function ConnectedApps() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const first = { teams: useIntegrationSync('teams'), jira: useIntegrationSync('jira') }

  // Coming back from Microsoft / Atlassian sign in.
  useEffect(() => {
    const ok = params.get('connected')
    const err = params.get('connect_error')
    if (!ok && !err) return
    const name = APPS.find(a => a.kind === (ok ?? params.get('app')))?.name ?? 'The app'
    if (ok) {
      toast(`${name} connected. Syncing now.`)
      first[ok]?.mutate('me', { onError: e => toast.error(e.message) })
    } else {
      toast.error(`${name} was not connected: ${err}`)
    }
    qc.invalidateQueries({ queryKey: ['connections'] })
    setParams({}, { replace: true })
  }, [params, setParams, qc]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <div className="px-5 pt-4 pb-1">
        <p className="text-sm font-semibold text-gray-900">Connected apps</p>
        <p className="text-xs text-gray-500">Sign in with your own work account once. Only your own calendar and issues are read.</p>
      </div>
      <div className="divide-y divide-gray-100">
        {APPS.map(app => <AppRow key={app.kind} app={app} />)}
      </div>
    </Card>
  )
}
