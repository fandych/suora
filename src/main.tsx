import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppThemeProvider } from '@/components/theme/AppThemeProvider'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </React.StrictMode>
)
