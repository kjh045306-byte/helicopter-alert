// Haversine formula — 두 GPS 좌표 간 거리(km)
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R    = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function deg2rad(deg) {
  return deg * (Math.PI / 180)
}

// 착륙장 목록에서 반경 이내 가장 가까운 곳 반환
export function findNearestZone(lat, lon, zones, radiusKm = 5) {
  let nearest = null
  let minDist = Infinity
  for (const zone of zones) {
    const d = distanceKm(lat, lon, zone.lat, zone.lon)
    if (d < radiusKm && d < minDist) {
      minDist = d
      nearest = { ...zone, distanceKm: d }
    }
  }
  return nearest
}

// 운항 지점 반경 체크 — 등록된 지점이 없으면 true(통과)
export function isNearFlightPoint(lat, lon, flightPoints) {
  if (!flightPoints) return true

  // 24시간 만료 체크
  if (flightPoints.expiresAt && Date.now() > flightPoints.expiresAt) return true

  const { takeoff, waypoints = [], landing, radiusKm = 1 } = flightPoints

  // 등록된 지점이 하나도 없으면 통과
  const allPoints = [takeoff, ...waypoints, landing].filter(Boolean)
  if (allPoints.length === 0) return true

  // 하나라도 반경 내에 있으면 통과
  return allPoints.some(
    (p) => distanceKm(lat, lon, p.lat, p.lon) <= radiusKm
  )
}
