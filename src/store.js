import { create } from 'zustand'
import { FlightState } from './services/stateMachine.js'

function lsBool(key, defaultVal) {
  const v = localStorage.getItem(key)
  return v === null ? defaultVal : v !== 'false'
}

function loadWaypoints() {
  try {
    const raw = localStorage.getItem('heli_waypoints')
    if (!raw) return { takeoff: null, waypoints: [], landing: null, radiusKm: 1, expiresAt: null }
    return JSON.parse(raw)
  } catch {
    return { takeoff: null, waypoints: [], landing: null, radiusKm: 1, expiresAt: null }
  }
}

export const useStore = create((set) => ({
  // GPS
  gpsPosition:   null,
  gpsError:      null,
  gpsActive:     false,
  gpsSignalLost: false,

  // 상태 머신
  flightState:  FlightState.IDLE,
  holdProgress: 0,

  // 이벤트 로그
  eventLog: [],

  // UI
  role: localStorage.getItem('heli_role') ?? 'pilot',
  offlineCount: 0,

  // 알림 토글
  notifyFCM:      lsBool('heli_notify_fcm',     true),
  notifyTelegram: lsBool('heli_notify_telegram', true),

  // 운항 지점 설정
  flightPoints: loadWaypoints(),

  // ── Actions ──────────────────────────────────────────────
  setGpsPosition:   (pos)  => set({ gpsPosition: pos, gpsError: null, gpsSignalLost: false }),
  setGpsError:      (err)  => set({ gpsError: err }),
  setGpsActive:     (flag) => set({ gpsActive: flag }),
  setGpsSignalLost: (v)    => set({ gpsSignalLost: v }),
  setFlightState:   (s)    => set({ flightState: s }),
  setHoldProgress:  (p)    => set({ holdProgress: p }),

  setRole: (role) => {
    localStorage.setItem('heli_role', role)
    set({ role })
  },

  setNotifyFCM: (v) => {
    localStorage.setItem('heli_notify_fcm', v)
    set({ notifyFCM: v })
  },
  setNotifyTelegram: (v) => {
    localStorage.setItem('heli_notify_telegram', v)
    set({ notifyTelegram: v })
  },

  setFlightPoints: (points) => {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000
    const data = { ...points, expiresAt }
    localStorage.setItem('heli_waypoints', JSON.stringify(data))
    set({ flightPoints: data })
  },

  clearFlightPoints: () => {
    const empty = { takeoff: null, waypoints: [], landing: null, radiusKm: 1, expiresAt: null }
    localStorage.removeItem('heli_waypoints')
    set({ flightPoints: empty })
  },

  addEvent: (event) =>
    set((state) => ({
      eventLog: [event, ...state.eventLog].slice(0, 50),
    })),

  addLog: (message) =>
    set((state) => ({
      eventLog: [
        { type: 'log', message, timestamp: Date.now() },
        ...state.eventLog,
      ].slice(0, 50),
    })),

  setOfflineCount: (n) => set({ offlineCount: n }),
  setEventLog:     (log) => set({ eventLog: log }),
}))
