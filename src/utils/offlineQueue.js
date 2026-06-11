const QUEUE_KEY = 'heli_offline_queue'

export function enqueue(item) {
  const queue = getQueue()
  queue.push({ ...item, queuedAt: Date.now() })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

export function dequeue() {
  const queue = getQueue()
  if (queue.length === 0) return null
  const [first, ...rest] = queue
  localStorage.setItem(QUEUE_KEY, JSON.stringify(rest))
  return first
}

// 온라인 복구 시 큐 전체를 처리하는 헬퍼
export async function flushQueue(handler) {
  const queue = getQueue()
  if (queue.length === 0) return 0
  let processed = 0
  for (const item of queue) {
    try {
      await handler(item)
      processed++
    } catch (e) {
      console.warn('[OfflineQueue] 재전송 실패:', e.message)
      break // 실패하면 중단 — 다음 복구 시 재시도
    }
  }
  if (processed === queue.length) {
    clearQueue()
  } else {
    // 성공한 것만 제거
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(processed)))
  }
  return processed
}
