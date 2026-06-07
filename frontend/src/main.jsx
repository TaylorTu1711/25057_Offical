import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './utils/registerChartJs'
import './index.css'
import './css/ResizableTable.css'
import './css/AppModal.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { applyTheme, getSavedTheme } from './utils/theme'

applyTheme(getSavedTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
