import { useInstallPrompt } from '../lib/install'
import Card from './ui/Card'
import Button from './ui/Button'
import Icon from './ui/Icon'

export default function InstallCard() {
  const { canPrompt, promptInstall, installed, ios } = useInstallPrompt()
  if (installed || (!canPrompt && !ios)) return null

  return (
    <Card className="p-4 flex items-center gap-3">
      <span className="w-10 h-10 rounded-md bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
        <Icon name="install" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">Install the app</p>
        <p className="text-xs text-gray-500">
          {canPrompt ? 'Add it to your home screen for one tap access.' : 'On iPhone, tap Share and then Add to Home Screen.'}
        </p>
      </div>
      {canPrompt && <Button size="sm" onClick={promptInstall}>Install</Button>}
    </Card>
  )
}
