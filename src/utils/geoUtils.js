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
