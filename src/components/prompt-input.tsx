import { createSignal, Show, onMount, createEffect } from "solid-js"
import AgentSelector from "./agent-selector"
import ModelSelector from "./model-selector"
import { addToHistory, getHistory } from "../stores/message-history"
import Kbd from "./kbd"
import HintRow from "./hint-row"
import { isMac } from "../lib/keyboard-utils"

interface PromptInputProps {
  instanceId: string
  instanceFolder: string
  sessionId: string
  onSend: (prompt: string) => Promise<void>
  disabled?: boolean
  agent: string
  model: { providerId: string; modelId: string }
  onAgentChange: (agent: string) => Promise<void>
  onModelChange: (model: { providerId: string; modelId: string }) => Promise<void>
}

export default function PromptInput(props: PromptInputProps) {
  const [prompt, setPrompt] = createSignal("")
  const [sending, setSending] = createSignal(false)
  const [history, setHistory] = createSignal<string[]>([])
  const [historyIndex, setHistoryIndex] = createSignal(-1)
  const [isFocused, setIsFocused] = createSignal(false)
  let textareaRef: HTMLTextAreaElement | undefined

  onMount(async () => {
    const loaded = await getHistory(props.instanceFolder)
    setHistory(loaded)
  })

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
      return
    }

    const textarea = textareaRef
    if (!textarea) return

    const atStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0
    const currentHistory = history()

    if (e.key === "ArrowUp" && atStart && currentHistory.length > 0) {
      e.preventDefault()
      const newIndex = historyIndex() === -1 ? 0 : Math.min(historyIndex() + 1, currentHistory.length - 1)
      setHistoryIndex(newIndex)
      setPrompt(currentHistory[newIndex])
      setTimeout(() => {
        textarea.style.height = "auto"
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px"
      }, 0)
      return
    }

    if (e.key === "ArrowDown" && historyIndex() >= 0) {
      e.preventDefault()
      const newIndex = historyIndex() - 1
      if (newIndex >= 0) {
        setHistoryIndex(newIndex)
        setPrompt(currentHistory[newIndex])
      } else {
        setHistoryIndex(-1)
        setPrompt("")
      }
      setTimeout(() => {
        textarea.style.height = "auto"
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px"
      }, 0)
      return
    }
  }

  async function handleSend() {
    const text = prompt().trim()
    if (!text || sending() || props.disabled) return

    setSending(true)
    try {
      await addToHistory(props.instanceFolder, text)

      const updated = await getHistory(props.instanceFolder)
      setHistory(updated)
      setHistoryIndex(-1)

      await props.onSend(text)
      setPrompt("")

      if (textareaRef) {
        textareaRef.style.height = "auto"
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      alert("Failed to send message: " + (error instanceof Error ? error.message : String(error)))
    } finally {
      setSending(false)
      textareaRef?.focus()
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement
    setPrompt(target.value)
    setHistoryIndex(-1)

    target.style.height = "auto"
    target.style.height = Math.min(target.scrollHeight, 200) + "px"
  }

  const canSend = () => prompt().trim().length > 0 && !sending() && !props.disabled

  return (
    <div class="prompt-input-container">
      <div class="prompt-input-wrapper">
        <textarea
          ref={textareaRef}
          class="prompt-input"
          placeholder="Type your message or /command..."
          value={prompt()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={sending() || props.disabled}
          rows={1}
        />
        <button class="send-button" onClick={handleSend} disabled={!canSend()} aria-label="Send message">
          <Show when={sending()} fallback={<span class="send-icon">▶</span>}>
            <span class="spinner-small" />
          </Show>
        </button>
      </div>
      <div class="prompt-input-hints">
        <HintRow>
          <Kbd>Enter</Kbd> to send • <Kbd>Shift+Enter</Kbd> for new line • <Kbd>↑↓</Kbd> for history •{" "}
          <Kbd shortcut="cmd+p" /> to focus
        </HintRow>
        <div class="flex items-center gap-2">
          <AgentSelector
            instanceId={props.instanceId}
            sessionId={props.sessionId}
            currentAgent={props.agent}
            onAgentChange={props.onAgentChange}
          />
          <ModelSelector
            instanceId={props.instanceId}
            sessionId={props.sessionId}
            currentModel={props.model}
            onModelChange={props.onModelChange}
          />
        </div>
      </div>
    </div>
  )
}
