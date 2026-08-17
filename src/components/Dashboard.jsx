import { useState, useEffect } from 'react'
import { useStore } from '../store.js'
import { useGPS } from '../hooks/useGPS.js'
import FlightStatus from './FlightStatus.jsx'
import EventLog from './EventLog.jsx'
import NotificationPanel from './NotificationPanel.jsx'
import TrackingMap from './TrackingMap.jsx'
import GpsDebugBar from './GpsDebugBar.jsx'
import {
  setGpsSession,
  clearGpsSession,
  subscribeGpsSession,
  refreshGpsSession,
} from '../services/firebaseService.js'

const TABS = [
  { id: 'status', label: '상태',    icon: '📡' },
  { id: 'map',    label: '지도',    icon: '🗺' },
  { id: 'log',    label: '이벤트',  icon: '📋' },
  { id: 'notify', label: '알림설정', icon: '🔔' },
]

export default function Dashboard() {
  const [tab, setTab]       = useState('status')
  const gpsActive           = useStore((s) => s.gpsActive)
  const role                = useStore((s) => s.role)
  const myUid               = useStore((s) => s.myUid)
  const activeGpsSession    = useStore((s) => s.activeGpsSession)
  const setActiveGpsSession = useStore((s) => s.setActiveGpsSession)
  const { startGPS, stopGPS } = useGPS()

  const isPilot = role === 'pilot'

  useEffect(() => {
    const unsub = subscribeGpsSession((session) => setActiveGpsSession(session))
    return () => unsub()
  }, [setActiveGpsSession])

  useEffect(() => {
    if (!isPilot || !myUid || gpsActive) return
    if (activeGpsSession?.uid === myUid && activeGpsSession?.active) {
      handleStartGPS()
    }
  }, [activeGpsSession, myUid, isPilot, gpsActive])

  useEffect(() => {
    if (!gpsActive || !myUid) return
    const interval = setInterval(() => {
      refreshGpsSession(myUid).catch(console.error)
    }, 30_000)
    return () => clearInterval(interval)
  }, [gpsActive, myUid])

  const otherUserActive =
    activeGpsSession?.active === true &&
    activeGpsSession?.uid !== myUid &&
    activeGpsSession?.lastActiveAt &&
    (Date.now() - activeGpsSession.lastActiveAt.toMillis()) < 2 * 60 * 1000

  async function handleStartGPS() {
    await startGPS()
    if (myUid) {
      await setGpsSession(myUid, activeGpsSession?.email ?? myUid).catch(console.error)
    }
  }

  async function handleStopGPS() {
    await stopGPS()
    if (myUid) {
      await clearGpsSession(myUid).catch(console.error)
    }
  }

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto">
      <header
        className="bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚁</span>
          <div>
            <h1 className="font-bold text-sm leading-tight">헬리콥터 이착륙 알림</h1>
            <p className="text-xs text-slate-500">HeliAlert v1.1</p>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-90 transition-all"
          style={{ touchAction: 'manipulation' }}
          aria-label="새로고침"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </header>

      <GpsDebugBar />

      {isPilot && otherUserActive && (
        <div className="bg-amber-900/50 border-b border-amber-700/50 text-amber-300 text-xs px-4 py-2 flex items-center gap-2">
          <span>🔒</span>
          <span>
            {activeGpsSession.email
              ? `${activeGpsSession.email} 이(가) GPS 감지 중`
              : '다른 조종사가 GPS 감지 중'
            } — 중복 사용 불가
          </span>
        </div>
      )}

      <OfflineBanner />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
        {tab === 'status' && (
          <>
            <FlightStatus />
            {isPilot && !gpsActive && (
              <div className="card text-center py-6">
                <div className="text-4xl mb-3">📡</div>
                {otherUserActive ? (
                  <>
                    <p className="text-amber-400 text-sm font-semibold mb-1">
                      🔒 GPS 감지 사용 중
                    </p>
                    <p className="text-slate-500 text-xs">
                      {activeGpsSession.email ?? '다른 조종사'}이(가) 감지 중입니다
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-slate-400 text-sm mb-4">
                      GPS 감지를 시작하면 이착륙을 자동으로 감지합니다
                    </p>
                    <button onClick={handleStartGPS} className="btn-primary">
                      GPS 감지 시작
                    </button>
                  </>
                )}
              </div>
            )}
            {isPilot && gpsActive && <StopGpsCard onStop={handleStopGPS} />}
          </>
        )}
        {tab === 'map'    && <TrackingMap />}
        {tab === 'log'    && <EventLog />}
        {tab === 'notify' && <NotificationPanel />}
      </main>

      <nav
        className="bg-slate-900 border-t border-slate-800 flex sticky bottom-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors
              ${tab === t.id
                ? 'text-blue-400 border-t-2 border-blue-500 -mt-px'
                : 'text-slate-500 hover:text-slate-300'}`}
            style={{ touchAction: 'manipulation' }}
          >
            <span className="text-base">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function StopGpsCard({ onStop }) {
  return (
    <div className="card border-red-900/60 space-y-2">
      <p className="text-xs text-slate-600 text-center">⚠ 감지를 중지하면 이착륙 알림이 비활성화됩니다</p>
      <button
        onClick={onStop}
        className="w-full py-3 rounded-xl text-sm font-semibold
                   bg-red-950/60 text-red-400 border border-red-900
                   hover:bg-red-900/60 transition-colors
                   flex items-center justify-center gap-2"
        style={{ touchAction: 'manipulation' }}
      >
        <span>⏹</span>
        감지 중지
      </button>
    </div>
  )
}

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const onOnline  = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])
  if (online) return null
  return (
    <div className="bg-red-900/70 text-red-300 text-xs px-4 py-2 flex items-center gap-2">
      <span>📵</span>
      오프라인 — 이벤트는 로컬에 저장되어 복구 시 자동 전송됩니다
    </div>
  )
}
