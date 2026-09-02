import { eq } from "drizzle-orm"

import type {
  ChannelConfigRecord,
  ChannelRuntimeState,
  DocumentGraphEdge,
  DocumentPageRecord,
  DocumentSettings,
  SkillFileRecord,
  WorkflowDefinition,
} from "@/data/domain/models"
import { executePersistedMutation, getDatabaseContext } from "@/data/db/client"
import {
  agents,
  agentVersions,
  appMeta,
  channels,
  chats,
  chatMessages,
  documents,
  documentVersions,
  integrationExecutions,
  integrations,
  providers,
  schedulers,
  skills,
  skillVersions,
  integrationVersions,
  workflows,
  workflowInvocations,
  workflowVersions,
} from "@/data/db/schema"

const SEED_VERSION = "2026-09-02-ui-v5"

let seedPromise: Promise<void> | undefined

function createWorkflowDefinition(title: string): WorkflowDefinition {
  return {
    nodes: [
      {
        id: `${title}-start`,
        type: "workflowNode",
        position: { x: 40, y: 120 },
        data: {
          label: "Start",
          prompt: "Collect the incoming request and normalize variables.",
          kind: "start",
          task: "Normalize the inbound request payload.",
          enabled: true,
          continueOnError: true,
          retryCount: 0,
          timeoutMs: 15000,
          outputKey: "request",
        },
      },
      {
        id: `${title}-agent`,
        type: "workflowNode",
        position: { x: 280, y: 120 },
        data: {
          label: "Agent Step",
          prompt: `Generate output for ${title}.`,
          kind: "agent",
          task: `Generate the main result for ${title}.`,
          agentId: "agent-support",
          enabled: true,
          continueOnError: false,
          retryCount: 1,
          timeoutMs: 45000,
          modelId: "gpt-5",
          inputTemplate: "{{request}}",
          outputKey: "result",
          maxInputChars: 8000,
          maxOutputChars: 8000,
        },
      },
      {
        id: `${title}-output`,
        type: "workflowNode",
        position: { x: 540, y: 120 },
        data: {
          label: "End",
          prompt: "Return the final response payload.",
          kind: "end",
          task: "Shape the final response and dispatch it.",
          enabled: true,
          continueOnError: true,
          retryCount: 0,
          timeoutMs: 15000,
          inputTemplate: "{{result}}",
          outputKey: "response",
        },
      },
    ],
    edges: [
      { id: `${title}-edge-1`, source: `${title}-start`, target: `${title}-agent`, data: { successOnly: true } },
      { id: `${title}-edge-2`, source: `${title}-agent`, target: `${title}-output`, data: { successOnly: true } },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    resourceBindings: {
      providerId: "provider-openai",
      skillId: "skill-plan",
      documentId: "document-product-manual",
      integrationId: "integration-webhook",
    },
    dryRunInputJson: "{\n  \"leadId\": \"LD-1001\"\n}",
    variables: [
      { id: `${title}-var-lead`, name: "leadId", defaultValue: "LD-1001", required: true },
    ],
    budget: {
      maxSteps: 8,
      maxDurationMs: 120000,
    },
  }
}

function createChannelRuntime(now: number): ChannelRuntimeState {
  return {
    messages: [
      {
        id: crypto.randomUUID(),
        direction: "incoming",
        senderName: "Visitor",
        senderId: "visitor-1001",
        content: "Hello, I need help with onboarding.",
        status: "received",
        createdAt: now - 90 * 60 * 1000,
      },
      {
        id: crypto.randomUUID(),
        direction: "outgoing",
        senderName: "SUORA",
        senderId: "agent-support",
        content: "Sure. I can walk you through the setup steps.",
        status: "sent",
        createdAt: now - 89 * 60 * 1000,
      },
    ],
    users: [
      {
        id: crypto.randomUUID(),
        channelId: "",
        senderName: "Visitor",
        senderId: "visitor-1001",
        firstSeenAt: now - 24 * 60 * 60 * 1000,
        lastActiveAt: now - 89 * 60 * 1000,
        messageCount: 1,
        conversationHistory: [
          { role: "user", content: "Hello, I need help with onboarding.", timestamp: now - 90 * 60 * 1000 },
          { role: "assistant", content: "Sure. I can walk you through the setup steps.", timestamp: now - 89 * 60 * 1000 },
        ],
      },
    ],
    health: {
      isHealthy: true,
      lastCheckAt: now - 30 * 60 * 1000,
      latencyMs: 164,
      errorCount: 0,
    },
    debugLog: [
      {
        id: crypto.randomUUID(),
        timestamp: now - 29 * 60 * 1000,
        tone: "success",
        text: "Last health check completed successfully.",
      },
    ],
  }
}

function createChannelConfig(now: number, overrides: Partial<ChannelConfigRecord>): ChannelConfigRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? "New channel",
    platform: overrides.platform ?? "web",
    enabled: overrides.enabled ?? false,
    status: overrides.status ?? "inactive",
    connectionMode: overrides.connectionMode ?? "webhook",
    webhookPath: overrides.webhookPath ?? `/channels/${overrides.id ?? "new-channel"}`,
    webhookSecret: overrides.webhookSecret ?? "",
    autoReply: overrides.autoReply ?? true,
    replyAgentId: overrides.replyAgentId ?? "agent-document-editor",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    lastMessageAt: overrides.lastMessageAt,
    messageCount: overrides.messageCount ?? 0,
    appId: overrides.appId,
    appSecret: overrides.appSecret,
    verificationToken: overrides.verificationToken,
    encryptKey: overrides.encryptKey,
    slackBotToken: overrides.slackBotToken,
    slackSigningSecret: overrides.slackSigningSecret,
    telegramBotToken: overrides.telegramBotToken,
    discordBotToken: overrides.discordBotToken,
    discordApplicationId: overrides.discordApplicationId,
    teamsAppId: overrides.teamsAppId,
    teamsAppPassword: overrides.teamsAppPassword,
    teamsTenantId: overrides.teamsTenantId,
    wechatOfficialAppId: overrides.wechatOfficialAppId,
    wechatOfficialAppSecret: overrides.wechatOfficialAppSecret,
    wechatOfficialToken: overrides.wechatOfficialToken,
    wechatPersonalWebhookUrl: overrides.wechatPersonalWebhookUrl,
    wechatPersonalAuthToken: overrides.wechatPersonalAuthToken,
    wechatPersonalQrCodeUrl: overrides.wechatPersonalQrCodeUrl,
    wechatPersonalBindingStatus: overrides.wechatPersonalBindingStatus,
    wechatPersonalBotToken: overrides.wechatPersonalBotToken,
    wechatPersonalBaseUrl: overrides.wechatPersonalBaseUrl,
    wechatPersonalAccountId: overrides.wechatPersonalAccountId,
    wechatPersonalUserId: overrides.wechatPersonalUserId,
    customWebhookUrl: overrides.customWebhookUrl,
    customAuthHeader: overrides.customAuthHeader,
    customAuthValue: overrides.customAuthValue,
    customPayloadTemplate: overrides.customPayloadTemplate,
    customPlatformName: overrides.customPlatformName,
    customPlatformIcon: overrides.customPlatformIcon,
    emailImapHost: overrides.emailImapHost,
    emailImapPort: overrides.emailImapPort,
    emailImapUser: overrides.emailImapUser,
    emailImapPassword: overrides.emailImapPassword,
    emailImapTls: overrides.emailImapTls,
    emailImapMailbox: overrides.emailImapMailbox,
    emailSmtpHost: overrides.emailSmtpHost,
    emailSmtpPort: overrides.emailSmtpPort,
    emailSmtpUser: overrides.emailSmtpUser,
    emailSmtpPassword: overrides.emailSmtpPassword,
    emailSmtpTls: overrides.emailSmtpTls,
    emailFromName: overrides.emailFromName,
    emailFromAddress: overrides.emailFromAddress,
    emailPollInterval: overrides.emailPollInterval,
    emailFilters: overrides.emailFilters ?? [],
    emailActions: overrides.emailActions ?? [],
    emailMarkAsRead: overrides.emailMarkAsRead ?? true,
  }
}

function createSkillFiles(skillName: string): SkillFileRecord[] {
  return [
    {
      path: "SKILL.md",
      language: "md",
      kind: "file",
      content: `---\nname: ${JSON.stringify(skillName)}\ndescription: ${JSON.stringify(`Describe what ${skillName} does and when to use it.`)}\n---\n\n## Purpose\n\nDescribe the skill intent, triggers, and limits here.\n`,
    },
    {
      path: "references",
      language: "txt",
      kind: "directory",
      content: "",
    },
    {
      path: "references/README.md",
      language: "md",
      kind: "file",
      content: `# References\n\nCapture related docs, notes, or external links for ${skillName}.`,
    },
    {
      path: "assets",
      language: "txt",
      kind: "directory",
      content: "",
    },
    {
      path: "assets/.gitkeep",
      language: "txt",
      kind: "file",
      content: "",
    },
    {
      path: "scripts",
      language: "txt",
      kind: "directory",
      content: "",
    },
    {
      path: "scripts/main.ts",
      language: "ts",
      kind: "file",
      executable: true,
      content: [
        "export async function main(input: unknown) {",
        "  return { ok: true, input }",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: "other",
      language: "txt",
      kind: "directory",
      content: "",
    },
    {
      path: "other/notes.md",
      language: "md",
      kind: "file",
      content: `# Notes\n\nAdd extra snippets or implementation notes for ${skillName}.`,
    },
  ]
}

function createDocumentPages(title: string): DocumentPageRecord[] {
  return [
    { id: `${title}-guides`, title: "guides", content: "", type: "folder", parentId: null },
    { id: `${title}-overview`, title: `${title}-overview.md`, content: `# ${title}\n\n## Overview\n\n${title} overview and purpose.\n`, type: "document", parentId: `${title}-guides` },
    { id: `${title}-details`, title: `${title}-details.md`, content: `# ${title} Details\n\n${title} implementation details and linked resources.\n`, type: "document", parentId: `${title}-guides` },
  ]
}

function createDocumentGraph(pages: DocumentPageRecord[]): DocumentGraphEdge[] {
  return pages.length > 1
    ? [{ id: `${pages[0].id}-${pages[1].id}`, source: pages[0].title, target: pages[1].title, label: "supports", status: "approved", confidence: 0.92 }]
    : []
}

function createDocumentSettings(): DocumentSettings {
  return {
    isPublic: false,
    includeInLlmsTxt: true,
  }
}

async function isSeeded() {
  const context = await getDatabaseContext()
  const result = (await context.db
    .select()
    .from(appMeta)
    .where(eq(appMeta.key, "seed_version"))
    .all())[0]
  return result?.value === SEED_VERSION
}

export function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      if (await isSeeded()) {
        return
      }

      await executePersistedMutation(async ({ db }) => {
        const now = Date.now()
        const oneDay = 24 * 60 * 60 * 1000

        const hasData =
          (await db.select().from(chats).all()).length > 0 ||
          (await db.select().from(workflows).all()).length > 0 ||
          (await db.select().from(skills).all()).length > 0 ||
          (await db.select().from(documents).all()).length > 0
        const hasProviders = (await db.select().from(providers).all()).length > 0
        const hasAgentVersions = (await db.select().from(agentVersions).all()).length > 0

        if (!hasData) {
          await db.insert(chats)
            .values([
              {
                id: "chat-product-review",
                title: "产品需求讨论",
                chatbotId: "assistant-main",
                summary: "讨论新 UI 的导航拆分方式",
                updatedAt: new Date(now - 2 * 60 * 60 * 1000),
              },
              {
                id: "chat-growth-plan",
                title: "增长方案评审",
                chatbotId: "assistant-growth",
                summary: "回顾 7 天内的增长实验数据",
                updatedAt: new Date(now - 2 * oneDay),
              },
              {
                id: "chat-archive-design",
                title: "知识库初始化",
                chatbotId: "assistant-docs",
                summary: "旧版资料清理和知识图谱导入",
                updatedAt: new Date(now - 16 * oneDay),
              },
            ])
            .run()

          await db.insert(chatMessages)
            .values([
              {
                id: "msg-1",
                chatId: "chat-product-review",
                role: "assistant",
                content: "我们先把 workflow、skills、documents 的 detail 面板做出来。",
                createdAt: new Date(now - 3 * 60 * 60 * 1000),
              },
              {
                id: "msg-2",
                chatId: "chat-product-review",
                role: "user",
                content: "先把本地数据层跑通，再接 UI。",
                createdAt: new Date(now - 2 * 60 * 60 * 1000),
              },
              {
                id: "msg-3",
                chatId: "chat-growth-plan",
                role: "user",
                content: "总结最近一周的转化实验表现。",
                createdAt: new Date(now - 2 * oneDay),
              },
              {
                id: "msg-4",
                chatId: "chat-growth-plan",
                role: "assistant",
                content: "实验 A 的转化率最高，但需要补充渠道归因。",
                createdAt: new Date(now - 2 * oneDay + 10 * 60 * 1000),
              },
            ])
            .run()

          await db.insert(agents)
            .values([
              { id: "agent-crm-sync", title: "CRM Sync Agent", kind: "custom", summary: "Sync inbound leads into CRM.", updatedAt: new Date(now - 3 * oneDay) },
            ])
            .run()

          if (!hasAgentVersions) {
            await db.insert(agentVersions)
              .values([
                { id: "agent-crm-sync-v1-0", agentId: "agent-crm-sync", major: 1, minor: 0, isRelease: false, configJson: JSON.stringify({ instructions: "Synchronize inbound leads into CRM and report failures.", providerId: "provider-openai", modelId: "gpt-4.1", skillIds: ["skill-brand-tone"], toolsetIds: ["integration-webhook", "integration-cleanup-script"] }), createdAt: new Date(now - 3 * oneDay) },
              ])
              .run()
          }

          await db.insert(workflows)
            .values([
              { id: "workflow-lead-intake", title: "Lead Intake Flow", summary: "Route new leads, classify intent, and create assignments.", updatedAt: new Date(now - 30 * 60 * 1000) },
              { id: "workflow-weekly-report", title: "Weekly Report Flow", summary: "Aggregate metrics and draft weekly summary.", updatedAt: new Date(now - 6 * 60 * 60 * 1000) },
            ])
            .run()

          await db.insert(workflowVersions)
            .values([
              { id: "workflow-lead-intake-v1-2", workflowId: "workflow-lead-intake", major: 1, minor: 2, isRelease: true, definitionJson: JSON.stringify(createWorkflowDefinition("lead-intake-release")), createdAt: new Date(now - 7 * oneDay) },
              { id: "workflow-lead-intake-v2-0", workflowId: "workflow-lead-intake", major: 2, minor: 0, isRelease: false, definitionJson: JSON.stringify(createWorkflowDefinition("lead-intake-draft")), createdAt: new Date(now - oneDay) },
              { id: "workflow-weekly-report-v1-0", workflowId: "workflow-weekly-report", major: 1, minor: 0, isRelease: false, definitionJson: JSON.stringify(createWorkflowDefinition("weekly-report")), createdAt: new Date(now - 6 * 60 * 60 * 1000) },
            ])
            .run()

          await db.insert(workflowInvocations)
            .values([
              { id: "workflow-run-1", workflowId: "workflow-lead-intake", versionId: "workflow-lead-intake-v2-0", status: "success", trigger: "manual", inputJson: JSON.stringify({ source: "seed" }), outputJson: JSON.stringify({ summary: "Created lead and assigned owner." }), traceJson: JSON.stringify([{ nodeId: "lead-intake-draft-start", label: "Start", status: "success", output: "Lead payload captured", startedAt: now - 10000, finishedAt: now - 9700 }, { nodeId: "lead-intake-draft-agent", label: "Agent Step", status: "success", output: "Lead classified", startedAt: now - 9600, finishedAt: now - 9300 }, { nodeId: "lead-intake-draft-output", label: "Output", status: "success", output: "Owner assigned", startedAt: now - 9200, finishedAt: now - 9000 }]), createdAt: new Date(now - 12 * 60 * 60 * 1000) },
            ])
            .run()

          await db.insert(skills)
            .values([
              { id: "skill-plan", title: "Plan", source: "builtin", summary: "Plan multi-step implementation work.", updatedAt: new Date(now - oneDay) },
              { id: "skill-agent-customization", title: "agent-customization", source: "system", summary: "Manage customization prompts and instructions.", updatedAt: new Date(now - 2 * oneDay) },
              { id: "skill-brand-tone", title: "brand-tone", source: "custom", summary: "Enforce brand writing style across outbound copy.", updatedAt: new Date(now - 3 * oneDay) },
            ])
            .run()

          await db.insert(skillVersions)
            .values([
              { id: "skill-plan-v1-1", skillId: "skill-plan", major: 1, minor: 1, isRelease: true, filesJson: JSON.stringify(createSkillFiles("Plan")), createdAt: new Date(now - 5 * oneDay) },
              { id: "skill-plan-v2-0", skillId: "skill-plan", major: 2, minor: 0, isRelease: false, filesJson: JSON.stringify(createSkillFiles("Plan Draft")), createdAt: new Date(now - oneDay) },
              { id: "skill-agent-customization-v1-0", skillId: "skill-agent-customization", major: 1, minor: 0, isRelease: true, filesJson: JSON.stringify(createSkillFiles("agent-customization")), createdAt: new Date(now - 8 * oneDay) },
              { id: "skill-brand-tone-v1-0", skillId: "skill-brand-tone", major: 1, minor: 0, isRelease: false, filesJson: JSON.stringify(createSkillFiles("brand-tone")), createdAt: new Date(now - 3 * oneDay) },
            ])
            .run()

          await db.insert(documents)
            .values([
              { id: "document-product-manual", title: "产品手册", summary: "核心产品说明和能力边界。", updatedAt: new Date(now - 4 * 60 * 60 * 1000) },
              { id: "document-deploy-guide", title: "部署说明", summary: "部署流程和环境要求。", updatedAt: new Date(now - 2 * oneDay) },
            ])
            .run()

          const productPages = createDocumentPages("产品手册")
          const deployPages = createDocumentPages("部署说明")

          await db.insert(documentVersions)
            .values([
              { id: "document-product-manual-v1-2", documentId: "document-product-manual", major: 1, minor: 2, isRelease: true, structureJson: JSON.stringify({ pages: productPages }), graphJson: JSON.stringify({ edges: createDocumentGraph(productPages).map((edge) => ({ ...edge, status: "approved", confidence: 0.88 })) }), settingsJson: JSON.stringify(createDocumentSettings()), createdAt: new Date(now - 4 * oneDay) },
              { id: "document-product-manual-v2-0", documentId: "document-product-manual", major: 2, minor: 0, isRelease: false, structureJson: JSON.stringify({ pages: productPages }), graphJson: JSON.stringify({ edges: createDocumentGraph(productPages).map((edge) => ({ ...edge, status: "pending", confidence: 0.73 })) }), settingsJson: JSON.stringify(createDocumentSettings()), createdAt: new Date(now - 4 * 60 * 60 * 1000) },
              { id: "document-deploy-guide-v1-0", documentId: "document-deploy-guide", major: 1, minor: 0, isRelease: false, structureJson: JSON.stringify({ pages: deployPages }), graphJson: JSON.stringify({ edges: createDocumentGraph(deployPages).map((edge) => ({ ...edge, status: "pending", confidence: 0.69 })) }), settingsJson: JSON.stringify(createDocumentSettings()), createdAt: new Date(now - 2 * oneDay) },
            ])
            .run()

          if (!hasProviders) {
            await db.insert(providers)
              .values([
                { id: "provider-openai", title: "OpenAI", providerType: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", modelsJson: JSON.stringify([{ id: "gpt-5.6-sol", name: "GPT-5.6 Sol", enabled: false, capabilities: ["toolcalling", "vision", "structuredOutput"], apiModes: ["messages", "responses", "completions"], contextWindow: 1050000, maxOutputTokens: 128000, supportsParallelToolCalls: true, supportsReasoning: true }]), enabled: false, updatedAt: new Date(now - oneDay) },
                { id: "provider-anthropic", title: "Anthropic", providerType: "anthropic", baseUrl: "https://api.anthropic.com/v1", apiKey: "", modelsJson: JSON.stringify([{ id: "claude-opus-5", name: "Claude Opus 5", enabled: false, capabilities: ["toolcalling", "vision", "structuredOutput"], apiModes: ["messages"], contextWindow: 200000, maxOutputTokens: 64000, supportsParallelToolCalls: true, supportsReasoning: true }]), enabled: false, updatedAt: new Date(now - 2 * oneDay) },
                { id: "provider-ollama", title: "Ollama", providerType: "ollama", baseUrl: "http://localhost:11434/v1", apiKey: "", modelsJson: JSON.stringify([{ id: "qwen3.8", name: "Qwen3.8", enabled: false, capabilities: ["toolcalling", "vision"], apiModes: ["messages", "responses", "completions"], contextWindow: 128000, maxOutputTokens: 32768, supportsParallelToolCalls: false, supportsReasoning: true }]), enabled: false, updatedAt: new Date(now - 3 * oneDay) },
              ])
              .run()
          }

          await db.insert(integrations)
            .values([
              { id: "integration-webhook", title: "Webhook Relay", kind: "http", endpoint: "https://api.example.com/webhook", updatedAt: new Date(now - 6 * 60 * 60 * 1000) },
              { id: "integration-github-mcp", title: "GitHub MCP", kind: "mcp", endpoint: "github://mcp", updatedAt: new Date(now - oneDay) },
              { id: "integration-cleanup-script", title: "cleanup.ps1", kind: "scripts", endpoint: "powershell://cleanup.ps1", updatedAt: new Date(now - 2 * oneDay) },
            ])
            .run()

          await db.insert(integrationVersions)
            .values([
              { id: "integration-webhook-v1-1", integrationId: "integration-webhook", major: 1, minor: 1, isRelease: true, configJson: JSON.stringify({ kind: "http", method: "POST", url: "https://api.example.com/webhook", description: "Forward normalized payloads.", headersJson: "{\n  \"Authorization\": \"Bearer {{token}}\"\n}", queryJson: "{}", bodyJson: "{\n  \"event\": \"workflow.completed\"\n}" }), createdAt: new Date(now - 4 * oneDay) },
              { id: "integration-github-mcp-v1-0", integrationId: "integration-github-mcp", major: 1, minor: 0, isRelease: true, configJson: JSON.stringify({ kind: "mcp", endpoint: "https://mcp.example.com/sse", launchCommand: "", protocols: ["sse", "streamable_http"], authModes: ["bearer"], authConfigJson: "{\n  \"token\": \"${GITHUB_TOKEN}\"\n}" }), createdAt: new Date(now - 3 * oneDay) },
              { id: "integration-cleanup-script-v1-0", integrationId: "integration-cleanup-script", major: 1, minor: 0, isRelease: false, configJson: JSON.stringify({ kind: "scripts", runtime: "node", handler: "cleanup", timeoutMs: 30000, inputSchemaJson: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"directory\": { \"type\": \"string\" }\n  }\n}", code: "export async function cleanup(input) {\n  return { ok: true, input }\n}\n" }), createdAt: new Date(now - 2 * oneDay) },
            ])
            .run()

          await db.insert(integrationExecutions)
            .values([
              { id: "integration-exec-1", integrationId: "integration-webhook", versionId: "integration-webhook-v1-1", status: "success", inputJson: "{\n  \"event\": \"workflow.completed\"\n}", outputJson: "{\n  \"ok\": true,\n  \"status\": 200\n}", createdAt: new Date(now - oneDay) },
            ])
            .run()

          await db.insert(schedulers)
            .values([
              { id: "scheduler-daily-summary", title: "Daily Summary Job", schedule: "0 9 * * *", updatedAt: new Date(now - oneDay) },
              { id: "scheduler-nightly-cleanup", title: "Nightly Cleanup", schedule: "0 2 * * *", updatedAt: new Date(now - 2 * oneDay) },
            ])
            .run()

          await db.insert(channels)
            .values([
              {
                id: "channel-website-chat",
                title: "Website Chat",
                platform: "web",
                enabled: true,
                status: "active",
                connectionMode: "webhook",
                webhookPath: "/channels/website-chat",
                webhookSecret: "website-secret",
                autoReply: true,
                replyAgentId: "agent-document-editor",
                createdAt: new Date(now - 7 * oneDay),
                lastMessageAt: new Date(now - 89 * 60 * 1000),
                messageCount: 2,
                configJson: JSON.stringify(createChannelConfig(now - oneDay, {
                  id: "channel-website-chat",
                  title: "Website Chat",
                  platform: "web",
                  enabled: true,
                  status: "active",
                  connectionMode: "webhook",
                  webhookPath: "/channels/website-chat",
                  webhookSecret: "website-secret",
                  autoReply: true,
                  replyAgentId: "agent-document-editor",
                  createdAt: now - 7 * oneDay,
                  updatedAt: now - oneDay,
                  lastMessageAt: now - 89 * 60 * 1000,
                  messageCount: 2,
                })),
                runtimeJson: JSON.stringify(createChannelRuntime(now - 30 * 60 * 1000)),
                updatedAt: new Date(now - oneDay),
              },
              {
                id: "channel-email-inbox",
                title: "Email Inbox",
                platform: "email",
                enabled: false,
                status: "inactive",
                connectionMode: "stream",
                webhookPath: "/channels/email-inbox",
                webhookSecret: "",
                autoReply: true,
                replyAgentId: "agent-skill-editor",
                createdAt: new Date(now - 10 * oneDay),
                lastMessageAt: new Date(now - 2 * oneDay),
                messageCount: 0,
                configJson: JSON.stringify(createChannelConfig(now - 2 * oneDay, {
                  id: "channel-email-inbox",
                  title: "Email Inbox",
                  platform: "email",
                  enabled: false,
                  status: "inactive",
                  connectionMode: "stream",
                  webhookPath: "/channels/email-inbox",
                  autoReply: true,
                  replyAgentId: "agent-skill-editor",
                  createdAt: now - 10 * oneDay,
                  updatedAt: now - 2 * oneDay,
                  lastMessageAt: now - 2 * oneDay,
                  emailImapHost: "imap.example.com",
                  emailImapPort: 993,
                  emailImapUser: "support@example.com",
                  emailImapTls: true,
                  emailImapMailbox: "INBOX",
                  emailSmtpHost: "smtp.example.com",
                  emailSmtpPort: 465,
                  emailSmtpTls: true,
                  emailFromName: "Support Bot",
                  emailFromAddress: "support@example.com",
                  emailPollInterval: 60,
                  emailFilters: [
                    { id: crypto.randomUUID(), field: "subject", operator: "contains", value: "support", enabled: true },
                  ],
                  emailActions: [
                    { id: crypto.randomUUID(), type: "auto_reply", enabled: true, useAgent: true },
                  ],
                  emailMarkAsRead: true,
                })),
                runtimeJson: JSON.stringify({
                  ...createChannelRuntime(now - oneDay),
                  messages: [],
                  users: [],
                  health: { isHealthy: null, errorCount: 0 },
                  debugLog: [],
                }),
                updatedAt: new Date(now - 2 * oneDay),
              },
            ])
            .run()
        }

          await db.insert(appMeta)
          .values({ key: "seed_version", value: SEED_VERSION })
          .onConflictDoUpdate({ target: appMeta.key, set: { value: SEED_VERSION } })
          .run()
      })
    })()
  }

  return seedPromise
}