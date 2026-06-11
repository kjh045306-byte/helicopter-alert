/**
 * Firebase Cloud Functions
 *  1. onFlightEvent      — 이착륙 이벤트 저장 시 FCM 푸시 발송
 *  2. cleanupExpiredEvents — 매일 자정(KST) 3일 경과 이벤트 삭제
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onSchedule }        = require('firebase-functions/v2/scheduler')
const { initializeApp }     = require('firebase-admin/app')
const { getFirestore }      = require('firebase-admin/firestore')
const { getMessaging }      = require('firebase-admin/messaging')

initializeApp()
const db = getFirestore()

// ── 이착륙 이벤트 → FCM 푸시 ──────────────────────────────────
exports.onFlightEvent = onDocumentCreated(
  'users/{uid}/flight_events/{docId}',
  async (event) => {
    const data = event.data?.data()
    if (!data) return

    const isLanding = data.type === 'landing'
    const title     = isLanding ? '🛬 착륙 감지' : '🚁 이륙 감지'
    const body      = isLanding
      ? `착륙 확인됨${data.landingZone ? ` — ${data.landingZone}` : ''}`
      : `이륙 확인됨 (${data.speedKmh?.toFixed(1) ?? '-'} km/h)`

    const snap = await db.collection('fcm_tokens')
      .where('role', 'in', ['ground', 'admin'])
      .get()

    const tokens = snap.docs.map((d) => d.data().token).filter(Boolean)
    if (tokens.length === 0) return

    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      android: { priority: 'high', notification: { channelId: 'heli_alert' } },
      apns:    { payload: { aps: { sound: 'default', badge: 1 } } },
    })

    console.log(`[FCM] 발송 완료: ${res.successCount}/${tokens.length}`)

    // 실패 토큰 정리
    const failed = []
    res.responses.forEach((r, i) => { if (!r.success) failed.push(tokens[i]) })
    if (failed.length > 0) {
      const batch = db.batch()
      const stale = await db.collection('fcm_tokens')
        .where('token', 'in', failed)
        .get()
      stale.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  }
)

// ── 만료 이벤트 자동 삭제 — 매일 자정 KST ─────────────────────
exports.cleanupExpiredEvents = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'Asia/Seoul' },
  async () => {
    const now  = new Date()
    const snap = await db.collectionGroup('flight_events')
      .where('expireAt', '<', now)
      .get()

    if (snap.empty) {
      console.log('[Cleanup] 삭제할 만료 이벤트 없음')
      return
    }

    // Firestore batch 최대 500건
    const BATCH_SIZE = 500
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch()
      snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }

    console.log(`[Cleanup] 만료 이벤트 ${snap.size}건 삭제 완료`)
  }
)
