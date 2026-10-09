import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePerson } from '../hooks/usePeople'
import { useProjects, projectsOf } from '../hooks/useProjects'
import { ROLE_LABELS } from '../lib/permissions'
import PersonProgress from '../components/PersonProgress'
import ReportButton from '../components/reports/ReportButton'
import TaskEditor from '../components/tasks/TaskEditor'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data: person } = usePerson(id)
  const { data: projects = [] } = useProjects()
  const [assigning, setAssigning] = useState(false)

  if (!person) return <Card className="h-40 animate-pulse max-w-6xl mx-auto" />
  const projectNames = projectsOf(projects, person.id).map(p => p.name).join(', ')

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="h-9 w-9 -ml-2 flex items-center justify-center text-gray-500 hover:text-gray-900 rounded-md" aria-label="Back">
          <Icon name="left" />
        </button>
        <Avatar person={person} size="md" />
        <div className="flex-1 min-w-0">
          <h2 className="page-title truncate">{person.name}</h2>
          <p className="text-sm text-gray-500 truncate">
            {ROLE_LABELS[person.role]}{projectNames ? `, ${projectNames}` : ''}{person.email ? ` · ${person.email}` : ''}
          </p>
        </div>
        {can('assignTasks') && (
          <Button onClick={() => setAssigning(true)} className="shrink-0"><Icon name="plus" size={16} /><span className="hidden sm:inline">Assign task</span></Button>
        )}
      </div>

      <PersonProgress person={person} actions={<ReportButton personId={person.id} label="Download report" />} />

      {assigning && <TaskEditor open assignTo={person.id} onClose={() => setAssigning(false)} />}
    </div>
  )
}
