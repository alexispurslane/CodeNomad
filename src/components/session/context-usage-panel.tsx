import { createMemo, type Component } from "solid-js"
import { getSessionInfo } from "../../stores/sessions"
import { formatTokenTotal } from "../../lib/formatters"

interface ContextUsagePanelProps {
  instanceId: string
  sessionId: string
}

const ContextUsagePanel: Component<ContextUsagePanelProps> = (props) => {
  const info = createMemo(
    () =>
      getSessionInfo(props.instanceId, props.sessionId) ?? {
        tokens: 0,
        cost: 0,
        contextWindow: 0,
        isSubscriptionModel: false,
        contextUsageTokens: 0,
        contextUsagePercent: null,
      },
  )

  const tokens = createMemo(() => info().tokens)
  const contextUsageTokens = createMemo(() => info().contextUsageTokens ?? 0)
  const contextWindow = createMemo(() => info().contextWindow)
  const contextUsagePercent = createMemo(() => info().contextUsagePercent)

  const costLabel = createMemo(() => {
    if (info().isSubscriptionModel || info().cost <= 0) return "Included in plan"
    return `$${info().cost.toFixed(2)} spent`
  })

  return (
    <div class="session-context-panel border-r border-base border-b px-3 py-3">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-xs font-semibold text-primary/70 uppercase tracking-wide">Tokens (last call)</div>
          <div class="text-lg font-semibold text-primary">{formatTokenTotal(tokens())}</div>
        </div>
        <div class="text-xs text-primary/70 text-right leading-tight">{costLabel()}</div>
      </div>
      <div class="mt-4">
        <div class="flex items-center justify-between mb-1">
          <div class="text-xs font-semibold text-primary/70 uppercase tracking-wide">Context window usage</div>
          <div class="text-sm font-medium text-primary">{contextUsagePercent() !== null ? `${contextUsagePercent()}%` : "--"}</div>
        </div>
        <div class="text-sm text-primary/90">
          {contextWindow()
            ? `${formatTokenTotal(contextUsageTokens())} of ${formatTokenTotal(contextWindow())}`
            : "Window size unavailable"}
        </div>
      </div>
      <div class="mt-3 h-1.5 rounded-full bg-base relative overflow-hidden">
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-accent-primary transition-[width]"
          style={{ width: contextUsagePercent() === null ? "0%" : `${contextUsagePercent()}%` }}
        />
      </div>
    </div>
  )
}

export default ContextUsagePanel
