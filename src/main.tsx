import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ConfirmProvider, ToastProvider } from './components/dialogs'
import { refreshSession } from './api'

console.log(`JIL Norzagaray Connect v${__APP_VERSION__}`)

// Keep the sign-in alive across browser/app restarts (esp. mobile, where tabs are
// suspended rather than closed). The launch refresh runs behind ProtectedRoute's loading
// screen; this covers the app returning to the foreground without a reload.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshSession()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
