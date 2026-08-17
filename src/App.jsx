import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import { useFlightState } from './hooks/useFlightState.js'
import {
  initFirebase,
  onAuthStateChange,
  subscribeRecentEvents,
  deleteExpiredEvents,
} from './services/firebaseService.js'
import { setupOfflineRecovery } from './services/notificationService.js'
import { useStore } from './store.js'

export default function App() {
  const setEventLog = useStore((s) => s.setEventLog)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState(null)

  useFlightState()

  useEffect(() => {
    const ready = initFirebase()
    setupOfflineRecovery()
    if (!ready) return

    let unsubEvents = () => {}
    let active = true

    const unsubAuth = onAuthStateChange((fbUser) => {
      if (!active) return
      if (fbUser) {
        setCurrentUser(fbUser)
        setUser(fbUser)
        deleteExpiredEvents().catch(console.error)
        unsubEvents = subscribeRecentEvents((events) => setEventLog(events))
      } else {
        setCurrentUser(null)
        setUser(null)
        unsubEvents()
        unsubEvents = () => {}
        setEventLog([])
      }
      setAuthReady(true)
    })

    return () => {
      active = false
      unsubAuth()
      unsubEvents()
    }
  }, [setEventLog, setCurrentUser])

  if (!authReady) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0a0a0a', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#f37321',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, boxShadow: '0 0 20px rgba(243,115,33,0.5)',
          animation: 'pulse 1.2s ease-in-out infinite',
        }}>🚁</div>
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
          }
        `}</style>
      </div>
    )
  }

  return user ? <Dashboard /> : <LoginScreen />
}
