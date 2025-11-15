import { Show, createMemo, createEffect, onCleanup, type Component } from "solid-js"
import type { Session } from "../../types/session"
import type { Attachment } from "../../types/attachment"
import type { ClientPart } from "../../types/message"
import MessageStream from "../message-stream"
import PromptInput from "../prompt-input"
import { instances, getActivePermission, sendPermissionResponse } from "../../stores/instances"
import { loadMessages, sendMessage, forkSession, isSessionMessagesLoading, setActiveParentSession, setActiveSession } from "../../stores/sessions"

interface SessionViewProps {
  sessionId: string
  activeSessions: Map<string, Session>
  instanceId: string
  instanceFolder: string
  escapeInDebounce: boolean
}

export const SessionView: Component<SessionViewProps> = (props) => {
  const session = () => props.activeSessions.get(props.sessionId)
  const messagesLoading = createMemo(() => isSessionMessagesLoading(props.instanceId, props.sessionId))

  createEffect(() => {
    const currentSession = session()
    if (currentSession) {
      loadMessages(props.instanceId, currentSession.id).catch(console.error)
    }
  })

  async function handleSendMessage(prompt: string, attachments: Attachment[]) {
    await sendMessage(props.instanceId, props.sessionId, prompt, attachments)
  }

  function getUserMessageText(messageId: string): string | null {
    const currentSession = session()
    if (!currentSession) return null

    const targetMessage = currentSession.messages.find((m) => m.id === messageId)
    const targetInfo = currentSession.messagesInfo.get(messageId)
    if (!targetMessage || targetInfo?.role !== "user") {
      return null
    }

    const textParts = targetMessage.parts.filter((p): p is ClientPart & { type: "text"; text: string } => p.type === "text")
    if (textParts.length === 0) {
      return null
    }

    return textParts.map((p) => p.text).join("\n")
  }

  async function handleRevert(messageId: string) {
    const instance = instances().get(props.instanceId)
    if (!instance || !instance.client) return

    try {
      await instance.client.session.revert({
        path: { id: props.sessionId },
        body: { messageID: messageId },
      })

      const restoredText = getUserMessageText(messageId)
      if (restoredText) {
        const textarea = document.querySelector(".prompt-input") as HTMLTextAreaElement
        if (textarea) {
          textarea.value = restoredText
          textarea.dispatchEvent(new Event("input", { bubbles: true }))
          textarea.focus()
        }
      }
    } catch (error) {
      console.error("Failed to revert:", error)
      alert("Failed to revert to message")
    }
  }

  async function handleFork(messageId?: string) {
    if (!messageId) {
      console.warn("Fork requires a user message id")
      return
    }

    const restoredText = getUserMessageText(messageId)

    try {
      const forkedSession = await forkSession(props.instanceId, props.sessionId, { messageId })

      const parentToActivate = forkedSession.parentId ?? forkedSession.id
      setActiveParentSession(props.instanceId, parentToActivate)
      if (forkedSession.parentId) {
        setActiveSession(props.instanceId, forkedSession.id)
      }

      await loadMessages(props.instanceId, forkedSession.id).catch(console.error)

      if (restoredText) {
        const textarea = document.querySelector(".prompt-input") as HTMLTextAreaElement
        if (textarea) {
          textarea.value = restoredText
          textarea.dispatchEvent(new Event("input", { bubbles: true }))
          textarea.focus()
        }
      }
    } catch (error) {
      console.error("Failed to fork session:", error)
      alert("Failed to fork session")
    }
  }

  const activePermission = createMemo(() => getActivePermission(props.instanceId))

  async function handlePermissionResponse(response: "once" | "always" | "reject") {
    const permission = activePermission()
    if (!permission) return

    try {
      await sendPermissionResponse(props.instanceId, props.sessionId, permission.id, response)
    } catch (error) {
      console.error("Failed to send permission response:", error)
    }
  }

  createEffect(() => {
    const permission = activePermission()
    if (!permission) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault()
        handlePermissionResponse("once")
      } else if (event.key === "a" || event.key === "A") {
        event.preventDefault()
        handlePermissionResponse("always")
      } else if (event.key === "d" || event.key === "D") {
        event.preventDefault()
        handlePermissionResponse("reject")
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown))
  })

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
            revert={s().revert}
            loading={messagesLoading()}
            onRevert={handleRevert}
            onFork={handleFork}
          />

          <Show when={activePermission()}>
            {(permission) => (
              <div class="permission-dialog border-2 border-[var(--status-warning)] bg-surface-secondary p-4 mx-4 mb-4 rounded-lg shadow-lg">
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0">
                    <div class="w-6 h-6 bg-[var(--status-warning)] rounded-full flex items-center justify-center">
                      <svg class="w-4 h-4 text-[var(--text-inverted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                  </div>
                  <div class="flex-1">
                    <div class="mb-2">
                      <span class="font-semibold text-primary">Permission Required</span>
                      <span class="ml-2 font-mono text-sm bg-surface-secondary border border-base rounded px-1.5 py-0.5">{permission().type}</span>
                    </div>
                    <div class="bg-surface-code p-3 rounded border mb-3">
                      <code class="text-sm text-primary">{permission().title}</code>
                    </div>
                    <div class="flex gap-2 text-sm">
                      <kbd class="kbd">Enter</kbd>
                      <span class="text-muted">Accept once</span>
                      <kbd class="kbd ml-4">a</kbd>
                      <span class="text-muted">Accept always</span>
                      <kbd class="kbd ml-4">d</kbd>
                      <span class="text-muted">Deny</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Show>

          <PromptInput
            instanceId={props.instanceId}
            instanceFolder={props.instanceFolder}
            sessionId={s().id}
            onSend={handleSendMessage}
            escapeInDebounce={props.escapeInDebounce}
          />
        </div>
      )}
    </Show>
  )
}

export default SessionView
