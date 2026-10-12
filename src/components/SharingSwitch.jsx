import { useAuth } from '../contexts/AuthContext'
import { useTeamSharing } from '../hooks/useOrg'
import { toast } from '../lib/toast'
import Switch from './ui/Switch'
import Tooltip from './ui/Tooltip'

// Manager / admin control: should employees see this page?
//   what: 'tasks' (Team page) or 'leaderboard'
export default function SharingSwitch({ what, tip }) {
  const { can, sharing } = useAuth()
  const share = useTeamSharing()
  if (!can('manageSharing')) return null
  const key = what === 'tasks' ? 'team_tasks_visible' : 'leaderboard_visible'
  const on = Boolean(sharing?.[key])
  const name = what === 'tasks' ? 'Team tasks' : 'The leaderboard'

  return (
    <div className="inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-md border border-gray-200 bg-surface transition-colors hover:border-gray-300">
      <span className="text-sm text-gray-700 whitespace-nowrap">Employees can see</span>
      <Tooltip align="right" text={tip} />
      <Switch checked={on} disabled={share.isPending} label={`Employees can see ${what === 'tasks' ? 'team tasks' : 'the leaderboard'}`}
        onChange={v => share.mutate({ [what]: v }, {
          onSuccess: () => toast(`${name} ${what === 'tasks' ? 'are' : 'is'} now ${v ? 'visible to' : 'hidden from'} employees`),
          onError: e => toast.error(e.message),
        })} />
    </div>
  )
}
