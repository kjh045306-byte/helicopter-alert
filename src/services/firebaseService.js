import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
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

function eventsCol(uid) {
  return collection(db, 'users', uid, 'flight_events')
}

export async function saveEvent(eventData) {
  if (!db || !currentUid) throw new Error('Firestore 미초기화 또는 미인증')
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
  if (snap.size > 0) console.log(`[Cleanup] 만료 이벤트 ${snap.size}건 삭제`)
}

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

// ── 실시간 위치 추적 ──────────────────────────────────────────

// 현재 위치 저장 (덮어쓰기)
export async function saveCurrentPosition(position) {
  if (!db || !currentUid) return
  try {
    await setDoc(doc(db, 'tracking', 'position'), {
      lat:       position.lat,
      lon:       position.lon,
      speedKmh:  position.speedKmh,
      accuracy:  position.accuracy,
      uid:       currentUid,
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    console.warn('[Tracking] 위치 저장 실패:', e.message)
  }
}

// 경로 포인트 추가
export async function saveTrackingPoint(position) {
  if (!db || !currentUid) return
  try {
    const expireAt = Timestamp.fromDate(
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    )
    await addDoc(collection(db, 'tracking', 'current', 'path'), {
      lat:       position.lat,
      lon:       position.lon,
      speedKmh:  position.speedKmh,
      uid:       currentUid,
      createdAt: serverTimestamp(),
      expireAt,
    })
  } catch (e) {
    console.warn('[Tracking] 경로 저장 실패:', e.message)
  }
}

// 이전 경로 전체 삭제 (감지 시작 시 호출)
export async function clearTrackingPath() {
  if (!db) return
  try {
    const snap = await getDocs(collection(db, 'tracking', 'current', 'path'))
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    console.log(`[Tracking] 이전 경로 ${snap.size}건 삭제`)
  } catch (e) {
    console.warn('[Tracking] 경로 삭제 실패:', e.message)
  }
}

// 현재 위치 실시간 구독
export function subscribePosition(callback) {
  if (!db) return () => {}
  return onSnapshot(doc(db, 'tracking', 'position'), (snap) => {
    if (snap.exists()) callback(snap.data())
    else callback(null)
  })
}

// 경로 실시간 구독
export function subscribePath(callback) {
  if (!db) return () => {}
  const q = query(
    collection(db, 'tracking', 'current', 'path'),
    where('expireAt', '>', Timestamp.now()),
    orderBy('expireAt', 'asc')
  )
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => d.data()))
  )
}

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

export function onForegroundMessage(callback) {
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
