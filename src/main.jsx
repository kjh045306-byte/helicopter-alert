import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Service Worker 등록 (PWA 캐싱 + FCM 백그라운드 메시지)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((reg) => console.log('[SW] 등록 완료:', reg.scope))
      .catch((err) => console.warn('[SW] 등록 실패:', err))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
