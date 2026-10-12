import { getFunctions, httpsCallable } from 'firebase/functions'
import { getFirebaseApp } from './firebaseService.js'

// Callable wrappers for the admin functions in functions/index.js (region: asia-northeast3)

let functionsInstance

function call(name, data) {
  if (!functionsInstance) {
    functionsInstance = getFunctions(getFirebaseApp(), 'asia-northeast3')
  }
  return httpsCallable(functionsInstance, name)(data).then((res) => res.data)
}

// 서버가 한글 메시지를 내려주는 오류 코드만 그대로 노출하고, 나머지는 일반 문구로 대체한다.
const SERVER_MESSAGE_CODES = new Set([
  'functions/permission-denied',
  'functions/invalid-argument',
  'functions/already-exists',
  'functions/failed-precondition',
  'functions/unauthenticated',
])

export function toUserMessage(err) {
  if (SERVER_MESSAGE_CODES.has(err?.code) && err.message) return err.message
  if (err?.code === 'functions/unavailable' || err?.code === 'functions/deadline-exceeded') {
    return '서버에 연결할 수 없습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.'
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

export async function listAccounts() {
  const data = await call('adminListAccounts')
  return data.accounts
}

export function createAccount({ email, password, role }) {
  return call('adminCreateAccount', { email, password, role })
}

export function setAccountRole(uid, role) {
  return call('adminSetRole', { uid, role })
}

export function setAccountDisabled(uid, disabled) {
  return call('adminSetDisabled', { uid, disabled })
}

export function resetAccountPassword(uid, newPassword) {
  return call('adminResetPassword', { uid, newPassword })
}

export function deleteAccount(uid) {
  return call('adminDeleteAccount', { uid })
}
