import { describe, expect, it, vi } from "vitest"

import { handleTeamsWebhook, handleTelegramWebhook } from "@electron/channels/channel-webhook-messaging-platforms"

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() } as never
}

describe("messaging webhook platforms", () => {
  it("maps Telegram text messages", async () => {
    const emit = vi.fn(async () => undefined)
    await handleTelegramWebhook({ headers: {}, body: { message: { message_id: 1, text: "hello", chat: { id: 2, type: "private" }, from: { id: 3, first_name: "Ada" } } } } as never, response(), { id: "telegram-1", platform: "telegram", webhookSecret: "", teamsAppId: "" } as never, emit)
    expect(emit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ content: "hello", chatId: "2" }), expect.anything())
  })

  it("ignores Teams bot messages and emits user messages", async () => {
    const emit = vi.fn(async () => undefined)
    const channel = { id: "teams-1", platform: "teams", teamsAppId: "bot-1" } as never
    await handleTeamsWebhook({ body: { type: "message", from: { id: "bot-1" } } } as never, response(), channel, emit)
    expect(emit).not.toHaveBeenCalled()
    await handleTeamsWebhook({ body: { type: "message", id: "m-1", from: { id: "user-1", name: "Ada" }, text: "hello", conversation: { id: "c-1" }, serviceUrl: "https://teams.example" } } as never, response(), channel, emit)
    expect(emit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ content: "hello" }), expect.anything())
  })
})
