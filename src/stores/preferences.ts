import { createSignal, onMount } from "solid-js"
import { storage, type ConfigData } from "../lib/storage"

export interface ModelPreference {
  providerId: string
  modelId: string
}

export interface AgentModelSelections {
  [instanceId: string]: Record<string, ModelPreference>
}

export interface Preferences {
  showThinkingBlocks: boolean
  lastUsedBinary?: string
  environmentVariables?: Record<string, string>
  modelRecents?: ModelPreference[]
  agentModelSelections?: AgentModelSelections
}

export interface OpenCodeBinary {
  path: string
  version?: string
  lastUsed: number
}

export interface RecentFolder {
  path: string
  lastAccessed: number
}

const MAX_RECENT_FOLDERS = 10
const MAX_RECENT_MODELS = 5

const defaultPreferences: Preferences = {
  showThinkingBlocks: false,
  modelRecents: [],
  agentModelSelections: {},
}

const [preferences, setPreferences] = createSignal<Preferences>(defaultPreferences)
const [recentFolders, setRecentFolders] = createSignal<RecentFolder[]>([])
const [opencodeBinaries, setOpenCodeBinaries] = createSignal<OpenCodeBinary[]>([])

async function loadConfig(): Promise<void> {
  try {
    const config = await storage.loadConfig()
    setPreferences({ ...defaultPreferences, ...config.preferences })
    setRecentFolders(config.recentFolders)
    setOpenCodeBinaries(config.opencodeBinaries || [])
  } catch (error) {
    console.error("Failed to load config:", error)
  }
}

async function saveConfig(): Promise<void> {
  try {
    const config: ConfigData = {
      preferences: preferences(),
      recentFolders: recentFolders(),
      opencodeBinaries: opencodeBinaries(),
    }
    await storage.saveConfig(config)
  } catch (error) {
    console.error("Failed to save config:", error)
  }
}

function updatePreferences(updates: Partial<Preferences>): void {
  const updated = { ...preferences(), ...updates }
  setPreferences(updated)
  saveConfig().catch(console.error)
}

function toggleShowThinkingBlocks(): void {
  updatePreferences({ showThinkingBlocks: !preferences().showThinkingBlocks })
}

function addRecentFolder(path: string): void {
  const folders = recentFolders().filter((f) => f.path !== path)
  folders.unshift({ path, lastAccessed: Date.now() })

  const trimmed = folders.slice(0, MAX_RECENT_FOLDERS)
  setRecentFolders(trimmed)
  saveConfig().catch(console.error)
}

function removeRecentFolder(path: string): void {
  const folders = recentFolders().filter((f) => f.path !== path)
  setRecentFolders(folders)
  saveConfig().catch(console.error)
}

function addOpenCodeBinary(path: string, version?: string): void {
  const binaries = opencodeBinaries().filter((b) => b.path !== path)
  binaries.unshift({ path, version, lastUsed: Date.now() })

  const trimmed = binaries.slice(0, 10) // Keep max 10 binaries
  setOpenCodeBinaries(trimmed)
  saveConfig().catch(console.error)
}

function removeOpenCodeBinary(path: string): void {
  const binaries = opencodeBinaries().filter((b) => b.path !== path)
  setOpenCodeBinaries(binaries)
  saveConfig().catch(console.error)
}

function updateLastUsedBinary(path: string): void {
  updatePreferences({ lastUsedBinary: path })

  const binaries = opencodeBinaries()
  let binary = binaries.find((b) => b.path === path)

  // If binary not found in list, add it (for system PATH "opencode")
  if (!binary) {
    addOpenCodeBinary(path)
    binary = { path, lastUsed: Date.now() }
  } else {
    binary.lastUsed = Date.now()
    // Move to front
    const sorted = [binary, ...binaries.filter((b) => b.path !== path)]
    setOpenCodeBinaries(sorted)
    saveConfig().catch(console.error)
  }
}

function updateEnvironmentVariables(envVars: Record<string, string>): void {
  updatePreferences({ environmentVariables: envVars })
}

function addEnvironmentVariable(key: string, value: string): void {
  const current = preferences().environmentVariables || {}
  const updated = { ...current, [key]: value }
  updateEnvironmentVariables(updated)
}

function removeEnvironmentVariable(key: string): void {
  const current = preferences().environmentVariables || {}
  const { [key]: removed, ...rest } = current
  updateEnvironmentVariables(rest)
}

function addRecentModelPreference(model: ModelPreference): void {
  if (!model.providerId || !model.modelId) return
  const recents = preferences().modelRecents ?? []
  const filtered = recents.filter((item) => item.providerId !== model.providerId || item.modelId !== model.modelId)
  const updated = [model, ...filtered].slice(0, MAX_RECENT_MODELS)
  updatePreferences({ modelRecents: updated })
}

function setAgentModelPreference(instanceId: string, agent: string, model: ModelPreference): void {
  if (!instanceId || !agent || !model.providerId || !model.modelId) return
  const selections = preferences().agentModelSelections ?? {}
  const instanceSelections = selections[instanceId] ?? {}
  const existing = instanceSelections[agent]
  if (existing && existing.providerId === model.providerId && existing.modelId === model.modelId) {
    return
  }
  updatePreferences({
    agentModelSelections: {
      ...selections,
      [instanceId]: {
        ...instanceSelections,
        [agent]: model,
      },
    },
  })
}

function getAgentModelPreference(instanceId: string, agent: string): ModelPreference | undefined {
  return preferences().agentModelSelections?.[instanceId]?.[agent]
}

// Load config on mount and listen for changes from other instances
onMount(() => {
  loadConfig()

  // Reload config when changed by another instance
  const unsubscribe = storage.onConfigChanged(() => {
    loadConfig()
  })

  // Cleanup on unmount
  return unsubscribe
})

export {
  preferences,
  updatePreferences,
  toggleShowThinkingBlocks,
  recentFolders,
  addRecentFolder,
  removeRecentFolder,
  opencodeBinaries,
  addOpenCodeBinary,
  removeOpenCodeBinary,
  updateLastUsedBinary,
  updateEnvironmentVariables,
  addEnvironmentVariable,
  removeEnvironmentVariable,
  addRecentModelPreference,
  setAgentModelPreference,
  getAgentModelPreference,
}
