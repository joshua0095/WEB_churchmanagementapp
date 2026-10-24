import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ConfirmProvider, ToastProvider } from './components/dialogs'
import { refreshSession } from './api'
import { RequestWatchdog, StartupGate } from './components/wake/StartupGate'
import { startStartup } from './serverStatus'

console.log(`JIL Norzagaray Connect v${__APP_VERSION__}`)

// Health check (wakes the free server) then the launch session refresh — see serverStatus.ts.
startStartup()

// Keep the sign-in alive across browser/app restarts (esp. mobile, where tabs are
// suspended rather than closed). The launch refresh runs in startStartup(); this covers
// the app returning to the foreground without a reload.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshSession()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <StartupGate>
            <App />
          </StartupGate>
          <RequestWatchdog />
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
