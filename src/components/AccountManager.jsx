import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../store.js'
import {
  listAccounts,
  createAccount,
  setAccountRole,
  setAccountDisabled,
  resetAccountPassword,
  deleteAccount,
  toUserMessage,
} from '../services/adminService.js'

const ROLES = ['admin', 'pilot', 'crew']

const ROLE_STYLE = {
  admin: 'bg-purple-900/50 text-purple-300 border-purple-700/60',
  pilot: 'bg-blue-900/50 text-blue-300 border-blue-700/60',
  crew:  'bg-slate-700/60 text-slate-300 border-slate-600',
}

const INPUT_CLS =
  'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200'

function formatLastAccess(account) {
  const raw = account.lastRefreshAt || account.lastSignInAt
  if (!raw) return '접속 기록 없음'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '접속 기록 없음'
  return d.toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function RoleBadge({ role }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_STYLE[role] ?? ROLE_STYLE.crew}`}>
      {role}
    </span>
  )
}

function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default function AccountManager({ onClose }) {
  const myUid = useStore((s) => s.currentUser?.uid)

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const [selected, setSelected] = useState(null)   // 액션 시트 대상
  const [dialog, setDialog]     = useState(null)   // { type: 'create'|'role'|'password'|'suspend'|'delete', account? }
  const [busy, setBusy]         = useState(false)
  const [actionError, setActionError] = useState('')

  // 입력 필드 (닫을 때 초기화)
  const [newEmail, setNewEmail]       = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole]         = useState('crew')
  const [resetPw, setResetPw]         = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setAccounts(await listAccounts())
    } catch (e) {
      setLoadError(toUserMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return accounts.filter((a) =>
      (roleFilter === 'all' || a.role === roleFilter) &&
      (!q || a.email.toLowerCase().includes(q))
    )
  }, [accounts, search, roleFilter])

  function closeDialog() {
    setDialog(null)
    setActionError('')
    setNewEmail(''); setNewPassword(''); setNewRole('crew'); setResetPw('')
  }

  function openAction(type) {
    setActionError('')
    setDialog({ type, account: selected })
    setSelected(null)
  }

  async function run(task) {
    setBusy(true)
    setActionError('')
    try {
      await task()
      closeDialog()
      await refresh()
    } catch (e) {
      setActionError(toUserMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function handleCreate() {
    const email = newEmail.trim()
    if (!email) return setActionError('이메일을 입력해 주세요.')
    if (newPassword.length < 6) return setActionError('임시 비밀번호는 6자 이상이어야 합니다.')
    run(() => createAccount({ email, password: newPassword, role: newRole }))
  }

  function handleResetPassword() {
    if (resetPw.length < 6) return setActionError('비밀번호는 6자 이상이어야 합니다.')
    run(() => resetAccountPassword(dialog.account.uid, resetPw))
  }

  const target = dialog?.account

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col max-w-md mx-auto">
      <header
        className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-lg px-1"
          aria-label="닫기"
        >←</button>
        <h2 className="font-bold text-sm flex-1">계정 관리</h2>
        <button
          onClick={() => { setActionError(''); setDialog({ type: 'create' }) }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-700 text-white"
        >+ 새 계정</button>
      </header>

      <div className="p-4 space-y-3 border-b border-slate-800">
        <input
          type="search"
          placeholder="이메일 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={INPUT_CLS}
        />
        <div className="flex gap-2">
          {['all', ...ROLES].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors
                ${roleFilter === r
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'border-slate-700 text-slate-400'}`}
            >{r === 'all' ? '전체' : r}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {!dialog && actionError && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
            {actionError}
          </p>
        )}
        {loading &&<p className="text-center text-sm text-slate-500 py-10">불러오는 중...</p>}

        {!loading && loadError && (
          <div className="card text-center space-y-3">
            <p className="text-sm text-red-400">{loadError}</p>
            <button onClick={refresh} className="px-4 py-2 text-sm rounded-lg bg-slate-700 text-slate-200">
              다시 시도
            </button>
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-10">
            {accounts.length === 0 ? '등록된 계정이 없습니다.' : '조건에 맞는 계정이 없습니다.'}
          </p>
        )}

        {!loading && !loadError && filtered.map((a) => {
          const isSelf = a.uid === myUid
          return (
            <button
              key={a.uid}
              disabled={isSelf}
              onClick={() => setSelected(a)}
              className={`card w-full text-left space-y-1.5 ${isSelf ? 'opacity-70' : 'active:scale-[0.99]'}`}
              style={{ touchAction: 'manipulation' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200 font-medium truncate flex-1">{a.email}</span>
                {isSelf && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/60">
                    본인
                  </span>
                )}
                <RoleBadge role={a.role} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={a.disabled ? 'text-red-400' : 'text-emerald-400'}>
                  ● {a.disabled ? '정지' : '활성'}
                </span>
                <span className="text-slate-500">{formatLastAccess(a)}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* 액션 시트 */}
      {selected && (
        <div className="fixed inset-0 z-[55] bg-black/60 flex items-end justify-center" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md bg-slate-800 rounded-t-2xl p-4 space-y-2"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-slate-400 text-center truncate pb-1">{selected.email}</p>
            <SheetButton onClick={() => openAction('role')}>🛡 역할 변경</SheetButton>
            <SheetButton onClick={() => openAction('password')}>🔑 비밀번호 초기화</SheetButton>
            {selected.disabled
              ? <SheetButton onClick={() => {
                  const uid = selected.uid
                  setSelected(null)
                  run(() => setAccountDisabled(uid, false))
                }}>✅ 계정 활성화</SheetButton>
              : <SheetButton onClick={() => openAction('suspend')}>⏸ 계정 정지</SheetButton>}
            <SheetButton danger onClick={() => openAction('delete')}>🗑 계정 삭제</SheetButton>
            <SheetButton onClick={() => setSelected(null)}>취소</SheetButton>
          </div>
        </div>
      )}

      {/* 새 계정 */}
      {dialog?.type === 'create' && (
        <Modal onClose={busy ? undefined : closeDialog}>
          <h3 className="text-sm font-semibold text-slate-200">새 계정</h3>
          <input
            type="email" placeholder="이메일" value={newEmail} autoComplete="off"
            onChange={(e) => setNewEmail(e.target.value)} className={INPUT_CLS}
          />
          <input
            type="password" placeholder="임시 비밀번호 (6자 이상)" value={newPassword} autoComplete="new-password"
            onChange={(e) => setNewPassword(e.target.value)} className={INPUT_CLS}
          />
          <RolePicker value={newRole} onChange={setNewRole} />
          <DialogFooter
            error={actionError} busy={busy} confirmLabel="만들기"
            onCancel={closeDialog} onConfirm={handleCreate}
          />
        </Modal>
      )}

      {/* 역할 변경 */}
      {dialog?.type === 'role' && target && (
        <Modal onClose={busy ? undefined : closeDialog}>
          <h3 className="text-sm font-semibold text-slate-200">역할 변경</h3>
          <p className="text-xs text-slate-400 break-all">{target.email}</p>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <button
                key={r}
                disabled={busy || r === target.role}
                onClick={() => run(() => setAccountRole(target.uid, r))}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm disabled:opacity-60
                  ${r === target.role ? 'border-blue-500 bg-slate-700/50' : 'border-slate-700'}`}
              >
                <RoleBadge role={r} />
                <span className="text-xs text-slate-500">{r === target.role ? '현재 역할' : ''}</span>
              </button>
            ))}
          </div>
          {actionError && <p className="text-xs text-red-400">{actionError}</p>}
          <button onClick={closeDialog} disabled={busy} className="w-full py-2 text-sm rounded-lg bg-slate-700 text-slate-300">
            닫기
          </button>
        </Modal>
      )}

      {/* 비밀번호 초기화 */}
      {dialog?.type === 'password' && target && (
        <Modal onClose={busy ? undefined : closeDialog}>
          <h3 className="text-sm font-semibold text-slate-200">비밀번호 초기화</h3>
          <p className="text-xs text-slate-400 break-all">{target.email}</p>
          <p className="text-xs text-amber-400">초기화하면 이 계정은 모든 기기에서 로그아웃됩니다.</p>
          <input
            type="password" placeholder="새 비밀번호 (6자 이상)" value={resetPw} autoComplete="new-password"
            onChange={(e) => setResetPw(e.target.value)} className={INPUT_CLS}
          />
          <DialogFooter
            error={actionError} busy={busy} confirmLabel="초기화"
            onCancel={closeDialog} onConfirm={handleResetPassword}
          />
        </Modal>
      )}

      {/* 정지 확인 */}
      {dialog?.type === 'suspend' && target && (
        <Modal onClose={busy ? undefined : closeDialog}>
          <h3 className="text-sm font-semibold text-slate-200">계정 정지</h3>
          <p className="text-sm text-slate-300 break-all">{target.email}</p>
          <p className="text-xs text-slate-400">
            정지하면 즉시 로그아웃되고 다시 로그인할 수 없습니다. 언제든 활성화할 수 있습니다.
          </p>
          <DialogFooter
            error={actionError} busy={busy} confirmLabel="정지" danger
            onCancel={closeDialog} onConfirm={() => run(() => setAccountDisabled(target.uid, true))}
          />
        </Modal>
      )}

      {/* 삭제 확인 */}
      {dialog?.type === 'delete' && target && (
        <Modal onClose={busy ? undefined : closeDialog}>
          <h3 className="text-sm font-semibold text-red-400">계정 삭제</h3>
          <p className="text-sm text-slate-200 break-all">{target.email}</p>
          <p className="text-xs text-slate-400">
            이 계정을 삭제하면 되돌릴 수 없습니다. 알림 토큰도 함께 삭제됩니다.
          </p>
          <DialogFooter
            error={actionError} busy={busy} confirmLabel="삭제" danger
            onCancel={closeDialog} onConfirm={() => run(() => deleteAccount(target.uid))}
          />
        </Modal>
      )}
    </div>
  )
}

function SheetButton({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full py-3 rounded-xl text-sm font-semibold
        ${danger ? 'bg-red-950/60 text-red-400 border border-red-900' : 'bg-slate-700 text-slate-200'}`}
      style={{ touchAction: 'manipulation' }}
    >{children}</button>
  )
}

function RolePicker({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`flex-1 py-2 text-xs rounded-lg border
            ${value === r ? 'border-blue-500 bg-slate-700/50 text-slate-100' : 'border-slate-700 text-slate-400'}`}
        >{r}</button>
      ))}
    </div>
  )
}

function DialogFooter({ error, busy, confirmLabel, danger, onCancel, onConfirm }) {
  return (
    <>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel} disabled={busy}
          className="flex-1 py-2 text-sm rounded-lg bg-slate-700 text-slate-300 disabled:opacity-50"
        >취소</button>
        <button
          onClick={onConfirm} disabled={busy}
          className={`flex-1 py-2 text-sm rounded-lg text-white disabled:opacity-50
            ${danger ? 'bg-red-700' : 'bg-blue-700'}`}
        >{busy ? '처리 중...' : confirmLabel}</button>
      </div>
    </>
  )
}
