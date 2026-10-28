import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installCursorFloat } from './utils/cursorFloat.mjs'

const removeCursorFloat = installCursorFloat()
if (import.meta.hot) import.meta.hot.dispose(removeCursorFloat)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
