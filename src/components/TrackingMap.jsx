import { useState, useEffect, useRef } from 'react'
import { subscribePosition, subscribePath } from '../services/firebaseService.js'

const GOOGLE_MAPS_KEY = 'AIzaSyAi9KTkybz2bDXoZbbHWHzMpzylOL6N_dg'

function useGoogleMaps() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (window.google?.maps) { setReady(true); return }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&language=ko`
    script.async = true
    script.onload = () => setReady(true)
    document.head.appendChild(script)
  }, [])
  return ready
}

export default function TrackingMap() {
  const mapRef      = useRef(null)
  const googleRef   = useRef(null)
  const markerRef   = useRef(null)
  const polylineRef = useRef(null)
  const googleReady = useGoogleMaps()

  const [position,    setPosition]    = useState(null)
  const [path,        setPath]        = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)

  // Firestore 실시간 구독
  useEffect(() => {
    const unsubPos  = subscribePosition((pos) => {
      setPosition(pos)
      if (pos) setLastUpdated(new Date())
    })
    const unsubPath = subscribePath((pts) => setPath(pts))
    return () => { unsubPos(); unsubPath() }
  }, [])

  // 지도 초기화
  useEffect(() => {
    if (!googleReady || !mapRef.current || googleRef.current) return

    const map = new window.google.maps.Map(mapRef.current, {
      center:            { lat: 37.4563, lng: 126.7052 },
      zoom:              10,
      mapTypeId:         'hybrid',
      mapTypeControl:    false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi',            elementType: 'all',    stylers: [{ visibility: 'off' }] },
        { featureType: 'poi.park',       elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit',        elementType: 'all',    stylers: [{ visibility: 'off' }] },
        { featureType: 'road',           elementType: 'labels', stylers: [{ visibility: 'on'  }] },
        { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'on'  }] },
      ],
    })

    // 헬기 마커
    const heliIcon = {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="22" fill="#1d4ed8" stroke="#93c5fd" stroke-width="2"/>
      <text x="24" y="32" text-anchor="middle" font-size="24">🚁</text>
    </svg>
  `),
      scaledSize: new window.google.maps.Size(48, 48),
      anchor:     new window.google.maps.Point(24, 24),
    }

    markerRef.current = new window.google.maps.Marker({
      map,
      visible: false,
      title:   '헬기 현재 위치',
      icon:    heliIcon,
    })

    // 경로 선
    polylineRef.current = new window.google.maps.Polyline({
      map,
      strokeColor:   '#3b82f6',
      strokeOpacity: 0.8,
      strokeWeight:  3,
    })

    googleRef.current = map
  }, [googleReady])

  // 위치 업데이트 → 마커 이동
  useEffect(() => {
    if (!googleRef.current || !markerRef.current || !position) return
    const latlng = { lat: position.lat, lng: position.lon }
    markerRef.current.setPosition(latlng)
    markerRef.current.setVisible(true)
    googleRef.current.panTo(latlng)
  }, [position])

  // 경로 업데이트 → 폴리라인 갱신
  useEffect(() => {
    if (!polylineRef.current) return
    const coords = path.map((p) => ({ lat: p.lat, lng: p.lon }))
    polylineRef.current.setPath(coords)
  }, [path])

  // 마지막 수신 시간 표시
  function timeAgo() {
    if (!lastUpdated) return null
    const sec = Math.floor((Date.now() - lastUpdated) / 1000)
    if (sec < 10)  return '방금 전'
    if (sec < 60)  return `${sec}초 전`
    return `${Math.floor(sec / 60)}분 전`
  }

  return (
    <div className="space-y-3">
      {/* 상태 바 */}
      <div className="card py-3">
        {position ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
              <span className="text-sm text-blue-300 font-semibold">비행 중</span>
              <span className="text-xs text-slate-500">{position.speedKmh?.toFixed(0)} km/h</span>
            </div>
            <span className="text-xs text-slate-500">수신 {timeAgo()}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
            <span className="text-sm text-slate-500">대기 중 — 조종사 감지 시작 후 표시됩니다</span>
          </div>
        )}
      </div>

      {/* 지도 */}
      <div
        ref={mapRef}
        style={{ height: '60vh', borderRadius: 12, overflow: 'hidden', border: '1px solid #334155' }}
      />

      {/* 경로 정보 */}
      {path.length > 0 && (
        <div className="card py-2 px-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">경로 포인트</span>
          <span className="text-xs text-slate-300 font-medium">{path.length}개</span>
        </div>
      )}
    </div>
  )
}
