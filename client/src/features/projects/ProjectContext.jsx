import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

const ProjectContext = createContext(null)

// One load per project page; every tab reads from here and calls reload()
// after it changes something, so counts and the next action stay honest.
export function ProjectProvider({ projectId, children }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const load = useCallback(async () => {
    setError(null)
    try { setData(await api.get(`/projects/${projectId}`)) } catch (requestError) { setError(requestError) }
  }, [projectId])
  useEffect(() => { setData(null); load() }, [load])
  return <ProjectContext.Provider value={{ ...(data || {}), loaded: Boolean(data), error, reload: load, projectId: Number(projectId) }}>{children}</ProjectContext.Provider>
}

export const useProject = () => useContext(ProjectContext)
