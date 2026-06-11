import { useEffect, useRef } from 'react'
import { gpsService } from '../services/gpsService.js'
import { flightMachine } from '../services/stateMachine.js'
import { saveCurrentPosition, saveTrackingPoint, clearTrackingPath } from '../services/firebaseService.js'
import { useStore } from '../store.js'

const GPS_SIGNAL_TIMEOUT_MS = 10_000
const TRACKING_INTERVAL_MS  = 7_000

export function useGPS() {
  const setGpsPosition   = useStore((s) => s.setGpsPosition)
  const setGpsError      = useStore((s) => s.setGpsError)
  const setGpsActive     = useStore((s) => s.setGpsActive)
  const setGpsSignalLost = useStore((s) => s.setGpsSignalLost)
  const rafRef           = useRef(null)
  const wakeLockRef      = useRef(null)
  const lastGpsRef       = useRef(null)
  const isActiveRef      = useRef(false)
  const trackingTimerRef = useRef(null)

  useEffect(() => {
    const unsubGPS = gpsService.subscribe((pos) => {
      if (pos) {
        lastGpsRef.current = Date.now()
        setGpsPosition(pos)
        flightMachine.update(pos)
      } else {
        setGpsError('GPS 신호 소실')
      }
    })

    const signalCheckInterval = setInterval(() => {
      if (!isActiveRef.current || lastGpsRef.current === null) return
      const elapsed = Date.now() - lastGpsRef.current
      if (elapsed >= GPS_SIGNAL_TIMEOUT_MS) {
        setGpsSignalLost(true)
        setGpsError('GPS 신호 끊김')
        flightMachine.notifyGpsLost()
      }
    }, 1_000)

    const setHoldProgress = useStore.getState().setHoldProgress
    function animLoop() {
      setHoldProgress(flightMachine.holdProgress)
      rafRef.current = requestAnimationFrame(animLoop)
    }
    rafRef.current = requestAnimationFrame(animLoop)

    function handleVisibility() {
      if (document.visibilityState !== 'visible' || !isActiveRef.current) return
      gpsService.stop()
      gpsService.start()
      if (lastGpsRef.current !== null && Date.now() - lastGpsRef.current >= GPS_SIGNAL_TIMEOUT_MS) {
        setGpsSignalLost(true)
        setGpsError('GPS 신호 끊김')
        flightMachine.notifyGpsLost()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      unsubGPS()
      clearInterval(signalCheckInterval)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [setGpsPosition, setGpsError, setGpsActive, setGpsSignalLost])

  async function startGPS() {
    const ok = gpsService.start()
    setGpsActive(ok)
    isActiveRef.current = ok
    if (!ok) {
      setGpsError('Geolocation API를 사용할 수 없습니다')
      return
    }

    // 이전 경로 삭제 후 추적 시작
    await clearTrackingPath()

    // 10초마다 위치 저장
    trackingTimerRef.current = setInterval(() => {
      const pos = gpsService.lastPosition
      if (pos && isActiveRef.current) {
        saveCurrentPosition(pos)
        saveTrackingPoint(pos)
      }
    }, TRACKING_INTERVAL_MS)

    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch (e) {
        console.warn('[WakeLock] 획득 실패:', e.message)
      }
    }
  }

  function stopGPS() {
    gpsService.stop()
    setGpsActive(false)
    isActiveRef.current = false
    lastGpsRef.current  = null

    // 추적 타이머 중지
    if (trackingTimerRef.current) {
      clearInterval(trackingTimerRef.current)
      trackingTimerRef.current = null
    }

    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {})
      wakeLockRef.current = null
    }
  }

  return { startGPS, stopGPS }
}
