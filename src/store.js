import { create } from 'zustand'
import { FlightState } from './services/stateMachine.js'
import { getRoleByEmail } from './services/firebaseService.js'

function lsBool(key, defaultVal) {
  const v = localStorage.getItem(key)
  return v === null ? defaultVal : v !== 'false'
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
  currentUser: null,
  role: localStorage.getItem('heli_role') ?? 'crew',
  offlineCount: 0,
  myUid:            null,
  activeGpsSession: null,

  // 알림 토글
  notifyFCM:      lsBool('heli_notify_fcm',     true),
  notifyTelegram: lsBool('heli_notify_telegram', true),
  markerColor: localStorage.getItem('heli_marker_color') ?? '#1d4ed8',

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
  setMarkerColor: (color) => {
    localStorage.setItem('heli_marker_color', color)
    set({ markerColor: color })
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
  setMyUid:            (uid)     => set({ myUid: uid }),
  setActiveGpsSession: (session) => set({ activeGpsSession: session }),

  setCurrentUser: (fbUser) => {
    if (fbUser) {
      const role = getRoleByEmail(fbUser.email)
      localStorage.setItem('heli_role', role)
      set({ currentUser: { uid: fbUser.uid, email: fbUser.email }, role })
    } else {
      localStorage.removeItem('heli_role')
      set({ currentUser: null, role: 'crew' })
    }
  },
}))
