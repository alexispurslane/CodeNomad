import { Component, JSX } from "solid-js"

interface HintRowProps {
  children: JSX.Element
  class?: string
}

const HintRow: Component<HintRowProps> = (props) => {
  return <span class={`text-xs text-gray-500 dark:text-gray-400 ${props.class || ""}`}>{props.children}</span>
}

export default HintRow
