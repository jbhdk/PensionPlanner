import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { defaultPlan } from './ui/defaultPlan'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialPlan={defaultPlan()} />
  </StrictMode>,
)
