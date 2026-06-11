import { useEffect } from 'react'
import { flightMachine, FlightState } from '../services/stateMachine.js'
import { handleFlightEvent } from '../services/notificationService.js'
import { useStore } from '../store.js'

export function useFlightState() {
  const setFlightState = useStore((s) => s.setFlightState)
  const addEvent       = useStore((s) => s.addEvent)

  useEffect(() => {
    const unsub = flightMachine.subscribe((event) => {
      if (event.type === 'stateChange') {
        setFlightState(event.state)
        return
      }

      // 이착륙 이벤트 발생
      const entry = {
        ...event,
        id:        crypto.randomUUID(),
        timestamp: event.timestamp ?? Date.now(),
      }
      addEvent(entry)
      handleFlightEvent(entry).catch(console.error)
    })

    return unsub
  }, [setFlightState, addEvent])
}
