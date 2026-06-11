import { saveEvent } from './firebaseService.js'
import { sendTelegramMessage, buildTelegramMessage } from './telegramService.js'
import { findNearestZone, isNearFlightPoint } from '../utils/geoUtils.js'
import { reverseGeocode } from '../utils/geocode.js'
import { enqueue, flushQueue } from '../utils/offlineQueue.js'
import { useStore } from '../store.js'
import { AIRCRAFT_ID } from '../config/firebase.js'

export const LANDING_ZONES = [
  { id: 'lz1', name: '서울 헬기장 A', lat: 37.5665, lon: 126.978  },
  { id: 'lz2', name: '인천 헬기장',   lat: 37.4563, lon: 126.7052 },
  { id: 'lz3', name: '수원 헬기장',   lat: 37.2636, lon: 127.0286 },
]

let lastTakeoffAt = null

async function showBrowserNotification(event) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const isTakeoff = event.type === 'takeoff'
  const title     = isTakeoff
    ? `🚁 [${AIRCRAFT_ID}] 이륙`
    : `🛬 [${AIRCRAFT_ID}] 착륙`

  const d     = new Date(event.timestamp ?? Date.now())
  const time  = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const speed = Number(event.speedKmh ?? 0).toFixed(1)
  const body  = [time, event.placeName, `${speed} km/h`].filter(Boolean).join(' | ')

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, {
        body,
        icon:    '/helicopter.svg',
        badge:   '/helicopter.svg',
        tag:     'heli-alert',
        vibrate: [200, 100, 200],
      })
    } else {
      new Notification(title, { body, icon: '/helicopter.svg' })
    }
  } catch (e) {
    console.warn('[Notify] 브라우저 알림 실패:', e.message)
  }
}

async function dispatchEvent(eventData) {
  const { notifyFCM, notifyTelegram, flightPoints } = useStore.getState()

  // 운항 지점 반경 체크
  if (!isNearFlightPoint(eventData.lat, eventData.lon, flightPoints)) {
    console.log('[Notify] 운항 지점 반경 외 — 이벤트 무시:', eventData.type)
    return
  }

  const zone = findNearestZone(eventData.lat, eventData.lon, LANDING_ZONES)
  const placeName = await reverseGeocode(eventData.lat, eventData.lon)

  let flightMinutes = null
  if (eventData.type === 'takeoff') {
    lastTakeoffAt = eventData.timestamp ?? Date.now()
  } else if (eventData.type === 'landing' && lastTakeoffAt !== null) {
    flightMinutes = Math.round(((eventData.timestamp ?? Date.now()) - lastTakeoffAt) / 60_000)
    lastTakeoffAt = null
  }

  const enriched = {
    ...eventData,
    landingZone:   zone?.name ?? null,
    landingZoneId: zone?.id   ?? null,
    placeName,
    flightMinutes,
  }

  await saveEvent(enriched)

  if (notifyFCM) {
    showBrowserNotification(enriched).catch(console.warn)
  }

  if (notifyTelegram) {
    sendTelegramMessage(buildTelegramMessage(enriched)).catch(console.warn)
  }

  return enriched
}

export async function handleFlightEvent(eventData) {
  if (!navigator.onLine) {
    enqueue(eventData)
    console.log('[Notify] 오프라인 — 큐에 저장:', eventData.type)
    return
  }
  try {
    await dispatchEvent(eventData)
  } catch (e) {
    console.warn('[Notify] 전송 실패, 큐에 저장:', e.message)
    enqueue(eventData)
  }
}

export function setupOfflineRecovery() {
  window.addEventListener('online', async () => {
    console.log('[OfflineRecovery] 네트워크 복구 — 큐 재전송')
    const count = await flushQueue(dispatchEvent)
    if (count > 0) {
      useStore.getState().addLog(`오프라인 중 저장된 ${count}건 재전송 완료`)
    }
  })
}
