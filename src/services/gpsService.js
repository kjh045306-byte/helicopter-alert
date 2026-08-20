// ============================================================
//  GPS 서비스 — Geolocation API 래퍼
//  확정 세팅값:
//    안정화 대기    : 3 s
//    GPS 만료 기준  : 10 s
//    GPS 정확도 한계: 100 m
//    정확도 미달 시 강제 진행: 15 s
// ============================================================

const GPS_STABILIZE_MS  = 3_000
const GPS_MAX_AGE_MS    = 10_000
const GPS_MAX_ACCURACY  = 100      // metres
const GPS_FALLBACK_MS   = 15_000   // 정확도 기준 미달이어도 이 시간 넘으면 강제 진행

export class GPSService {
  #watchId        = null
  #listeners      = new Set()
  #lastPosition   = null
  #stabilizeTimer = null
  #isStabilized   = false
  #startTime      = null
  #bestFallback   = null

  subscribe(cb) {
    this.#listeners.add(cb)
    return () => this.#listeners.delete(cb)
  }

  start() {
    if (!('geolocation' in navigator)) {
      console.error('[GPS] Geolocation API 미지원')
      return false
    }
    if (this.#watchId !== null) return true

    this.#startTime = Date.now()

    this.#watchId = navigator.geolocation.watchPosition(
      (pos) => this.#handlePosition(pos),
      (err) => this.#handleError(err),
      {
        enableHighAccuracy: true,
        timeout:            GPS_MAX_AGE_MS,
        maximumAge:         1_000,
      }
    )
    return true
  }

  stop() {
    if (this.#watchId !== null) {
      navigator.geolocation.clearWatch(this.#watchId)
      this.#watchId = null
    }
    clearTimeout(this.#stabilizeTimer)
    this.#stabilizeTimer = null
    this.#isStabilized   = false
    this.#lastPosition   = null
    this.#startTime      = null
    this.#bestFallback   = null
  }

  get lastPosition() {
    return this.#lastPosition
  }

  // ── 내부 ────────────────────────────────────────────────────
  #handlePosition(pos) {
    const { latitude, longitude, accuracy, speed } = pos.coords
    const ageMs = Date.now() - pos.timestamp

    if (ageMs > GPS_MAX_AGE_MS) return   // 오래된 좌표

    const normalized = {
      lat:       latitude,
      lon:       longitude,
      accuracy,
      speedMs:   speed ?? 0,
      speedKmh:  (speed ?? 0) * 3.6,
      timestamp: pos.timestamp,
      ageMs,
    }

    if (accuracy > GPS_MAX_ACCURACY) {
      // 정확도 기준 미달 — 그래도 폴백용으로 최선의 좌표는 보관
      if (!this.#bestFallback || accuracy < this.#bestFallback.accuracy) {
        this.#bestFallback = normalized
      }
      // 15초 넘게 기준 미달이 지속되면 폴백 좌표로 강제 진행 (무한 대기 방지)
      if (
        !this.#isStabilized &&
        this.#startTime &&
        Date.now() - this.#startTime >= GPS_FALLBACK_MS
      ) {
        this.#isStabilized = true
        this.#lastPosition = this.#bestFallback
        this.#emit(this.#bestFallback)
      }
      return
    }

    if (!this.#isStabilized) {
      if (!this.#stabilizeTimer) {
        this.#stabilizeTimer = setTimeout(() => {
          this.#isStabilized = true
          this.#lastPosition = normalized
          this.#emit(normalized)
        }, GPS_STABILIZE_MS)
      }
      return
    }

    this.#lastPosition = normalized
    this.#emit(normalized)
  }

  #handleError(err) {
    console.warn('[GPS] 오류:', err.message)
    this.#emit(null)
  }

  #emit(data) {
    this.#listeners.forEach((cb) => cb(data))
  }
}

export const gpsService = new GPSService()
