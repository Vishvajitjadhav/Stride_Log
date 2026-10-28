import Select from '../ui/Select'

// The one project dropdown for adding and assigning tasks, so My Day,
// the task editor and assigning all read the same.
export default function ProjectPicker({ projects, value, onChange, className = 'field', ...rest }) {
  return (
    <Select className={className} value={value} onChange={e => onChange(e.target.value)} {...rest}>
      <option value="">No project</option>
      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  )
}
