import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installCursorFloat } from './utils/cursorFloat.mjs'
import { ensureCacheOwner } from './utils/userCache'
import { authService } from './services/authService'

// Before the first render: a cache that belongs to someone else must never reach the screen.
ensureCacheOwner(authService.getCurrentUser())

const removeCursorFloat = installCursorFloat()
if (import.meta.hot) import.meta.hot.dispose(removeCursorFloat)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
