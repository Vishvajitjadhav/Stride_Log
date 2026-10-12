import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useOrgSettings, useUpdateOrg } from '../../hooks/useOrg'
import { useTeamsStatus, useTeamsSync, useSyncRuns } from '../../hooks/useTeamsSync'
import { toast } from '../../lib/toast'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Switch from '../../components/ui/Switch'

const SECRETS = 'npx supabase secrets set MS_TENANT_ID=<tenant id> MS_CLIENT_ID=<client id> MS_CLIENT_SECRET=<secret value>'

const STEPS = [
  ['Register the app', 'In the Microsoft Entra admin center, open App registrations and choose New registration. Name it StrideLog, single tenant.'],
  ['Allow calendar reading', 'Under API permissions add Microsoft Graph, Application permissions, Calendars.Read. Then select Grant admin consent.'],
  ['Create a secret', 'Under Certificates and secrets, create a client secret and copy its value.'],
  ['Connect StrideLog', 'Copy the Tenant ID and Client ID from the Overview page and run the command below once.'],
]

function Copy({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}
      className="shrink-0 h-7 px-2.5 rounded text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors">
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function Integrations() {
  const { data: org } = useOrgSettings()
  const update = useUpdateOrg()
  const { data: status, isLoading } = useTeamsStatus()
  const sync = useTeamsSync()
  const { data: runs = [] } = useSyncRuns()
  const [guide, setGuide] = useState(false)
  const connected = status?.configured

  async function setOrg(fields, message) {
    await update.mutateAsync(fields)
    toast(message)
  }

  async function syncAll() {
    try {
      const r = await sync.mutateAsync('all')
      toast(`Synced ${r.people} ${r.people === 1 ? 'person' : 'people'}: ${r.created} new, ${r.updated} updated, ${r.removed} removed`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <span className="w-12 h-12 rounded-lg bg-[#4b53bc]/10 text-[#4b53bc] flex items-center justify-center shrink-0">
            <Icon name="calendar" size={24} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold text-gray-900">Microsoft Teams meetings</p>
              {isLoading ? <Badge variant="draft">Checking</Badge>
                : connected ? <Badge variant="submitted">{status.mock ? 'Connected (test mode)' : 'Connected'}</Badge>
                : <Badge variant="missing">Not connected</Badge>}
            </div>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              Meetings from everyone's Outlook calendar become tasks in their day automatically: finished meetings as Done,
              upcoming ones as To do, with the right category. Runs every 30 minutes on working days and when someone opens their day.
            </p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-gray-100 border-t border-gray-100">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Turn on for the company</p>
              <p className="text-xs text-gray-500">Each person can still switch it off for themselves under Account.</p>
            </div>
            <Switch checked={Boolean(org?.teams_sync_enabled)} disabled={!connected || update.isPending}
              onChange={v => setOrg({ teams_sync_enabled: v }, v ? 'Teams sync turned on' : 'Teams sync turned off')} label="Turn on Teams sync" />
          </div>
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Only Teams meetings</p>
              <p className="text-xs text-gray-500">When off, every busy calendar entry (for example in person meetings) is added too.</p>
            </div>
            <Switch checked={Boolean(org?.teams_only_online)} disabled={update.isPending}
              onChange={v => setOrg({ teams_only_online: v }, 'Saved')} label="Only Teams meetings" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <p className="text-xs text-gray-500">Private meetings are added as "Private meeting". Declined, cancelled and all day entries are skipped.</p>
            <Button onClick={syncAll} loading={sync.isPending} disabled={!connected || !org?.teams_sync_enabled}>
              <Icon name="refresh" size={16} /> Sync everyone now
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <button onClick={() => setGuide(g => !g)} className="w-full flex items-center justify-between px-5 py-4 text-left group">
          <span>
            <span className="block text-sm font-semibold text-gray-900">{connected ? 'Setup guide' : 'Connect Microsoft 365 (about 10 minutes, one time)'}</span>
            <span className="block text-xs text-gray-500">Needs a Microsoft 365 admin. Free: no extra licence or cost.</span>
          </span>
          <Icon name="down" size={18} className={`text-gray-400 group-hover:text-gray-700 transition-transform ${guide || !connected ? 'rotate-180' : ''}`} />
        </button>
        {(guide || !connected) && (
          <ol className="px-5 pb-5 space-y-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold flex items-center justify-center shrink-0 ring-1 ring-primary-200">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{title}</p>
                  <p className="text-sm text-gray-600">{text}</p>
                  {i === 3 && (
                    <div className="mt-2 flex items-center gap-2 rounded-md bg-[#0f172a] pl-3 pr-1 py-1.5">
                      <code className="flex-1 min-w-0 text-xs text-[#c8d4e6] overflow-x-auto whitespace-nowrap scrollbar-none">{SECRETS}</code>
                      <Copy text={SECRETS} />
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
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className={`w-2 h-2 rounded-full shrink-0 ${r.error ? 'bg-red-500' : r.finished_at ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className="flex-1 min-w-0 text-gray-700 truncate">
                  {r.error ? r.error : r.finished_at
                    ? `${r.people} ${r.people === 1 ? 'person' : 'people'}, ${r.created} new, ${r.updated} updated, ${r.removed} removed`
                    : 'Running'}
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {{ schedule: 'Automatic', admin: 'Everyone', person: 'One person' }[r.trigger]} · {formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
