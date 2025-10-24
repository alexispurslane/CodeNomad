import { Component, createSignal, createEffect, For, Show, onCleanup } from "solid-js"
import type { Agent } from "../types/session"

interface AgentPickerProps {
  open: boolean
  onSelect: (agentName: string) => void
  onClose: () => void
  agents: Agent[]
  searchQuery: string
  textareaRef?: HTMLTextAreaElement
}

const AgentPicker: Component<AgentPickerProps> = (props) => {
  const [filteredAgents, setFilteredAgents] = createSignal<Agent[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  let containerRef: HTMLDivElement | undefined
  let scrollContainerRef: HTMLDivElement | undefined

  createEffect(() => {
    if (!props.open) return

    const query = props.searchQuery.toLowerCase()
    const filtered = query
      ? props.agents.filter(
          (agent) =>
            agent.name.toLowerCase().includes(query) ||
            (agent.description && agent.description.toLowerCase().includes(query)),
        )
      : props.agents

    setFilteredAgents(filtered)
    setSelectedIndex(0)

    setTimeout(() => {
      if (scrollContainerRef) {
        scrollContainerRef.scrollTop = 0
      }
    }, 0)
  })

  function scrollToSelected() {
    setTimeout(() => {
      const selectedElement = containerRef?.querySelector('[data-agent-selected="true"]')
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" })
      }
    }, 0)
  }

  function handleSelect(agentName: string) {
    props.onSelect(agentName)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!props.open) return

    const agents = filteredAgents()

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, agents.length - 1))
      scrollToSelected()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
      scrollToSelected()
    } else if (e.key === "Enter") {
      e.preventDefault()
      const selected = agents[selectedIndex()]
      if (selected) {
        handleSelect(selected.name)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      props.onClose()
    }
  }

  createEffect(() => {
    if (props.open) {
      document.addEventListener("keydown", handleKeyDown)
      onCleanup(() => {
        document.removeEventListener("keydown", handleKeyDown)
      })
    }
  })

  return (
    <Show when={props.open}>
      <div
        ref={containerRef}
        class="absolute bottom-full left-0 mb-1 w-full max-w-md rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800 z-50"
      >
        <div class="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400">Select Agent</div>
        </div>

        <div ref={scrollContainerRef} class="max-h-60 overflow-y-auto">
          <Show when={filteredAgents().length === 0}>
            <div class="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No agents found</div>
          </Show>

          <For each={filteredAgents()}>
            {(agent, index) => (
              <div
                class={`cursor-pointer px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  index() === selectedIndex() ? "bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
                data-agent-selected={index() === selectedIndex()}
                onClick={() => handleSelect(agent.name)}
              >
                <div class="flex items-start gap-2">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.name}</span>
                      <Show when={agent.mode === "subagent"}>
                        <span class="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-normal text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                          subagent
                        </span>
                      </Show>
                    </div>
                    <Show when={agent.description}>
                      <div class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                        {agent.description && agent.description.length > 80
                          ? agent.description.slice(0, 80) + "..."
                          : agent.description}
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>

        <div class="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <span class="font-medium">↑↓</span> navigate • <span class="font-medium">Enter</span> select •{" "}
            <span class="font-medium">Esc</span> close
          </div>
        </div>
      </div>
    </Show>
  )
}

export default AgentPicker
