import { useStore } from '../store.js'
import { FlightState } from '../services/stateMachine.js'
import { WifiOff } from 'lucide-react'

const STATE_CONFIG = {
  [FlightState.IDLE]: {
    label:  '지상 대기',
    color:  'bg-slate-700 text-slate-300',
    ring:   'ring-slate-600',
    dot:    'bg-slate-400',
    pulse:  false,
  },
  [FlightState.TAKING_OFF]: {
    label:  '이륙 감지 중',
    color:  'bg-amber-900/60 text-amber-300',
    ring:   'ring-amber-500',
    dot:    'bg-amber-400',
    pulse:  true,
  },
  [FlightState.AIRBORNE]: {
    label:  '비행 중',
    color:  'bg-blue-900/60 text-blue-300',
    ring:   'ring-blue-500',
    dot:    'bg-blue-400',
    pulse:  false,
  },
  [FlightState.LANDING]: {
    label:  '착륙 감지 중',
    color:  'bg-green-900/60 text-green-300',
    ring:   'ring-green-500',
    dot:    'bg-green-400',
    pulse:  true,
  },
}

export default function FlightStatus() {
  const flightState    = useStore((s) => s.flightState)
  const gpsPosition    = useStore((s) => s.gpsPosition)
  const holdProgress   = useStore((s) => s.holdProgress)
  const gpsSignalLost  = useStore((s) => s.gpsSignalLost)
  const cfg            = STATE_CONFIG[flightState]

  const isHolding = holdProgress > 0 &&
    (flightState === FlightState.TAKING_OFF || flightState === FlightState.LANDING)

  return (
    <div className="space-y-3">
      {/* 상태 카드 */}
      <div className={`card ring-2 ${cfg.ring} transition-all duration-500`}>
        {/* GPS 신호 끊김 경고 */}
        {gpsSignalLost && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-red-900/70 border border-red-600 text-red-300 text-sm">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>GPS 신호 끊김 — 지상 대기로 리셋됨</span>
          </div>
        )}

        {/* 상태 배지 */}
        <div className="flex items-center justify-between mb-4">
          <span className={`status-badge ${cfg.color}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse-fast' : ''}`} />
            {cfg.label}
          </span>
          {gpsPosition && (
            <span className="text-xs text-slate-500">
              정확도 {gpsPosition.accuracy?.toFixed(0)}m
            </span>
          )}
        </div>

        {/* 속도 대형 표시 */}
        <div className="text-center py-4">
          <div className="text-6xl font-bold tabular-nums leading-none">
            {gpsPosition ? gpsPosition.speedKmh.toFixed(1) : '--'}
          </div>
          <div className="text-slate-400 mt-1 text-sm">km/h</div>
        </div>

        {/* 홀드 프로그레스 바 */}
        {isHolding && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>
                {flightState === FlightState.TAKING_OFF ? '이륙 확인 중 (5s)' : '착륙 확인 중 (20s)'}
              </span>
              <span>{Math.round(holdProgress * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  flightState === FlightState.TAKING_OFF ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${holdProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 좌표 */}
        {gpsPosition && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-xl p-2">
            <div>
              <div className="text-slate-400 font-medium">위도</div>
              <div className="tabular-nums">{gpsPosition.lat.toFixed(6)}</div>
            </div>
            <div>
              <div className="text-slate-400 font-medium">경도</div>
              <div className="tabular-nums">{gpsPosition.lon.toFixed(6)}</div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
