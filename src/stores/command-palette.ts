import { createSignal } from "solid-js"

const [isOpen, setIsOpen] = createSignal(false)

export function showCommandPalette() {
  setIsOpen(true)
}

export function hideCommandPalette() {
  setIsOpen(false)
}

export function toggleCommandPalette() {
  setIsOpen(!isOpen())
}

export { isOpen }
