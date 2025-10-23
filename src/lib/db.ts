const DB_NAME = "opencode-client"
const DB_VERSION = 1
const HISTORY_STORE = "message-history"

let db: IDBDatabase | null = null

async function getDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      if (!database.objectStoreNames.contains(HISTORY_STORE)) {
        database.createObjectStore(HISTORY_STORE)
      }
    }
  })
}

export async function saveHistory(instanceId: string, history: string[]): Promise<void> {
  const database = await getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(HISTORY_STORE, "readwrite")
    const store = tx.objectStore(HISTORY_STORE)
    const request = store.put(history, instanceId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function loadHistory(instanceId: string): Promise<string[]> {
  try {
    const database = await getDB()
    return new Promise((resolve, reject) => {
      const tx = database.transaction(HISTORY_STORE, "readonly")
      const store = tx.objectStore(HISTORY_STORE)
      const request = store.get(instanceId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  } catch (error) {
    console.warn("Failed to load history from IndexedDB:", error)
    return []
  }
}

export async function deleteHistory(instanceId: string): Promise<void> {
  const database = await getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(HISTORY_STORE, "readwrite")
    const store = tx.objectStore(HISTORY_STORE)
    const request = store.delete(instanceId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
