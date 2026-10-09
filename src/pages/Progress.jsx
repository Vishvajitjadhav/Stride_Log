import { useAuth } from '../contexts/AuthContext'
import { getGreeting } from '../utils/dates'
import PersonProgress from '../components/PersonProgress'
import ReportButton from '../components/reports/ReportButton'

// The employee's own week, month and trend.
export default function Progress() {
  const { profile } = useAuth()
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h2 className="page-title">{getGreeting()}, {profile.name.split(' ')[0]}</h2>
        <p className="page-subtitle">Your work this week, day by day.</p>
      </div>
      <PersonProgress person={profile} actions={<ReportButton defaultScope="me" label="Download report" />} />
    </div>
  )
}
