// ============================================================
//  Service Worker — PWA 앱 셸 캐싱 + FCM 백그라운드 메시지
// ============================================================

const CACHE_NAME = 'heli-alert-v3'
const SHELL_URLS = ['/', '/index.html', '/helicopter.svg', '/manifest.json']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL_URLS).catch((err) => console.warn('[SW] 캐싱 일부 실패:', err))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = e.request.url
  if (
    url.includes('firebaseio.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('api.telegram.org')
  ) return

  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')))
    return
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const resClone = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

// ── FCM 백그라운드 메시지 ─────────────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyB8p6uYONP0SDRSLPwXGA88ZBXVRKQ62Hw',
  authDomain:        'helicopter-alert.firebaseapp.com',
  projectId:         'helicopter-alert',
  storageBucket:     'helicopter-alert.firebasestorage.app',
  messagingSenderId: '816812597780',
  appId:             '1:816812597780:web:4d46a16d26a026b8d2fd01',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {}
  self.registration.showNotification(title ?? '헬리콥터 알림', {
    body:    body ?? '',
    icon:    '/helicopter.svg',
    badge:   '/helicopter.svg',
    tag:     'heli-alert',
    vibrate: [200, 100, 200],
    data:    payload.data,
  })
})
