const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule }         = require('firebase-functions/v2/scheduler')
const { setGlobalOptions }   = require('firebase-functions/v2')
const logger                 = require('firebase-functions/logger')
const { initializeApp }      = require('firebase-admin/app')
const { getAuth }            = require('firebase-admin/auth')
const { getFirestore }       = require('firebase-admin/firestore')

initializeApp()
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 5 })
const db   = getFirestore()
const auth = getAuth()

const ROLES = ['admin', 'pilot', 'crew']

function requireAdmin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.')
  if (request.auth.token.role !== 'admin') throw new HttpsError('permission-denied', '관리자만 사용할 수 있습니다.')
}
function checkUid(uid) {
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', '대상 계정이 올바르지 않습니다.')
}
function checkRole(role) {
  if (!ROLES.includes(role)) throw new HttpsError('invalid-argument', '올바르지 않은 역할입니다.')
}
function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 6) throw new HttpsError('invalid-argument', '비밀번호는 6자 이상이어야 합니다.')
}
function notSelf(request, uid) {
  if (request.auth.uid === uid) throw new HttpsError('failed-precondition', '본인 계정은 변경할 수 없습니다.')
}
function toAccount(u) {
  return {
    uid:          u.uid,
    email:        u.email ?? '',
    role:         u.customClaims?.role ?? 'crew',
    disabled:     u.disabled,
    createdAt:    u.metadata.creationTime,
    lastSignInAt: u.metadata.lastSignInTime ?? null,
    lastRefreshAt: u.metadata.lastRefreshTime ?? null,
  }
}
// 정지·삭제·역할 해제 시 해당 계정이 잡고 있던 GPS 잠금 해제
async function releaseGpsSession(uid) {
  const ref  = db.doc('heli_status/gps_session')
  const snap = await ref.get()
  if (snap.exists && snap.data().uid === uid) await ref.delete()
}

exports.adminListAccounts = onCall(async (request) => {
  requireAdmin(request)
  const accounts = []
  let pageToken
  do {
    const res = await auth.listUsers(1000, pageToken)
    accounts.push(...res.users.map(toAccount))
    pageToken = res.pageToken
  } while (pageToken)
  accounts.sort((a, b) => a.email.localeCompare(b.email))
  return { accounts }
})

exports.adminCreateAccount = onCall(async (request) => {
  requireAdmin(request)
  const email = String(request.data?.email ?? '').trim().toLowerCase()
  const { password, role } = request.data ?? {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', '이메일 형식이 올바르지 않습니다.')
  checkPassword(password)
  checkRole(role)
  try {
    const user = await auth.createUser({ email, password })
    await auth.setCustomUserClaims(user.uid, { role })
    logger.info('[admin] createAccount', { by: request.auth.token.email, target: email, role })
    return { uid: user.uid }
  } catch (e) {
    if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', '이미 등록된 이메일입니다.')
    logger.error('[admin] createAccount 실패', e.code)
    throw new HttpsError('internal', '계정을 만들지 못했습니다.')
  }
})

exports.adminSetRole = onCall(async (request) => {
  requireAdmin(request)
  const { uid, role } = request.data ?? {}
  checkUid(uid); checkRole(role); notSelf(request, uid)
  await auth.setCustomUserClaims(uid, { role })
  if (role !== 'pilot') await releaseGpsSession(uid)
  logger.info('[admin] setRole', { by: request.auth.token.email, target: uid, role })
  return { ok: true }
})

exports.adminSetDisabled = onCall(async (request) => {
  requireAdmin(request)
  const { uid, disabled } = request.data ?? {}
  checkUid(uid); notSelf(request, uid)
  if (typeof disabled !== 'boolean') throw new HttpsError('invalid-argument', '상태 값이 올바르지 않습니다.')
  await auth.updateUser(uid, { disabled })
  if (disabled) {
    await auth.revokeRefreshTokens(uid)
    await releaseGpsSession(uid)
  }
  logger.info('[admin] setDisabled', { by: request.auth.token.email, target: uid, disabled })
  return { ok: true }
})

exports.adminResetPassword = onCall(async (request) => {
  requireAdmin(request)
  const { uid, newPassword } = request.data ?? {}
  checkUid(uid); notSelf(request, uid); checkPassword(newPassword)
  await auth.updateUser(uid, { password: newPassword })
  await auth.revokeRefreshTokens(uid)
  logger.info('[admin] resetPassword', { by: request.auth.token.email, target: uid })
  return { ok: true }
})

exports.adminDeleteAccount = onCall(async (request) => {
  requireAdmin(request)
  const { uid } = request.data ?? {}
  checkUid(uid); notSelf(request, uid)
  await releaseGpsSession(uid)
  const tokens = await db.collection('fcm_tokens').where('uid', '==', uid).get()
  if (!tokens.empty) {
    const batch = db.batch()
    tokens.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  await auth.deleteUser(uid)
  logger.info('[admin] deleteAccount', { by: request.auth.token.email, target: uid })
  return { ok: true }
})

// 만료 이벤트 자동 삭제 — 매일 자정 KST
exports.cleanupExpiredEvents = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'Asia/Seoul' },
  async () => {
    const snap = await db.collection('flight_events')
      .where('expireAt', '<', new Date())
      .get()
    if (snap.empty) {
      logger.info('[Cleanup] 삭제할 만료 이벤트 없음')
      return
    }
    const BATCH_SIZE = 500
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch()
      snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
    logger.info(`[Cleanup] 만료 이벤트 ${snap.size}건 삭제 완료`)
  }
)
