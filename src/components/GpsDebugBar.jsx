import { useStore } from '../store.js'

export default function GpsDebugBar() {
  const gpsActive   = useStore((s) => s.gpsActive)
  const gpsPosition = useStore((s) => s.gpsPosition)
  const gpsError    = useStore((s) => s.gpsError)

  if (!gpsActive && !gpsError) return null

  return (
    <div className={`text-xs px-4 py-1.5 flex items-center gap-2
      ${gpsError ? 'bg-red-900/60 text-red-300' : 'bg-slate-800 text-slate-400'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${gpsError ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`} />
      {gpsError
        ? `GPS 오류: ${gpsError}`
        : gpsPosition
          ? `GPS 활성 — 갱신 ${((Date.now() - gpsPosition.timestamp) / 1000).toFixed(0)}s 전`
          : 'GPS 안정화 중...'}
    </div>
  )
}
