import { useEffect } from 'react'
import Dashboard from './components/Dashboard.jsx'
import { useFlightState } from './hooks/useFlightState.js'
import {
  initFirebase,
  initAuth,
  subscribeRecentEvents,
  deleteExpiredEvents,
} from './services/firebaseService.js'
import { setupOfflineRecovery } from './services/notificationService.js'
import { useStore } from './store.js'

export default function App() {
  const setEventLog = useStore((s) => s.setEventLog)
  useFlightState()

  useEffect(() => {
    const ready = initFirebase()
    setupOfflineRecovery()

    if (!ready) return

    let unsub  = () => {}
    let active = true

    initAuth().then((uid) => {
      if (!active || !uid) return

      // 앱 시작 시 만료 이벤트 정리
      deleteExpiredEvents().catch(console.error)

      // Firestore 실시간 구독
      unsub = subscribeRecentEvents((events) => setEventLog(events))
    })

    return () => {
      active = false
      unsub()
    }
  }, [setEventLog])

  return <Dashboard />
}
