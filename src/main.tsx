import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadPlan } from './persistence/planStorage'
import { App } from './ui/App'
import { defaultPlan } from './ui/defaultPlan'

const stored = loadPlan()
const initialPlan = stored.kind === 'Loaded' ? stored.plan : defaultPlan()
const loadError = stored.kind === 'Failed' ? stored.reason : undefined
const loadNotice = stored.kind === 'Loaded' ? stored.notice : undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialPlan={initialPlan} loadError={loadError} loadNotice={loadNotice} />
  </StrictMode>,
)
