import { useState, useEffect, useRef } from 'react'

const GOOGLE_MAPS_KEY = 'AIzaSyAi9KTkybz2bDXoZbbHWHzMpzylOL6N_dg'

function useGoogleMaps() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (window.google?.maps) { setReady(true); return }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&language=ko`
    script.async = true
    script.onload = () => setReady(true)
    document.head.appendChild(script)
  }, [])
  return ready
}

export default function WaypointMap({ initialPos, onConfirm, onClose, title }) {
  const mapRef      = useRef(null)
  const googleRef   = useRef(null)
  const markerRef   = useRef(null)
  const googleReady = useGoogleMaps()

  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching,     setSearching]     = useState(false)
  const [showResults,   setShowResults]   = useState(false)
  const [selectedPos,   setSelectedPos]   = useState(initialPos ?? null)

  useEffect(() => {
    if (!googleReady || !mapRef.current || googleRef.current) return

    const center = initialPos
      ? { lat: initialPos.lat, lng: initialPos.lon }
      : { lat: 37.4563, lng: 126.7052 }

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 13,
      mapTypeId: 'hybrid',
      mapTypeControl: false,
      gestureHandling: 'greedy',
      scrollwheel: true,
      streetViewControl: false,
      fullscreenControl: false,
    })

    if (initialPos) {
      const marker = new window.google.maps.Marker({
        position: center,
        map,
        draggable: true,
      })
      marker.addListener('dragend', () => {
        const pos = marker.getPosition()
        setSelectedPos({ lat: pos.lat(), lon: pos.lng() })
      })
      markerRef.current = marker
    }

    map.addListener('click', (e) => {
      const lat = e.latLng.lat()
      const lon = e.latLng.lng()
      if (markerRef.current) {
        markerRef.current.setPosition(e.latLng)
      } else {
        const marker = new window.google.maps.Marker({
          position: e.latLng,
          map,
          draggable: true,
        })
        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          setSelectedPos({ lat: pos.lat(), lon: pos.lng() })
        })
        markerRef.current = marker
      }
      setSelectedPos({ lat, lon })
      setShowResults(false)
    })

    googleRef.current = map
  }, [googleReady])

  function doSearch() {
    if (!searchQuery.trim() || !googleReady) return
    setSearching(true)
    setShowResults(false)

    const service = new window.google.maps.places.PlacesService(googleRef.current)
    service.textSearch(
      { query: searchQuery, region: 'kr' },
      (results, status) => {
        setSearching(false)
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
          setSearchResults(results.slice(0, 5))
          setShowResults(true)
        } else {
          setSearchResults([])
          setShowResults(false)
          alert('검색 결과가 없습니다.')
        }
      }
    )
  }

  function selectResult(place) {
    const lat  = place.geometry.location.lat()
    const lon  = place.geometry.location.lng()
    const name = place.name

    setSelectedPos({ lat, lon, name })
    setShowResults(false)
    setSearchQuery(name)

    if (!googleRef.current) return
    googleRef.current.setCenter({ lat, lng: lon })
    googleRef.current.setZoom(16)

    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng: lon })
    } else {
      const marker = new window.google.maps.Marker({
        position: { lat, lng: lon },
        map: googleRef.current,
        draggable: true,
      })
      marker.addListener('dragend', () => {
        const pos = marker.getPosition()
        setSelectedPos({ lat: pos.lat(), lon: pos.lng() })
      })
      markerRef.current = marker
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#0f172a' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1e293b', borderBottom: '1px solid #334155', flexShrink: 0 }}>
        <button onClick={onClose} style={{ color: '#94a3b8', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{title}</span>
      </div>

      <div style={{ padding: '8px 16px', background: '#1e293b', flexShrink: 0, position: 'relative', zIndex: 10000 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(false) }}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="장소 검색 (예: 인천 헬기장)"
            style={{
              flex: 1, padding: '10px 14px', fontSize: 14,
              background: '#334155', color: '#fff', borderRadius: 8,
              border: '1px solid #475569', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={doSearch}
            disabled={searching}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 600,
              background: searching ? '#334155' : '#3b82f6',
              color: '#fff', borderRadius: 8, border: 'none',
              cursor: searching ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {searching ? '검색 중' : '검색'}
          </button>
        </div>

        {showResults && searchResults.length > 0 && (
          <div style={{
            position: 'absolute', left: 16, right: 16, top: '100%', marginTop: 4,
            background: '#1e293b', border: '1px solid #475569', borderRadius: 8,
            zIndex: 10001, maxHeight: 260, overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          }}>
            {searchResults.map((place, i) => (
              <button
                key={i}
                onClick={() => selectResult(place)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: 'none', border: 'none',
                  borderBottom: i < searchResults.length - 1 ? '1px solid #334155' : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{place.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{place.formatted_address}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={mapRef} style={{ flex: 1 }} />

      <div style={{ padding: '12px 16px', background: '#1e293b', borderTop: '1px solid #334155', flexShrink: 0 }}>
        {selectedPos ? (
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 8 }}>
            {selectedPos.name ? `📍 ${selectedPos.name}` : `위도 ${selectedPos.lat.toFixed(5)} / 경도 ${selectedPos.lon.toFixed(5)}`}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 8 }}>
            지도를 탭하거나 검색으로 지점을 선택하세요
          </p>
        )}
        <button
          onClick={() => selectedPos && onConfirm(selectedPos)}
          disabled={!selectedPos}
          style={{
            width: '100%', padding: '10px', borderRadius: 8, fontSize: 14,
            fontWeight: 600, border: 'none',
            cursor: selectedPos ? 'pointer' : 'not-allowed',
            background: selectedPos ? '#2563eb' : '#334155',
            color: selectedPos ? '#fff' : '#64748b',
          }}
        >
          이 위치로 설정
        </button>
      </div>
    </div>
  )
}
