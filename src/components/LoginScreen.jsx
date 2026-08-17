import { useState } from 'react'
import { signInWithEmail } from '../services/firebaseService.js'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      await signInWithEmail(email.trim().toLowerCase(), password)
    } catch (err) {
      console.error('[Login]', err.code, err.message)
      const msg = err.code === 'auth/invalid-credential' ||
                  err.code === 'auth/user-not-found' ||
                  err.code === 'auth/wrong-password'
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : '로그인 중 오류가 발생했습니다. 다시 시도해주세요.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: '#0a0a0a', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ marginBottom: 44, textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', background: '#f37321',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px', boxShadow: '0 0 32px rgba(243,115,33,0.45), 0 0 8px rgba(243,115,33,0.3)',
        }}>
          <div style={{
            width: 58, height: 58, borderRadius: '50%', background: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, lineHeight: 1,
          }}>🚁</div>
        </div>
        <div style={{ display: 'inline-block', position: 'relative' }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: '#ffffff', letterSpacing: '-1px' }}>
            HeliAlert
          </span>
          <div style={{
            position: 'absolute', bottom: -4, left: 0, right: 0, height: 3, borderRadius: 2,
            background: 'linear-gradient(to right, #ef4444, #f37321)',
          }} />
        </div>
        <p style={{ marginTop: 14, color: '#6b7280', fontSize: 13, letterSpacing: '0.5px' }}>
          Helicopter Landing Alert System
        </p>
      </div>

      <div style={{
        width: '100%', maxWidth: 380, background: '#161616', borderRadius: 18,
        padding: '32px 28px', border: '1px solid #262626', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{
              display: 'block', color: '#9ca3af', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8,
            }}>이메일</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="example@sk.com" autoComplete="email" required
              style={{
                width: '100%', boxSizing: 'border-box', padding: '13px 15px', borderRadius: 10,
                border: '1.5px solid #2a2a2a', background: '#0f0f0f', color: '#f5f5f5',
                fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#f37321' }}
              onBlur={(e) => { e.target.style.borderColor = '#2a2a2a' }}
            />
          </div>
          <div>
            <label style={{
              display: 'block', color: '#9ca3af', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8,
            }}>비밀번호</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력" autoComplete="current-password" required
              style={{
                width: '100%', boxSizing: 'border-box', padding: '13px 15px', borderRadius: 10,
                border: '1.5px solid #2a2a2a', background: '#0f0f0f', color: '#f5f5f5',
                fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#f37321' }}
              onBlur={(e) => { e.target.style.borderColor = '#2a2a2a' }}
            />
          </div>
          {error && (
            <div style={{
              padding: '11px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠️</span><span>{error}</span>
            </div>
          )}
          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, width: '100%', padding: '15px', borderRadius: 11, border: 'none',
              background: loading ? '#555' : 'linear-gradient(135deg, #f37321, #e55c00)',
              color: '#ffffff', fontSize: 16, fontWeight: 700, letterSpacing: '0.3px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(243,115,33,0.35)',
              transition: 'all 0.2s', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 32, color: '#4b5563', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
        계정 문의는 관리자에게 연락해주세요
      </p>
    </div>
  )
}
