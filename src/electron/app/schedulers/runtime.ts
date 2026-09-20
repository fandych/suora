import crypto from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { schedulerRuns, schedulers, workflowVersions } from "@/drizzle/schema"
import { executeWorkflowCommand } from "@/electron/app/workflows/execute-engine"
import { executeWorkflowRun } from "@/electron/app/workflows/runtime"
import { workflowService } from "@/electron/app/workflows/service"
import { chatApplicationService } from "@/electron/app/chats/service"
import { runWorkflowAgent } from "@/electron/app/workflows/runtime-agent"
import { documentService } from "@/electron/app/documents/service"
import { integrationApplicationService } from "@/electron/app/integrations/service"
import { getSystemMailProfile, sendMail } from "@/electron/app/channels/mail-service"
import type { ChatRuntimeSettings } from "@/types/chat"
import { invokeAgent } from "@/electron/app/agents/runtime"

type Scheduler = typeof schedulers.$inferSelect

let timer: ReturnType<typeof setTimeout> | null = null
let started = false
const activeRuns = new Map<string, AbortController>()

function parseField(value: string, min: number, max: number) {
  const values = new Set<number>()
  for (const segment of value.split(",")) {
    const [range, stepValue] = segment.split("/")
    const step = stepValue ? Number(stepValue) : 1
    if (!Number.isInteger(step) || step < 1) throw new Error("Invalid cron step.")
    const [start, end] = range === "*" ? [min, max] : range.includes("-") ? range.split("-").map(Number) : [Number(range), Number(range)]
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end)
      throw new Error("Invalid cron field.")
    for (let item = start; item <= end; item += step) values.add(item)
  }
  return values
}

function matchesSchedule(schedule: string, timestamp: number, timeZone: string) {
  const fields = schedule.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error("Scheduler schedules must use five-field cron syntax.")
  const [minute, hour, day, month, weekday] = [
    parseField(fields[0], 0, 59),
    parseField(fields[1], 0, 23),
    parseField(fields[2], 1, 31),
    parseField(fields[3], 1, 12),
    parseField(fields[4], 0, 7),
  ]
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    minute: "numeric",
    hour: "numeric",
    day: "numeric",
    month: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const weekdayValue = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((part) => part.type === "weekday")?.value ?? "")
  return minute.has(get("minute")) && hour.has(get("hour")) && day.has(get("day")) && month.has(get("month")) && (weekday.has(weekdayValue) || weekday.has(7) && weekdayValue === 0)
}

function nextMinuteDelay() {
  return 60_000 - (Date.now() % 60_000) + 250
}

function arm() {
  if (!started) return
  timer = setTimeout(() => void tick().finally(arm), nextMinuteDelay())
}

async function invokeWorkflow(scheduler: Scheduler, input: unknown, signal: AbortSignal) {
  const [version] = await getDrizzleDatabase()
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, scheduler.targetId))
    .orderBy(desc(workflowVersions.major), desc(workflowVersions.minor), desc(workflowVersions.createdAt))
    .limit(1)
  if (!version) throw new Error("Scheduled workflow was not found.")
  const command = await executeWorkflowRun({
    requestId: crypto.randomUUID(),
    workflowId: scheduler.targetId,
    versionId: version.id,
    definition: JSON.parse(version.definitionJson),
    input,
    mode: "manual",
  })
  const result = await executeWorkflowCommand(
    {
      ...command,
      runtime: {
        getChatRuntimeSettings: () =>
          chatApplicationService.getSessionSettings(null).then((settings) => settings.runtime as ChatRuntimeSettings),
        executeAgent: (agentInput) => runWorkflowAgent(agentInput, signal),
        getDocumentDetail: (documentId) => documentService.get(documentId),
        executeIntegration: (config, inputJson, integrationId) =>
          integrationApplicationService.execute({ kind: "http", config, inputJson, integrationId }),
        sendMail: async (payload) => {
          const profile = getSystemMailProfile()
          if (!profile) return { success: false, error: "SMTP is not configured." }
          return sendMail({ profile, toAddress: payload.to, subject: payload.subject, content: payload.content })
        },
      },
    },
    () => undefined,
    signal,
  )
  await workflowService.recordInvocation({
    workflowId: scheduler.targetId,
    versionId: version.id,
    status: "success",
    trigger: "scheduler",
    input: JSON.stringify(input),
    output: JSON.stringify(result.output),
    traceJson: JSON.stringify(result.traces),
  })
  return result.output
}

async function runScheduler(scheduler: Scheduler) {
  const now = Date.now()
  let input: unknown
  try {
    input = JSON.parse(scheduler.inputPayloadJson || "{}")
  } catch {
    input = {}
  }
  const id = crypto.randomUUID()
  const controller = new AbortController()
  activeRuns.set(id, controller)
  await getDrizzleDatabase().insert(schedulerRuns).values({
    id,
    schedulerId: scheduler.id,
    status: "running",
    inputJson: JSON.stringify(input),
    outputJson: "{}",
    startedAt: now,
    finishedAt: null,
  })
  try {
    let output: unknown
    let failure: unknown
    for (let attempt = 0; attempt <= Math.min(Math.max(scheduler.retryLimit, 0), 5); attempt += 1) {
      try {
        output =
          scheduler.targetType === "workflow"
            ? await invokeWorkflow(scheduler, input, controller.signal)
            : await invokeAgent(scheduler.targetId, JSON.stringify(input), controller.signal)
        failure = undefined
        break
      } catch (error) {
        failure = error
        if (attempt < scheduler.retryLimit) await new Promise((resolve) => setTimeout(resolve, scheduler.retryBackoffSeconds * 1000))
      }
    }
    if (failure) throw failure
    await getDrizzleDatabase().update(schedulerRuns).set({ status: "success", outputJson: JSON.stringify(output), finishedAt: Date.now() }).where(eq(schedulerRuns.id, id))
  } catch (error) {
    await getDrizzleDatabase().update(schedulerRuns).set({ status: "error", outputJson: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), finishedAt: Date.now() }).where(eq(schedulerRuns.id, id))
  } finally {
    activeRuns.delete(id)
  }
}

async function tick() {
  const minute = Date.now() - (Date.now() % 60_000)
  const rows = await getDrizzleDatabase().select().from(schedulers).where(eq(schedulers.enabled, true))
  for (const scheduler of rows) {
    try {
      if (matchesSchedule(scheduler.schedule, minute, scheduler.timeZone)) void runScheduler(scheduler)
    } catch (error) {
      console.error(`Invalid scheduler '${scheduler.id}':`, error)
    }
  }
}

export const schedulerRuntime = {
  async start() {
    if (started) return
    started = true
    await tick()
    arm()
  },
  stop() {
    started = false
    if (timer) clearTimeout(timer)
    timer = null
    for (const controller of activeRuns.values()) controller.abort()
    activeRuns.clear()
  },
}