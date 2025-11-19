import type { AppConfig, InstanceData } from "../../../cli/src/api-types"
import { cliApi } from "./api-client"
import { cliEvents } from "./cli-events"

export type ConfigData = AppConfig

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }

  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch (error) {
      console.warn("Failed to compare config objects", error)
    }
  }

  return false
}

export class ServerStorage {
  private configChangeListeners: Set<(config: ConfigData) => void> = new Set()
  private configCache: ConfigData | null = null
  private loadPromise: Promise<ConfigData> | null = null

  constructor() {
    cliEvents.on("config.appChanged", (event) => {
      if (event.type !== "config.appChanged") return
      this.setConfigCache(event.config)
    })
  }

  async loadConfig(): Promise<ConfigData> {
    if (this.configCache) {
      return this.configCache
    }

    if (!this.loadPromise) {
      this.loadPromise = cliApi
        .fetchConfig()
        .then((config) => {
          this.setConfigCache(config)
          return config
        })
        .finally(() => {
          this.loadPromise = null
        })
    }

    return this.loadPromise
  }

  async updateConfig(next: ConfigData): Promise<ConfigData> {
    const nextConfig = await cliApi.updateConfig(next)
    this.setConfigCache(nextConfig)
    return nextConfig
  }

  async loadInstanceData(instanceId: string): Promise<InstanceData> {
    return cliApi.readInstanceData(instanceId)
  }

  async saveInstanceData(instanceId: string, data: InstanceData): Promise<void> {
    await cliApi.writeInstanceData(instanceId, data)
  }

  async deleteInstanceData(instanceId: string): Promise<void> {
    await cliApi.deleteInstanceData(instanceId)
  }

  onConfigChanged(listener: (config: ConfigData) => void): () => void {
    this.configChangeListeners.add(listener)
    if (this.configCache) {
      listener(this.configCache)
    }
    return () => this.configChangeListeners.delete(listener)
  }

  private setConfigCache(config: ConfigData) {
    if (this.configCache && isDeepEqual(this.configCache, config)) {
      this.configCache = config
      return
    }
    this.configCache = config
    this.notifyConfigChanged(config)
  }

  private notifyConfigChanged(config: ConfigData) {
    for (const listener of this.configChangeListeners) {
      listener(config)
    }
  }
}

export const storage = new ServerStorage()
