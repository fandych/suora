import { describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({ app: { isPackaged: false } }))

import { createSqliteTestDatabase } from "@/../tests/helpers/sqlite-test-database"
import { agents, channels, integrations, workflowInvocations } from "@/drizzle/schema"

describe("entity persistence integration", () => {
  it("persists representative resources in one SQLite schema", async () => {
    const testDatabase = createSqliteTestDatabase()
    try {
      await testDatabase.db
        .insert(agents)
        .values({ id: "agent-integration", title: "Agent", kind: "custom", summary: "", updatedAt: 1 })
      await testDatabase.db.insert(integrations).values({
        id: "integration-integration",
        title: "Integration",
        kind: "http",
        endpoint: "",
        enabled: true,
        updatedAt: 1,
      })
      await testDatabase.db.insert(channels).values({
        id: "channel-integration",
        title: "Channel",
        platform: "web",
        enabled: true,
        status: "active",
        connectionMode: "webhook",
        webhookPath: "/channels/test",
        webhookSecret: "",
        autoReply: true,
        replyAgentId: "",
        createdAt: 1,
        lastMessageAt: null,
        messageCount: 0,
        configJson: "{}",
        runtimeJson: "{}",
        updatedAt: 1,
      })
      await testDatabase.db.insert(workflowInvocations).values({
        id: "invocation-integration",
        workflowId: "workflow-test",
        versionId: "version-test",
        status: "completed",
        trigger: "manual",
        inputJson: "{}",
        outputJson: "{}",
        traceJson: "[]",
        createdAt: 1,
      })
      expect(await testDatabase.db.select().from(agents)).toHaveLength(1)
      expect(await testDatabase.db.select().from(integrations)).toHaveLength(1)
      expect(await testDatabase.db.select().from(channels)).toHaveLength(1)
      expect(await testDatabase.db.select().from(workflowInvocations)).toHaveLength(1)
    } finally {
      testDatabase.close()
    }
  })
})
