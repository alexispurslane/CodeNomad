import { Component, onMount, onCleanup, Show, createMemo, createEffect } from "solid-js"
import type { Session } from "./types/session"
import EmptyState from "./components/empty-state"
import SessionPicker from "./components/session-picker"
import CommandPalette from "./components/command-palette"
import InstanceTabs from "./components/instance-tabs"
import SessionTabs from "./components/session-tabs"
import MessageStream from "./components/message-stream"
import PromptInput from "./components/prompt-input"
import LogsView from "./components/logs-view"
import { initMarkdown } from "./lib/markdown"
import { createCommandRegistry } from "./lib/commands"
import type { Command } from "./lib/commands"
import {
  hasInstances,
  isSelectingFolder,
  setIsSelectingFolder,
  setHasInstances,
  sessionPickerInstance,
  hideSessionPicker,
  showSessionPicker,
} from "./stores/ui"
import {
  createInstance,
  instances,
  updateInstance,
  activeInstanceId,
  setActiveInstanceId,
  stopInstance,
  getActiveInstance,
  addLog,
} from "./stores/instances"
import {
  getSessions,
  activeSessionId,
  setActiveSession,
  setActiveParentSession,
  clearActiveParentSession,
  createSession,
  deleteSession,
  getSessionFamily,
  activeParentSessionId,
  getParentSessions,
  loadMessages,
  sendMessage,
  updateSessionAgent,
  updateSessionModel,
  agents,
} from "./stores/sessions"
import { setupTabKeyboardShortcuts } from "./lib/keyboard"
import { isOpen as isCommandPaletteOpen, showCommandPalette, hideCommandPalette } from "./stores/command-palette"
import { registerNavigationShortcuts } from "./lib/shortcuts/navigation"
import { registerInputShortcuts } from "./lib/shortcuts/input"
import { registerAgentShortcuts } from "./lib/shortcuts/agent"
import { registerEscapeShortcut } from "./lib/shortcuts/escape"
import { keyboardRegistry } from "./lib/keyboard-registry"

const SessionView: Component<{
  sessionId: string
  activeSessions: Map<string, Session>
  instanceId: string
  instanceFolder: string
}> = (props) => {
  const session = () => props.activeSessions.get(props.sessionId)

  createEffect(() => {
    const currentSession = session()
    if (currentSession) {
      loadMessages(props.instanceId, currentSession.id).catch(console.error)
    }
  })

  async function handleSendMessage(prompt: string) {
    await sendMessage(props.instanceId, props.sessionId, prompt)
  }

  async function handleAgentChange(agent: string) {
    await updateSessionAgent(props.instanceId, props.sessionId, agent)
  }

  async function handleModelChange(model: { providerId: string; modelId: string }) {
    await updateSessionModel(props.instanceId, props.sessionId, model)
  }

  return (
    <Show
      when={session()}
      fallback={
        <div class="flex items-center justify-center h-full">
          <div class="text-center text-gray-500">Session not found</div>
        </div>
      }
    >
      {(s) => (
        <div class="session-view">
          <MessageStream
            instanceId={props.instanceId}
            sessionId={s().id}
            messages={s().messages || []}
            messagesInfo={s().messagesInfo}
          />
          <PromptInput
            instanceId={props.instanceId}
            instanceFolder={props.instanceFolder}
            sessionId={s().id}
            onSend={handleSendMessage}
            agent={s().agent}
            model={s().model}
            onAgentChange={handleAgentChange}
            onModelChange={handleModelChange}
          />
        </div>
      )}
    </Show>
  )
}

const App: Component = () => {
  const commandRegistry = createCommandRegistry()

  const activeInstance = createMemo(() => getActiveInstance())

  const activeSessions = createMemo(() => {
    const instance = activeInstance()
    if (!instance) return new Map()
    const instanceId = instance.id

    const parentId = activeParentSessionId().get(instanceId)
    if (!parentId) return new Map()

    const sessionFamily = getSessionFamily(instanceId, parentId)
    return new Map(sessionFamily.map((s) => [s.id, s]))
  })

  const activeSessionIdForInstance = createMemo(() => {
    const instance = activeInstance()
    if (!instance) return null
    return activeSessionId().get(instance.id) || null
  })

  async function handleSelectFolder() {
    setIsSelectingFolder(true)
    try {
      const folder = await window.electronAPI.selectFolder()
      if (!folder) {
        return
      }

      const instanceId = await createInstance(folder)
      setHasInstances(true)

      console.log("Created instance:", instanceId, "Port:", instances().get(instanceId)?.port)
    } catch (error) {
      console.error("Failed to create instance:", error)
    } finally {
      setIsSelectingFolder(false)
    }
  }

  async function handleCloseInstance(instanceId: string) {
    if (confirm("Stop OpenCode instance? This will stop the server.")) {
      await stopInstance(instanceId)
      if (instances().size === 0) {
        setHasInstances(false)
      }
    }
  }

  async function handleNewSession(instanceId: string) {
    try {
      const session = await createSession(instanceId)
      setActiveParentSession(instanceId, session.id)
    } catch (error) {
      console.error("Failed to create session:", error)
    }
  }

  async function handleCloseSession(instanceId: string, sessionId: string) {
    const sessions = getSessions(instanceId)
    const session = sessions.find((s) => s.id === sessionId)

    const isParent = session?.parentId === null

    if (!isParent) {
      return
    }

    clearActiveParentSession(instanceId)
    showSessionPicker(instanceId)
  }

  function setupCommands() {
    commandRegistry.register({
      id: "init",
      label: "Initialize AGENTS.md",
      description: "Create or update AGENTS.md file",
      keywords: ["/init", "agents", "initialize"],
      action: async () => {
        const instance = activeInstance()
        const sessionId = activeSessionIdForInstance()
        if (!instance || !instance.client || !sessionId || sessionId === "logs") return

        try {
          await instance.client.session.init({ path: { id: sessionId } })
          console.log("Initialized AGENTS.md")
        } catch (error) {
          console.error("Failed to initialize AGENTS.md:", error)
        }
      },
    })

    commandRegistry.register({
      id: "compact",
      label: "Compact Session",
      description: "Summarize and compact the current session",
      keywords: ["/compact", "summarize", "compress"],
      action: async () => {
        const instance = activeInstance()
        const sessionId = activeSessionIdForInstance()
        if (!instance || !instance.client || !sessionId || sessionId === "logs") return

        try {
          await instance.client.session.summarize({ path: { id: sessionId } })
          console.log("Session compacted")
        } catch (error) {
          console.error("Failed to compact session:", error)
        }
      },
    })

    commandRegistry.register({
      id: "undo",
      label: "Undo Last Message",
      description: "Revert the last message",
      keywords: ["/undo", "revert", "undo"],
      action: async () => {
        const instance = activeInstance()
        const sessionId = activeSessionIdForInstance()
        if (!instance || !instance.client || !sessionId || sessionId === "logs") return

        try {
          await instance.client.session.revert({ path: { id: sessionId } })
          console.log("Last message reverted")
        } catch (error) {
          console.error("Failed to revert message:", error)
        }
      },
    })

    commandRegistry.register({
      id: "thinking",
      label: "Toggle Thinking Blocks",
      description: "Show/hide AI thinking process",
      keywords: ["/thinking", "toggle", "show", "hide"],
      action: () => {
        console.log("Toggle thinking blocks (not implemented)")
      },
    })

    commandRegistry.register({
      id: "help",
      label: "Show Help",
      description: "Display keyboard shortcuts and help",
      keywords: ["/help", "shortcuts", "help"],
      action: () => {
        console.log("Show help modal (not implemented)")
      },
    })

    commandRegistry.register({
      id: "new-session",
      label: "New Session",
      description: "Create a new session",
      shortcut: { key: "N", meta: true, shift: true },
      action: async () => {
        const instance = activeInstance()
        if (!instance) return
        await handleNewSession(instance.id)
      },
    })

    commandRegistry.register({
      id: "open-model-selector",
      label: "Open Model Selector",
      description: "Choose a different model",
      shortcut: { key: "M", meta: true, shift: true },
      action: () => {
        const modelInput = document.querySelector("[data-model-selector] input") as HTMLInputElement
        modelInput?.focus()
      },
    })

    commandRegistry.register({
      id: "focus-prompt",
      label: "Focus Prompt Input",
      description: "Jump to the message input",
      shortcut: { key: "P", meta: true },
      action: () => {
        const textarea = document.querySelector(".prompt-input") as HTMLTextAreaElement
        textarea?.focus()
      },
    })

    commandRegistry.register({
      id: "open-agent-selector",
      label: "Open Agent Selector",
      description: "Choose a different agent",
      action: () => {
        const agentButton = document.querySelector("[data-agent-selector]") as HTMLElement
        agentButton?.click()
      },
    })
  }

  function handleExecuteCommand(commandId: string) {
    commandRegistry.execute(commandId)
  }

  function handleCycleAgent() {
    const instance = activeInstance()
    const sessionId = activeSessionIdForInstance()
    if (!instance || !sessionId || sessionId === "logs") return

    const sessions = getSessions(instance.id)
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return

    const instanceAgents = agents().get(instance.id) || []
    const availableAgents =
      session.parentId === null ? instanceAgents.filter((a) => a.mode !== "subagent") : instanceAgents

    if (availableAgents.length === 0) return

    const currentIndex = availableAgents.findIndex((a) => a.name === session.agent)
    const nextIndex = (currentIndex + 1) % availableAgents.length
    const nextAgent = availableAgents[nextIndex]

    if (nextAgent) {
      updateSessionAgent(instance.id, sessionId, nextAgent.name).catch(console.error)
    }
  }

  function handleCycleAgentReverse() {
    const instance = activeInstance()
    const sessionId = activeSessionIdForInstance()
    if (!instance || !sessionId || sessionId === "logs") return

    const sessions = getSessions(instance.id)
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return

    const instanceAgents = agents().get(instance.id) || []
    const availableAgents =
      session.parentId === null ? instanceAgents.filter((a) => a.mode !== "subagent") : instanceAgents

    if (availableAgents.length === 0) return

    const currentIndex = availableAgents.findIndex((a) => a.name === session.agent)
    const prevIndex = currentIndex <= 0 ? availableAgents.length - 1 : currentIndex - 1
    const prevAgent = availableAgents[prevIndex]

    if (prevAgent) {
      updateSessionAgent(instance.id, sessionId, prevAgent.name).catch(console.error)
    }
  }

  onMount(() => {
    initMarkdown(false).catch(console.error)

    setupCommands()

    setupTabKeyboardShortcuts(
      handleSelectFolder,
      handleCloseInstance,
      handleNewSession,
      handleCloseSession,
      showCommandPalette,
    )

    registerNavigationShortcuts()
    registerInputShortcuts(
      () => {
        const textarea = document.querySelector(".prompt-input") as HTMLTextAreaElement
        if (textarea) textarea.value = ""
      },
      () => {
        const textarea = document.querySelector(".prompt-input") as HTMLTextAreaElement
        textarea?.focus()
      },
    )
    registerAgentShortcuts(handleCycleAgent, handleCycleAgentReverse, () => {
      const modelInput = document.querySelector("[data-model-selector] input") as HTMLInputElement
      modelInput?.focus()
    })
    registerEscapeShortcut(
      () => {
        const instance = activeInstance()
        if (!instance) return false
        const sessions = getSessions(instance.id)
        const sessionId = activeSessionIdForInstance()
        const session = sessions.find((s) => s.id === sessionId)
        if (!session) return false
        const lastMessage = session.messages[session.messages.length - 1]
        return lastMessage?.status === "streaming"
      },
      () => {
        console.log("Interrupt session (not implemented)")
      },
      () => {
        const active = document.activeElement as HTMLElement
        active?.blur()
      },
      hideCommandPalette,
    )

    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcut = keyboardRegistry.findMatch(e)
      if (shortcut) {
        e.preventDefault()
        shortcut.handler()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown)
    })

    window.electronAPI.onNewInstance(() => {
      handleSelectFolder()
    })

    window.electronAPI.onInstanceStarted(({ id, port, pid }) => {
      console.log("Instance started:", { id, port, pid })
      updateInstance(id, { port, pid, status: "ready" })
    })

    window.electronAPI.onInstanceError(({ id, error }) => {
      console.error("Instance error:", { id, error })
      updateInstance(id, { status: "error", error })
    })

    window.electronAPI.onInstanceStopped(({ id }) => {
      console.log("Instance stopped:", id)
      updateInstance(id, { status: "stopped" })
    })

    window.electronAPI.onInstanceLog(({ id, entry }) => {
      addLog(id, entry)
    })
  })

  return (
    <div class="h-screen w-screen flex flex-col">
      <Show
        when={!hasInstances()}
        fallback={
          <>
            <InstanceTabs
              instances={instances()}
              activeInstanceId={activeInstanceId()}
              onSelect={setActiveInstanceId}
              onClose={handleCloseInstance}
              onNew={handleSelectFolder}
            />

            <Show when={activeInstance()}>
              {(instance) => (
                <>
                  <Show
                    when={activeSessions().size > 0}
                    fallback={
                      <div class="flex-1 flex items-center justify-center">
                        <div class="text-center text-gray-500">
                          <p class="mb-2">No parent session selected</p>
                          <p class="text-sm">Select or create a parent session to begin</p>
                        </div>
                      </div>
                    }
                  >
                    <SessionTabs
                      instanceId={instance().id}
                      sessions={activeSessions()}
                      activeSessionId={activeSessionIdForInstance()}
                      onSelect={(id) => setActiveSession(instance().id, id)}
                      onClose={(id) => handleCloseSession(instance().id, id)}
                      onNew={() => handleNewSession(instance().id)}
                    />

                    <div class="content-area flex-1 overflow-hidden flex flex-col">
                      <Show
                        when={activeSessionIdForInstance() === "logs"}
                        fallback={
                          <Show
                            when={activeSessionIdForInstance()}
                            fallback={
                              <div class="flex items-center justify-center h-full">
                                <div class="text-center text-gray-500">
                                  <p class="mb-2">No session selected</p>
                                  <p class="text-sm">Select a session to view messages</p>
                                </div>
                              </div>
                            }
                          >
                            <SessionView
                              sessionId={activeSessionIdForInstance()!}
                              activeSessions={activeSessions()}
                              instanceId={activeInstance()!.id}
                              instanceFolder={activeInstance()!.folder}
                            />
                          </Show>
                        }
                      >
                        <LogsView instanceId={instance().id} />
                      </Show>
                    </div>
                  </Show>
                </>
              )}
            </Show>
          </>
        }
      >
        <EmptyState onSelectFolder={handleSelectFolder} isLoading={isSelectingFolder()} />
      </Show>

      <Show when={sessionPickerInstance()}>
        {(instanceId) => <SessionPicker instanceId={instanceId()} open={true} onClose={hideSessionPicker} />}
      </Show>

      <CommandPalette
        open={isCommandPaletteOpen()}
        onClose={hideCommandPalette}
        commands={commandRegistry.getAll()}
        onExecute={handleExecuteCommand}
      />
    </div>
  )
}

export default App
