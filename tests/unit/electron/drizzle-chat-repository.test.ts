// @vitest-environment node

import { describe, expect, it } from "vitest"

import { appState } from "@/electron/infrastructure/app-state"
import { listChats } from "@/electron/app/chats/repository"
import { createSqliteTestDatabase } from "../../helpers/sqlite-test-database"

describe("chat repository contract", () => {
  it("keeps chat persistence behind the repository boundary", () => {
    expect("src/electron/app/chats/repository.ts").toContain("app/chats/repository")
  })

  it("filters channel-origin chats out of the normal chat list", async () => {
    const { sqlite, close } = createSqliteTestDatabase()
    appState.sqlite = sqlite

    sqlite
      .prepare(
        "INSERT INTO chats (id, title, chatbot_id, summary, source_type, source_ref, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run("chat-manual", "Manual", "assistant-main", "", "manual", null, 2)
    sqlite
      .prepare(
        "INSERT INTO chats (id, title, chatbot_id, summary, source_type, source_ref, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run("chat-channel", "Channel", "assistant-main", "", "channel", "channel-1", 3)
    sqlite
      .prepare(
        "INSERT INTO chats (id, title, chatbot_id, summary, source_type, source_ref, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run("chat-channel-channel-1-user-1", "Legacy Channel", "assistant-main", "", "manual", null, 4)
    sqlite
      .prepare(
        "INSERT INTO chat_messages (id, chat_id, role, content, parts_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("message-1", "chat-manual", "user", "hello", "[]", 2)
    sqlite
      .prepare(
        "INSERT INTO chat_messages (id, chat_id, role, content, parts_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("message-2", "chat-channel", "user", "hello", "[]", 3)
    sqlite
      .prepare(
        "INSERT INTO chat_messages (id, chat_id, role, content, parts_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("message-3", "chat-channel-channel-1-user-1", "user", "legacy", "[]", 4)

    const rows = await listChats()

    expect(rows.map((row) => row.id)).toEqual(["chat-manual"])

    appState.sqlite = null
    close()
  })
})
