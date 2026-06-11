import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { firebaseConfig, FCM_VAPID_KEY } from '../config/firebase.js'

let app
let db
let auth
let messaging
let currentUid = null

// ── 앱 초기화 ──────────────────────────────────────────────────
export function initFirebase() {
  if (!firebaseConfig.apiKey) {
    console.warn('[Firebase] config/firebase.js 값이 비어있습니다.')
    return false
  }
  try {
    app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    db   = getFirestore(app)
    auth = getAuth(app)
    return true
  } catch (e) {
    console.error('[Firebase] 초기화 실패:', e)
    return false
  }
}

// ── 익명 인증 — 앱 시작 시 한 번 호출 ──────────────────────────
export async function initAuth() {
  if (!auth) return null
  try {
    const cred = await signInAnonymously(auth)
    currentUid = cred.user.uid
    console.log('[Auth] 익명 로그인 완료:', currentUid)
    return currentUid
  } catch (e) {
    console.warn('[Auth] 익명 로그인 실패:', e.message)
    return null
  }
}

export function getDeviceId() {
  return currentUid
}

// 이벤트 컬렉션 참조 — users/{uid}/flight_events
function eventsCol(uid) {
  return collection(db, 'users', uid, 'flight_events')
}

// ── 이벤트 저장 ────────────────────────────────────────────────
export async function saveEvent(eventData) {
  if (!db || !currentUid) throw new Error('Firestore 미초기화 또는 미인증')

  // 3일 후 만료 타임스탬프
  const expireAt = Timestamp.fromDate(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  )

  return addDoc(eventsCol(currentUid), {
    ...eventData,
    uid:       currentUid,
    deviceId:  currentUid,
    createdAt: serverTimestamp(),
    expireAt,
  })
}

// ── 만료 이벤트 삭제 (앱 시작 시 호출) ──────────────────────────
export async function deleteExpiredEvents() {
  if (!db || !currentUid) return

  const now  = Timestamp.now()
  const snap = await getDocs(
    query(eventsCol(currentUid), where('expireAt', '<', now))
  )

  await Promise.all(
    snap.docs.map((d) =>
      deleteDoc(doc(db, 'users', currentUid, 'flight_events', d.id))
    )
  )

  if (snap.size > 0) {
    console.log(`[Cleanup] 만료 이벤트 ${snap.size}건 삭제`)
  }
}

// ── 실시간 이벤트 구독 ─────────────────────────────────────────
export function subscribeRecentEvents(callback, count = 50) {
  if (!db || !currentUid) return () => {}

  const q = query(
    eventsCol(currentUid),
    orderBy('createdAt', 'desc'),
    limit(count)
  )
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )
}

// ── FCM 토큰 등록 ──────────────────────────────────────────────
export async function registerFCMToken(role) {
  if (!app) return null
  try {
    messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY })
    if (token) {
      await addDoc(collection(db, 'fcm_tokens'), {
        token,
        role,
        uid:       currentUid,
        createdAt: serverTimestamp(),
      })
    }
    return token
  } catch (e) {
    console.warn('[FCM] 토큰 등록 실패:', e.message)
    return null
  }
}

// ── 포어그라운드 FCM 수신 ───────────────────────────────────────
export function onForegroundMessage(callback) {
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
