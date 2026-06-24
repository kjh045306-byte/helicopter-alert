import { useState } from 'react'
import { useStore } from '../store.js'

const MARKER_COLORS = ['#FF7A00', '#FFD400', '#1d4ed8', '#38BDF8']
import { sendTelegramMessage, buildTelegramMessage } from '../services/telegramService.js'
import { reverseGeocode } from '../utils/geocode.js'
import { getQueue } from '../utils/offlineQueue.js'
import WaypointMap from './WaypointMap.jsx'

function Toggle({ on, onChange, label }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
          ${on ? 'bg-blue-500' : 'bg-slate-600'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm
            transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

function PointSelector({ label, emoji, point, onSelect, onClear }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base w-6 text-center flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        {point ? (
          <p className="text-xs text-slate-200 truncate">
            {point.name ?? `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`}
          </p>
        ) : (
          <p className="text-xs text-slate-500">미설정</p>
        )}
      </div>
      <button
        onClick={onSelect}
        className="px-2 py-1 text-xs rounded bg-slate-600 text-slate-200
                   hover:bg-slate-500 flex-shrink-0"
      >
        {point ? '변경' : '선택'}
      </button>
      {onClear && (
        <button
          onClick={onClear}
          className="px-2 py-1 text-xs rounded bg-red-900/60 text-red-400
                     hover:bg-red-800/60 flex-shrink-0"
        >
          삭제
        </button>
      )}
    </div>
  )
}

export default function NotificationPanel() {
  const notifyTelegram    = useStore((s) => s.notifyTelegram)
  const setNotifyTelegram = useStore((s) => s.setNotifyTelegram)
  const flightPoints      = useStore((s) => s.flightPoints)
  const setFlightPoints   = useStore((s) => s.setFlightPoints)
  const clearFlightPoints = useStore((s) => s.clearFlightPoints)
  const markerColor       = useStore((s) => s.markerColor)
  const setMarkerColor    = useStore((s) => s.setMarkerColor)

  const [testState, setTestState] = useState(null)
  const [mapTarget, setMapTarget] = useState(null)
  const [radiusKm,  setRadiusKm]  = useState(flightPoints.radiusKm ?? 1)
  const offlineQ = getQueue()

  function handleMapConfirm(pos) {
    const updated = { ...flightPoints }
    if (mapTarget.type === 'takeoff') {
      updated.takeoff = pos
    } else if (mapTarget.type === 'landing') {
      updated.landing = pos
    } else if (mapTarget.type === 'waypoint') {
      const wps = [...(updated.waypoints ?? [])]
      wps[mapTarget.index] = pos
      updated.waypoints = wps
    }
    setFlightPoints({ ...updated, radiusKm })
    setMapTarget(null)
  }

  function addWaypoint() {
    const wps = [...(flightPoints.waypoints ?? []), null]
    setFlightPoints({ ...flightPoints, waypoints: wps, radiusKm })
  }

  function removeWaypoint(i) {
    const wps = (flightPoints.waypoints ?? []).filter((_, idx) => idx !== i)
    setFlightPoints({ ...flightPoints, waypoints: wps, radiusKm })
  }

  function clearPoint(type) {
    const updated = { ...flightPoints }
    if (type === 'takeoff') updated.takeoff = null
    if (type === 'landing') updated.landing = null
    setFlightPoints({ ...updated, radiusKm })
  }

  function saveRadius() {
    setFlightPoints({ ...flightPoints, radiusKm })
  }

  function expiryLabel() {
    if (!flightPoints.expiresAt) return null
    const diff = flightPoints.expiresAt - Date.now()
    if (diff <= 0) return '만료됨'
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    return `${h}시간 ${m}분 후 만료`
  }

  const hasAnyPoint = flightPoints.takeoff ||
    flightPoints.landing ||
    (flightPoints.waypoints ?? []).some(Boolean)

  async function handleTest(type) {
    if (testState === 'sending') return
    setTestState('sending')
    const LAT = 37.388, LON = 127.071
    const placeName = await reverseGeocode(LAT, LON).catch(() => `위도 ${LAT} 경도 ${LON}`)
    const mockEvent = {
      type,
      timestamp:     Date.now(),
      speedKmh:      type === 'takeoff' ? 49.2 : 3.1,
      lat:           LAT,
      lon:           LON,
      accuracy:      8,
      landingZone:   null,
      placeName,
      flightMinutes: type === 'landing' ? 23 : null,
    }
    let anyOk = false
    if (notifyTelegram) {
      const ok = await sendTelegramMessage(buildTelegramMessage(mockEvent))
      if (ok) anyOk = true
    }
    setTestState(anyOk ? 'done' : 'fail')
    setTimeout(() => setTestState(null), 2500)
  }

  return (
    <div className="space-y-4">

      {/* 감지 설정값 — Dashboard에서 이동 */}
      <SettingsInfo />

      {/* 지도 마커 색상 */}
      <div className="card space-y-2">
        <h3 className="text-sm font-semibold text-slate-400">지도 마커 색상</h3>
        <div className="grid grid-cols-4 gap-2">
          {MARKER_COLORS.map((hex) => (
            <button
              key={hex}
              onClick={() => setMarkerColor(hex)}
              className={`flex items-center justify-center py-2 rounded-xl border transition-all
                ${markerColor === hex ? 'border-blue-400 bg-slate-700/50' : 'border-slate-700'}`}
            >
              <svg width="28" height="28" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="22" fill={hex} stroke={hex} strokeWidth="2" />
                <circle cx="24" cy="24" r="14" fill="#ffffff" />
                <text x="24" y="32" textAnchor="middle" fontSize="20">🚁</text>
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* 운항 지점 설정 */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-400">운항 지점 설정</h3>
          {hasAnyPoint && (
            <span className="text-xs text-blue-400">{expiryLabel()}</span>
          )}
        </div>

        <PointSelector
          label="이륙 지점"
          emoji="🛫"
          point={flightPoints.takeoff}
          onSelect={() => setMapTarget({ type: 'takeoff' })}
          onClear={flightPoints.takeoff ? () => clearPoint('takeoff') : null}
        />

        {(flightPoints.waypoints ?? []).map((wp, i) => (
          <PointSelector
            key={i}
            label={`경유 지점 ${i + 1}`}
            emoji="🔄"
            point={wp}
            onSelect={() => setMapTarget({ type: 'waypoint', index: i })}
            onClear={() => removeWaypoint(i)}
          />
        ))}

        <button
          onClick={addWaypoint}
          className="w-full py-1.5 text-xs rounded border border-dashed
                     border-slate-600 text-slate-400 hover:border-slate-500
                     hover:text-slate-300 transition-colors"
        >
          + 경유지 추가
        </button>

        <PointSelector
          label="착륙 지점"
          emoji="🛬"
          point={flightPoints.landing}
          onSelect={() => setMapTarget({ type: 'landing' })}
          onClear={flightPoints.landing ? () => clearPoint('landing') : null}
        />

        <div className="flex items-center gap-3 pt-1 border-t border-slate-700">
          <span className="text-xs text-slate-400 flex-shrink-0">감지 반경</span>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={radiusKm}
            onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
            onMouseUp={saveRadius}
            onTouchEnd={saveRadius}
            className="flex-1"
          />
          <span className="text-xs text-slate-300 w-12 text-right flex-shrink-0">
            {radiusKm} km
          </span>
        </div>

        {hasAnyPoint && (
          <button
            onClick={clearFlightPoints}
            className="w-full py-1.5 text-xs rounded bg-slate-700
                       text-slate-400 hover:bg-slate-600 transition-colors"
          >
            전체 초기화
          </button>
        )}
      </div>

      {/* 알림 채널 */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-400">알림 채널</h3>
        <Toggle label="텔레그램 알림" on={notifyTelegram} onChange={setNotifyTelegram} />
      </div>

      {/* 알림 테스트 */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-400">알림 테스트</h3>
        {!notifyTelegram ? (
          <p className="text-xs text-slate-500 text-center py-1">활성화된 알림 채널이 없습니다</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTest('takeoff')}
                disabled={testState === 'sending'}
                className="btn-primary text-sm py-2 disabled:opacity-50"
              >
                🚁 이륙 테스트
              </button>
              <button
                onClick={() => handleTest('landing')}
                disabled={testState === 'sending'}
                className="btn-primary text-sm py-2 disabled:opacity-50"
              >
                🛬 착륙 테스트
              </button>
            </div>
            {testState === 'sending' && <p className="text-xs text-slate-400 text-center">발송 중...</p>}
            {testState === 'done'    && <p className="text-xs text-green-400 text-center">✓ 테스트 발송 완료</p>}
            {testState === 'fail'    && <p className="text-xs text-red-400 text-center">발송 실패 — 설정값을 확인하세요</p>}
          </>
        )}
      </div>

      {offlineQ.length > 0 && (
        <div className="card border-amber-700 bg-amber-900/20">
          <div className="flex items-center gap-2 text-amber-400">
            <span>⚠️</span>
            <div>
              <div className="text-sm font-semibold">오프라인 큐</div>
              <div className="text-xs text-amber-300/80">
                {offlineQ.length}건 저장됨 — 네트워크 복구 시 자동 전송
              </div>
            </div>
          </div>
        </div>
      )}

      {mapTarget && (
        <WaypointMap
          title={
            mapTarget.type === 'takeoff' ? '이륙 지점 선택' :
            mapTarget.type === 'landing' ? '착륙 지점 선택' :
            `경유 지점 ${mapTarget.index + 1} 선택`
          }
          initialPos={
            mapTarget.type === 'takeoff'  ? flightPoints.takeoff :
            mapTarget.type === 'landing'  ? flightPoints.landing :
            flightPoints.waypoints?.[mapTarget.index]
          }
          onConfirm={handleMapConfirm}
          onClose={() => setMapTarget(null)}
        />
      )}
    </div>
  )
}

function SettingsInfo() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-slate-400"
      >
        <span>⚙️ 감지 설정값</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {[
            ['이륙 감지 속도', '25 km/h 이상'],
            ['이륙 유지 시간', '5 초'],
            ['착륙 감지 속도', '15 km/h 미만'],
            ['착륙 유지 시간', '20 초'],
            ['이벤트 최소 간격', '90 초'],
            ['GPS 안정화 대기', '3 초'],
            ['GPS 최대 갱신 경과', '10 초'],
            ['GPS 최대 허용 정확도', '100 m'],
            ['착륙장 매칭 반경', '5 km'],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-slate-300 font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
