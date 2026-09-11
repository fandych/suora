import { describe, expect, it } from "vitest"
import type { ChannelDetail } from "@shared/domain/channel-models"
import { appendChannelDebug, formatWeChatPersonalDiagnostic, mergeChannelDebugLogEntries } from "@/services/channels/channel-diagnostics-service"

const detail = { runtime: { debugLog: [{ id: "current", timestamp: 1, tone: "info", text: "current" }] } } as ChannelDetail

describe("channel diagnostics service", () => {
  it("adds newest debug entries and caps their count", () => {
    const result = appendChannelDebug(detail, "success", "connected", 2)
    expect(result[0]).toMatchObject({ tone: "success", text: "connected", timestamp: 2 })
    expect(result).toHaveLength(2)
  })

  it("merges logs without duplicate ids", () => {
    const result = mergeChannelDebugLogEntries(detail.runtime.debugLog, [
      { id: "incoming", timestamp: 3, tone: "error", text: "incoming" },
      { id: "current", timestamp: 4, tone: "info", text: "duplicate" },
    ])
    expect(result.map((entry) => entry.id)).toEqual(["incoming", "current"])
  })

  it("formats WeChat diagnostics with fallback values", () => {
    expect(formatWeChatPersonalDiagnostic({ status: "timeout", diagnosticEvent: "poll" })).toContain("status=timeout")
    expect(formatWeChatPersonalDiagnostic({})).toContain("upstreamStatus=unknown")
  })
})
