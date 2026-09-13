import { useState } from 'react'
import { useStore } from '../store.js'
import { format, isToday, isYesterday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { deleteEventById } from '../services/firebaseService.js'

const TYPE_STYLE = {
  takeoff: {
    label: '이륙',
    emoji: '🚁',
    bg:    'bg-amber-900/40 border-amber-700',
    dot:   'bg-amber-400',
  },
  landing: {
    label: '착륙',
    emoji: '🛬',
    bg:    'bg-green-900/40 border-green-700',
    dot:   'bg-green-400',
  },
}

function getTs(ev) {
  if (ev.createdAt?.toMillis) return ev.createdAt.toMillis()
  return ev.timestamp ?? Date.now()
}

function groupByDate(events) {
  const map = new Map()
  for (const ev of events) {
    const d   = new Date(getTs(ev))
    const key = format(d, 'yyyy-MM-dd')
    let label
    if (isToday(d))          label = '오늘'
    else if (isYesterday(d)) label = '어제'
    else                     label = format(d, 'M월 d일 (EEE)', { locale: ko })

    if (!map.has(key)) map.set(key, { label, events: [] })
    map.get(key).events.push(ev)
  }
  return [...map.values()]
}

export default function EventLog() {
  const eventLog = useStore((s) => s.eventLog)
  const flight   = eventLog.filter((e) => e.type === 'takeoff' || e.type === 'landing')

  const [confirmId, setConfirmId] = useState(null)
  const [deleting,  setDeleting]  = useState(false)

  async function handleDelete(id) {
    if (!id) { setConfirmId(null); return }
    setDeleting(true)
    try {
      await deleteEventById(id)
    } catch (e) {
      console.error('[EventLog] 삭제 실패:', e)
    }
    setDeleting(false)
    setConfirmId(null)
  }

  if (flight.length === 0) {
    return (
      <div className="card text-center py-10 text-slate-500">
        <div className="text-3xl mb-2">📭</div>
        <div className="text-sm">저장된 이벤트가 없습니다</div>
        <div className="text-xs mt-1 text-slate-600">이착륙 감지 시 자동 기록됩니다</div>
      </div>
    )
  }

  const groups = groupByDate(flight)

  return (
    <div className="space-y-5">
      {groups.map(({ label, events }) => (
        <section key={label}>
          {/* 날짜 헤더 */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-400">{label}</span>
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">{events.length}건</span>
          </div>

          <div className="space-y-2">
            {events.map((ev) => {
              const cfg = TYPE_STYLE[ev.type]
              if (!cfg) return null
              const ts  = getTs(ev)

              return (
                <div key={ev.id ?? ts} className={`border rounded-xl px-3 py-2.5 ${cfg.bg}`}>
                  {/* 타입 + 시각 + 삭제버튼 */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.emoji} {cfg.label}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-400 tabular-nums">
                        {format(new Date(ts), 'HH:mm:ss')}
                      </span>
                      <button
                        onClick={() => setConfirmId(ev.id)}
                        aria-label="이벤트 삭제"
                        className="text-slate-500 hover:text-red-400 transition-colors p-0.5"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {confirmId === ev.id && (
                    <div className="mt-2 mb-2 rounded-lg border border-red-800 bg-red-950/60 p-2.5 text-center">
                      <p className="text-xs text-red-300 mb-2">이 이벤트를 삭제할까요?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmId(null)}
                          className="flex-1 py-1.5 text-xs rounded-lg bg-slate-700 text-slate-300"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          disabled={deleting}
                          className="flex-1 py-1.5 text-xs rounded-lg bg-red-600 text-white font-medium disabled:opacity-50"
                        >
                          {deleting ? '삭제 중...' : '삭제'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 속도 · 위도 · 경도 */}
                  <div className="grid grid-cols-3 gap-x-3 text-xs">
                    {ev.speedKmh !== undefined && (
                      <div>
                        <div className="text-slate-600">속도</div>
                        <div className="text-slate-300 tabular-nums font-medium">
                          {Number(ev.speedKmh).toFixed(1)} km/h
                        </div>
                      </div>
                    )}
                    {ev.lat !== undefined && (
                      <div>
                        <div className="text-slate-600">위도</div>
                        <div className="text-slate-400 tabular-nums">
                          {Number(ev.lat).toFixed(5)}
                        </div>
                      </div>
                    )}
                    {ev.lon !== undefined && (
                      <div>
                        <div className="text-slate-600">경도</div>
                        <div className="text-slate-400 tabular-nums">
                          {Number(ev.lon).toFixed(5)}
                        </div>
                      </div>
                    )}
                  </div>

                  {ev.landingZone && (
                    <div className="text-xs text-slate-400 mt-1.5">
                      📍 {ev.landingZone}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
