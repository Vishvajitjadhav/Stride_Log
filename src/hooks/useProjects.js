import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Projects with their members: [{ id, name, description, color, is_active, members: [{ user_id, role }] }]
export function useProjects({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: ['projects', includeInactive],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      let q = supabase.from('projects').select('*, members:project_members(user_id, role)').order('name')
      if (!includeInactive) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

// Projects a given person belongs to.
export function projectsOf(projects = [], userId) {
  return projects.filter(p => p.members.some(m => m.user_id === userId))
}

export function useProjectMutations() {
  const qc = useQueryClient()
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['facts'] })
  }

  // Save details and replace the member list in one go.
  const save = useMutation({
    mutationFn: async ({ id, name, description, color, members }) => {
      const fields = { name: name.trim(), description: description?.trim() || null, color }
      const res = id
        ? await supabase.from('projects').update(fields).eq('id', id).select('id').single()
        : await supabase.from('projects').insert(fields).select('id').single()
      if (res.error) throw new Error(res.error.code === '23505' ? 'A project with this name already exists.' : res.error.message)
      const projectId = res.data.id

      const del = await supabase.from('project_members').delete().eq('project_id', projectId)
      if (del.error) throw del.error
      if (members.length) {
        const ins = await supabase.from('project_members').insert(members.map(m => ({ project_id: projectId, user_id: m.user_id, role: m.role })))
        if (ins.error) throw ins.error
      }
      return projectId
    },
    onSuccess,
  })

  const setActive = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('projects').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess,
  })

  return { save, setActive }
}
