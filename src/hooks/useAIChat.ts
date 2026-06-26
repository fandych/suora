// Hook for managing AI chat interactions within a session.
//
// AI SDK v6 aligned:
// - Uses ModelMessage types directly (no custom AIChatMessage)
// - toModelMessages() converts app Message[] to AI SDK v6 ModelMessage[]
// - Stream events use v6 field names (input/output, finish-step, tool-error)

import { useState, useCallback, useRef, useEffect } from 'react'
import { streamResponseWithTools, initializeProvider, validateModelConfig, classifyAppError } from '@/services/aiService'
import { executeAgentPipeline, listSavedPipelines, resolvePipelineByReference, type AgentPipelineProgressStep } from '@/services/agentPipelineService'
import { loadPipelineExecutionsFromDisk } from '@/services/pipelineFiles'
import { parseSlashPipelineChatCommand } from '@/services/pipelineChatCommands'
import { buildPipelineExecutionNotificationMessage } from '@/services/pipelineExecutionPresentation'
import { buildPipelineExecutionPath } from '@/services/pipelineNavigation'
import { parseChatControlCommand, resolveAgentControlReference, resolveModelControlReference } from '@/services/chatControlCommands'
import { buildShortcutCommandPrompt, parseShortcutCommand } from '@/services/shortcutCommands'
import { buildSlashCommandHelp, formatSlashMessage } from '@/services/slashCommandDispatcher'
import { t } from '@/services/i18n'
import { getToolsForAgent, getSkillSystemPrompts, mergeSkillsWithBuiltins, buildSystemPrompt, recordToolErrorMemory } from '@/services/tools'
import { logger } from '@/services/logger'
import { sanitizeToolError } from '@/services/sanitization'
import { toModelMessages as buildModelMessages, buildContextSummary } from '@/services/chatContext'
import { createToolOutputEnvelope } from '@/services/runtimeOutput'
import { validateAgentPipeline } from '@/services/pipelineValidation'
import { selectBestAgentForTask } from '@/services/agentSelection'
import { confirm } from '@/services/confirmDialog'
import { useAppStore } from '@/store/appStore'
import { generateId } from '@/utils/helpers'
import type { Message, ToolCall, MessageAttachment, ContentPart } from '@/types'

const STREAM_FLUSH_INTERVAL_MS = 100 // minimum ms between store updates during short text streaming
const MAX_CHAT_TOOL_STEPS = 100

function getStreamFlushIntervalMs(contentLength: number): number {
  if (contentLength < 4_000) return STREAM_FLUSH_INTERVAL_MS
  if (contentLength < 12_000) return 180
  return 320
}

type PipelineChatLanguage = 'en' | 'zh'

function detectPipelineChatLanguage(input: string): PipelineChatLanguage {
  return /[\u4e00-\u9fff]/u.test(input) ? 'zh' : 'en'
}

function trimPipelinePreview(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength).trimEnd()}...`
    : value
}

function formatPipelineCatalogMessage(
  pipelines: Array<{ id: string; name: string; steps: Array<unknown> }>,
  language: PipelineChatLanguage,
): string {
  if (pipelines.length === 0) {
    return language === 'zh'
      ? [
          '当前还没有已保存的流水线。',
          '',
          '先在“流水线”页面创建并保存一条流水线，然后就可以在聊天中直接运行。',
        ].join('\n')
      : [
          'No saved pipelines are available yet.',
          '',
          'Create and save a pipeline in the Pipeline view before running it from chat.',
        ].join('\n')
  }

  return language === 'zh'
    ? [
        '已保存的流水线',
        '',
        ...pipelines.map((pipeline, index) => `${index + 1}. ${pipeline.name} · ${pipeline.steps.length} 步 · id: ${pipeline.id}`),
        '',
        '可使用 /pipeline <名称或ID> 运行流水线。',
      ].join('\n')
    : [
        'Saved pipelines',
        '',
        ...pipelines.map((pipeline, index) => `${index + 1}. ${pipeline.name} · ${pipeline.steps.length} steps · id: ${pipeline.id}`),
        '',
        'Run one with /pipeline <name-or-id>.',
      ].join('\n')
}

function formatPipelineHelpMessage(language: PipelineChatLanguage): string {
  return language === 'zh'
    ? [
        'Pipeline 命令',
        '',
        '- /pipeline list：列出已保存流水线',
        '- /pipeline run <名称或ID> key=value：预览并运行流水线',
        '- /pipeline status：查看当前或最近流水线状态',
        '- /pipeline history <名称或ID>：查看最近执行记录',
        '- /pipeline cancel：取消正在运行的流水线',
      ].join('\n')
    : [
        'Pipeline commands',
        '',
        '- /pipeline list: list saved pipelines',
        '- /pipeline run <name-or-id> key=value: preview and run a pipeline',
        '- /pipeline status: show the current or latest pipeline status',
        '- /pipeline history <name-or-id>: show recent execution records',
        '- /pipeline cancel: cancel the running pipeline',
      ].join('\n')
}

function formatPipelineHistoryMessage(
  executions: Array<{ pipelineName: string; status: string; startedAt: number; completedAt: number; error?: string; finalOutput?: string }>,
  language: PipelineChatLanguage,
): string {
  if (executions.length === 0) return language === 'zh' ? '还没有流水线执行记录。' : 'No pipeline execution history yet.'
  const title = language === 'zh' ? '最近流水线执行记录' : 'Recent pipeline runs'
  return [
    title,
    '',
    ...executions.slice(0, 8).map((execution, index) => {
      const duration = execution.completedAt - execution.startedAt
      const detail = execution.error || execution.finalOutput || ''
      return `${index + 1}. ${execution.pipelineName} · ${execution.status} · ${duration}ms${detail ? `\n   ${trimPipelinePreview(detail, 180)}` : ''}`
    }),
  ].join('\n')
}

function hashText(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(16)
}

function getPreviousOpenAIResponseId(messages: Message[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue
    const providerResponseId = message.runtime?.providerResponseId
    if (providerResponseId) return providerResponseId
  }
  return undefined
}

interface SendMessageOptions {
  continuationResponseId?: string
}

function looksLikeToolFailureOutput(output: string): boolean {
  const normalized = output.trim().toLowerCase()
  if (!normalized) return false

  return normalized.startsWith('error:')
    || normalized.startsWith('search error:')
    || normalized.startsWith('path blocked')
    || normalized.startsWith('command blocked')
    || normalized.startsWith('cancelled by user')
    || normalized.startsWith('tool "')
}

function formatPipelineExecutionMessage(
  pipelineName: string,
  steps: AgentPipelineProgressStep[],
  status: 'running' | 'success' | 'error',
  language: PipelineChatLanguage,
  finalOutput?: string,
  error?: string,
): string {
  const completed = steps.filter((step) => step.status === 'success' || step.status === 'error').length
  const succeeded = steps.filter((step) => step.status === 'success').length
  const failed = steps.filter((step) => step.status === 'error').length
  const statusLabel = language === 'zh'
    ? status === 'running'
      ? '执行中'
      : status === 'success'
        ? '已完成'
        : '失败'
    : status === 'running'
      ? 'Running'
      : status === 'success'
        ? 'Completed'
        : 'Failed'

  const lines = language === 'zh'
    ? [
        `流水线：${pipelineName}`,
        `状态：${statusLabel}`,
        `进度：已完成 ${completed}/${steps.length || 0} 步 · 成功 ${succeeded} · 失败 ${failed}`,
      ]
    : [
        `Pipeline: ${pipelineName}`,
        `Status: ${statusLabel}`,
        `Progress: ${completed}/${steps.length || 0} completed · ${succeeded} succeeded · ${failed} failed`,
      ]

  if (steps.length > 0) {
    lines.push('')
    for (const step of steps) {
      const durationLabel = step.durationMs !== undefined ? ` · ${step.durationMs}ms` : ''
      const agentLabel = step.agentName || step.agentId
      lines.push(`${step.stepIndex + 1}. ${agentLabel} · ${step.status}${durationLabel}`)
      lines.push(language === 'zh'
        ? `任务：${trimPipelinePreview(step.task, 180)}`
        : `Task: ${trimPipelinePreview(step.task, 180)}`)
      if (step.error) {
        lines.push(language === 'zh'
          ? `错误：${trimPipelinePreview(step.error, 240)}`
          : `Error: ${trimPipelinePreview(step.error, 240)}`)
      } else if (step.output) {
        lines.push(language === 'zh'
          ? `输出：${trimPipelinePreview(step.output, 280)}`
          : `Output: ${trimPipelinePreview(step.output, 280)}`)
      }
      lines.push('')
    }
  }

  if (error) {
    lines.push(language === 'zh'
      ? `流水线错误：${trimPipelinePreview(error, 500)}`
      : `Pipeline error: ${trimPipelinePreview(error, 500)}`)
  } else if (finalOutput) {
    lines.push(language === 'zh' ? '最终输出：' : 'Final output:')
    lines.push(trimPipelinePreview(finalOutput, 1200))
  }

  return lines.join('\n').trim()
}

function updateSessionMessage(sessionId: string, messageId: string, updates: Partial<Message>) {
  const state = useAppStore.getState()
  const session = state.sessions.find((item) => item.id === sessionId)
  if (!session) return

  state.updateSession(sessionId, {
    messages: session.messages.map((message) => message.id === messageId ? { ...message, ...updates } : message),
  })
}

// ─── Hook ─────────────────────────────────────────────────────────

interface UseAIChatOptions {
  sessionId?: string | null
}

interface ActiveChatStream {
  abortController: AbortController
  messageId: string
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [, setStreamVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const { sessionId: targetSessionId } = options

  const activeStreamsRef = useRef(new Map<string, ActiveChatStream>())

  const notifyStreamChange = useCallback(() => {
    setStreamVersion((version) => version + 1)
  }, [])

  const resolveTargetSession = useCallback((store = useAppStore.getState()) => {
    const resolvedSessionId = targetSessionId ?? store.activeSessionId
    if (!resolvedSessionId) return null
    return store.sessions.find((session) => session.id === resolvedSessionId) ?? null
  }, [targetSessionId])

  const cancelStream = useCallback((sessionId?: string, reason = 'Cancelled by user') => {
    const store = useAppStore.getState()
    const resolvedSessionId = sessionId ?? targetSessionId ?? store.activeSessionId
    if (!resolvedSessionId) return

    const activeStream = activeStreamsRef.current.get(resolvedSessionId)
    activeStream?.abortController.abort()
    if (activeStream) {
      activeStreamsRef.current.delete(resolvedSessionId)
      notifyStreamChange()
    }

    const session = store.sessions.find((item) => item.id === resolvedSessionId) ?? null
    if (!session) return
    const lastMsg = activeStream
      ? session.messages.find((message) => message.id === activeStream.messageId)
      : session.messages[session.messages.length - 1]
    if (!lastMsg || lastMsg.role !== 'assistant') return

    const updatedToolCalls = lastMsg.toolCalls?.map((t) =>
      t.status === 'running' || t.status === 'pending'
        ? { ...t, status: 'error' as const, output: 'Cancelled by user', completedAt: Date.now() }
        : t
    )
    store.updateSession(session.id, {
      messages: session.messages.map((message) => message.id === lastMsg.id
        ? {
            ...lastMsg,
            toolCalls: updatedToolCalls,
            isStreaming: false,
            cancellation: {
              cancelledAt: Date.now(),
              cancelReason: reason,
              partialContentLength: lastMsg.content.length,
            },
          }
        : message),
    })
  }, [notifyStreamChange, targetSessionId])

  const setActiveStream = useCallback((sessionId: string, stream: ActiveChatStream) => {
    activeStreamsRef.current.set(sessionId, stream)
    notifyStreamChange()
  }, [notifyStreamChange])

  const clearActiveStream = useCallback((sessionId: string, abortController: AbortController) => {
    const activeStream = activeStreamsRef.current.get(sessionId)
    if (activeStream?.abortController !== abortController) return
    activeStreamsRef.current.delete(sessionId)
    notifyStreamChange()
  }, [notifyStreamChange])

  useEffect(() => {
    return () => {
      for (const sessionId of Array.from(activeStreamsRef.current.keys())) {
        cancelStream(sessionId)
      }
    }
  }, [cancelStream])

  const sendMessage = useCallback(async (userMessage: string, attachments?: MessageAttachment[], options?: SendMessageOptions) => {
    // Guard against accidental whitespace-only sends. If there are no attachments
    // either, do nothing — there is nothing to send.
    if ((!userMessage || !userMessage.trim()) && !attachments?.length) return

    const shortcutCommand = parseShortcutCommand(userMessage)
    const slashPipelineCommand = shortcutCommand ? null : parseSlashPipelineChatCommand(userMessage)
    const store = useAppStore.getState()
    const activeSession = store.sessions.find((s) => s.id === (targetSessionId ?? store.activeSessionId))
    if (!activeSession) { setError('No active session'); return }

    const controlCommand = parseChatControlCommand(userMessage)
    if (controlCommand) {
      if (activeStreamsRef.current.has(activeSession.id)) cancelStream(activeSession.id)

      if (controlCommand.type === 'clear') {
        store.updateSession(activeSession.id, { messages: [] })
        setError(null)
        return
      }

      const controlResult = controlCommand.type === 'help'
        ? { content: buildSlashCommandHelp(), isError: false }
        : controlCommand.type === 'model'
        ? (() => {
            const model = resolveModelControlReference(controlCommand.reference, store.models)
            if (!model) return { content: formatSlashMessage('slash.modelNotFound', { reference: controlCommand.reference }), isError: true }
            store.setSelectedModel(model)
            store.updateSession(activeSession.id, { modelId: model.id })
            return { content: formatSlashMessage('slash.modelSwitched', { name: model.name }), isError: false }
          })()
        : (() => {
            const agent = resolveAgentControlReference(controlCommand.reference, store.agents)
            if (!agent) return { content: formatSlashMessage('slash.agentNotFound', { reference: controlCommand.reference }), isError: true }
            const preferredModel = agent.modelId
              ? store.models.find((model) => model.id === agent.modelId && model.enabled)
              : null
            store.setSelectedAgent(agent)
            if (preferredModel) store.setSelectedModel(preferredModel)
            store.updateSession(activeSession.id, {
              agentId: agent.id,
              modelId: preferredModel?.id ?? activeSession.modelId,
            })
            return { content: formatSlashMessage('slash.agentUsing', { name: agent.name }), isError: false }
          })()

      store.updateSession(activeSession.id, {
        messages: [
          ...activeSession.messages,
          {
            id: generateId('msg'),
            role: 'user',
            content: userMessage,
            timestamp: Date.now(),
            ...(attachments?.length ? { attachments } : {}),
          },
          {
            id: generateId('msg'),
            role: 'assistant',
            content: controlResult.content,
            timestamp: Date.now(),
            isError: controlResult.isError,
          },
        ],
        title: activeSession.messages.length === 0 ? userMessage.slice(0, 30) : activeSession.title,
      })
      setError(controlResult.isError ? controlResult.content : null)
      return
    }

    if (activeStreamsRef.current.has(activeSession.id)) {
      if (slashPipelineCommand?.type === 'cancel') cancelStream(activeSession.id)
      return
    }

    const prevMessages = activeSession.messages
    const userMsg: Message = {
      id: generateId('msg'),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      ...(attachments?.length ? { attachments } : {}),
    }

    const getCurrentSessionState = () =>
      useAppStore.getState().sessions.find((session) => session.id === activeSession.id) ?? null
    const appendReplyAndReturnContextMessages = (assistantReply: Message) => {
      const latestSession = getCurrentSessionState()
      const currentMessages = latestSession?.messages ?? prevMessages
      useAppStore.getState().updateSession(activeSession.id, {
        messages: [...currentMessages, userMsg, assistantReply],
        title: currentMessages.length === 0 ? userMessage.slice(0, 30) : (latestSession?.title ?? activeSession.title),
      })
      return currentMessages
    }
    const pushImmediateAssistantReply = (content: string, isError = false) => {
      appendReplyAndReturnContextMessages({
          id: generateId('msg'),
          role: 'assistant',
          content,
          timestamp: Date.now(),
          isError,
      })
    }

    const pipelineChatLanguage = detectPipelineChatLanguage(userMessage)
    const pipelineCommand = slashPipelineCommand

    if (pipelineCommand) {
      setError(null)

      const abortController = new AbortController()

      const assistantMsg: Message = {
        id: generateId('msg'),
        role: 'assistant',
        content: pipelineCommand.type === 'run'
          ? (pipelineChatLanguage === 'zh'
            ? `正在准备流水线 ${pipelineCommand.reference}...`
            : `Preparing pipeline ${pipelineCommand.reference}...`)
          : (pipelineChatLanguage === 'zh' ? '正在处理流水线指令...' : 'Processing pipeline command...'),
        timestamp: Date.now(),
        isStreaming: true,
      }

      appendReplyAndReturnContextMessages(assistantMsg)
      setActiveStream(activeSession.id, { abortController, messageId: assistantMsg.id })

      try {
        if (pipelineCommand.type === 'list') {
          const pipelines = await listSavedPipelines()
          updateSessionMessage(activeSession.id, assistantMsg.id, {
            content: formatPipelineCatalogMessage(pipelines, pipelineChatLanguage),
            isStreaming: false,
          })
        } else if (pipelineCommand.type === 'help') {
          updateSessionMessage(activeSession.id, assistantMsg.id, {
            content: formatPipelineHelpMessage(pipelineChatLanguage),
            isStreaming: false,
          })
        } else if (pipelineCommand.type === 'cancel') {
          updateSessionMessage(activeSession.id, assistantMsg.id, {
            content: pipelineChatLanguage === 'zh' ? '当前没有正在运行的流水线。' : 'No pipeline is currently running.',
            isStreaming: false,
          })
        } else if (pipelineCommand.type === 'status') {
          const executions = store.workspacePath ? await loadPipelineExecutionsFromDisk(store.workspacePath) : []
          updateSessionMessage(activeSession.id, assistantMsg.id, {
            content: formatPipelineHistoryMessage(executions.slice(0, 1), pipelineChatLanguage),
            isStreaming: false,
          })
        } else if (pipelineCommand.type === 'history') {
          let pipelineId: string | undefined
          if (pipelineCommand.reference) {
            const resolution = await resolvePipelineByReference(pipelineCommand.reference)
            if (resolution.status === 'found') pipelineId = resolution.pipeline.id
          }
          const executions = store.workspacePath ? await loadPipelineExecutionsFromDisk(store.workspacePath, pipelineId) : []
          updateSessionMessage(activeSession.id, assistantMsg.id, {
            content: formatPipelineHistoryMessage(executions, pipelineChatLanguage),
            isStreaming: false,
          })
        } else {
          const resolution = await resolvePipelineByReference(pipelineCommand.reference)
          if (resolution.status !== 'found') {
            const content = resolution.status === 'ambiguous'
              ? (pipelineChatLanguage === 'zh'
                ? `流水线名称不明确，请使用完整名称或 ID：${resolution.matches.map((pipeline) => pipeline.name).join('、')}`
                : `Pipeline reference is ambiguous. Use the full name or ID: ${resolution.matches.map((pipeline) => pipeline.name).join(', ')}`)
              : (pipelineChatLanguage === 'zh' ? '找不到这条流水线。使用 /pipeline list 查看可用项。' : 'Pipeline not found. Use /pipeline list to see available pipelines.')
            updateSessionMessage(activeSession.id, assistantMsg.id, { content, isStreaming: false, isError: true })
            return
          }

          const pipelineToRun = pipelineCommand.args
            ? {
                ...resolution.pipeline,
                steps: resolution.pipeline.steps.map((step, index) => index === 0
                  ? { ...step, task: `Pipeline arguments:\n${Object.entries(pipelineCommand.args ?? {}).map(([key, value]) => `- ${key}: ${value}`).join('\n')}\n\n${step.task}` }
                  : step),
              }
            : resolution.pipeline
          const validation = validateAgentPipeline(pipelineToRun, useAppStore.getState().agents, useAppStore.getState().models)
          const highRiskAgents = pipelineToRun.steps
            .map((step) => useAppStore.getState().agents.find((agent) => agent.id === step.agentId))
            .filter((agent) => agent?.permissionMode === 'bypassPermissions')
            .map((agent) => agent?.name)
            .filter(Boolean)
          const previewLines = pipelineChatLanguage === 'zh'
            ? [
                `流水线：${resolution.pipeline.name}`,
                `步骤数：${pipelineToRun.steps.filter((step) => step.enabled !== false).length}/${pipelineToRun.steps.length}`,
                `输入摘要：${trimPipelinePreview(userMessage, 280)}`,
                `命名参数：${pipelineCommand.args ? Object.entries(pipelineCommand.args).map(([key, value]) => `${key}=${value}`).join(', ') : '无'}`,
                `高风险 Agent：${highRiskAgents.length ? highRiskAgents.join('、') : '无'}`,
                validation.issues.length ? `预检：${validation.issues.map((issue) => issue.message).join('；')}` : '预检：通过',
              ]
            : [
                `Pipeline: ${resolution.pipeline.name}`,
                `Steps: ${pipelineToRun.steps.filter((step) => step.enabled !== false).length}/${pipelineToRun.steps.length}`,
                `Input: ${trimPipelinePreview(userMessage, 280)}`,
                `Named args: ${pipelineCommand.args ? Object.entries(pipelineCommand.args).map(([key, value]) => `${key}=${value}`).join(', ') : 'none'}`,
                `High-risk agents: ${highRiskAgents.length ? highRiskAgents.join(', ') : 'none'}`,
                validation.issues.length ? `Dry-run: ${validation.issues.map((issue) => issue.message).join('; ')}` : 'Dry-run: passed',
              ]

          if (!validation.valid) {
            updateSessionMessage(activeSession.id, assistantMsg.id, {
              content: previewLines.join('\n'),
              isStreaming: false,
              isError: true,
            })
            return
          }

          updateSessionMessage(activeSession.id, assistantMsg.id, {
            content: previewLines.join('\n'),
            isStreaming: true,
          })

          const confirmed = await confirm({
            title: pipelineChatLanguage === 'zh' ? '运行这条流水线？' : 'Run this pipeline?',
            body: previewLines.join('\n'),
            confirmText: pipelineChatLanguage === 'zh' ? '运行' : 'Run',
            cancelText: pipelineChatLanguage === 'zh' ? '取消' : 'Cancel',
            danger: highRiskAgents.length > 0,
          })
          if (!confirmed) {
            updateSessionMessage(activeSession.id, assistantMsg.id, {
              content: pipelineChatLanguage === 'zh' ? '已取消运行流水线。' : 'Pipeline run cancelled before execution.',
              isStreaming: false,
            })
            return
          }

          const liveSteps: AgentPipelineProgressStep[] = []
          let lastProgressFlush = 0

          const execution = await executeAgentPipeline(pipelineToRun, {
            trigger: 'chat',
            persistExecution: true,
            persistLastRun: true,
            abortSignal: abortController.signal,
            onStepUpdate: (step) => {
              liveSteps[step.stepIndex] = {
                ...liveSteps[step.stepIndex],
                ...step,
              }

              const now = Date.now()
              if (step.status !== 'running' || now - lastProgressFlush >= 150) {
                lastProgressFlush = now
                updateSessionMessage(activeSession.id, assistantMsg.id, {
                  content: formatPipelineExecutionMessage(
                    resolution.pipeline.name,
                    liveSteps.filter(Boolean),
                    'running',
                    pipelineChatLanguage,
                  ),
                  isStreaming: true,
                })
              }
            },
          })

          const finalSteps = liveSteps.length > 0
            ? liveSteps.filter(Boolean)
            : execution.steps.map((step) => ({
                stepIndex: step.stepIndex,
                agentId: step.agentId,
                task: step.task,
                input: step.input,
                output: step.output,
                status: step.status,
                startedAt: step.startedAt,
                completedAt: step.completedAt,
                durationMs: step.durationMs,
                error: step.error,
              }))

          updateSessionMessage(activeSession.id, assistantMsg.id, {
            content: formatPipelineExecutionMessage(
              execution.pipelineName,
              finalSteps,
              execution.status,
              pipelineChatLanguage,
              execution.finalOutput,
              execution.error,
            ),
            isStreaming: false,
            isError: execution.status === 'error',
          })

          useAppStore.getState().addNotification({
            id: generateId('notif'),
            type: execution.status === 'success' ? 'success' : 'error',
            title: execution.status === 'success'
              ? t('agents.pipelineCompletedTitle', 'Pipeline completed: {name}').replace('{name}', execution.pipelineName)
              : t('agents.pipelineFailedTitle', 'Pipeline failed: {name}').replace('{name}', execution.pipelineName),
            message: buildPipelineExecutionNotificationMessage(execution),
            timestamp: Date.now(),
            read: false,
            action: {
              module: 'pipeline',
              label: t('agents.pipelineOpenRun', 'Open pipeline run'),
              path: buildPipelineExecutionPath({
                pipelineId: resolution.pipeline.id,
                executionId: execution.id,
              }),
            },
          })
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          // The pipeline run was cancelled by the user (e.g. via the stop button
          // or `/pipeline cancel`). cancelStream() has already recorded the
          // cancellation reason on the message; just clear the streaming flag
          // and surface a friendly message instead of treating the abort as a
          // generic provider error.
          const cancelledContent = pipelineChatLanguage === 'zh'
            ? '已取消正在运行的流水线。'
            : 'Pipeline run cancelled.'
          updateSessionMessage(activeSession.id, assistantMsg.id, {
            content: cancelledContent,
            isStreaming: false,
          })
        } else {
          const message = err instanceof Error
            ? err.message
            : (pipelineChatLanguage === 'zh' ? '流水线执行失败。' : 'Pipeline execution failed')
          setError(message)
          updateSessionMessage(activeSession.id, assistantMsg.id, {
            content: message,
            isStreaming: false,
            isError: true,
          })
        }
      } finally {
        clearActiveStream(activeSession.id, abortController)
      }

      return
    }

    const { models, agents, skills, selectedModel, selectedAgent } = store
    const defaultAgent = agents.find((a) => a.id === 'default-assistant')
    const recommendedAgent = !activeSession.agentId && !selectedAgent
      ? selectBestAgentForTask(userMessage, agents, skills, store.agentPerformance, store.agentSelectionPreferences)
      : null
    const shortcutAgent = shortcutCommand ? agents.find((a) => a.id === shortcutCommand.agentId && a.enabled !== false) : null
    const sessionAgent = shortcutAgent
      ?? (activeSession.agentId
      ? agents.find((a) => a.id === activeSession.agentId)
      : (recommendedAgent && recommendedAgent.score >= 20 ? recommendedAgent.agent : (selectedAgent ?? defaultAgent)))
    const model = activeSession.modelId
      ? models.find((m) => m.id === activeSession.modelId)
      : sessionAgent?.modelId
        ? models.find((m) => m.id === sessionAgent.modelId)
        : selectedModel

    if (!model) {
      const errorContent = 'No model selected. Please select a model in the toolbar, or run /pipeline list.'
      setError(errorContent)
      pushImmediateAssistantReply(errorContent, true)
      return
    }

    const validation = validateModelConfig(model)
    if (!validation.valid) {
      const errorContent = `Model configuration error: ${validation.error}. Please check Models settings.`
      setError(errorContent)
      pushImmediateAssistantReply(errorContent, true)
      return
    }

    setError(null)

    const abortController = new AbortController()

    try {
      if (model.apiKey || model.providerType === 'ollama') {
        initializeProvider(model.providerType, model.apiKey || 'ollama', model.baseUrl, model.provider)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize AI provider'
      setError(errorMsg)
      pushImmediateAssistantReply(errorMsg, true)
      return
    }

    const runId = generateId('run')
    const assistantMsg: Message = {
      id: generateId('msg'),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      modelUsed: model.name,
      isStreaming: true,
      agentId: sessionAgent?.id,
      runtime: {
        runId,
        sessionId: activeSession.id,
        agentId: sessionAgent?.id,
        agentName: sessionAgent?.name,
        modelId: model.id,
        modelName: model.name,
        startedAt: Date.now(),
      },
    }

    const contextMessagesAtSend = appendReplyAndReturnContextMessages(assistantMsg)
    setActiveStream(activeSession.id, { abortController, messageId: assistantMsg.id })

    const perfStart = performance.now()
    let tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined
    let hasError = false
    let autoRetryCount = 0
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null
    try {
      const modelIdentifier = `${model.provider}:${model.modelId}`

      // Convert app messages to AI SDK v6 ModelMessage[]
      const effectiveUserMsg = shortcutCommand
        ? { ...userMsg, content: buildShortcutCommandPrompt(shortcutCommand) }
        : userMsg
      const contextMessages = [...contextMessagesAtSend, effectiveUserMsg]
      const previousResponseId = model.providerType === 'openai'
        ? (options?.continuationResponseId ?? getPreviousOpenAIResponseId(contextMessagesAtSend))
        : undefined
      const requestMessages = previousResponseId ? [effectiveUserMsg] : contextMessages
      const modelMessages = buildModelMessages(requestMessages)
      const contextSummary = buildContextSummary(contextMessages)

      logger.info(`[Chat:Start] prevMessages=${prevMessages.length} → modelMessages=${modelMessages.length}`, {
        previousResponseId,
        requestMode: previousResponseId ? 'openai-response-chain' : 'full-history',
      })

      const mergedSkills = sessionAgent ? mergeSkillsWithBuiltins(skills) : []

      const filteredTools = sessionAgent ? getToolsForAgent(sessionAgent.skills, mergedSkills, {
        includePluginTools: true,
        allowedTools: sessionAgent.allowedTools,
        disallowedTools: sessionAgent.disallowedTools,
        permissionMode: sessionAgent.permissionMode,
        errorContext: {
          sessionId: activeSession.id,
          agentId: sessionAgent.id,
          skillIds: sessionAgent.skills,
          source: 'chat',
        },
      }) : {}

      const skillPrompts = sessionAgent
        ? await getSkillSystemPrompts(sessionAgent.skills, mergedSkills)
        : ''
      const assignedSkillIds = new Set(sessionAgent?.skills ?? [])
      const promptMemories = sessionAgent?.autoLearn
        ? [
            ...(store.globalMemories ?? []),
            ...(activeSession.memories ?? []),
            ...(sessionAgent.memories ?? []),
            ...mergedSkills
              .filter((skill) => assignedSkillIds.has(skill.id))
              .flatMap((skill) => skill.memories ?? []),
          ]
        : undefined

      const systemPrompt = buildSystemPrompt({
        agentPrompt: sessionAgent?.systemPrompt,
        sessionContext: activeSession.contextPrompt,
        responseStyle: sessionAgent?.responseStyle,
        memories: promptMemories,
        skillPrompts,
        toolNames: Object.keys(filteredTools),
        permissionMode: sessionAgent?.permissionMode,
        autoLearn: sessionAgent?.autoLearn,
      })
      const runtimeSnapshot = {
        ...assistantMsg.runtime,
        runId,
        sessionId: activeSession.id,
        messageId: assistantMsg.id,
        agentId: sessionAgent?.id,
        agentName: sessionAgent?.name,
        modelId: model.id,
        modelName: model.name,
        toolNames: Object.keys(filteredTools),
        systemPromptHash: hashText(systemPrompt ?? ''),
        startedAt: assistantMsg.runtime?.startedAt ?? Date.now(),
      }

      let fullContent = ''
      let currentToolCalls: ToolCall[] = []
      let contentParts: ContentPart[] = []
      let lastFlush = 0
      const flushToStore = (isFinal: boolean) => {
        const latest = useAppStore.getState().sessions.find((s) => s.id === activeSession.id)
        if (!latest) return false
        if (!latest.messages.some((message) => message.id === assistantMsg.id)) {
          logger.warn('[Chat:FlushSkipped] Assistant message was removed while streaming; aborting response', {
            sessionId: activeSession.id,
            messageId: assistantMsg.id,
          })
          abortController.abort()
          return false
        }
        useAppStore.getState().updateSession(activeSession.id, {
          messages: latest.messages.map((message) => message.id === assistantMsg.id
            ? {
                ...message,
                content: fullContent,
                toolCalls: currentToolCalls.length ? currentToolCalls : undefined,
                contentParts: contentParts.length ? contentParts : undefined,
                tokenUsage,
                runtime: runtimeSnapshot,
                contextSummary,
                isError: hasError || undefined,
                isStreaming: !isFinal,
              }
            : message),
        })
        return true
      }

      // Stream inactivity timeout: abort if no events received for 5 minutes
      const STREAM_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000
      const resetInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer)
        inactivityTimer = setTimeout(() => {
          logger.warn('[Chat:Timeout] No stream events for 5 minutes — aborting')
          setError('Response timed out — no data received for 5 minutes. Please retry.')
          cancelStream(activeSession.id, 'Response timed out — no data received for 5 minutes')
        }, STREAM_INACTIVITY_TIMEOUT_MS)
      }
      resetInactivityTimer()

      const toolStepBudget = Math.max(2, Math.min((sessionAgent?.maxTurns ?? defaultAgent?.maxTurns ?? 30) + 1, MAX_CHAT_TOOL_STEPS))
      const cacheKey = `chat:${activeSession.parentSessionId ?? activeSession.id}`

      // Auto-retry config for transient errors (rate limit, network, server)
      const MAX_AUTO_RETRIES = 3
      const RETRY_DELAYS_MS: Record<string, number[]> = {
        'rate-limit': [5000, 15000, 40000],
        'network-offline': [2000, 5000, 12000],
        'network-refused': [2000, 5000, 12000],
        'timeout': [3000, 8000, 20000],
        'server': [3000, 8000, 20000],
      }

      const runStreamAttempt = async () => {
        for await (const event of streamResponseWithTools(modelIdentifier, modelMessages, {
          systemPrompt,
          tools: filteredTools,
          // Agent maxTurns is a tool-action budget; the model still needs one
          // extra step to turn the final tool result into an answer.
          maxSteps: toolStepBudget,
          abortSignal: abortController.signal,
          apiKey: model.apiKey,
          baseUrl: model.baseUrl,
          providerType: model.providerType,
          cacheKey,
          previousResponseId,
        })) {
          if (abortController.signal.aborted) return
          resetInactivityTimer()

          switch (event.type) {
            case 'text-delta':
              if (event.text != null) {
                fullContent += event.text
                // Append to existing text part or create a new one
                const lastPart = contentParts[contentParts.length - 1]
                if (lastPart && lastPart.type === 'text') {
                  lastPart.text += event.text
                } else {
                  contentParts.push({ type: 'text', text: event.text })
                }
                // Throttle UI updates for text-delta to avoid state-overwrite races
                const now = Date.now()
                if (now - lastFlush > getStreamFlushIntervalMs(fullContent.length)) {
                  if (!flushToStore(false)) return
                  lastFlush = now
                }
              }
              break

            case 'tool-call': {
              logger.info(`[Chat:ToolCall] ${event.toolName} | id=${event.toolCallId}`, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                inputKeys: Object.keys(event.input ?? {}),
              })
              currentToolCalls = [
                ...currentToolCalls.filter((t) => t.id !== event.toolCallId),
                { id: event.toolCallId, toolName: event.toolName, input: event.input, status: 'running', startedAt: Date.now() },
              ]
              // Add tool-call part to ordered content
              if (!contentParts.some((part) => part.type === 'tool-call' && part.toolCallId === event.toolCallId)) {
                contentParts.push({ type: 'tool-call', toolCallId: event.toolCallId })
              }
              if (!flushToStore(false)) return
              lastFlush = Date.now()
              continue
            }

            case 'tool-result': {
              const matchingCall = currentToolCalls.find(t => t.id === event.toolCallId)
              const toolFailed = looksLikeToolFailureOutput(event.output)
              const normalizedOutput = toolFailed ? sanitizeToolError(event.output) : event.output
              const duration = matchingCall?.startedAt ? `${Date.now() - matchingCall.startedAt}ms` : '?'
              const outputLen = normalizedOutput?.length ?? 0
              logger.info(`[Chat:ToolResult] ${event.toolName} | id=${event.toolCallId} | duration=${duration} | outputLen=${outputLen}`, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                durationMs: duration,
                output: outputLen <= 4000 ? normalizedOutput : normalizedOutput.slice(0, 4000) + `... [truncated]`,
              })
              if (toolFailed) {
                logger.warn(`[Chat:ToolResultReclassified] ${event.toolName} | id=${event.toolCallId} returned an error-shaped result payload`, {
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                })
              }
              // Cap persisted tool output at 50KB to avoid bloating the session
              // store (tool outputs can be very large when they wrap file contents
              // or API responses). The original length is kept as metadata so the
              // UI can show an accurate "view full output" affordance once we add
              // an external store for large payloads.
              const PERSISTED_TOOL_OUTPUT_MAX = 50_000
              const persistedOutput = outputLen > PERSISTED_TOOL_OUTPUT_MAX
                ? normalizedOutput.slice(0, PERSISTED_TOOL_OUTPUT_MAX) + `\n\n... [${(outputLen - PERSISTED_TOOL_OUTPUT_MAX).toLocaleString()} characters truncated — total ${outputLen.toLocaleString()} chars]`
                : normalizedOutput
              const completedAt = Date.now()
              const durationMs = matchingCall?.startedAt ? completedAt - matchingCall.startedAt : undefined
              const envelope = await createToolOutputEnvelope({
                status: toolFailed ? 'error' : 'completed',
                output: normalizedOutput,
                durationMs,
                workspacePath: store.workspacePath,
                runId,
                toolCallId: event.toolCallId,
              })
              currentToolCalls = currentToolCalls.map((t) =>
                t.id === event.toolCallId
                  ? {
                      ...t,
                      status: toolFailed ? 'error' : 'completed',
                      output: persistedOutput,
                      outputEnvelope: envelope,
                      completedAt,
                      durationMs,
                    }
                  : t
              )
              if (!flushToStore(false)) return
              lastFlush = Date.now()
              continue
            }

            case 'tool-error': {
              const errMatchingCall = currentToolCalls.find(t => t.id === event.toolCallId)
              const errDuration = errMatchingCall?.startedAt ? `${Date.now() - errMatchingCall.startedAt}ms` : '?'
              const sanitizedError = sanitizeToolError(event.error)
              logger.error(`[Chat:ToolError] ${event.toolName} | id=${event.toolCallId} | duration=${errDuration}`, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                durationMs: errDuration,
                inputKeys: errMatchingCall?.input ? Object.keys(errMatchingCall.input) : [],
                error: sanitizedError,
              })
              recordToolErrorMemory({
                sessionId: activeSession.id,
                agentId: sessionAgent?.id,
                skillIds: sessionAgent?.skills,
                source: 'chat-stream',
                toolName: event.toolName,
                input: errMatchingCall?.input,
                error: sanitizedError,
                durationMs: errMatchingCall?.startedAt ? Date.now() - errMatchingCall.startedAt : undefined,
                errorSource: 'stream',
              })
              currentToolCalls = currentToolCalls.map((t) =>
                t.id === event.toolCallId
                  ? {
                      ...t,
                      status: 'error',
                      output: sanitizedError,
                      outputEnvelope: {
                        status: 'error',
                        summary: sanitizedError,
                        durationMs: t.startedAt ? Date.now() - t.startedAt : undefined,
                        outputChars: sanitizedError.length,
                      },
                      completedAt: Date.now(),
                    }
                  : t
              )
              if (!flushToStore(false)) return
              lastFlush = Date.now()
              continue
            }

            case 'finish-step': {
              logger.info(`[Chat:StepFinished] reason=${event.finishReason} | textLen=${fullContent.length} | tools=${currentToolCalls.length}`)
              continue
            }

            case 'error':
              hasError = true
              logger.error(`[Chat:Error]`, { error: sanitizeToolError(event.error) })
              fullContent += `\n\n[Tool Error] ${sanitizeToolError(event.error)}`
              break

            case 'usage':
              tokenUsage = {
                promptTokens: event.promptTokens,
                completionTokens: event.completionTokens,
                totalTokens: event.totalTokens,
              }
              break

            case 'response-metadata':
              runtimeSnapshot.providerResponseId = event.providerResponseId ?? runtimeSnapshot.providerResponseId
              runtimeSnapshot.cachedPromptTokens = event.cachedPromptTokens ?? runtimeSnapshot.cachedPromptTokens
              break
          }

          // Throttled flush for text-delta
          const now = Date.now()
          if (now - lastFlush >= getStreamFlushIntervalMs(fullContent.length)) {
            lastFlush = now
            if (!flushToStore(false)) return
          }
        }
      }

      // Stream with exponential-backoff auto-retry for transient errors
      let streamDone = false
      while (!streamDone && !abortController.signal.aborted) {
        try {
          await runStreamAttempt()
          streamDone = true
        } catch (streamErr) {
          if (abortController.signal.aborted) break

          const classification = classifyAppError(streamErr)
          // Only auto-retry if there is no partial content yet — retrying mid-stream
          // would cause duplicate tool calls; the user can manually continue instead.
          const hasPartialProgress = fullContent.length > 0
            || currentToolCalls.some((tc) => tc.status === 'completed' || tc.status === 'error')

          if (
            !hasPartialProgress
            && classification.retryable
            && autoRetryCount < MAX_AUTO_RETRIES
          ) {
            autoRetryCount++
            const delays = RETRY_DELAYS_MS[classification.category] ?? RETRY_DELAYS_MS['server']
            const delayMs = delays[Math.min(autoRetryCount - 1, delays.length - 1)]
            const countdownSec = Math.round(delayMs / 1000)
            logger.warn(`[Chat:AutoRetry] attempt=${autoRetryCount}/${MAX_AUTO_RETRIES} delay=${delayMs}ms category=${classification.category}`)

            // Show a countdown notice inside the (still-streaming) message
            const retryNotice = t(
              'chat.autoRetrying',
              'Auto-retrying in {s}s (attempt {n}/{max}) — {hint}',
            )
              .replace('{s}', String(countdownSec))
              .replace('{n}', String(autoRetryCount))
              .replace('{max}', String(MAX_AUTO_RETRIES))
              .replace('{hint}', classification.hint)
            updateSessionMessage(activeSession.id, assistantMsg.id, {
              content: retryNotice,
              isStreaming: true,
              autoRetryCount,
            })

            await new Promise<void>((resolve) => {
              // Respect abort while waiting
              const tid = setTimeout(resolve, delayMs)
              abortController.signal.addEventListener('abort', () => { clearTimeout(tid); resolve() }, { once: true })
            })

            if (!abortController.signal.aborted) {
              // Clear the retry notice before the next attempt
              updateSessionMessage(activeSession.id, assistantMsg.id, {
                content: '',
                isStreaming: true,
                autoRetryCount,
              })
            }
            continue
          }

          // Cannot auto-retry — propagate to outer catch
          throw streamErr
        }
      }

      // Clear inactivity timeout now that the stream has ended
      if (inactivityTimer) clearTimeout(inactivityTimer)

      // Skip post-stream processing if cancelled — cancelStream() already handled cleanup
      if (abortController.signal.aborted) {
        // no-op: cancelStream() handled cleanup
      } else {
        // Final flush
        const chatDuration = (performance.now() - perfStart).toFixed(0)
        const toolSummary = currentToolCalls.map((t) => ({
          id: t.id,
          tool: t.toolName,
          status: t.status,
          durationMs: t.startedAt && t.completedAt ? t.completedAt - t.startedAt : null,
          outputLen: t.output?.length ?? 0,
        }))
        logger.info(`[Chat:Complete] duration=${chatDuration}ms | textLen=${fullContent.length} | parts=${contentParts.length} | tools=${currentToolCalls.length}`, {
          durationMs: chatDuration,
          textLength: fullContent.length,
          contentParts: contentParts.length,
          toolCalls: toolSummary,
          tokenUsage,
        })
        flushToStore(true)

        // Auto-learn: agent memory is now managed via the memory_store tool
        // rather than naive keyword detection. The autoLearn flag is kept
        // for future use by the memory_store tool's execute() logic.
      }
    } catch (err) {
      hasError = true
      if (abortController.signal.aborted) {
        try {
          const latest = useAppStore.getState().sessions.find((s) => s.id === activeSession.id)
          if (latest) {
            const last = latest.messages.find((message) => message.id === assistantMsg.id)
            if (last?.isStreaming) {
              useAppStore.getState().updateSession(activeSession.id, {
                messages: latest.messages.map((message) => message.id === assistantMsg.id ? { ...last, isStreaming: false } : message),
              })
            }
          }
        } catch (cleanupErr) {
          logger.warn('[Chat:Cancel] Cleanup after abort failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) })
        }
      } else {
        const errorContent = err instanceof Error ? err.message : 'An unknown error occurred'
        const classification = classifyAppError(err)
        setError(errorContent)
        try {
          const latest = useAppStore.getState().sessions.find((s) => s.id === activeSession.id)
          if (latest) {
            const currentMsg = latest.messages.find((message) => message.id === assistantMsg.id)
            // If partial content was generated, preserve it and mark as mid-stream failure
            // so the user can resume without starting over from scratch.
            const hasPartialProgress = (currentMsg?.content?.length ?? 0) > 0
              || (currentMsg?.toolCalls ?? []).some((tc) => tc.status === 'completed' || tc.status === 'error')
            useAppStore.getState().updateSession(activeSession.id, {
              messages: latest.messages.map((message) => message.id === assistantMsg.id
                ? hasPartialProgress
                  ? {
                      ...message,
                      isStreaming: false,
                      isError: false,
                      failedMidStream: true,
                      streamError: sanitizeToolError(errorContent),
                      autoRetryCount: autoRetryCount > 0 ? autoRetryCount : undefined,
                      errorInfo: {
                        category: 'provider',
                        retryable: classification.retryable,
                        hint: classification.hint || 'Check your API quota and network, then continue or retry.',
                        rawSanitized: sanitizeToolError(errorContent),
                        source: model.providerType,
                      },
                    }
                  : {
                      ...message,
                      content: errorContent,
                      isStreaming: false,
                      isError: true,
                      autoRetryCount: autoRetryCount > 0 ? autoRetryCount : undefined,
                      errorInfo: {
                        category: 'provider',
                        retryable: classification.retryable,
                        hint: classification.hint || 'Retry the message, switch model, or check provider settings.',
                        rawSanitized: sanitizeToolError(errorContent),
                        source: model.providerType,
                      },
                    }
                : message),
            })
          }
        } catch (cleanupErr) {
          logger.warn('[Chat:Error] Store cleanup failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) })
        }
      }
    } finally {
      clearActiveStream(activeSession.id, abortController)
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
        inactivityTimer = null
      }
      const elapsed = Math.round(performance.now() - perfStart)
      // Record model usage statistics (always, even on cancel/error)
      if (tokenUsage) {
        useAppStore.getState().recordModelUsage(
          model.id,
          tokenUsage.promptTokens,
          tokenUsage.completionTokens,
          elapsed,
          hasError,
          hasError ? (error ?? undefined) : undefined,
          tokenUsage.totalTokens,
        )
      } else if (!hasError) {
        // Only record zero-token call if not an error (API was actually reached)
        useAppStore.getState().recordModelUsage(model.id, 0, 0, elapsed)
      } else {
        useAppStore.getState().recordModelUsage(model.id, 0, 0, elapsed, true, error ?? undefined)
      }
      // Record agent performance stats
      if (sessionAgent) {
        useAppStore.getState().recordAgentPerformance(sessionAgent.id, elapsed, tokenUsage?.totalTokens ?? 0, hasError)
      }
    }
  }, [cancelStream, clearActiveStream, setActiveStream, targetSessionId])

  const retryLastError = useCallback(() => {
    const store = useAppStore.getState()
    const session = resolveTargetSession()
    if (session && activeStreamsRef.current.has(session.id)) return
    if (!session || session.messages.length < 2) return

    const lastMsg = session.messages[session.messages.length - 1]
    if (!lastMsg?.isError && !lastMsg?.failedMidStream) return
    // Don't retry a message that is still streaming — wait for it to complete
    // or be cancelled first so we don't double-fire requests.
    if (lastMsg.isStreaming) return

    const continuationResponseId = lastMsg.runtime?.providerResponseId
    let userText = ''
    let userAttachments: MessageAttachment[] | undefined
    for (let i = session.messages.length - 2; i >= 0; i--) {
      if (session.messages[i].role === 'user') {
        userText = session.messages[i].content
        userAttachments = session.messages[i].attachments
        break
      }
    }
    if (!userText && !userAttachments?.length) return

    const cleaned = session.messages.slice(0, -2)
    store.updateSession(session.id, { messages: cleaned })

    sendMessage(userText, userAttachments, { continuationResponseId })
  }, [resolveTargetSession, sendMessage])

  const deleteMessage = useCallback((messageId: string) => {
    const store = useAppStore.getState()
    const session = resolveTargetSession(store)
    if (!session) return
    store.updateSession(session.id, {
      messages: session.messages.filter((m) => m.id !== messageId),
    })
  }, [resolveTargetSession])

  const regenerateMessage = useCallback((messageId: string) => {
    const store = useAppStore.getState()
    const session = resolveTargetSession(store)
    if (session && activeStreamsRef.current.has(session.id)) return
    if (!session) return

    // Find the assistant message to regenerate
    const msgIndex = session.messages.findIndex((m) => m.id === messageId)
    if (msgIndex < 0) return
    // Regeneration only makes sense for assistant messages — bail out cleanly
    // if a user message id was passed in by mistake.
    if (session.messages[msgIndex]?.role !== 'assistant') return

    // Find the user message before it
    let userText = ''
    let userAttachments: MessageAttachment[] | undefined
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (session.messages[i].role === 'user') {
        userText = session.messages[i].content
        userAttachments = session.messages[i].attachments
        break
      }
    }
    if (!userText && !userAttachments?.length) return

    // Remove messages from the assistant message onwards
    const cleaned = session.messages.slice(0, msgIndex)
    // Also remove the user message (sendMessage will re-add it)
    const withoutUser = cleaned.slice(0, -1)
    const continuationResponseId = session.messages[msgIndex]?.runtime?.providerResponseId
    store.updateSession(session.id, { messages: withoutUser })

    sendMessage(userText, userAttachments, { continuationResponseId })
  }, [resolveTargetSession, sendMessage])

  const clearMessages = useCallback(() => {
    const store = useAppStore.getState()
    const session = resolveTargetSession(store)
    if (!session) return
    store.updateSession(session.id, { messages: [] })
  }, [resolveTargetSession])

  /**
   * Resume after a mid-stream failure (failedMidStream === true).
   * The partial message is kept as context; we send a continuation prompt
   * so the model picks up where it left off without wasting the work already done.
   */
  const resumeFromMessage = useCallback((messageId: string) => {
    const store = useAppStore.getState()
    const session = resolveTargetSession(store)
    if (!session || activeStreamsRef.current.has(session.id)) return

    const msgIndex = session.messages.findIndex((m) => m.id === messageId)
    if (msgIndex < 0) return
    const failedMsg = session.messages[msgIndex]
    if (!failedMsg?.failedMidStream) return

    // Clear the failure markers so the message looks like a completed turn
    const fixedMsg = {
      ...failedMsg,
      failedMidStream: undefined as boolean | undefined,
      streamError: undefined as string | undefined,
      isError: false,
      isStreaming: false,
    }

    store.updateSession(session.id, {
      messages: session.messages.map((m) => m.id === messageId ? fixedMsg : m),
    })

    // Detect language from prior messages to pick the right continuation prompt
    const hasChinese = session.messages
      .slice(0, msgIndex)
      .some((m) => /[\u4e00-\u9fff]/.test(m.content))
    const continuePrompt = hasChinese
      ? '请从上次中断的地方继续，无需重复已完成的步骤。'
      : 'Please continue from where you left off. Do not repeat steps already completed.'

    sendMessage(continuePrompt)
  }, [resolveTargetSession, sendMessage])

  const loadingSessionId = targetSessionId ?? useAppStore.getState().activeSessionId
  const isLoading = Boolean(loadingSessionId && activeStreamsRef.current.has(loadingSessionId))

  return { sendMessage, cancelStream, retryLastError, resumeFromMessage, deleteMessage, regenerateMessage, clearMessages, isLoading, error }
}
