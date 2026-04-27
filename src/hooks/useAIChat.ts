// Hook for managing AI chat interactions within a session.
//
// AI SDK v6 aligned:
// - Uses ModelMessage types directly (no custom AIChatMessage)
// - toModelMessages() converts app Message[] to AI SDK v6 ModelMessage[]
// - Stream events use v6 field names (input/output, finish-step, tool-error)

import { useState, useCallback, useRef, useEffect } from 'react'
import { streamResponseWithTools, initializeProvider, validateModelConfig } from '@/services/aiService'
import { executeAgentPipeline, listSavedPipelines, resolvePipelineByReference, type AgentPipelineProgressStep } from '@/services/agentPipelineService'
import { loadPipelineExecutionsFromDisk } from '@/services/pipelineFiles'
import { detectNaturalPipelineChatCommand, looksLikePipelineChatCommand, parseSlashPipelineChatCommand } from '@/services/pipelineChatCommands'
import { getToolsForAgent, getSkillSystemPrompts, mergeSkillsWithBuiltins, buildSystemPrompt } from '@/services/tools'
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

const STREAM_FLUSH_INTERVAL = 50 // ms between store updates during text streaming

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
        '可使用 /pipeline <名称或ID>，或直接说“运行 Morning Run 流水线”。',
      ].join('\n')
    : [
        'Saved pipelines',
        '',
        ...pipelines.map((pipeline, index) => `${index + 1}. ${pipeline.name} · ${pipeline.steps.length} steps · id: ${pipeline.id}`),
        '',
        'Run one with /pipeline <name-or-id>, or say "run pipeline Morning Run".',
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

export function useAIChat() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const streamingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    // Immediately clear loading state so the UI reflects the stop
    streamingRef.current = false
    setIsLoading(false)

    const store = useAppStore.getState()
    const session = store.sessions.find((s) => s.id === store.activeSessionId)
    if (!session) return
    const lastMsg = session.messages[session.messages.length - 1]
    if (!lastMsg || lastMsg.role !== 'assistant') return

    const updatedToolCalls = lastMsg.toolCalls?.map((t) =>
      t.status === 'running' || t.status === 'pending'
        ? { ...t, status: 'error' as const, output: 'Cancelled by user', completedAt: Date.now() }
        : t
    )
    const baseMessages = session.messages.slice(0, -1)
    store.updateSession(session.id, {
      messages: [...baseMessages, {
        ...lastMsg,
        toolCalls: updatedToolCalls,
        isStreaming: false,
        cancellation: {
          cancelledAt: Date.now(),
          cancelReason: 'Cancelled by user',
          partialContentLength: lastMsg.content.length,
        },
      }],
    })
  }, [])

  const sendMessage = useCallback(async (userMessage: string, attachments?: MessageAttachment[]) => {
    const earlyPipelineCommand = parseSlashPipelineChatCommand(userMessage)
    if (streamingRef.current) {
      if (earlyPipelineCommand?.type === 'cancel') cancelStream()
      return
    }

    const store = useAppStore.getState()
    const activeSession = store.sessions.find((s) => s.id === store.activeSessionId)
    if (!activeSession) { setError('No active session'); return }

    const prevMessages = activeSession.messages
    const userMsg: Message = {
      id: generateId('msg'),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      ...(attachments?.length ? { attachments } : {}),
    }

    const pushImmediateAssistantReply = (content: string, isError = false) => {
      store.updateSession(activeSession.id, {
        messages: [...prevMessages, userMsg, {
          id: generateId('msg'),
          role: 'assistant',
          content,
          timestamp: Date.now(),
          isError,
        }],
        title: prevMessages.length === 0 ? userMessage.slice(0, 30) : activeSession.title,
      })
    }

    const pipelineChatLanguage = detectPipelineChatLanguage(userMessage)
    const slashPipelineCommand = parseSlashPipelineChatCommand(userMessage)
    const pipelineCommand = slashPipelineCommand
      ?? (looksLikePipelineChatCommand(userMessage)
        ? detectNaturalPipelineChatCommand(userMessage, await listSavedPipelines())
        : null)

    if (pipelineCommand) {
      streamingRef.current = true
      setIsLoading(true)
      setError(null)

      const abortController = new AbortController()
      abortRef.current = abortController

      const assistantMsg: Message = {
        id: generateId('msg'),
        role: 'assistant',
        content: pipelineCommand.type === 'run'
          ? `Preparing pipeline ${pipelineCommand.reference}...`
          : 'Processing pipeline command...',
        timestamp: Date.now(),
        isStreaming: true,
      }

      store.updateSession(activeSession.id, {
        messages: [...prevMessages, userMsg, assistantMsg],
        title: prevMessages.length === 0 ? userMessage.slice(0, 30) : activeSession.title,
      })

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
              ? `Pipeline completed: ${execution.pipelineName}`
              : `Pipeline failed: ${execution.pipelineName}`,
            message: execution.error || execution.finalOutput?.slice(0, 120) || undefined,
            timestamp: Date.now(),
            read: false,
            action: { module: 'pipeline', label: 'Open pipeline history' },
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Pipeline execution failed'
        setError(message)
        updateSessionMessage(activeSession.id, assistantMsg.id, {
          content: message,
          isStreaming: false,
          isError: true,
        })
      } finally {
        streamingRef.current = false
        abortRef.current = null
        setIsLoading(false)
      }

      return
    }

    const { models, agents, skills, selectedModel, selectedAgent } = store
    const defaultAgent = agents.find((a) => a.id === 'default-assistant')
    const recommendedAgent = !activeSession.agentId && !selectedAgent
      ? selectBestAgentForTask(userMessage, agents, skills, store.agentPerformance)
      : null
    const sessionAgent = activeSession.agentId
      ? agents.find((a) => a.id === activeSession.agentId)
      : (recommendedAgent && recommendedAgent.score >= 20 ? recommendedAgent.agent : (selectedAgent ?? defaultAgent))
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

    streamingRef.current = true
    setIsLoading(true)
    setError(null)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      if (model.apiKey || model.providerType === 'ollama') {
        initializeProvider(model.providerType, model.apiKey || 'ollama', model.baseUrl, model.provider)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize AI provider'
      setError(errorMsg)
      pushImmediateAssistantReply(errorMsg, true)
      streamingRef.current = false
      setIsLoading(false)
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

    store.updateSession(activeSession.id, {
      messages: [...prevMessages, userMsg, assistantMsg],
      title: prevMessages.length === 0 ? userMessage.slice(0, 30) : activeSession.title,
    })

    const perfStart = performance.now()
    let tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined
    let hasError = false
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null
    try {
      const modelIdentifier = `${model.provider}:${model.modelId}`

      // Convert app messages to AI SDK v6 ModelMessage[]
      const contextMessages = [...prevMessages, userMsg]
      const modelMessages = buildModelMessages(contextMessages)
      const contextSummary = buildContextSummary(contextMessages)

      logger.info(`[Chat:Start] prevMessages=${prevMessages.length} → modelMessages=${modelMessages.length}`)

      const mergedSkills = sessionAgent ? mergeSkillsWithBuiltins(skills) : []

      const filteredTools = sessionAgent ? getToolsForAgent(sessionAgent.skills, mergedSkills, {
        includePluginTools: true,
        allowedTools: sessionAgent.allowedTools,
        disallowedTools: sessionAgent.disallowedTools,
        permissionMode: sessionAgent.permissionMode,
      }) : {}

      const skillPrompts = sessionAgent
        ? await getSkillSystemPrompts(sessionAgent.skills, mergedSkills)
        : ''

      const systemPrompt = buildSystemPrompt({
        agentPrompt: sessionAgent?.systemPrompt,
        responseStyle: sessionAgent?.responseStyle,
        memories: sessionAgent?.memories,
        skillPrompts,
        toolNames: Object.keys(filteredTools),
        permissionMode: sessionAgent?.permissionMode,
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
        if (!latest) return
        const baseMessages = latest.messages.slice(0, -1)
        useAppStore.getState().updateSession(activeSession.id, {
          messages: [...baseMessages, {
            ...assistantMsg,
            content: fullContent,
            toolCalls: currentToolCalls.length ? currentToolCalls : undefined,
            contentParts: contentParts.length ? contentParts : undefined,
            tokenUsage,
            runtime: runtimeSnapshot,
            contextSummary,
            isError: hasError || undefined,
            isStreaming: !isFinal,
          }],
        })
      }

      // Stream inactivity timeout: abort if no events received for 5 minutes
      const STREAM_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000
      const resetInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer)
        inactivityTimer = setTimeout(() => {
          logger.warn('[Chat:Timeout] No stream events for 5 minutes — aborting')
          setError('Response timed out — no data received for 5 minutes. Please retry.')
          abortController.abort()
        }, STREAM_INACTIVITY_TIMEOUT_MS)
      }
      resetInactivityTimer()

      for await (const event of streamResponseWithTools(modelIdentifier, modelMessages, {
        systemPrompt,
        tools: filteredTools,
        maxSteps: Math.max(2, Math.min(sessionAgent?.maxTurns ?? 20, 50)),
        abortSignal: abortController.signal,
        apiKey: model.apiKey,
        baseUrl: model.baseUrl,
      })) {
        if (abortController.signal.aborted) break
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
              if (now - lastFlush > STREAM_FLUSH_INTERVAL) {
                flushToStore(false)
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
            contentParts.push({ type: 'tool-call', toolCallId: event.toolCallId })
            flushToStore(false)
            lastFlush = Date.now()
            continue
          }

          case 'tool-result': {
            const matchingCall = currentToolCalls.find(t => t.id === event.toolCallId)
            const duration = matchingCall?.startedAt ? `${Date.now() - matchingCall.startedAt}ms` : '?'
            const outputLen = event.output?.length ?? 0
            logger.info(`[Chat:ToolResult] ${event.toolName} | id=${event.toolCallId} | duration=${duration} | outputLen=${outputLen}`, {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              durationMs: duration,
              output: outputLen <= 4000 ? event.output : event.output.slice(0, 4000) + `... [truncated]`,
            })
            // Cap persisted tool output at 50KB to avoid bloating the session
            // store (tool outputs can be very large when they wrap file contents
            // or API responses). The original length is kept as metadata so the
            // UI can show an accurate "view full output" affordance once we add
            // an external store for large payloads.
            const PERSISTED_TOOL_OUTPUT_MAX = 50_000
            const persistedOutput = outputLen > PERSISTED_TOOL_OUTPUT_MAX
              ? event.output.slice(0, PERSISTED_TOOL_OUTPUT_MAX) + `\n\n... [${(outputLen - PERSISTED_TOOL_OUTPUT_MAX).toLocaleString()} characters truncated — total ${outputLen.toLocaleString()} chars]`
              : event.output
            const completedAt = Date.now()
            const durationMs = matchingCall?.startedAt ? completedAt - matchingCall.startedAt : undefined
            const envelope = await createToolOutputEnvelope({
              status: 'completed',
              output: event.output,
              durationMs,
              workspacePath: store.workspacePath,
              runId,
              toolCallId: event.toolCallId,
            })
            currentToolCalls = currentToolCalls.map((t) =>
              t.id === event.toolCallId
                ? { ...t, status: 'completed', output: persistedOutput, outputEnvelope: envelope, completedAt, durationMs }
                : t
            )
            flushToStore(false)
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
            flushToStore(false)
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
        }

        // Throttled flush for text-delta
        const now = Date.now()
        if (now - lastFlush >= STREAM_FLUSH_INTERVAL) {
          lastFlush = now
          flushToStore(false)
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
            const base = latest.messages.slice(0, -1)
            const last = latest.messages[latest.messages.length - 1]
            if (last?.isStreaming) {
              useAppStore.getState().updateSession(activeSession.id, {
                messages: [...base, { ...last, isStreaming: false }],
              })
            }
          }
        } catch (cleanupErr) {
          logger.warn('[Chat:Cancel] Cleanup after abort failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) })
        }
      } else {
        const errorContent = err instanceof Error ? err.message : 'An unknown error occurred'
        setError(errorContent)
        try {
          const latest = useAppStore.getState().sessions.find((s) => s.id === activeSession.id)
          if (latest) {
            const base = latest.messages.slice(0, -1)
            useAppStore.getState().updateSession(activeSession.id, {
              messages: [...base, {
                ...assistantMsg,
                content: errorContent,
                isStreaming: false,
                isError: true,
                errorInfo: {
                  category: 'provider',
                  retryable: true,
                  hint: 'Retry the message, switch model, or check provider settings.',
                  rawSanitized: sanitizeToolError(errorContent),
                  source: model.providerType,
                },
              }],
            })
          }
        } catch (cleanupErr) {
          logger.warn('[Chat:Error] Store cleanup failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) })
        }
      }
    } finally {
      streamingRef.current = false
      abortRef.current = null
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
        inactivityTimer = null
      }
      setIsLoading(false)
      // Record model usage statistics (always, even on cancel/error)
      if (tokenUsage) {
        useAppStore.getState().recordModelUsage(
          model.id,
          tokenUsage.promptTokens,
          tokenUsage.completionTokens,
        )
      } else if (!hasError) {
        // Only record zero-token call if not an error (API was actually reached)
        useAppStore.getState().recordModelUsage(model.id, 0, 0)
      }
      // Record agent performance stats
      if (sessionAgent) {
        const elapsed = performance.now() - perfStart
        useAppStore.getState().recordAgentPerformance(sessionAgent.id, elapsed, tokenUsage?.totalTokens ?? 0, hasError)
      }
    }
  }, [cancelStream])

  const retryLastError = useCallback(() => {
    if (streamingRef.current) return
    const store = useAppStore.getState()
    const session = store.sessions.find((s) => s.id === store.activeSessionId)
    if (!session || session.messages.length < 2) return

    const lastMsg = session.messages[session.messages.length - 1]
    if (!lastMsg?.isError) return

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

    sendMessage(userText, userAttachments)
  }, [sendMessage])

  const deleteMessage = useCallback((messageId: string) => {
    const store = useAppStore.getState()
    const session = store.sessions.find((s) => s.id === store.activeSessionId)
    if (!session) return
    store.updateSession(session.id, {
      messages: session.messages.filter((m) => m.id !== messageId),
    })
  }, [])

  const regenerateMessage = useCallback((messageId: string) => {
    if (streamingRef.current) return
    const store = useAppStore.getState()
    const session = store.sessions.find((s) => s.id === store.activeSessionId)
    if (!session) return

    // Find the assistant message to regenerate
    const msgIndex = session.messages.findIndex((m) => m.id === messageId)
    if (msgIndex < 0) return

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
    store.updateSession(session.id, { messages: withoutUser })

    sendMessage(userText, userAttachments)
  }, [sendMessage])

  const clearMessages = useCallback(() => {
    const store = useAppStore.getState()
    const session = store.sessions.find((s) => s.id === store.activeSessionId)
    if (!session) return
    store.updateSession(session.id, { messages: [] })
  }, [])

  return { sendMessage, cancelStream, retryLastError, deleteMessage, regenerateMessage, clearMessages, isLoading, error }
}
