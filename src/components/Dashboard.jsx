import { useState, useEffect } from 'react'
import { useStore } from '../store.js'
import { useGPS } from '../hooks/useGPS.js'
import FlightStatus from './FlightStatus.jsx'
import EventLog from './EventLog.jsx'
import NotificationPanel from './NotificationPanel.jsx'
import TrackingMap from './TrackingMap.jsx'
import GpsDebugBar from './GpsDebugBar.jsx'
import { reverseGeocode } from '../utils/geocode.js'
import { sendTelegramMessage, buildLocationMessage } from '../services/telegramService.js'

const TABS = [
  { id: 'status', label: '상태',    icon: '📡' },
  { id: 'map',    label: '지도',    icon: '🗺' },
  { id: 'log',    label: '이벤트',  icon: '📋' },
  { id: 'notify', label: '알림설정', icon: '🔔' },
]

export default function Dashboard() {
  const [tab, setTab]    = useState('status')
  const gpsActive        = useStore((s) => s.gpsActive)
  const role             = useStore((s) => s.role)
  const { startGPS, stopGPS } = useGPS()

  const isPilot = role === 'pilot'

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚁</span>
          <div>
            <h1 className="font-bold text-sm leading-tight">헬리콥터 이착륙 알림</h1>
            <p className="text-xs text-slate-500">HeliAlert v0.8</p>
          </div>
        </div>
        {isPilot && (
          <button
            onClick={gpsActive ? stopGPS : startGPS}
            className={gpsActive ? 'btn-danger text-sm py-1.5 px-3' : 'btn-primary text-sm py-1.5 px-3'}
          >
            {gpsActive ? '감지 중지' : 'GPS 시작'}
          </button>
        )}
      </header>

      <GpsDebugBar />
      <OfflineBanner />

      <nav className="bg-slate-900 border-b border-slate-800 flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors
              ${tab === t.id
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300'}`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
        {tab === 'status' && (
          <>
            <FlightStatus />
            {isPilot && !gpsActive && (
              <div className="card text-center py-6">
                <div className="text-4xl mb-3">📡</div>
                <p className="text-slate-400 text-sm mb-4">
                  GPS 감지를 시작하면 이착륙을 자동으로 감지합니다
                </p>
                <button onClick={startGPS} className="btn-primary">
                  GPS 감지 시작
                </button>
              </div>
            )}
            {isPilot && gpsActive && <LocationCheckCard />}
            {isPilot && gpsActive && <StopGpsCard onStop={stopGPS} />}
          </>
        )}
        {tab === 'map'    && <TrackingMap />}
        {tab === 'log'    && <EventLog />}
        {tab === 'notify' && <NotificationPanel />}
      </main>
    </div>
  )
}

function LocationCheckCard() {
  const gpsPosition    = useStore((s) => s.gpsPosition)
  const gpsSignalLost  = useStore((s) => s.gpsSignalLost)
  const notifyTelegram = useStore((s) => s.notifyTelegram)
  const [state, setState] = useState(null)

  const canSend = !!gpsPosition && !gpsSignalLost

  async function handleLocationCheck() {
    if (state === 'sending' || !canSend) return
    setState('sending')
    try {
      const placeName = await reverseGeocode(gpsPosition.lat, gpsPosition.lon)
        .catch(() => `위도 ${gpsPosition.lat.toFixed(4)} 경도 ${gpsPosition.lon.toFixed(4)}`)
      const event = {
        timestamp: Date.now(),
        lat:       gpsPosition.lat,
        lon:       gpsPosition.lon,
        placeName,
      }
      let ok = false
      if (notifyTelegram) {
        ok = await sendTelegramMessage(buildLocationMessage(event))
      }
      setState(ok ? 'done' : 'fail')
    } catch (e) {
      console.error('[LocationCheck]', e)
      setState('fail')
    }
    setTimeout(() => setState(null), 2500)
  }

  return (
    <div className="card space-y-2">
      <button
        onClick={handleLocationCheck}
        disabled={!canSend || state === 'sending'}
        className={`w-full py-3 rounded-xl text-sm font-semibold border transition-colors flex items-center justify-center gap-2
          ${canSend
            ? 'bg-blue-700/40 text-blue-300 border-blue-700 hover:bg-blue-700/60'
            : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
          } disabled:opacity-50`}
      >
        <span>📍</span>
        위치 확인
      </button>
      {gpsSignalLost && (
        <p className="text-xs text-red-400 text-center">GPS 신호 없음 — 신호 복구 후 사용 가능</p>
      )}
      {!gpsSignalLost && !gpsPosition && (
        <p className="text-xs text-slate-600 text-center">GPS 위치 수신 대기 중...</p>
      )}
      {state === 'sending' && <p className="text-xs text-slate-400 text-center">위치 정보 전송 중...</p>}
      {state === 'done'    && <p className="text-xs text-green-400 text-center">✓ 위치 알림 발송 완료</p>}
      {state === 'fail'    && <p className="text-xs text-red-400 text-center">발송 실패 — 통신 상태를 확인하세요</p>}
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
