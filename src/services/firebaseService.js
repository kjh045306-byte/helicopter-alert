import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
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
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { firebaseConfig, FCM_VAPID_KEY } from '../config/firebase.js'

let app
let db
let auth
let messaging

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

export function getDeviceId() {
  return auth?.currentUser?.uid ?? null
}

function eventsCol(uid) {
  return collection(db, 'users', uid, 'flight_events')
}

export async function saveEvent(eventData) {
  const uid = auth?.currentUser?.uid
  if (!db || !uid) throw new Error('Firestore 미초기화 또는 미인증')
  const expireAt = Timestamp.fromDate(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  )
  return addDoc(eventsCol(uid), {
    ...eventData,
    uid,
    deviceId:  uid,
    createdAt: serverTimestamp(),
    expireAt,
  })
}

export async function deleteExpiredEvents() {
  const uid = auth?.currentUser?.uid
  if (!db || !uid) return
  const now  = Timestamp.now()
  const snap = await getDocs(
    query(eventsCol(uid), where('expireAt', '<', now))
  )
  await Promise.all(
    snap.docs.map((d) =>
      deleteDoc(doc(db, 'users', uid, 'flight_events', d.id))
    )
  )
  if (snap.size > 0) console.log(`[Cleanup] 만료 이벤트 ${snap.size}건 삭제`)
}

export function subscribeRecentEvents(callback, count = 50) {
  const uid = auth?.currentUser?.uid
  if (!db || !uid) return () => {}
  const q = query(
    eventsCol(uid),
    orderBy('createdAt', 'desc'),
    limit(count)
  )
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )
}

// ── 실시간 위치 추적 ──────────────────────────────────────────

export async function saveCurrentPosition(position) {
  const uid = auth?.currentUser?.uid
  if (!db || !uid) return
  try {
    await setDoc(doc(db, 'tracking', 'position'), {
      lat:       position.lat,
      lon:       position.lon,
      speedKmh:  position.speedKmh,
      accuracy:  position.accuracy,
      uid,
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    console.warn('[Tracking] 위치 저장 실패:', e.message)
  }
}

export async function saveTrackingPoint(position) {
  const uid = auth?.currentUser?.uid
  if (!db || !uid) return
  try {
    const expireAt = Timestamp.fromDate(
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    )
    await addDoc(collection(db, 'tracking', 'current', 'path'), {
      lat:       position.lat,
      lon:       position.lon,
      speedKmh:  position.speedKmh,
      uid,
      createdAt: serverTimestamp(),
      expireAt,
    })
  } catch (e) {
    console.warn('[Tracking] 경로 저장 실패:', e.message)
  }
}

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

export function subscribePosition(callback) {
  if (!db) return () => {}
  return onSnapshot(doc(db, 'tracking', 'position'), (snap) => {
    if (snap.exists()) callback(snap.data())
    else callback(null)
  })
}

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
  const uid = auth?.currentUser?.uid
  if (!app) return null
  try {
    messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY })
    if (token) {
      await addDoc(collection(db, 'fcm_tokens'), {
        token,
        role,
        uid,
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

export async function setGpsSession(uid, email) {
  if (!db) return
  await setDoc(doc(db, 'heli_status', 'gps_session'), {
    uid,
    email,
    active:       true,
    startedAt:    serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  })
}

export async function refreshGpsSession(uid) {
  if (!db) return
  const ref  = doc(db, 'heli_status', 'gps_session')
  const snap = await getDoc(ref)
  if (snap.exists() && snap.data().uid === uid) {
    await setDoc(ref, { lastActiveAt: serverTimestamp() }, { merge: true })
  }
}

export async function clearGpsSession(uid) {
  if (!db) return
  const ref  = doc(db, 'heli_status', 'gps_session')
  const snap = await getDoc(ref)
  if (snap.exists() && snap.data().uid === uid) {
    await deleteDoc(ref)
  }
}

export function subscribeGpsSession(callback) {
  if (!db) return () => {}
  return onSnapshot(
    doc(db, 'heli_status', 'gps_session'),
    (snap) => callback(snap.exists() ? snap.data() : null),
  )
}

// ── 인증 ──────────────────────────────────────────────────────

const PILOT_EMAILS = new Set([
  'cds0440@sk.com',
  'jjk@sk.com',
  'juhwan_kim@sk.com',
])

export function getRoleByEmail(email) {
  return PILOT_EMAILS.has(email?.toLowerCase()) ? 'pilot' : 'crew'
}

export async function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signOutUser() {
  return signOut(auth)
}

export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser
  if (!user) throw new Error('로그인 상태가 아닙니다.')
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await fbUpdatePassword(user, newPassword)
}

export function onAuthStateChange(callback) {
  if (!auth) return () => {}
  return onAuthStateChanged(auth, callback)
}

export function getCurrentUser() {
  return auth?.currentUser ?? null
}
