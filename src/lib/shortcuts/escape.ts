import { keyboardRegistry } from "../keyboard-registry"

export function registerEscapeShortcut(
  isSessionBusy: () => boolean,
  interruptSession: () => void,
  blurInput: () => void,
  closeModal: () => void,
) {
  keyboardRegistry.register({
    id: "escape",
    key: "Escape",
    modifiers: {},
    handler: () => {
      const hasOpenModal = document.querySelector('[role="dialog"]') !== null

      if (hasOpenModal) {
        closeModal()
        return
      }

      if (isSessionBusy()) {
        interruptSession()
        return
      }

      blurInput()
    },
    description: "cancel/close",
    context: "global",
  })
}
