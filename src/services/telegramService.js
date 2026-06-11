import { TELEGRAM_CONFIG, AIRCRAFT_ID } from '../config/firebase.js'

const BASE_URL = `https://api.telegram.org/bot${TELEGRAM_CONFIG.botToken}`

export async function sendTelegramMessage(text) {
  if (!TELEGRAM_CONFIG.botToken || !TELEGRAM_CONFIG.chatId) {
    console.warn('[Telegram] 설정값 미입력')
    return false
  }
  try {
    const res = await fetch(`${BASE_URL}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:    TELEGRAM_CONFIG.chatId,
        text,
        parse_mode: 'HTML',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('[Telegram] API 오류:', err.description)
    }
    return res.ok
  } catch (e) {
    console.error('[Telegram] 전송 실패:', e.message)
    return false
  }
}

// event 필드:
//   type, timestamp, lat, lon,
//   placeName (geocode 결과), flightMinutes (착륙 시에만)
export function buildTelegramMessage(event) {
  const isTakeoff = event.type === 'takeoff'
  const emoji     = isTakeoff ? '🛫' : '🛬'
  const label     = isTakeoff ? '이륙' : '착륙'

  const d    = new Date(event.timestamp ?? Date.now())
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  const location = event.placeName
    ?? `위도 ${Number(event.lat).toFixed(4)} 경도 ${Number(event.lon).toFixed(4)}`

  let msg =
    `${emoji} [헬기] ${label}\n` +
    `- 시각: ${time}\n` +
    `- 위치: ${location}`

  if (!isTakeoff && event.flightMinutes != null) {
    msg += `\n- 비행시간: ${event.flightMinutes}분`
  }

  return msg
}

export function buildLocationMessage(event) {
  const d    = new Date(event.timestamp ?? Date.now())
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const location = event.placeName ?? `위도 ${Number(event.lat).toFixed(4)} 경도 ${Number(event.lon).toFixed(4)}`
  return `📍 [헬기] 위치확인\n- 시각: ${time}\n- 위치: ${location}`
}
