import { saveHistory, loadHistory, deleteHistory } from "../lib/db"

const MAX_HISTORY = 100

const instanceHistories = new Map<string, string[]>()
const historyLoaded = new Set<string>()

export async function addToHistory(instanceId: string, text: string): Promise<void> {
  await ensureHistoryLoaded(instanceId)

  const history = instanceHistories.get(instanceId) || []

  history.unshift(text)

  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY
  }

  instanceHistories.set(instanceId, history)

  saveHistory(instanceId, history).catch((err) => {
    console.warn("Failed to persist message history:", err)
  })
}

export async function getHistory(instanceId: string): Promise<string[]> {
  await ensureHistoryLoaded(instanceId)
  return instanceHistories.get(instanceId) || []
}

export async function clearHistory(instanceId: string): Promise<void> {
  instanceHistories.delete(instanceId)
  historyLoaded.delete(instanceId)
  await deleteHistory(instanceId)
}

async function ensureHistoryLoaded(instanceId: string): Promise<void> {
  if (historyLoaded.has(instanceId)) {
    return
  }

  try {
    const history = await loadHistory(instanceId)
    instanceHistories.set(instanceId, history)
    historyLoaded.add(instanceId)
  } catch (error) {
    console.warn("Failed to load history:", error)
    instanceHistories.set(instanceId, [])
    historyLoaded.add(instanceId)
  }
}
