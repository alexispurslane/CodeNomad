import { keyboardRegistry } from "../keyboard-registry"

export function registerAgentShortcuts(
  cycleAgent: () => void,
  cycleAgentReverse: () => void,
  focusModelSelector: () => void,
) {
  const isMac = () => navigator.platform.toLowerCase().includes("mac")

  keyboardRegistry.register({
    id: "agent-next",
    key: "Tab",
    modifiers: {},
    handler: cycleAgent,
    description: "next agent",
    context: "global",
    condition: () => {
      const active = document.activeElement
      return !(active?.tagName === "TEXTAREA" || active?.tagName === "INPUT" || active?.hasAttribute("contenteditable"))
    },
  })

  keyboardRegistry.register({
    id: "agent-prev",
    key: "Tab",
    modifiers: { shift: true },
    handler: cycleAgentReverse,
    description: "previous agent",
    context: "global",
    condition: () => {
      const active = document.activeElement
      return !(active?.tagName === "TEXTAREA" || active?.tagName === "INPUT" || active?.hasAttribute("contenteditable"))
    },
  })

  keyboardRegistry.register({
    id: "focus-model",
    key: "M",
    modifiers: { ctrl: !isMac(), meta: isMac(), shift: true },
    handler: focusModelSelector,
    description: "focus model",
    context: "global",
  })
}
