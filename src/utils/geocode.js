// ============================================================
//  역지오코딩 — OpenStreetMap Nominatim API
//  정책: 1 req/s 이하, 브라우저 User-Agent 자동 첨부
// ============================================================

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse'

// Nominatim address 객체 → 한국어 지명 문자열
function formatAddress(addr) {
  const seen  = new Set()
  const parts = []

  function add(v) {
    if (v && !seen.has(v)) { seen.add(v); parts.push(v) }
  }

  // 시/도
  add(addr.state)

  // 시/군 (state와 중복이면 자동 제외됨)
  add(addr.city || addr.county || addr.town || addr.municipality)

  // 구 (city_district: 분당구, 강남구 등)
  add(addr.city_district || addr.borough)

  // 동/읍/면/리
  add(addr.suburb || addr.quarter || addr.neighbourhood || addr.village || addr.hamlet)

  return parts.join(' ') || null
}

function fallback(lat, lon) {
  return `위도 ${Number(lat).toFixed(4)} 경도 ${Number(lon).toFixed(4)}`
}

export async function reverseGeocode(lat, lon) {
  try {
    const url = `${NOMINATIM}?lat=${lat}&lon=${lon}&format=json`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'ko' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    return formatAddress(data.address ?? {}) ?? fallback(lat, lon)
  } catch (e) {
    console.warn('[Geocode] 변환 실패:', e.message)
    return fallback(lat, lon)
  }
}
