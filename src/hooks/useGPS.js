import { useEffect, useRef } from 'react'
import { gpsService } from '../services/gpsService.js'
import { flightMachine } from '../services/stateMachine.js'
import { useStore } from '../store.js'

const GPS_SIGNAL_TIMEOUT_MS = 10_000

export function useGPS() {
  const setGpsPosition   = useStore((s) => s.setGpsPosition)
  const setGpsError      = useStore((s) => s.setGpsError)
  const setGpsActive     = useStore((s) => s.setGpsActive)
  const setGpsSignalLost = useStore((s) => s.setGpsSignalLost)
  const rafRef           = useRef(null)
  const wakeLockRef      = useRef(null)
  const lastGpsRef       = useRef(null)   // Date.now() of last valid GPS fix
  const isActiveRef      = useRef(false)

  useEffect(() => {
    // GPS 구독
    const unsubGPS = gpsService.subscribe((pos) => {
      if (pos) {
        lastGpsRef.current = Date.now()
        setGpsPosition(pos)
        flightMachine.update(pos)
      } else {
        setGpsError('GPS 신호 소실')
      }
    })

    // GPS 타임아웃 감시 (10초 갱신 없으면 경고 + 상태 머신 리셋)
    const signalCheckInterval = setInterval(() => {
      if (!isActiveRef.current || lastGpsRef.current === null) return
      const elapsed = Date.now() - lastGpsRef.current
      if (elapsed >= GPS_SIGNAL_TIMEOUT_MS) {
        setGpsSignalLost(true)
        setGpsError('GPS 신호 끊김')
        flightMachine.notifyGpsLost()
      }
    }, 1_000)

    // 홀드 프로그레스 애니메이션 루프
    const setHoldProgress = useStore.getState().setHoldProgress
    function animLoop() {
      setHoldProgress(flightMachine.holdProgress)
      rafRef.current = requestAnimationFrame(animLoop)
    }
    rafRef.current = requestAnimationFrame(animLoop)

    // 화면 복귀 감지 — GPS 스트림 재시작 + 고착 방지
    function handleVisibility() {
      if (document.visibilityState !== 'visible' || !isActiveRef.current) return
      gpsService.stop()
      gpsService.start()
      // 마지막 갱신이 10초 이상 지났으면 상태 머신 리셋
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
    // Wake Lock 획득 (화면 꺼짐 방지)
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
    // Wake Lock 해제
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {})
      wakeLockRef.current = null
    }
  }

  return { startGPS, stopGPS }
}
