import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import { INTEGRATIONS, useIntegrationStatus, useIntegrationSync, useDisconnect } from '../../hooks/useIntegrations'
import { toast } from '../../lib/toast'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Switch from '../ui/Switch'
import Sheet from '../ui/Sheet'
import Icon from '../ui/Icon'
import AppLogo from './AppLogo'

const APPS = [
  {
    kind: 'teams', name: 'Microsoft Teams', noun: ['meeting', 'meetings'],
    about: 'Your calendar meetings are added to your day. Finished ones are marked done.',
  },
  {
    kind: 'jira', name: 'Jira', noun: ['issue', 'issues'],
    about: 'Issues assigned to you appear as tasks and follow their Jira status: To do, In progress, In review, Done.',
  },
]

function AppRow({ app }) {
  const { profile, user, updateProfile } = useAuth()
  const { data: status, isLoading } = useIntegrationStatus(app.kind)
  const sync = useIntegrationSync(app.kind)
  const disconnect = useDisconnect(app.kind)
  const [asking, setAsking] = useState(false)
  const { flag, syncedAt } = INTEGRATIONS[app.kind]
  const available = Boolean(status?.configured && status.enabled)
  const on = available && profile[flag]

  async function syncNow() {
    try {
      const r = await sync.mutateAsync('me')
      const [one, many] = app.noun
      if (r.people === 0) toast(`No ${app.name} account found for ${user?.email}`)
      else toast(r.created ? `${r.created} new ${r.created === 1 ? one : many} added` : r.updated ? `${r.updated} ${r.updated === 1 ? 'task' : 'tasks'} updated` : `Your ${many} are up to date`)
    } catch (e) { toast.error(e.message) }
  }

  async function connect() {
    await updateProfile({ [flag]: true })
    toast(`${app.name} connected`)
    syncNow()
  }

  async function stop(remove) {
    try {
      const r = await disconnect.mutateAsync({ remove })
      setAsking(false)
      toast(remove && r.removed ? `${app.name} disconnected, ${r.removed} open ${r.removed === 1 ? 'task' : 'tasks'} removed` : `${app.name} disconnected`)
    } catch (e) { toast.error(e.message) }
  }

  const state = isLoading ? 'Checking' : !available ? 'Not set up by your admin yet' : on ? 'Connected' : 'Off'

  return (
    <div className="group px-5 py-4 transition-colors hover:bg-gray-50/60">
      <div className="flex items-start gap-3">
        <AppLogo app={app.kind} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{app.name}</p>
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full
              ${on ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {on && <span className="w-1.5 h-1.5 rounded-full bg-green-600" />}
              {state}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{app.about}</p>
          {on && (
            <p className="text-xs text-gray-400 mt-1">
              {user?.email}{', '}
              {profile[syncedAt] ? `last synced ${formatDistanceToNow(new Date(profile[syncedAt]), { addSuffix: true })}` : 'not synced yet'}
            </p>
          )}
        </div>
        <Switch checked={on} disabled={!available} label={`Sync ${app.name}`}
          onChange={v => (v ? connect() : setAsking(true))} />
      </div>
      {on && (
        <div className="mt-3 pl-12">
          <Button size="sm" variant="outline" loading={sync.isPending} onClick={syncNow}>
            <Icon name="refresh" size={14} /> Sync now
          </Button>
        </div>
      )}

      <Sheet open={asking} onClose={() => setAsking(false)} title={`Disconnect ${app.name}?`}
        footer={<>
          <Button variant="outline" size="sm" loading={disconnect.isPending && !disconnect.variables?.remove} onClick={() => stop(false)}>Keep my tasks</Button>
          <Button variant="danger" size="sm" loading={disconnect.isPending && disconnect.variables?.remove} onClick={() => stop(true)}>Remove open tasks</Button>
        </>}>
        <p className="text-sm text-gray-600">
          New {app.noun[1]} will stop appearing in your day. Finished tasks always stay in your history.
          Do you also want to remove the unfinished ones that came from {app.name}?
        </p>
      </Sheet>
    </div>
  )
}

// Account card: one place to turn each connected app on or off for yourself.
export default function ConnectedApps() {
  return (
    <Card>
      <div className="px-5 pt-4 pb-1">
        <p className="text-sm font-semibold text-gray-900">Connected apps</p>
        <p className="text-xs text-gray-500">Matched to you by your company email. Turn either one off at any time.</p>
      </div>
      <div className="divide-y divide-gray-100">
        {APPS.map(app => <AppRow key={app.kind} app={app} />)}
      </div>
    </Card>
  )
}
