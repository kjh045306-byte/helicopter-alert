// ============================================================
//  이착륙 상태 머신
//
//  상태:   IDLE → TAKING_OFF → AIRBORNE → LANDING → IDLE
//
//  확정 세팅값:
//    이륙 감지  : 25 km/h 이상 5 s 유지
//    착륙 감지  : 15 km/h 미만 20 s 유지
//    이벤트 간격: 90 s
// ============================================================

export const FlightState = Object.freeze({
  IDLE:       'IDLE',
  TAKING_OFF: 'TAKING_OFF',
  AIRBORNE:   'AIRBORNE',
  LANDING:    'LANDING',
})

const TAKEOFF_SPEED_KMH  = 25
const TAKEOFF_HOLD_MS    = 5_000
const LANDING_SPEED_KMH  = 15
const LANDING_HOLD_MS    = 20_000
const MIN_EVENT_INTERVAL = 90_000

export class FlightStateMachine {
  #state         = FlightState.IDLE
  #holdTimer     = null
  #holdStart     = null
  #holdPausedAt  = null   // GPS 끊김 시 일시정지 시각
  #holdElapsed   = 0      // 일시정지 전까지 경과한 시간(ms)
  #lastEventAt   = 0
  #listeners     = new Set()
  #gpsLost       = false  // GPS 끊김 여부
  #lastKnownPos  = null   // 마지막으로 수신한 위치 (GPS 유실 후 착륙 처리에 사용)

  get state() { return this.#state }

  update(position) {
    if (!position) return

    // GPS 복구 감지 — AIRBORNE 중 끊겼다가 돌아온 경우
    if (this.#gpsLost) {
      this.#gpsLost = false
      if (this.#state === FlightState.AIRBORNE || this.#state === FlightState.LANDING) {
        this.#resumeLandingTimer()
      }
    }

    const { speedKmh, lat, lon, accuracy, timestamp } = position

    switch (this.#state) {
      case FlightState.IDLE:
        if (speedKmh >= TAKEOFF_SPEED_KMH) {
          this.#startHold(() => this.#doTakeoff({ lat, lon, accuracy, speedKmh, timestamp }))
        } else {
          this.#clearHold()
        }
        break

      case FlightState.TAKING_OFF:
        if (speedKmh < TAKEOFF_SPEED_KMH) {
          this.#clearHold()
          this.#transition(FlightState.IDLE)
        }
        break

      case FlightState.AIRBORNE:
        if (speedKmh < LANDING_SPEED_KMH) {
          this.#startHold(() => this.#doLanding({ lat, lon, accuracy, speedKmh, timestamp }))
        } else {
          this.#clearHold()
        }
        break

      case FlightState.LANDING:
        if (speedKmh >= LANDING_SPEED_KMH) {
          this.#clearHold()
          this.#transition(FlightState.AIRBORNE)
        }
        break
    }
  }

  subscribe(cb) {
    this.#listeners.add(cb)
    return () => this.#listeners.delete(cb)
  }

  // GPS 끊김 알림 — useGPS.js에서 호출
  notifyGpsLost() {
    if (this.#gpsLost) return
    this.#gpsLost = true

    // 비행 중일 때만 타이머 일시정지
    if (
      this.#state === FlightState.AIRBORNE ||
      this.#state === FlightState.LANDING
    ) {
      this.#pauseLandingTimer()
      console.log('[StateMachine] GPS 끊김 — 착륙 타이머 일시정지')
    } else {
      // 지상(IDLE/TAKING_OFF)에서 끊기면 기존대로 리셋
      this.reset()
    }
  }

  reset() {
    this.#clearHold()
    this.#holdElapsed  = 0
    this.#holdPausedAt = null
    this.#gpsLost      = false
    this.#transition(FlightState.IDLE)
  }

  // ── 내부 ──────────────────────────────────────────────────

  #pauseLandingTimer() {
    if (this.#holdTimer === null) return
    clearTimeout(this.#holdTimer)
    this.#holdTimer    = null
    this.#holdPausedAt = Date.now()
    // 지금까지 경과한 시간 누적
    if (this.#holdStart !== null) {
      this.#holdElapsed += Date.now() - this.#holdStart
    }
    this.#holdStart = null
  }

  #resumeLandingTimer() {
    // 일시정지 상태가 아니면 무시
    if (this.#holdPausedAt === null) return

    const remaining = LANDING_HOLD_MS - this.#holdElapsed
    this.#holdPausedAt = null
    this.#holdStart    = Date.now()

    console.log(`[StateMachine] GPS 복구 — 착륙 타이머 재개 (잔여 ${remaining}ms)`)

    if (remaining <= 0) {
      // 이미 충분히 기다렸으면 즉시 착륙 처리
      this.#holdTimer = setTimeout(() => {
        this.#holdTimer = null
        this.#fireLanding()
      }, 0)
      return
    }

    this.#holdTimer = setTimeout(() => {
      this.#holdTimer = null
      this.#fireLanding()
    }, remaining)
  }

  #fireLanding() {
    const pos = this.#lastKnownPos
    const now = Date.now()
    if (now - this.#lastEventAt < MIN_EVENT_INTERVAL) {
      console.warn('[StateMachine] 이벤트 최소 간격 미달 — 무시')
      this.#holdElapsed = 0
      this.#transition(FlightState.AIRBORNE)
      return
    }
    this.#lastEventAt = now
    this.#holdElapsed = 0
    this.#doLanding(pos)
  }

  #startHold(callback) {
    if (this.#holdTimer !== null) return
    const duration = this.#state === FlightState.IDLE ? TAKEOFF_HOLD_MS : LANDING_HOLD_MS

    if (this.#state === FlightState.IDLE) {
      this.#transition(FlightState.TAKING_OFF)
    } else if (this.#state === FlightState.AIRBORNE) {
      this.#holdElapsed = 0   // 새 착륙 감지 시작 시 초기화
      this.#transition(FlightState.LANDING)
    }

    this.#holdStart = Date.now()
    this.#holdTimer = setTimeout(() => {
      this.#holdTimer = null
      const now = Date.now()
      if (now - this.#lastEventAt < MIN_EVENT_INTERVAL) {
        console.warn('[StateMachine] 이벤트 최소 간격 미달 — 무시')
        this.#transition(
          this.#state === FlightState.TAKING_OFF ? FlightState.IDLE : FlightState.AIRBORNE
        )
        return
      }
      this.#lastEventAt = now
      callback()
    }, duration)
  }

  #clearHold() {
    if (this.#holdTimer !== null) {
      clearTimeout(this.#holdTimer)
      this.#holdTimer    = null
      this.#holdStart    = null
      this.#holdElapsed  = 0
      this.#holdPausedAt = null
    }
  }

  #doTakeoff(data) {
    this.#lastKnownPos = data
    this.#transition(FlightState.AIRBORNE)
    this.#emit({ type: 'takeoff', ...data })
  }

  #doLanding(data) {
    this.#transition(FlightState.IDLE)
    this.#emit({ type: 'landing', ...data })
  }

  #transition(next) {
    if (this.#state === next) return
    this.#state = next
    this.#emit({ type: 'stateChange', state: next })
  }

  #emit(event) {
    this.#listeners.forEach((cb) => cb(event))
  }

  // 현재 홀드 진행률 (0~1), UI 프로그레스바용
  get holdProgress() {
    if (this.#holdPausedAt !== null) {
      // 일시정지 중 — 멈춘 시점의 진행률 유지
      return Math.min(this.#holdElapsed / LANDING_HOLD_MS, 1)
    }
    if (this.#holdTimer === null || this.#holdStart === null) return 0
    const duration = this.#state === FlightState.TAKING_OFF ? TAKEOFF_HOLD_MS : LANDING_HOLD_MS
    const elapsed  = this.#holdElapsed + (Date.now() - this.#holdStart)
    return Math.min(elapsed / duration, 1)
  }
}

export const flightMachine = new FlightStateMachine()
