import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckIcon, CopyIcon, LibraryIcon, PlayIcon, XIcon } from 'lucide-react';
import { SidePanel } from '@/components/layout/SidePanel';
import { ResizeHandle } from '@/components/layout/ResizeHandle';
import { flushPendingSplitStoreWrites } from '@/services/fileStorage';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import { useI18n } from '@/hooks/useI18n';
import { useAppStore } from '@/store/appStore';
import { IconifyIcon } from '@/components/icons/IconifyIcons';
import { executeAgentPipeline, dryRunAgentPipeline, type AgentPipelineProgressStep, type DryRunResult } from '@/services/agentPipelineService';
import { validateAgentPipeline } from '@/services/pipelineValidation';
import { buildPipelineMermaidSource } from '@/services/pipelineMermaid';
import { buildPipelineOptimizationIterations, type PipelineOptimizationIteration } from '@/services/pipelineOptimization';
import { buildIncomingTransitionMap, ensureEditablePipelineGraph, materializePipelineGraph, removePipelineTransition, upsertPipelineTransition } from '@/services/pipelineGraph';
import { getDisplayPipelineVersion, getNextPipelineVersion, releasePipelineVersion } from '@/services/pipelineVersioning';
import { formatPipelineExecutionEngineLabel, formatPipelineExecutionFallbackReason } from '@/services/pipelineExecutionPresentation';
import { loadPipelineExecutionsFromDisk, loadPipelinesFromDisk, savePipelineToDisk } from '@/services/pipelineFiles';
import { t as translate } from '@/services/i18n';
import type { AgentPipeline, AgentPipelineBudget, AgentPipelineExecution, AgentPipelineExecutionStep, AgentPipelineStep, AgentPipelineVariable, PipelineStepUsage } from '@/types';
import { generateId } from '@/utils/helpers';
import { Button as UiButton } from "@/components/shared/button";
import { Dialog, DialogActions, DialogBody, DialogTitle } from '@/components/shared/dialog';
import { Input as UiInput } from "@/components/shared/form-controls";
import { ScrollArea } from '@/components/ui/scroll-area';
import { parsePipelineImport, serializePipelineExport } from '@/services/pipelinePortability';
import { nodeTypeRequiresTask, nodeTypeUsesAgentRuntime } from '@/components/pipeline/pipelineNodeBehaviors';
import { PipelineGeneralPanel } from '@/components/pipeline/PipelineGeneralPanel';
import { PipelineStepConfigPanel } from '@/components/pipeline/PipelineStepConfigPanel';
import { PIPELINE_NODE_ICONS } from '@/components/pipeline/PipelineFlowCanvas.nodes';
import { PIPELINE_NODE_LIBRARY, type PipelineNodeType } from '@/components/pipeline/pipelineNodeLibrary';
import { workbenchSidebarAccentActionClass, workbenchSidebarCardClass, workbenchSidebarDescriptionClass, workbenchSidebarEmptyClass, workbenchSidebarIconClass, workbenchSidebarItemClass, workbenchSidebarMetaClass, workbenchSidebarPillClass, workbenchSidebarPrimaryActionClass, workbenchSidebarSearchInputClass, workbenchSidebarSubtleActionClass, workbenchSidebarTitleClass } from '@/components/workbench/styles';
import { scheduleWhenIdle } from '@/utils/scheduling';

const LazyPipelineAssistantDrawer = lazy(() => import('@/components/pipeline/PipelineAssistantDrawer').then((module) => ({ default: module.PipelineAssistantDrawer })));
const LazyPipelineFlowDiagram = lazy(() => import('@/components/pipeline/PipelineFlowDiagram').then((module) => ({ default: module.PipelineFlowDiagram })));
const LazyPipelineFlowCanvas = lazy(() => import('@/components/pipeline/PipelineFlowCanvas').then((module) => ({ default: module.PipelineFlowCanvas })));
const PIPELINE_HEADER_BACKGROUND = 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--t-surface-1)_99%,transparent),color-mix(in_srgb,var(--t-surface-0)_98%,transparent))]';
type PipelineEditorTab = 'general' | 'design' | 'others';
function formatDuration(durationMs?: number, t?: (key: string, defaultValue?: string) => string) {
    if (durationMs === undefined)
        return t?.('agents.pipelinePendingDuration', 'Waiting...') ?? 'Waiting...';
    if (durationMs < 1000)
        return `${durationMs}ms`;
    if (durationMs < 60000)
        return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
}
function buildDefaultPipelineNodeStep(nodeType: PipelineNodeType, fallbackAgentId: string): AgentPipelineStep {
  return {
    nodeType,
    agentId: fallbackAgentId,
    task: nodeType === 'condition'
      ? 'Evaluate the decision rule and choose the next branch.'
      : nodeType === 'agent'
        ? 'Produce the requested result using the workflow context.'
      : nodeType === 'code'
        ? 'Transform workflow data with sandboxed JavaScript.'
      : nodeType === 'template'
        ? 'Render the final text or structured payload from workflow variables.'
      : nodeType === 'variable'
        ? 'Assign workflow variables for downstream nodes.'
      : nodeType === 'iteration'
        ? 'Run a child pipeline for each item in the selected array.'
      : nodeType === 'toolset'
        ? 'Execute the selected workspace tool and capture its result.'
      : nodeType === 'pipeline'
        ? 'Pass the prepared payload to the downstream pipeline.'
        : nodeType === 'rag'
          ? 'Retrieve supporting document context for the next step.'
          : nodeType === 'wiki'
            ? 'Search the selected wiki or document group for matching pages.'
        : nodeType === 'script'
          ? 'Execute the local script with the prepared context.'
          : nodeType === 'http'
            ? 'Call the target API and capture the response.'
            : nodeType === 'webhook'
              ? 'Send an outgoing webhook to the selected target.'
            : nodeType === 'email'
              ? 'Compose and send the notification email.'
              : '',
    enabled: true,
    continueOnError: true,
    retryCount: 0,
    startParams: nodeType === 'start' ? [{ key: 'input', label: 'Input', defaultValue: '', required: false }] : undefined,
    endOutputs: nodeType === 'end' ? [{ key: 'result', label: 'Result', value: '{{previous.output}}' }] : undefined,
    conditionMode: nodeType === 'condition' ? 'all' : undefined,
    conditionTrueLabel: nodeType === 'condition' ? 'True' : undefined,
    conditionFalseLabel: nodeType === 'condition' ? 'False' : undefined,
    scriptRuntime: nodeType === 'script' ? 'nodejs' : undefined,
    codeLanguage: nodeType === 'code' ? 'javascript' : undefined,
    codeSource: nodeType === 'code' ? 'function main(inputs) {\n  return { result: inputs.previous ?? inputs };\n}' : undefined,
    codeOutputSchema: nodeType === 'code' ? 'result' : undefined,
    templateBody: nodeType === 'template' ? '{{ previous.output | default("") }}' : undefined,
    variableAssignments: nodeType === 'variable' ? [{ variable: 'result', mode: 'overwrite', value: '{{previous.output}}' }] : undefined,
    iterationSource: nodeType === 'iteration' ? '{{previous.output}}' : undefined,
    iterationItemVar: nodeType === 'iteration' ? 'item' : undefined,
    iterationIndexVar: nodeType === 'iteration' ? 'index' : undefined,
    iterationMode: nodeType === 'iteration' ? 'sequential' : undefined,
    iterationErrorMode: nodeType === 'iteration' ? 'terminate' : undefined,
    httpMethod: nodeType === 'http' ? 'GET' : undefined,
    httpAuthType: nodeType === 'http' ? 'none' : undefined,
    webhookMethod: nodeType === 'webhook' ? 'POST' : undefined,
    webhookAuthType: nodeType === 'webhook' ? 'none' : undefined,
    webhookCaptureResponse: nodeType === 'webhook' ? true : undefined,
    httpCaptureResponse: nodeType === 'http' ? true : undefined,
    ragTopK: nodeType === 'rag' ? 5 : undefined,
    wikiTopK: nodeType === 'wiki' ? 5 : undefined,
    parallelBranches: nodeType === 'parallel' ? 2 : undefined,
    parallelJoinStrategy: nodeType === 'parallel' ? 'all' : undefined,
    joinStrategy: nodeType === 'join' ? 'wait-all' : undefined,
    name: nodeType === 'agent'
      ? 'Agent step'
      : nodeType === 'condition'
        ? 'If / Else'
        : nodeType === 'code'
          ? 'Code'
          : nodeType === 'template'
            ? 'Template'
            : nodeType === 'variable'
              ? 'Variable Assigner'
              : nodeType === 'iteration'
                ? 'Iteration'
        : nodeType === 'pipeline'
          ? 'Nested pipeline'
            : nodeType === 'toolset'
              ? 'Toolset step'
              : nodeType === 'rag'
                ? 'Document retrieval'
                : nodeType === 'wiki'
                  ? 'Wiki search'
          : nodeType === 'script'
              ? 'Script execution'
            : nodeType === 'http'
              ? 'HTTP / API'
                : nodeType === 'webhook'
                  ? 'Webhook'
              : nodeType === 'email'
                ? 'SMTP Email'
                : nodeType === 'parallel'
                  ? 'Parallel'
                  : nodeType === 'join'
                    ? 'Join'
                  : nodeType === 'start'
                    ? 'Start'
                    : nodeType === 'end'
                      ? 'End'
                    : 'Node',
  };
}

  function findBoundaryIndex(pipeline: AgentPipelineStep[], nodeType: 'start' | 'end'): number {
    return pipeline.findIndex((step) => step.nodeType === nodeType);
  }

  function buildSeededWorkflow(nodeType: PipelineNodeType, fallbackAgentId: string): AgentPipelineStep[] {
    if (nodeType === 'start') {
      return [
        buildDefaultPipelineNodeStep('start', fallbackAgentId),
        buildDefaultPipelineNodeStep('end', fallbackAgentId),
      ];
    }
    if (nodeType === 'end') {
      return [
        buildDefaultPipelineNodeStep('start', fallbackAgentId),
        buildDefaultPipelineNodeStep('end', fallbackAgentId),
      ];
    }
    return [
      buildDefaultPipelineNodeStep('start', fallbackAgentId),
      buildDefaultPipelineNodeStep(nodeType, fallbackAgentId),
      buildDefaultPipelineNodeStep('end', fallbackAgentId),
    ];
  }
function formatTriggerLabel(trigger: AgentPipelineExecution['trigger'], t: (key: string, defaultValue?: string) => string) {
    if (trigger === 'timer')
        return t('agents.pipelineTriggeredByTimer', 'Triggered by timer');
    if (trigger === 'chat')
        return t('agents.pipelineTriggeredByChat', 'Triggered from chat');
    return t('agents.pipelineTriggeredManually', 'Triggered manually');
}
function statusStyles(status: AgentPipelineProgressStep['status'] | AgentPipelineExecution['status']) {
    switch (status) {
        case 'running':
            return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
        case 'success':
            return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';
        case 'error':
            return 'bg-red-500/15 text-red-300 border-red-500/20';
        case 'skipped':
            return 'bg-slate-500/15 text-text-muted border-border-subtle';
        case 'pending':
        default:
            return 'bg-surface-3 text-text-secondary border-border-subtle';
    }
}
function optimizationStatusStyles(status: PipelineOptimizationIteration['status']) {
    switch (status) {
        case 'configured':
            return 'border-emerald-500/20 bg-emerald-500/12 text-emerald-200';
        case 'warning':
            return 'border-red-500/20 bg-red-500/12 text-red-200';
        case 'recommended':
        default:
            return 'border-amber-500/20 bg-amber-500/12 text-amber-200';
    }
}
function normalizeRetryCount(value?: number): number {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(Math.trunc(value ?? 0), 3));
}
function buildDefaultVariableValues(variables: AgentPipelineVariable[] | undefined): Record<string, string> {
    if (!variables)
        return {};
    const next: Record<string, string> = {};
    for (const variable of variables) {
        if (!variable.name)
            continue;
        next[variable.name] = variable.defaultValue ?? '';
    }
    return next;
}
function reconcilePipelineVariableValues(currentValues: Record<string, string>, previousVariables: AgentPipelineVariable[], nextVariables: AgentPipelineVariable[]): Record<string, string> {
    const nextValues: Record<string, string> = {};
    nextVariables.forEach((variable, index) => {
        const nextName = variable.name.trim();
        if (!nextName)
            return;
        const previousName = previousVariables[index]?.name.trim() ?? '';
        if (currentValues[nextName] !== undefined) {
            nextValues[nextName] = currentValues[nextName];
            return;
        }
        if (previousName && previousName !== nextName && currentValues[previousName] !== undefined) {
            nextValues[nextName] = currentValues[previousName];
            return;
        }
        nextValues[nextName] = variable.defaultValue ?? '';
    });
    return nextValues;
}
function mapExecutionStep(step: AgentPipelineExecutionStep, agentNameMap: Record<string, string>): AgentPipelineProgressStep {
    return {
        stepIndex: step.stepIndex,
        agentId: step.agentId,
        agentName: agentNameMap[step.agentId],
        name: step.name,
        task: step.task,
        input: step.input,
        output: step.output,
        status: step.status,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        durationMs: step.durationMs,
        attempts: step.attempts,
        error: step.error,
        ...(step.usage ? { usage: step.usage } : {}),
        ...(step.skipReason ? { skipReason: step.skipReason } : {}),
    };
}
function formatTokenCount(value?: number): string {
    if (!Number.isFinite(value) || !value)
        return '0';
    if (value < 1000)
        return String(value);
    if (value < 1000000)
        return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k`;
    return `${(value / 1000000).toFixed(1)}M`;
}
function formatUsageLabel(usage: PipelineStepUsage | undefined, t: (key: string, defaultValue?: string) => string): string | null {
    if (!usage)
        return null;
    return `${t('agents.pipelineTokensIn', 'in')} ${formatTokenCount(usage.promptTokens)} · ${t('agents.pipelineTokensOut', 'out')} ${formatTokenCount(usage.completionTokens)} · ${t('agents.pipelineTokensTotal', 'total')} ${formatTokenCount(usage.totalTokens)}`;
}
function buildPreviewSteps(pipeline: AgentPipelineStep[], agentNameMap: Record<string, string>): AgentPipelineProgressStep[] {
    return pipeline.map((step, index) => ({
        stepIndex: index,
        agentId: step.agentId,
        agentName: agentNameMap[step.agentId],
        name: step.name,
        task: step.task,
        input: step.enabled === false ? '' : (index === 0 ? step.task : ''),
        status: step.enabled === false ? 'skipped' : 'pending',
        error: step.enabled === false ? translate('agents.pipelineStepDisabled', 'Step disabled') : undefined,
    }));
}
function getValidExecutionId(currentId: string | null, executions: AgentPipelineExecution[]): string | null {
    return currentId && executions.some((execution) => execution.id === currentId)
        ? currentId
        : (executions[0]?.id ?? null);
}
export function PipelineLayout() {
    const { t, locale } = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();
    const [panelWidth, setPanelWidth] = useResizablePanel('pipeline', 340);
    const [searchQuery, setSearchQuery] = useState('');
    const [assistantState, setAssistantState] = useState<{
        mode: 'create' | 'edit';
        pipelineId: string | null;
    } | null>(null);
    const [pipelineDescription, setPipelineDescription] = useState('');
    const [pipelineVariables, setPipelineVariables] = useState<AgentPipelineVariable[]>([]);
    const [pipelineBudget, setPipelineBudget] = useState<AgentPipelineBudget | undefined>(undefined);
    const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});
    const [diagramView, setDiagramView] = useState<'flow' | 'list' | 'source'>('flow');
    const [copiedMermaid, setCopiedMermaid] = useState(false);
    const [diagramDialogOpen, setDiagramDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importJsonText, setImportJsonText] = useState('');
    const [importJsonError, setImportJsonError] = useState<string | null>(null);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [copiedExportJson, setCopiedExportJson] = useState(false);
    const [pipelineHistory, setPipelineHistory] = useState<AgentPipelineExecution[]>([]);
    const [optimizationIterations, setOptimizationIterations] = useState<PipelineOptimizationIteration[] | null>(null);
    const [running, setRunning] = useState(false);
    const [editorTab, setEditorTab] = useState<PipelineEditorTab>('design');
    const [designDryRunOpen, setDesignDryRunOpen] = useState(false);
    const [designDryRunInput, setDesignDryRunInput] = useState('{}');
    const [designDryRunInputError, setDesignDryRunInputError] = useState<string | null>(null);
    const [copiedDesignOutput, setCopiedDesignOutput] = useState(false);
    const [liveSteps, setLiveSteps] = useState<AgentPipelineProgressStep[]>([]);
    const [activeExecution, setActiveExecution] = useState<AgentPipelineExecution | null>(null);
    const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
    const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
    const runAbortControllerRef = useRef<AbortController | null>(null);
    const hydratedRequestedPipelineIdRef = useRef<string | null>(null);
    const hydratedSelectedPipelineIdRef = useRef<string | null>(null);
    const variableNameMemoryRef = useRef<Record<number, string>>({});
    const { workspacePath, agents, models, agentPipeline: pipeline, setAgentPipeline, clearAgentPipeline, agentPipelineName, setAgentPipelineName, selectedAgentPipelineId, setSelectedAgentPipelineId, agentPipelines, setAgentPipelines, addNotification, } = useAppStore();
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const requestedPipelineId = searchParams.get('pipelineId');
    const requestedExecutionId = searchParams.get('executionId');
    const requestedTimerId = searchParams.get('timerId');
    const requestedFiredAtRaw = searchParams.get('firedAt');
    const requestedFiredAt = requestedFiredAtRaw ? Number(requestedFiredAtRaw) : Number.NaN;
    const enabledAgents = agents.filter((agent) => agent.enabled !== false);
    const runnableAgents = useMemo(() => enabledAgents.filter((agent) => {
      if (agent.modelId) {
        return models.some((model) => model.id === agent.modelId && model.enabled !== false);
      }
      return models.some((model) => model.enabled !== false);
    }), [enabledAgents, models]);
    const agentNameMap = useMemo(() => Object.fromEntries(agents.map((agent) => [
        agent.id,
        agent.id === 'default-assistant'
            ? t('chat.assistant', agent.name || 'Assistant')
            : agent.name,
    ])), [agents, t]);
    const selectedSavedPipeline = selectedAgentPipelineId
        ? agentPipelines.find((item) => item.id === selectedAgentPipelineId) ?? null
        : null;
    const currentWorkflowVersion = selectedSavedPipeline ? getDisplayPipelineVersion(selectedSavedPipeline) : getDisplayPipelineVersion(null);
    const assistantPipeline = assistantState?.pipelineId
        ? agentPipelines.find((item) => item.id === assistantState.pipelineId) ?? null
        : null;
    const resetPipelineExecutionState = () => {
        setLiveSteps([]);
        setActiveExecution(null);
    };
    const hydratePipelineEditor = useCallback((savedPipeline: AgentPipeline) => {
        setAgentPipelineName(savedPipeline.name);
        setPipelineDescription(savedPipeline.description ?? '');
        setPipelineVariables(savedPipeline.variables ?? []);
        setVariableValues(buildDefaultVariableValues(savedPipeline.variables));
        setPipelineBudget(savedPipeline.budget);
      setAgentPipeline(ensureEditablePipelineGraph(savedPipeline.steps));
        resetPipelineExecutionState();
    }, [setAgentPipeline, setAgentPipelineName]);
    const selectSavedPipeline = useCallback((savedPipeline: AgentPipeline) => {
        hydratedRequestedPipelineIdRef.current = null;
        hydratedSelectedPipelineIdRef.current = savedPipeline.id;
        setSelectedAgentPipelineId(savedPipeline.id);
        hydratePipelineEditor(savedPipeline);
    }, [hydratePipelineEditor, setSelectedAgentPipelineId]);
    const refreshSavedPipelines = useCallback(async (): Promise<AgentPipeline[]> => {
        if (!workspacePath)
            return [];
        try {
            const savedPipelines = await loadPipelinesFromDisk(workspacePath);
            setAgentPipelines(savedPipelines);
            return savedPipelines;
        }
        catch {
            return [];
        }
    }, [workspacePath, setAgentPipelines]);
    const updatePipelineVariables = (updater: (current: AgentPipelineVariable[]) => AgentPipelineVariable[]) => {
        setPipelineVariables((current) => {
            const next = updater(current);
            setVariableValues((values) => reconcilePipelineVariableValues(values, current, next));
            return next;
        });
    };
    const renamePipelineVariable = (index: number, nextName: string) => {
        const trimmedNextName = nextName.trim();
        const rememberedName = variableNameMemoryRef.current[index]?.trim() ?? '';
        const currentName = pipelineVariables[index]?.name.trim() ?? '';
        const sourceName = currentName || rememberedName;
        setPipelineVariables((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: nextName } : item));
        if (!sourceName || !trimmedNextName || sourceName === trimmedNextName)
            return;
        setVariableValues((current) => {
            if (current[sourceName] === undefined)
                return current;
            const nextValues = { ...current, [trimmedNextName]: current[sourceName] };
            delete nextValues[sourceName];
            return nextValues;
        });
    };
    const enabledPipelineSteps = useMemo(() => pipeline.filter((step) => step.enabled !== false), [pipeline]);
    useEffect(() => {
      if (pipeline.length === 0) {
        if (selectedStepIndex !== null) {
          setSelectedStepIndex(null);
        }
        return;
      }
      if (selectedStepIndex !== null && selectedStepIndex >= pipeline.length) {
        setSelectedStepIndex(pipeline.length > 0 ? pipeline.length - 1 : null);
      }
    }, [pipeline.length, selectedStepIndex]);
    useEffect(() => {
        const nextMemory: Record<number, string> = {};
        pipelineVariables.forEach((variable, index) => {
            const trimmedName = variable.name.trim();
            if (trimmedName) {
                nextMemory[index] = trimmedName;
                return;
            }
            const rememberedName = variableNameMemoryRef.current[index]?.trim();
            if (rememberedName)
                nextMemory[index] = rememberedName;
        });
        variableNameMemoryRef.current = nextMemory;
    }, [pipelineVariables]);
    const invalidEnabledSteps = useMemo(() => enabledPipelineSteps.filter((step) => nodeTypeRequiresTask(step.nodeType ?? 'agent') && !step.task.trim()).length, [enabledPipelineSteps]);
    useEffect(() => {
      const scheduled = scheduleWhenIdle(() => {
        void refreshSavedPipelines();
      }, 1200);
      return () => scheduled.cancel();
    }, [refreshSavedPipelines]);
    useEffect(() => {
        if (!requestedPipelineId) {
            hydratedRequestedPipelineIdRef.current = null;
            return;
        }
        const requestedPipeline = agentPipelines.find((item) => item.id === requestedPipelineId);
        if (!requestedPipeline)
            return;
        if (hydratedRequestedPipelineIdRef.current === requestedPipeline.id)
            return;
        hydratedRequestedPipelineIdRef.current = requestedPipeline.id;
        selectSavedPipeline(requestedPipeline);
    }, [requestedPipelineId, agentPipelines, selectSavedPipeline]);
    useEffect(() => {
        if (!selectedAgentPipelineId) {
            hydratedSelectedPipelineIdRef.current = null;
            return;
        }
        const selectedPipeline = agentPipelines.find((item) => item.id === selectedAgentPipelineId);
        if (!selectedPipeline)
            return;
        if (hydratedSelectedPipelineIdRef.current === selectedAgentPipelineId)
            return;
        hydratedSelectedPipelineIdRef.current = selectedAgentPipelineId;
        hydratePipelineEditor(selectedPipeline);
    }, [selectedAgentPipelineId, agentPipelines, hydratePipelineEditor]);
    useEffect(() => {
        if (!assistantState || assistantState.mode !== 'edit')
            return;
        if (!assistantState.pipelineId) {
            setAssistantState(null);
            return;
        }
        if (!agentPipelines.some((item) => item.id === assistantState.pipelineId)) {
            setAssistantState(null);
        }
    }, [assistantState, agentPipelines]);
    useEffect(() => {
        if (!workspacePath || !selectedAgentPipelineId) {
            setPipelineHistory([]);
            setSelectedExecutionId(null);
            return;
        }
        const scheduled = scheduleWhenIdle(() => {
          loadPipelineExecutionsFromDisk(workspacePath, selectedAgentPipelineId).then((executions) => {
            setPipelineHistory(executions);
            setSelectedExecutionId((current) => {
              if (requestedExecutionId && executions.some((execution) => execution.id === requestedExecutionId)) {
                return requestedExecutionId;
              }
              if (requestedTimerId) {
                const timerMatches = executions.filter((execution) => execution.timerId === requestedTimerId);
                if (timerMatches.length > 0) {
                  const matchedExecution = Number.isFinite(requestedFiredAt)
                    ? timerMatches
                      .slice()
                      .sort((left, right) => Math.abs(left.startedAt - requestedFiredAt) - Math.abs(right.startedAt - requestedFiredAt))[0]
                    : timerMatches[0];
                  if (matchedExecution) {
                    return matchedExecution.id;
                  }
                }
              }
              return getValidExecutionId(current, executions);
            });
          }).catch(() => {
            // Ignore execution history loading errors
          });
        }, 1400);
        return () => scheduled.cancel();
    }, [workspacePath, selectedAgentPipelineId, requestedExecutionId, requestedTimerId, requestedFiredAt]);
    useEffect(() => {
        if (!requestedPipelineId && !requestedExecutionId && !requestedTimerId)
            return;
        if (requestedPipelineId && selectedAgentPipelineId !== requestedPipelineId)
            return;
        if (requestedExecutionId && pipelineHistory.length > 0 && !pipelineHistory.some((execution) => execution.id === requestedExecutionId)) {
            setSearchParams({}, { replace: true });
            return;
        }
        if (!requestedExecutionId && requestedTimerId && pipelineHistory.length > 0 && !selectedExecutionId)
            return;
        if (requestedExecutionId && selectedExecutionId !== requestedExecutionId)
            return;
        setSearchParams({}, { replace: true });
    }, [requestedPipelineId, requestedExecutionId, requestedTimerId, selectedAgentPipelineId, selectedExecutionId, pipelineHistory, setSearchParams]);
    const filteredPipelines = useMemo(() => {
        const keyword = deferredSearchQuery.trim().toLowerCase();
        if (!keyword)
            return agentPipelines;
        return agentPipelines.filter((item) => item.name.toLowerCase().includes(keyword));
    }, [agentPipelines, deferredSearchQuery]);
    const selectedHistoryExecution = useMemo(() => pipelineHistory.find((execution) => execution.id === selectedExecutionId) ?? null, [pipelineHistory, selectedExecutionId]);
    const monitorSteps = useMemo(() => {
        if (liveSteps.length > 0)
            return liveSteps;
        if (activeExecution)
            return activeExecution.steps.map((step) => mapExecutionStep(step, agentNameMap));
        return [];
    }, [liveSteps, activeExecution, agentNameMap]);
    const executionDetail = selectedHistoryExecution ?? (!selectedSavedPipeline ? activeExecution : null);
    const executionDetailSteps = useMemo(() => executionDetail?.steps.map((step) => mapExecutionStep(step, agentNameMap)) ?? [], [executionDetail, agentNameMap]);
    const executionDetailEngineLabel = useMemo(() => formatPipelineExecutionEngineLabel(executionDetail?.runtime?.executionEngine, t), [executionDetail?.runtime?.executionEngine, t]);
    const executionDetailFallbackLabel = useMemo(() => formatPipelineExecutionFallbackReason(executionDetail?.runtime?.executionFallbackReason, t), [executionDetail?.runtime?.executionFallbackReason, t]);
    const executionDetailWarnings = executionDetail?.runtime?.validationWarnings ?? [];
    const pipelineValidation = useMemo(() => validateAgentPipeline({ name: agentPipelineName.trim() || 'Draft Pipeline', steps: pipeline, variables: pipelineVariables, budget: pipelineBudget }, agents, models), [agentPipelineName, pipeline, pipelineVariables, pipelineBudget, agents, models]);
    const shouldShowValidationPanel = pipeline.length > 0 && pipelineValidation.issues.length > 0;
    useEffect(() => {
        setOptimizationIterations(null);
    }, [agentPipelineName, pipelineDescription, pipeline, pipelineVariables, pipelineBudget, pipelineValidation]);
    useEffect(() => {
      if (editorTab !== 'design' && designDryRunOpen) {
        setDesignDryRunOpen(false);
      }
    }, [designDryRunOpen, editorTab]);
    const resetPipelineEditor = () => {
        hydratedRequestedPipelineIdRef.current = null;
        hydratedSelectedPipelineIdRef.current = null;
        variableNameMemoryRef.current = {};
      setSelectedStepIndex(null);
        setSelectedAgentPipelineId(null);
        setAgentPipelineName('');
        setPipelineDescription('');
        setPipelineVariables([]);
        setVariableValues({});
        setPipelineBudget(undefined);
        clearAgentPipeline();
        setPipelineHistory([]);
        resetPipelineExecutionState();
        setSelectedExecutionId(null);
    };
    const loadSavedPipeline = (pipelineId: string) => {
        const selectedPipeline = agentPipelines.find((item) => item.id === pipelineId);
        if (!selectedPipeline)
            return;
        selectSavedPipeline(selectedPipeline);
    };
    const openAssistantCreate = () => {
        setAssistantState({ mode: 'create', pipelineId: null });
    };
    const openAssistantEdit = (pipelineId: string) => {
        setAssistantState({ mode: 'edit', pipelineId });
    };
    const buildDraftPipelineSnapshot = () => ({
      id: selectedSavedPipeline?.id ?? 'draft-pipeline',
      name: agentPipelineName.trim() || selectedSavedPipeline?.name || 'Draft Pipeline',
      ...(pipelineDescription.trim() ? { description: pipelineDescription.trim() } : {}),
      steps: pipeline,
      ...(pipelineVariables.length > 0 ? { variables: pipelineVariables } : {}),
      ...(pipelineBudget ? { budget: pipelineBudget } : {}),
      createdAt: selectedSavedPipeline?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      ...(selectedSavedPipeline?.version ? { version: selectedSavedPipeline.version } : {}),
      ...(selectedSavedPipeline?.publishedVersion ? { publishedVersion: selectedSavedPipeline.publishedVersion } : {}),
      ...(selectedSavedPipeline?.lastPublishedAt ? { lastPublishedAt: selectedSavedPipeline.lastPublishedAt } : {}),
    } satisfies AgentPipeline);
    const replacePipelineDraft = (nextPipeline: AgentPipelineStep[]) => {
      setAgentPipeline(ensureEditablePipelineGraph(nextPipeline));
        setOptimizationIterations(null);
        resetPipelineExecutionState();
    };
    const exportJson = useMemo(() => pipeline.length > 0 ? serializePipelineExport(buildDraftPipelineSnapshot()) : '', [agentPipelineName, pipelineDescription, pipeline, pipelineVariables, pipelineBudget, selectedSavedPipeline]);
    const openImportDialog = () => {
      setImportJsonError(null);
      setImportJsonText('');
      setImportDialogOpen(true);
    };
    const openExportDialog = () => {
      setCopiedExportJson(false);
      setExportDialogOpen(true);
    };
    const applyImportedPipeline = () => {
      try {
        const { pipeline: importedPipeline, warnings } = parsePipelineImport(importJsonText);
        setAgentPipelineName(importedPipeline.name);
        setPipelineDescription(importedPipeline.description ?? '');
        setPipelineVariables(importedPipeline.variables ?? []);
        setVariableValues(buildDefaultVariableValues(importedPipeline.variables));
        setPipelineBudget(importedPipeline.budget);
        replacePipelineDraft(importedPipeline.steps);
        setSelectedStepIndex(importedPipeline.steps.length > 0 ? 0 : null);
        setSelectedAgentPipelineId(null);
        setImportDialogOpen(false);
        addNotification({
          id: generateId('notif'),
          type: warnings.length > 0 ? 'warning' : 'success',
          title: warnings.length > 0 ? t('agents.pipelineImportWarningsTitle', 'Pipeline imported with warnings') : t('agents.pipelineImportSuccessTitle', 'Pipeline imported'),
          message: warnings[0] ?? t('agents.pipelineImportSuccessBody', `${importedPipeline.name} is ready to review before saving.`).replace('{name}', () => importedPipeline.name),
          timestamp: Date.now(),
          read: false,
        });
      }
      catch (error) {
        setImportJsonError((error as Error).message || t('agents.pipelineImportError', 'Import failed.'));
      }
    };
    const copyExportJson = async () => {
      try {
        await navigator.clipboard.writeText(exportJson);
        setCopiedExportJson(true);
        window.setTimeout(() => setCopiedExportJson(false), 1200);
      }
      catch {
        addNotification({
          id: generateId('notif'),
          type: 'error',
          title: t('agents.pipelineExportCopyFailedTitle', 'Could not copy export JSON'),
          message: t('agents.pipelineExportCopyFailedBody', 'The workflow export JSON could not be copied to the clipboard.'),
          timestamp: Date.now(),
          read: false,
        });
      }
    };
    const connectPipelineSteps = (sourceStepIndex: number, targetStepIndex: number) => {
      replacePipelineDraft(upsertPipelineTransition(pipeline, sourceStepIndex, targetStepIndex));
    };
    const disconnectPipelineSteps = (sourceStepIndex: number, targetStepIndex: number) => {
      replacePipelineDraft(removePipelineTransition(pipeline, sourceStepIndex, targetStepIndex));
    };
    const runDryRunPreview = (overrideVariables?: Record<string, string>) => {
      const parsedVariables = overrideVariables ?? variableValues;
        setDesignDryRunInputError(null);
        const trimmedName = agentPipelineName.trim() || selectedSavedPipeline?.name || 'Draft Pipeline';
        const sanitizedBudget: AgentPipelineBudget | undefined = pipelineBudget
            && (pipelineBudget.maxTotalDurationMs || pipelineBudget.maxTotalTokens || pipelineBudget.maxStepCount)
            ? { ...pipelineBudget }
            : undefined;
        const result = dryRunAgentPipeline({
            id: selectedSavedPipeline?.id ?? generateId('pipeline-dry'),
            name: trimmedName,
            steps: pipeline,
            ...(pipelineVariables.length > 0 ? { variables: pipelineVariables } : {}),
            ...(sanitizedBudget ? { budget: sanitizedBudget } : {}),
            createdAt: selectedSavedPipeline?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
          }, { variables: parsedVariables });
        setDryRunResult(result);
        addNotification({
            id: generateId('notif'),
            type: result.valid ? 'info' : 'warning',
            title: t('agents.pipelineDryRunResultTitle', 'Dry run complete'),
            message: t('agents.pipelineDryRunMessage', `${result.steps.filter((step) => step.status === 'would-run').length} step(s) would run, ${result.steps.filter((step) => step.status === 'skipped').length} skipped, ${result.steps.filter((step) => step.status === 'error').length} error(s).`),
            timestamp: Date.now(),
            read: false,
        });
    };
    const runDesignDryRunPreview = () => {
        try {
          const parsedPayload: unknown = JSON.parse(designDryRunInput);
          if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
            setDesignDryRunInputError(t('agents.pipelineDryRunJsonError', 'Enter a valid JSON object before running the workflow.'));
            return;
          }
          const nextVariables = {
            ...variableValues,
            ...Object.fromEntries(Object.entries(parsedPayload as Record<string, unknown>).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])),
          };
          setVariableValues(nextVariables);
          runDryRunPreview(nextVariables);
        }
        catch {
          setDesignDryRunInputError(t('agents.pipelineDryRunJsonError', 'Enter a valid JSON object before running the workflow.'));
        }
    };
    const runOptimizationReview = () => {
        const iterations = buildPipelineOptimizationIterations({
            name: agentPipelineName.trim() || selectedSavedPipeline?.name || 'Draft Pipeline',
            description: pipelineDescription.trim() || selectedSavedPipeline?.description,
            steps: pipeline,
            ...(pipelineVariables.length > 0 ? { variables: pipelineVariables } : {}),
            ...(pipelineBudget ? { budget: pipelineBudget } : {}),
        }, pipelineValidation);
        setOptimizationIterations(iterations);
        addNotification({
            id: generateId('notif'),
            type: pipelineValidation.valid ? 'info' : 'warning',
            title: t('agents.pipelineOptimizationTitle', 'Pipeline optimization complete'),
            message: t('agents.pipelineOptimizationMessage', 'Generated 30 focused optimization iterations for the current pipeline.'),
            timestamp: Date.now(),
            read: false,
        });
    };
    const addStep = () => {
        if (runnableAgents.length === 0)
            return;
      addNode('agent');
    };
    const addNode = (nodeType: PipelineNodeType) => {
      if (nodeTypeUsesAgentRuntime(nodeType) && runnableAgents.length === 0)
        return;
      const fallbackAgentId = runnableAgents[0]?.id ?? enabledAgents[0]?.id ?? agents[0]?.id ?? 'default-assistant';
      const hasStart = findBoundaryIndex(pipeline, 'start') !== -1;
      const hasEnd = findBoundaryIndex(pipeline, 'end') !== -1;

      if (pipeline.length === 0) {
        const seeded = buildSeededWorkflow(nodeType, fallbackAgentId);
        replacePipelineDraft(seeded);
        setSelectedStepIndex(nodeType === 'end' ? 1 : nodeType === 'start' ? 0 : 1);
        return;
      }

      if (nodeType === 'start') {
        if (hasStart) return;
        replacePipelineDraft([buildDefaultPipelineNodeStep('start', fallbackAgentId), ...pipeline]);
        setSelectedStepIndex(0);
        return;
      }

      if (nodeType === 'end') {
        if (hasEnd) return;
        replacePipelineDraft([...pipeline, buildDefaultPipelineNodeStep('end', fallbackAgentId)]);
        setSelectedStepIndex(pipeline.length);
        return;
      }

      const endIndex = findBoundaryIndex(pipeline, 'end');
      const insertIndex = endIndex === -1 ? pipeline.length : endIndex;
      replacePipelineDraft([
        ...pipeline.slice(0, insertIndex),
        buildDefaultPipelineNodeStep(nodeType, fallbackAgentId),
        ...pipeline.slice(insertIndex),
      ]);
      setSelectedStepIndex(insertIndex);
    };
    const insertStepAfter = (idx: number, nodeType: PipelineNodeType = 'agent') => {
      if (nodeTypeUsesAgentRuntime(nodeType) && runnableAgents.length === 0)
        return;
      const fallbackAgentId = runnableAgents[0]?.id ?? enabledAgents[0]?.id ?? agents[0]?.id ?? 'default-assistant';
      const hasStart = findBoundaryIndex(pipeline, 'start') !== -1;
      const hasEnd = findBoundaryIndex(pipeline, 'end') !== -1;

      if (nodeType === 'start') {
        if (hasStart) return;
        replacePipelineDraft([buildDefaultPipelineNodeStep('start', fallbackAgentId), ...pipeline]);
        setSelectedStepIndex(0);
        return;
      }

      if (nodeType === 'end') {
        if (hasEnd) return;
        replacePipelineDraft([...pipeline, buildDefaultPipelineNodeStep('end', fallbackAgentId)]);
        setSelectedStepIndex(pipeline.length);
        return;
      }

      const endIndex = findBoundaryIndex(pipeline, 'end');
      const nextIndex = endIndex !== -1 ? Math.min(idx + 1, endIndex) : idx + 1;
      const nextStep: AgentPipelineStep = buildDefaultPipelineNodeStep(nodeType, fallbackAgentId);
      replacePipelineDraft([
        ...pipeline.slice(0, nextIndex),
        nextStep,
        ...pipeline.slice(nextIndex),
      ]);
      setSelectedStepIndex(nextIndex);
    };
    const removeStep = (idx: number) => {
      setSelectedStepIndex((current) => {
        if (current === null)
          return current;
        if (pipeline.length <= 1)
          return null;
        if (current === idx)
          return Math.max(0, idx - 1);
        if (current > idx)
          return current - 1;
        return current;
      });
        replacePipelineDraft(pipeline.filter((_, index) => index !== idx));
    };
    const updateStep = (idx: number, updates: Partial<AgentPipelineStep>) => {
        replacePipelineDraft(pipeline.map((step, index) => index === idx ? { ...step, ...updates } : step));
    };
    const moveStep = (idx: number, direction: -1 | 1) => {
        const targetIndex = idx + direction;
        if (targetIndex < 0 || targetIndex >= pipeline.length)
            return;
        const nextPipeline = [...pipeline];
        const [movedStep] = nextPipeline.splice(idx, 1);
        nextPipeline.splice(targetIndex, 0, movedStep);
        setSelectedStepIndex((current) => {
          if (current === idx)
            return targetIndex;
          if (current === targetIndex)
            return idx;
          return current;
        });
        replacePipelineDraft(nextPipeline);
    };
    const duplicateStep = (idx: number) => {
        const step = pipeline[idx];
        if (!step)
            return;
        const trimmedName = step.name?.trim();
        const duplicateName = trimmedName
            ? t('agents.pipelineStepCopyName', '{name} copy').replace('{name}', () => trimmedName)
            : undefined;
        replacePipelineDraft([
            ...pipeline.slice(0, idx + 1),
            {
                ...step,
                ...(duplicateName ? { name: duplicateName } : {}),
            },
            ...pipeline.slice(idx + 1),
        ]);
        setSelectedStepIndex(idx + 1);
    };
    const appendStepReference = (idx: number, token: string) => {
        replacePipelineDraft(pipeline.map((step, index) => {
            if (index !== idx)
                return step;
            const nextTask = step.task.trim()
                ? `${step.task.replace(/\s+$/u, '')}\n${token}`
                : token;
            return { ...step, task: nextTask };
        }));
    };
    const savePipeline = async (publishCurrentVersion = false) => {
        if (!workspacePath || pipeline.length === 0)
            return;
        if (!pipelineValidation.valid) {
            addNotification({
                id: generateId('notif'),
                type: 'warning',
                title: t('agents.pipelineDryRunFailedTitle', 'Pipeline validation failed'),
                message: pipelineValidation.errors[0]?.message ?? t('agents.pipelineDryRunFailedBody', 'Fix validation errors before saving.'),
                timestamp: Date.now(),
                read: false,
            });
            return;
        }
        const trimmedName = agentPipelineName.trim();
        if (!trimmedName) {
            addNotification({
                id: generateId('notif'),
                type: 'warning',
                title: t('agents.pipelineNameRequiredTitle', 'Pipeline name required'),
                message: t('agents.pipelineNameRequiredBody', 'Name the pipeline before saving it.'),
                timestamp: Date.now(),
                read: false,
            });
            return;
        }
        const now = Date.now();
        const savedPipeline = selectedSavedPipeline;
        const nextVersion = publishCurrentVersion
          ? releasePipelineVersion({ version: savedPipeline?.version ?? '1.0' })
          : getNextPipelineVersion(savedPipeline);
        const trimmedDescription = pipelineDescription.trim();
        const sanitizedVariables = pipelineVariables
            .map((variable) => ({
            ...variable,
            name: variable.name.trim(),
            ...(variable.label?.trim() ? { label: variable.label.trim() } : { label: undefined }),
            ...(variable.description?.trim() ? { description: variable.description.trim() } : { description: undefined }),
        }))
            .filter((variable) => variable.name);
        const sanitizedBudget: AgentPipelineBudget | undefined = pipelineBudget
            && (pipelineBudget.maxTotalDurationMs || pipelineBudget.maxTotalTokens || pipelineBudget.maxStepCount)
            ? {
                ...(pipelineBudget.maxTotalDurationMs ? { maxTotalDurationMs: pipelineBudget.maxTotalDurationMs } : {}),
                ...(pipelineBudget.maxTotalTokens ? { maxTotalTokens: pipelineBudget.maxTotalTokens } : {}),
                ...(pipelineBudget.maxStepCount ? { maxStepCount: pipelineBudget.maxStepCount } : {}),
            }
            : undefined;
        const nextPipeline: AgentPipeline = {
            id: savedPipeline?.id ?? generateId('pipeline'),
            name: trimmedName,
          version: nextVersion,
          publishedVersion: publishCurrentVersion ? nextVersion : savedPipeline?.publishedVersion,
          lastPublishedAt: publishCurrentVersion ? now : savedPipeline?.lastPublishedAt,
            ...(trimmedDescription ? { description: trimmedDescription } : {}),
            steps: pipeline,
            ...(sanitizedVariables.length > 0 ? { variables: sanitizedVariables } : {}),
            ...(sanitizedBudget ? { budget: sanitizedBudget } : {}),
            createdAt: savedPipeline?.createdAt ?? now,
            updatedAt: now,
            lastRunAt: savedPipeline?.lastRunAt,
        };
        const saved = await savePipelineToDisk(workspacePath, nextPipeline);
        if (!saved) {
            addNotification({
                id: generateId('notif'),
                type: 'error',
                title: t('agents.pipelineSaveFailedTitle', 'Pipeline save failed'),
                message: t('agents.pipelineSaveFailedBody', 'Could not write the pipeline file to disk.'),
                timestamp: Date.now(),
                read: false,
            });
            return;
        }
        const nextPipelines = [nextPipeline, ...agentPipelines.filter((item) => item.id !== nextPipeline.id)];
        hydratedSelectedPipelineIdRef.current = nextPipeline.id;
        setAgentPipelines(nextPipelines);
        setSelectedAgentPipelineId(nextPipeline.id);
        try {
            await flushPendingSplitStoreWrites();
        }
        catch {
            addNotification({
                id: generateId('notif'),
                type: 'warning',
                title: t('agents.pipelineSaveSyncWarningTitle', 'Pipeline saved with a sync warning'),
                message: t('agents.pipelineSaveSyncWarningBody', 'The pipeline was saved to disk, but the workspace state could not be flushed immediately.'),
                timestamp: Date.now(),
                read: false,
            });
        }
        addNotification({
            id: generateId('notif'),
            type: 'success',
          title: publishCurrentVersion ? t('agents.pipelinePublishedTitle', 'Pipeline published') : t('agents.pipelineSavedTitle', 'Pipeline saved'),
          message: publishCurrentVersion
            ? t('agents.pipelinePublishedBody', `${nextPipeline.name} ${nextVersion} is now published.`).replace('{name}', () => nextPipeline.name)
            : t('agents.pipelineSavedBody', `${nextPipeline.name} is now available for timers and history tracking.`).replace('{name}', () => nextPipeline.name),
            timestamp: Date.now(),
            read: false,
        });
    };
    const handleAssistantPipelineMutated = useCallback(async () => {
        const refreshedPipelines = await refreshSavedPipelines();
        if (refreshedPipelines.length === 0) {
            resetPipelineEditor();
            return;
        }
        if (assistantState?.mode === 'edit' && assistantState.pipelineId) {
            const updatedPipeline = refreshedPipelines.find((item) => item.id === assistantState.pipelineId);
            if (updatedPipeline) {
                selectSavedPipeline(updatedPipeline);
                return;
            }
            if (selectedAgentPipelineId === assistantState.pipelineId) {
                resetPipelineEditor();
            }
            setAssistantState(null);
            return;
        }
        selectSavedPipeline(refreshedPipelines[0]);
    }, [assistantState, refreshSavedPipelines, resetPipelineEditor, selectSavedPipeline, selectedAgentPipelineId]);
    const runPipeline = async () => {
        if (enabledPipelineSteps.length === 0 || invalidEnabledSteps > 0 || !pipelineValidation.valid || running)
            return;
        const previewSteps = buildPreviewSteps(pipeline, agentNameMap);
        const controller = new AbortController();
        runAbortControllerRef.current = controller;
        setRunning(true);
        setSelectedExecutionId(null);
        setActiveExecution(null);
        setLiveSteps(previewSteps);
        try {
            const now = Date.now();
            const execution = await executeAgentPipeline({
                id: selectedSavedPipeline?.id ?? generateId('pipeline-draft'),
                name: agentPipelineName.trim() || selectedSavedPipeline?.name || 'Draft Pipeline',
                steps: pipeline,
                ...(pipelineVariables.length > 0 ? { variables: pipelineVariables } : {}),
                ...(pipelineBudget ? { budget: pipelineBudget } : {}),
                createdAt: selectedSavedPipeline?.createdAt ?? now,
                updatedAt: now,
                lastRunAt: selectedSavedPipeline?.lastRunAt,
            }, {
                trigger: 'manual',
                persistExecution: Boolean(selectedSavedPipeline && workspacePath),
                persistLastRun: Boolean(selectedSavedPipeline && workspacePath),
                abortSignal: controller.signal,
                ...(pipelineVariables.length > 0 ? { variables: variableValues } : {}),
                onStepUpdate: (progressStep) => {
                    setLiveSteps((previous) => {
                        // Step edits clear liveSteps immediately, so this rebuild only handles
                        // late async updates arriving after a reset or pipeline switch.
                        const next = previous.length === pipeline.length ? [...previous] : buildPreviewSteps(pipeline, agentNameMap);
                        next[progressStep.stepIndex] = {
                            ...next[progressStep.stepIndex],
                            ...progressStep,
                        };
                        return next;
                    });
                },
            });
            setActiveExecution(execution);
            setLiveSteps(execution.steps.map((step) => mapExecutionStep(step, agentNameMap)));
            if (selectedSavedPipeline && workspacePath) {
                const executions = await loadPipelineExecutionsFromDisk(workspacePath, selectedSavedPipeline.id);
                setPipelineHistory(executions);
                setSelectedExecutionId(executions[0]?.id ?? null);
            }
        }
        finally {
            setRunning(false);
            runAbortControllerRef.current = null;
        }
    };
    const cancelRunningPipeline = () => {
        const controller = runAbortControllerRef.current;
        if (controller && !controller.signal.aborted) {
            controller.abort();
        }
    };
    // Guarantee the in-flight pipeline is cancelled if the user navigates away.
    useEffect(() => {
        return () => {
            const controller = runAbortControllerRef.current;
            if (controller && !controller.signal.aborted)
                controller.abort();
        };
    }, []);
    const formatRelativeTime = (timestamp?: number) => {
        if (!timestamp)
            return t('agents.pipelineNeverRan', 'Never ran');
        const diff = Date.now() - timestamp;
        if (diff < 60000)
            return t('agents.justNow', 'Just now');
        const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        if (diff < 3600000)
            return formatter.format(-Math.floor(diff / 60000), 'minute');
        if (diff < 86400000)
            return formatter.format(-Math.floor(diff / 3600000), 'hour');
        return formatter.format(-Math.floor(diff / 86400000), 'day');
    };
    const latestExecutionReference = useMemo(() => {
        if (executionDetailSteps.length > 0)
            return executionDetailSteps;
        if (monitorSteps.length > 0)
            return monitorSteps;
        return pipelineHistory[0]?.steps.map((step) => mapExecutionStep(step, agentNameMap)) ?? [];
    }, [executionDetailSteps, monitorSteps, pipelineHistory, agentNameMap]);
    const pipelineGraphSteps = useMemo(() => materializePipelineGraph(pipeline), [pipeline]);
    const incomingByStepId = useMemo(() => buildIncomingTransitionMap(pipelineGraphSteps), [pipelineGraphSteps]);
    const selectedStep = selectedStepIndex !== null ? (pipeline[selectedStepIndex] ?? null) : null;
    const selectedPreviewStep = selectedStepIndex !== null ? latestExecutionReference[selectedStepIndex] : undefined;
    const selectedPreviousOutput = useMemo(() => {
      if (selectedStepIndex === null) return '';
      const selectedGraphStep = pipelineGraphSteps[selectedStepIndex];
      if (!selectedGraphStep) return '';
      const incomingSourceIds = incomingByStepId.get(selectedGraphStep.id) ?? [];
      const indexById = new Map(pipelineGraphSteps.map((step, index) => [step.id, index]));
      const outputs = incomingSourceIds
        .map((sourceId) => {
          const sourceIndex = indexById.get(sourceId);
          return sourceIndex === undefined ? '' : (latestExecutionReference[sourceIndex]?.output ?? '');
        })
        .filter(Boolean);
      if (outputs.length > 1) {
        return outputs.join('\n\n---\n\n');
      }
      return outputs[0] ?? '';
    }, [incomingByStepId, latestExecutionReference, pipelineGraphSteps, selectedStepIndex]);
    const diagramProgressSteps = useMemo(() => {
        if (monitorSteps.length > 0)
            return monitorSteps;
        if (executionDetailSteps.length > 0)
            return executionDetailSteps;
        return buildPreviewSteps(pipeline, agentNameMap);
    }, [monitorSteps, executionDetailSteps, pipeline, agentNameMap]);
    const hasPipelineSteps = pipeline.length > 0;
    const mermaidSource = useMemo(() => buildPipelineMermaidSource(pipeline, {
        pipelineName: agentPipelineName.trim() || selectedSavedPipeline?.name || t('agents.pipelineDraft', 'Draft pipeline'),
        description: pipelineDescription.trim() || selectedSavedPipeline?.description,
        agentNameMap,
        progressSteps: diagramProgressSteps,
    }), [pipeline, agentPipelineName, selectedSavedPipeline, pipelineDescription, agentNameMap, diagramProgressSteps, t]);
    const copyMermaidSource = async () => {
        try {
            await navigator.clipboard.writeText(mermaidSource);
            setCopiedMermaid(true);
            window.setTimeout(() => setCopiedMermaid(false), 1600);
        }
        catch {
            addNotification({
                id: generateId('notif'),
                type: 'error',
                title: t('agents.pipelineMermaidCopyFailedTitle', 'Could not copy diagram'),
                message: t('agents.pipelineMermaidCopyFailedBody', 'The Mermaid source could not be copied to the clipboard.'),
                timestamp: Date.now(),
                read: false,
            });
        }
    };
    const copyDesignDryRunOutput = async () => {
      if (!dryRunResult)
        return;
      const lastPreview = dryRunResult.steps[dryRunResult.steps.length - 1];
      const serialized = JSON.stringify({
        variables: dryRunResult.variables,
        lastStep: lastPreview,
      }, null, 2);
      try {
        await navigator.clipboard.writeText(serialized);
        setCopiedDesignOutput(true);
        window.setTimeout(() => setCopiedDesignOutput(false), 1200);
      }
      catch {
        addNotification({
          id: generateId('notif'),
          type: 'error',
          title: t('agents.pipelineCopyOutputFailedTitle', 'Could not copy dry run output'),
          message: t('agents.pipelineCopyOutputFailedBody', 'The dry run output could not be copied to the clipboard.'),
          timestamp: Date.now(),
          read: false,
        });
      }
    };
      const renderDiagramContent = (expanded = false) => {
        if (diagramView === 'flow') {
          return (<Suspense fallback={<div className={`${expanded ? 'h-[70vh]' : 'h-80'} rounded-2xl border border-border-subtle bg-surface-0/40`} />}>
            <LazyPipelineFlowCanvas steps={pipeline} progressSteps={diagramProgressSteps} agentNameMap={agentNameMap} className={expanded ? 'h-[70vh]' : undefined} onAddStep={enabledAgents.length > 0 ? addStep : undefined} selectedStepIndex={selectedStepIndex} onStepSelect={setSelectedStepIndex} validationIssues={pipelineValidation.issues}/>
          </Suspense>);
        }
        if (diagramView === 'list') {
          return (<div className={expanded ? 'max-h-[70vh] overflow-y-auto' : undefined}>
            <Suspense fallback={<div className="h-80 rounded-2xl border border-border-subtle bg-surface-0/40" />}>
              <LazyPipelineFlowDiagram steps={pipeline} progressSteps={diagramProgressSteps} agentNameMap={agentNameMap}/>
            </Suspense>
          </div>);
        }
        return (<pre className={`${expanded ? 'h-[70vh]' : 'max-h-96'} overflow-auto rounded-2xl border border-border-subtle bg-surface-0/45 p-4 text-[11px] leading-relaxed text-text-secondary`}>
          <code>{mermaidSource}</code>
          </pre>);
      };
    return (<>
      <SidePanel title={t('agents.pipeline', 'Pipeline')} width={panelWidth} action={<div className="flex items-center gap-2">
            <UiButton unstyled type="button" onClick={openAssistantCreate} className={workbenchSidebarPrimaryActionClass}>
              {t('timer.aiCreate', 'AI Create')}
            </UiButton>
            <UiButton unstyled type="button" onClick={resetPipelineEditor} className={workbenchSidebarAccentActionClass}>
              + {t('common.new', 'New')}
            </UiButton>
          </div>}>
        <div className="module-sidebar-stack p-3 space-y-3">
          <div className={workbenchSidebarCardClass}>
            <div className="relative">
              <IconifyIcon name="ui-search" size={14} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"/>
              <UiInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('agents.searchPipelines', 'Search pipelines...')} wrapperClassName="w-full" controlClassName={workbenchSidebarSearchInputClass.replace('pr-10', 'pr-3').replace('pl-10', 'pl-9')}/>
            </div>
            <div className={workbenchSidebarMetaClass}>
              <span>{filteredPipelines.length} {t('common.results', 'results')}</span>
              {searchQuery.trim() && <span>{agentPipelines.length} {t('common.total', 'total')}</span>}
            </div>
          </div>

          <div className="space-y-2">
            {filteredPipelines.length > 0 && (<div className="px-1 pt-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                {t('agents.pipelineSavedList', 'Saved pipelines')}
              </div>)}

            {filteredPipelines.length === 0 ? (<div className={workbenchSidebarEmptyClass}>
                <div>{searchQuery.trim()
                ? t('agents.noMatchingPipelines', 'No matching pipelines.')
                : t('agents.noSavedPipelines', 'No saved pipelines yet.')}</div>
                {!searchQuery.trim() && (<div className="mt-4 flex flex-col gap-2">
                    <UiButton unstyled type="button" onClick={resetPipelineEditor} className={workbenchSidebarPrimaryActionClass}>
                      {t('agents.createFirstPipeline', 'Create your first pipeline')}
                    </UiButton>
                    <UiButton unstyled type="button" onClick={openAssistantCreate} className={workbenchSidebarSubtleActionClass}>
                      {t('timer.aiCreate', 'AI Create')}
                    </UiButton>
                  </div>)}
              </div>) : (filteredPipelines.map((savedPipeline) => (<UiButton unstyled key={savedPipeline.id} type="button" onClick={() => loadSavedPipeline(savedPipeline.id)} className={workbenchSidebarItemClass(selectedAgentPipelineId === savedPipeline.id, 'border-border-subtle bg-surface-1/70 text-text-secondary hover:border-border hover:bg-surface-2/70')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className={workbenchSidebarTitleClass}>{savedPipeline.name}</div>
                        {selectedAgentPipelineId === savedPipeline.id && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] text-accent">{t('agents.open', 'Open')}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                        <span>{savedPipeline.steps.length} {t('agents.pipelineSteps', 'steps')}</span>
                        <span className="h-1 w-1 rounded-full bg-border"/>
                        <span>v{getDisplayPipelineVersion(savedPipeline)}</span>
                        <span className="h-1 w-1 rounded-full bg-border"/>
                        <span>{formatRelativeTime(savedPipeline.lastRunAt)}</span>
                      </div>
                      {savedPipeline.description && <div className={workbenchSidebarDescriptionClass}>{savedPipeline.description}</div>}
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
                        <span className={workbenchSidebarPillClass}>{savedPipeline.lastRunAt ? t('agents.pipelineRecentRun', 'Recent run') : t('agents.pipelineAwaitingFirstRun', 'Awaiting first run')}</span>
                      </div>
                    </div>
                    <span className={`${workbenchSidebarIconClass} mt-0.5 h-9 w-9`}>
                      <IconifyIcon name="skill-agent-comm" size={15} color="currentColor"/>
                    </span>
                  </div>
                </UiButton>)))}
          </div>
        </div>
      </SidePanel>

      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={280} maxWidth={420}/>

      <div className="module-workspace flex min-w-0 flex-1 flex-col">
        <div className={`module-hero-strip border-b border-border-subtle px-6 py-5 ${PIPELINE_HEADER_BACKGROUND}`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                <span>{t('agents.pipeline', 'Pipeline')}</span>
                {selectedSavedPipeline && <span className="rounded-full border border-border-subtle bg-surface-3/80 px-2 py-0.5 text-[10px] normal-case tracking-normal text-text-secondary">{selectedSavedPipeline.id}</span>}
                <span className="rounded-full border border-border-subtle bg-surface-3/80 px-2 py-0.5 text-[10px] normal-case tracking-normal text-text-secondary">v{currentWorkflowVersion}</span>
                {selectedSavedPipeline?.publishedVersion && selectedSavedPipeline.publishedVersion === selectedSavedPipeline.version ? <span className="rounded-full border border-emerald-300 bg-emerald-50/80 px-2 py-0.5 text-[10px] normal-case tracking-normal text-emerald-700">{t('agents.pipelinePublished', 'Published')}</span> : null}
                <span className={`rounded-full border px-2 py-0.5 text-[10px] normal-case tracking-normal ${statusStyles(running ? 'running' : (activeExecution?.status ?? 'pending'))}`}>
                  {running ? t('agents.pipelineStatusRunning', 'Running') : t(`agents.pipelineStatus.${activeExecution?.status ?? 'pending'}`, activeExecution?.status ?? 'pending')}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-text-primary">{agentPipelineName.trim() || t('agents.pipelineDraft', 'Draft pipeline')}</h1>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <UiButton unstyled type="button" onClick={() => selectedSavedPipeline && openAssistantEdit(selectedSavedPipeline.id)} disabled={!selectedSavedPipeline} className="rounded-xl bg-accent/15 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40">{t('timer.aiEditCurrent', 'AI Edit')}</UiButton>
            <UiButton unstyled type="button" onClick={openImportDialog} className="rounded-xl border border-border-subtle/70 bg-surface-0/82 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-text-primary">{t('agents.pipelineImport', 'Import JSON')}</UiButton>
            <UiButton unstyled type="button" onClick={openExportDialog} disabled={pipeline.length === 0} className="rounded-xl border border-border-subtle/70 bg-surface-0/82 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-text-primary disabled:opacity-40">{t('agents.pipelineExport', 'Export JSON')}</UiButton>
            <UiButton unstyled type="button" onClick={() => void savePipeline()} disabled={!workspacePath || pipeline.length === 0} className="rounded-xl bg-accent/15 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40">{t('common.saveChanges', 'Save Changes')}</UiButton>
            <UiButton unstyled type="button" onClick={() => void savePipeline(true)} disabled={!workspacePath || pipeline.length === 0} className="rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40">{t('agents.publishPipeline', 'Publish')}</UiButton>
            <UiButton unstyled type="button" onClick={runPipeline} disabled={enabledPipelineSteps.length === 0 || invalidEnabledSteps > 0 || !pipelineValidation.valid || running} className="rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40">
              {running ? t('agents.runningPipeline', 'Running...') : t('agents.runPipeline', '▶ Run Pipeline')}
            </UiButton>
            {running && (<UiButton unstyled type="button" onClick={cancelRunningPipeline} className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25" title={t('agents.cancelPipelineHint', 'Stop the running pipeline')}>
                {t('agents.cancelPipeline', '■ Cancel')}
              </UiButton>)}
          </div>

          {dryRunResult && (<div className="mt-3 rounded-3xl border border-border-subtle/55 bg-surface-0/72 px-4 py-3 text-xs text-text-secondary">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{t('agents.pipelineDryRunResultTitle', 'Dry run preview')}</div>
                <UiButton unstyled type="button" onClick={() => setDryRunResult(null)} className="text-text-muted hover:text-text-primary" aria-label={t('common.close', 'Close')}>×</UiButton>
              </div>
              {dryRunResult.budgetExceeded && (<div className="mt-1 text-blue-100">
                  {t('agents.pipelineBudgetExceeded', 'Budget exceeded')}: {dryRunResult.budgetExceeded.type} {dryRunResult.budgetExceeded.observed}/{dryRunResult.budgetExceeded.limit}
                </div>)}
              <ol className="mt-2 space-y-1">
                {dryRunResult.steps.map((step) => {
                const tone = step.status === 'would-run'
                    ? 'text-emerald-200'
                    : step.status === 'skipped' || step.status === 'disabled'
                        ? 'text-text-muted'
                        : 'text-red-200';
                return (<li key={step.stepIndex} className={tone}>
                      <span className="font-mono">#{step.stepIndex + 1}</span>{' '}
                      <span className="uppercase tracking-[0.12em]">{step.status}</span>
                      {step.modelId ? <span className="ml-2 text-text-muted">[{step.modelId}]</span> : null}
                      {step.reason ? <span className="ml-2 text-text-muted">— {step.reason}</span> : null}
                      {step.name ? <span className="ml-2">{step.name}</span> : null}
                    </li>);
            })}
              </ol>
                {dryRunResult.visitedStepIndices?.length > 0 ? <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                  <span>{t('agents.pipelineTraversedPath', 'Traversed path')}:</span>
                  {dryRunResult.visitedStepIndices.map((stepIndex) => <span key={`dry-run-path-${stepIndex}`} className="rounded-full border border-border-subtle bg-surface-1/80 px-2 py-0.5 font-mono">#{stepIndex + 1}</span>)}
                </div> : null}
            </div>)}

          {optimizationIterations && (<div className="mt-3 rounded-3xl border border-border-subtle/55 bg-surface-0/72 px-4 py-3 text-xs text-text-secondary">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{t('agents.pipelineOptimizationTitle', 'Pipeline optimization')}</div>
                  <div className="mt-1 text-emerald-100/75">{t('agents.pipelineOptimizationSubtitle', '20 iterative improvements for reliability, cost, and handoff quality.')}</div>
                </div>
                <UiButton unstyled type="button" onClick={() => setOptimizationIterations(null)} className="text-text-muted hover:text-text-primary" aria-label={t('common.close', 'Close')}>×</UiButton>
              </div>
              <ol className="mt-3 grid gap-2 xl:grid-cols-2">
                {optimizationIterations.map((iteration) => (<li key={iteration.iteration} className="rounded-2xl border border-border-subtle bg-surface-1/92 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-text-muted">#{iteration.iteration}</span>
                      <span className="font-medium text-text-primary">{iteration.title}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${optimizationStatusStyles(iteration.status)}`}>
                        {t(`agents.pipelineOptimizationStatus.${iteration.status}`, iteration.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">{iteration.detail}</div>
                  </li>))}
              </ol>
            </div>)}

          {shouldShowValidationPanel && (<div className="mt-3 rounded-3xl border border-border-subtle/55 bg-surface-0/72 px-4 py-3 text-xs text-text-secondary">
              <div className="font-semibold">{t('agents.pipelineDryRun', 'Dry-run validation')}</div>
              <div className="mt-2 space-y-1">
                {pipelineValidation.issues.slice(0, 5).map((issue) => (<div key={`${issue.code}-${issue.stepIndex ?? 'pipeline'}-${issue.message}`}>
                    {issue.severity.toUpperCase()}: {issue.message}
                  </div>))}
              </div>
            </div>)}
        </div>

        <div className="border-b border-border-subtle px-6">
          <div className="flex flex-wrap gap-2 py-4">
            <UiButton unstyled type="button" onClick={() => setEditorTab('general')} className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${editorTab === 'general' ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-text-secondary hover:bg-surface-3'}`}>
              {t('agents.pipelineGeneral', 'General')}
            </UiButton>
            <UiButton unstyled type="button" onClick={() => setEditorTab('design')} className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${editorTab === 'design' ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-text-secondary hover:bg-surface-3'}`}>
              {t('agents.pipelineDesign', 'Design')}
            </UiButton>
            <UiButton unstyled type="button" onClick={() => setEditorTab('others')} className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${editorTab === 'others' ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-text-secondary hover:bg-surface-3'}`}>
              {t('agents.pipelineOthers', 'Others')}
            </UiButton>
          </div>
        </div>

        <div className={`grid min-h-0 flex-1 gap-0 ${editorTab === 'others' ? 'xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.9fr)]' : ''}`}>
          <div className={`module-canvas min-h-0 px-6 py-6 ${editorTab === 'design' ? 'flex h-full flex-col overflow-hidden' : 'overflow-y-auto'}`}>
            {editorTab === 'general' ? (<PipelineGeneralPanel
                name={agentPipelineName}
                description={pipelineDescription}
                variables={pipelineVariables}
                variableValues={variableValues}
                budget={pipelineBudget}
                onNameChange={setAgentPipelineName}
                onDescriptionChange={setPipelineDescription}
                onVariablesChange={updatePipelineVariables}
                onRenameVariable={renamePipelineVariable}
                onVariableValuesChange={setVariableValues}
                onBudgetChange={setPipelineBudget}
                t={t}
              />) : editorTab === 'design' ? (<div className="flex h-full min-h-0 flex-col">
                <section className="flex min-h-0 flex-1 rounded-[24px] border border-border-subtle/55 bg-surface-1/96 p-0 shadow-[0_8px_20px_rgba(15,23,42,0.05)] backdrop-blur-sm">
                  <div className="h-full min-h-0 flex-1">
                    <Suspense fallback={<div className="h-full rounded-2xl border border-border-subtle bg-surface-0/40" />}>
                      <LazyPipelineFlowCanvas
                        steps={pipeline}
                        progressSteps={diagramProgressSteps}
                        agentNameMap={agentNameMap}
                        validationIssues={pipelineValidation.issues}
                        className="h-full"
                        onAddStep={runnableAgents.length > 0 ? addStep : undefined}
                        selectedStepIndex={selectedStepIndex}
                        onStepSelect={setSelectedStepIndex}
                        onCanvasClearSelection={() => {
                          setSelectedStepIndex(null)
                          setDesignDryRunOpen(false)
                        }}
                        leftPanelContent={<div className="flex min-h-0 flex-1 flex-col gap-2">
                          <div className="flex items-center gap-2 border-b border-border-subtle/60 px-1 pb-2 text-xs font-semibold text-text-primary">
                            <LibraryIcon className="size-3.5 text-text-muted" />
                            {t('agents.pipelineNodeLibrary', 'Node library')}
                          </div>
                          <ScrollArea className="min-h-0 flex-1">
                            <div className="flex flex-col gap-3 p-2.5">
                              {Array.from(new Set(PIPELINE_NODE_LIBRARY.map((item) => item.category))).map((category) => (<div key={category} className="space-y-1.5">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{category}</div>
                                  <div className="flex flex-col gap-1.5">
                                    {PIPELINE_NODE_LIBRARY.filter((item) => item.category === category).map((item) => {
                                      const NodeIcon = PIPELINE_NODE_ICONS[item.value]
                                      return (<UiButton key={item.value} unstyled type="button" onClick={() => addNode(item.value)} disabled={nodeTypeUsesAgentRuntime(item.value) && runnableAgents.length === 0} className="flex w-full items-center gap-2 rounded-lg border border-border-subtle/70 bg-surface-0/82 px-2.5 py-1.5 text-left text-xs font-medium text-text-primary transition-colors hover:border-accent/25 hover:bg-accent/6 disabled:opacity-45">
                                          <NodeIcon className="size-3.5 shrink-0 text-text-muted" />
                                          <span className="truncate">{item.label}</span>
                                        </UiButton>)
                                    })}
                                  </div>
                                </div>))}
                            </div>
                          </ScrollArea>
                          <div className="rounded-xl border border-border-subtle/70 bg-surface-0/82 px-3 py-2 text-[11px] text-text-muted">
                            {runnableAgents.length === 0
                              ? t('agents.enableAgentBeforeStep', 'Configure at least one runnable agent before adding agent or condition nodes.')
                              : `${pipeline.length} ${t('agents.pipelineSteps', 'steps')}`}
                          </div>
                        </div>}
                        onInsertStepAfter={insertStepAfter}
                        onConnectSteps={connectPipelineSteps}
                        onDisconnectSteps={disconnectPipelineSteps}
                        topRightPanelContent={<UiButton unstyled type="button" onClick={() => setDesignDryRunOpen((current) => !current)} className="rounded-xl border border-border-subtle/70 bg-surface-1/96 p-2 text-text-secondary shadow-lg backdrop-blur-sm transition-colors hover:border-accent/25 hover:text-text-primary" aria-label={designDryRunOpen ? t('agents.closeDryRunPanel', 'Close dry run panel') : t('agents.openDryRunPanel', 'Open dry run panel')} title={designDryRunOpen ? t('agents.closeDryRunPanel', 'Close dry run panel') : t('agents.openDryRunPanel', 'Open dry run panel')}>
                          {designDryRunOpen ? <XIcon className="size-4" /> : <PlayIcon className="size-4" />}
                        </UiButton>}
                        rightPanelContent={designDryRunOpen ? <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border-subtle/70 bg-surface-1/95 p-2 shadow-xl">
                            <div className="flex items-center justify-between gap-2 border-b border-border-subtle/60 px-1 pb-2 text-xs font-semibold text-text-primary">
                              <div className="flex items-center gap-2">
                                <PlayIcon className="size-3.5 text-text-muted" />
                                {t('agents.pipelineDryRun', 'Dry run')}
                              </div>
                              <UiButton unstyled type="button" onClick={() => setDesignDryRunOpen(false)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-2/80 hover:text-text-primary" aria-label={t('agents.closeDryRunPanel', 'Close dry run panel')}>
                                <XIcon className="size-3.5" />
                              </UiButton>
                            </div>
                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1 text-text-secondary">
                              <div>
                                <p className="text-[11px] font-medium text-text-primary">{t('agents.pipelineDryRunInput', 'Input parameters')}</p>
                                <p className="mt-1 text-[10px] leading-4 text-text-muted">{t('agents.pipelineDryRunButtonHint', 'Simulate the run without calling any model.')}</p>
                              </div>
                              <textarea
                                value={designDryRunInput}
                                onChange={(event) => {
                                  setDesignDryRunInput(event.target.value)
                                  setDesignDryRunInputError(null)
                                }}
                                className="min-h-28 w-full rounded-xl border border-border-subtle/70 bg-surface-0/88 px-3 py-2 font-mono text-[11px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45"
                                placeholder='{"topic":"launch"}'
                                spellCheck={false}
                              />
                              {designDryRunInputError ? <div className="text-[10px] text-red-400">{designDryRunInputError}</div> : null}
                              <div className="grid gap-2 sm:grid-cols-2">
                                <UiButton unstyled type="button" onClick={runDesignDryRunPreview} disabled={pipeline.length === 0} className="rounded-xl bg-accent px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-45">{t('agents.pipelineDryRunButton', 'Dry run')}</UiButton>
                                <UiButton unstyled type="button" onClick={runOptimizationReview} disabled={pipeline.length === 0} className="rounded-xl border border-border-subtle/70 bg-surface-0/82 px-3 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-text-primary disabled:opacity-45">{t('agents.pipelineOptimize30', 'Optimize ×30')}</UiButton>
                              </div>
                              {dryRunResult ? <div className="rounded-xl border border-border-subtle/70 bg-surface-0/82 px-3 py-3">
                                  <div className="flex items-center justify-between gap-2 text-[10px] text-text-secondary">
                                    <span>{t('agents.pipelineDryRunProgress', 'Progress')}</span>
                                    <span>{dryRunResult.steps.filter((step) => step.status === 'would-run').length}/{dryRunResult.steps.length}</span>
                                  </div>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2/90">
                                    <div className="h-full rounded-full bg-accent" style={{ width: `${dryRunResult.steps.length === 0 ? 0 : (dryRunResult.steps.filter((step) => step.status === 'would-run').length / dryRunResult.steps.length) * 100}%` }} />
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-lg border border-border-subtle/70 bg-surface-1/80 px-2.5 py-2 text-[10px] text-text-secondary">{t('agents.pipelineWouldRun', 'Would run')}: {dryRunResult.steps.filter((step) => step.status === 'would-run').length}</div>
                                    <div className="rounded-lg border border-border-subtle/70 bg-surface-1/80 px-2.5 py-2 text-[10px] text-text-secondary">{t('agents.pipelineSkipped', 'Skipped')}: {dryRunResult.steps.filter((step) => step.status === 'skipped').length}</div>
                                    <div className="rounded-lg border border-border-subtle/70 bg-surface-1/80 px-2.5 py-2 text-[10px] text-text-secondary">{t('common.error', 'Error')}: {dryRunResult.steps.filter((step) => step.status === 'error').length}</div>
                                    <div className="rounded-lg border border-border-subtle/70 bg-surface-1/80 px-2.5 py-2 text-[10px] text-text-secondary">{t('common.disabled', 'Disabled')}: {dryRunResult.steps.filter((step) => step.status === 'disabled').length}</div>
                                  </div>
                                  {dryRunResult.visitedStepIndices?.length > 0 ? <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-text-secondary">
                                      <span>{t('agents.pipelineTraversedPath', 'Traversed path')}:</span>
                                      {dryRunResult.visitedStepIndices.map((stepIndex) => <span key={`design-dry-run-path-${stepIndex}`} className="rounded-full border border-border-subtle/70 bg-surface-1/80 px-2 py-0.5 font-mono">#{stepIndex + 1}</span>)}
                                    </div> : null}
                                </div> : null}
                              {pipelineVariables.filter((variable) => variable.name.trim()).length > 0 ? <div className="space-y-2">
                                  {pipelineVariables.filter((variable) => variable.name.trim()).map((variable) => (<div key={variable.name} className="rounded-xl border border-border-subtle/70 bg-surface-0/82 px-3 py-2">
                                      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">{variable.label?.trim() || variable.name}</div>
                                      <div className="mt-1 text-[11px] text-text-primary">{variableValues[variable.name] || variable.defaultValue || '—'}</div>
                                    </div>))}
                                </div> : <div className="rounded-xl border border-dashed border-border-subtle/70 px-3 py-3 text-[11px] text-text-muted">{t('agents.pipelineNoVariables', 'No variables declared yet.')}</div>}
                              {dryRunResult ? <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">{t('agents.pipelineFinalOutput', 'Final output')}</div>
                                      <div className="mt-1 text-[11px] text-emerald-900">{dryRunResult.steps[dryRunResult.steps.length - 1]?.name || t('agents.pipelineDryRunResultTitle', 'Dry run preview')}</div>
                                    </div>
                                    <UiButton unstyled type="button" onClick={() => { void copyDesignDryRunOutput(); }} className="rounded-lg border border-emerald-200/80 bg-white/65 px-2 py-1 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-white" aria-label={t('agents.copyDryRunOutput', 'Copy dry run output')}>
                                      {copiedDesignOutput ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                                    </UiButton>
                                  </div>
                                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-white/60 p-2 font-mono text-[10px] leading-4 text-emerald-950">{JSON.stringify({
                                    variables: dryRunResult.variables,
                                    output: dryRunResult.steps[dryRunResult.steps.length - 1] ?? null,
                                  }, null, 2)}</pre>
                                </div> : null}
                                {dryRunResult ? (<ol className="space-y-2 rounded-xl border border-border-subtle/70 bg-surface-0/84 px-3 py-3 text-[10px] text-text-secondary">
                                  {dryRunResult.steps.filter((step) => step.status === 'would-run' || step.status === 'error').map((step) => (<li key={step.stepIndex}>
                                      <span className="font-mono">#{step.stepIndex + 1}</span>{' '}
                                      <span className="uppercase tracking-[0.12em]">{step.status}</span>
                                      {step.reason ? <span className="ml-2 text-text-muted">— {step.reason}</span> : null}
                                    </li>))}
                                </ol>) : null}
                            </div>
                          </div> : selectedStep && selectedStepIndex !== null ? <div className="flex h-full min-h-0 flex-col gap-2 rounded-xl border border-border-subtle/70 bg-surface-1/95 p-2 shadow-xl">
                              <div className="border-b border-border-subtle/60 px-1 pb-2 text-xs font-semibold text-text-primary">{t('agents.pipelineNodeProperties', 'Node properties')}</div>
                              <div className="min-h-0 flex-1 overflow-y-auto">
                                <PipelineStepConfigPanel
                                  step={selectedStep}
                                  stepIndex={selectedStepIndex}
                                  totalSteps={pipeline.length}
                                  enabledAgents={enabledAgents.map((agent) => ({ id: agent.id, name: agent.name }))}
                                  agentNameMap={agentNameMap}
                                  models={models}
                                  previousOutput={selectedPreviousOutput}
                                  previewStep={selectedPreviewStep}
                                  onUpdateStep={updateStep}
                                  onMoveStep={moveStep}
                                  onDuplicateStep={duplicateStep}
                                  onRemoveStep={removeStep}
                                  onAppendReference={appendStepReference}
                                  formatDuration={formatDuration}
                                  normalizeRetryCount={normalizeRetryCount}
                                  t={t}
                                />
                              </div>
                            </div> : null}
                      />
                    </Suspense>
                  </div>
                </section>
              </div>) : (<div className="space-y-6">
                <section className="rounded-[28px] border border-border-subtle bg-surface-1/75 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineOperationalOverview', 'Operational overview')}</h2>
                      <p className="mt-1 text-xs text-text-muted">{t('agents.pipelineOperationalOverviewHint', 'Use this tab to review run history, fallback diagnostics, and detailed step handoffs once the pipeline has been executed.')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
                      <span className="rounded-full bg-surface-3 px-2.5 py-1">{pipelineHistory.length} {t('agents.pipelineRuns', 'runs')}</span>
                      <span className="rounded-full bg-surface-3 px-2.5 py-1">{monitorSteps.length || executionDetailSteps.length} {t('agents.pipelineSteps', 'steps')}</span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">
                    {selectedSavedPipeline
                      ? t('agents.pipelineOperationalSelectHint', 'Select a saved run on the right to inspect diagnostics and step handoffs.')
                      : t('agents.pipelineOperationalDraftHint', 'Save this draft to unlock run history and timer integrations, then inspect executions from the panels on the right.')}
                  </div>
                </section>
              </div>)}
          </div>

          {editorTab === 'others' ? (<aside className="min-h-0 border-t border-border-subtle xl:border-t-0 xl:border-l">
            <div className="module-canvas h-full overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                {editorTab === 'others' ? (<>
                <section className="rounded-[28px] border border-border-subtle bg-surface-1/75 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineWorkflowDiagram', 'Workflow diagram')}</h2>
                      <p className="mt-1 text-xs text-text-muted">{t('agents.pipelineWorkflowDiagramHint', 'Preview the pipeline as Mermaid, or copy the source into docs and markdown notes.')}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <UiButton unstyled type="button" onClick={() => setDiagramDialogOpen(true)} disabled={!hasPipelineSteps} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-accent disabled:opacity-45">
                        <IconifyIcon name="ui-export" size={13} color="currentColor"/>
                        {t('common.expand', 'Expand')}
                      </UiButton>
                      <UiButton unstyled type="button" onClick={() => void copyMermaidSource()} disabled={!hasPipelineSteps} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-accent disabled:opacity-45">
                        <IconifyIcon name={copiedMermaid ? 'ui-check' : 'ui-copy'} size={13} color="currentColor"/>
                        {copiedMermaid ? t('common.copied', 'Copied') : t('agents.copyMermaid', 'Copy Mermaid')}
                      </UiButton>
                    </div>
                  </div>

                  <div className="mt-4 inline-flex rounded-2xl border border-border-subtle bg-surface-2/60 p-1">
                    <UiButton unstyled type="button" onClick={() => setDiagramView('flow')} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${diagramView === 'flow' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'}`}>
                      {t('agents.pipelineDiagramFlow', 'Flow')}
                    </UiButton>
                    <UiButton unstyled type="button" onClick={() => setDiagramView('list')} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${diagramView === 'list' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'}`}>
                      {t('agents.pipelineDiagramList', 'List')}
                    </UiButton>
                    <UiButton unstyled type="button" onClick={() => setDiagramView('source')} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${diagramView === 'source' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'}`}>
                      {t('agents.pipelineDiagramSource', 'Mermaid')}
                    </UiButton>
                  </div>

                  <div className="mt-4">
                    {renderDiagramContent()}
                  </div>
                </section>

                {diagramDialogOpen && (<Dialog open={diagramDialogOpen} onClose={setDiagramDialogOpen} size="5xl" className="w-[min(96vw,1280px)] max-w-none overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 p-0 text-text-primary shadow-2xl ring-0">
                    <DialogBody className="mt-0">
                      <div className="flex items-center justify-between gap-3 border-b border-border-subtle/70 px-5 py-4">
                        <div>
                          <DialogTitle className="text-base font-semibold text-text-primary">{t('agents.pipelineWorkflowDiagram', 'Workflow diagram')}</DialogTitle>
                          <p className="mt-1 text-xs text-text-muted">{t('agents.pipelineWorkflowDiagramHint', 'Preview the pipeline as Mermaid, or copy the source into docs and markdown notes.')}</p>
                        </div>
                        <UiButton unstyled type="button" onClick={() => setDiagramDialogOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-subtle/55 bg-surface-0/72 text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent" aria-label={t('common.close', 'Close')}>
                          <IconifyIcon name="ui-close" size={14} color="currentColor"/>
                        </UiButton>
                      </div>
                      <div className="px-5 py-4">
                        {renderDiagramContent(true)}
                      </div>
                    </DialogBody>
                  </Dialog>)}

                {editorTab === 'others' ? (<>
                <section className="rounded-[28px] border border-border-subtle bg-surface-1/75 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineHistory', 'Execution History')}</h2>
                      <p className="mt-1 text-xs text-text-muted">{selectedSavedPipeline ? t('agents.pipelineHistoryHint', 'Recent executions for the selected saved pipeline.') : t('agents.pipelineHistoryHeaderHint', 'Execution history appears after you save this draft as a reusable pipeline.')}</p>
                    </div>
                    {selectedSavedPipeline && <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] text-text-secondary">{pipelineHistory.length}</span>}
                  </div>

                    {!selectedSavedPipeline ? (<div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">{t('agents.pipelineHistoryEmptyHint', 'Save the pipeline first to keep execution history and let timers reference it.')}</div>) : pipelineHistory.length === 0 ? (<div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">{t('agents.noPipelineHistory', 'No pipeline executions recorded yet.')}</div>) : (<div className="mt-4 space-y-3">
                      {pipelineHistory.slice(0, 20).map((execution) => {
                const engineLabel = formatPipelineExecutionEngineLabel(execution.runtime?.executionEngine, t);
                const fallbackLabel = formatPipelineExecutionFallbackReason(execution.runtime?.executionFallbackReason, t);
                return (<UiButton unstyled key={execution.id} type="button" onClick={() => setSelectedExecutionId(execution.id)} className={`w-full rounded-[22px] border p-4 text-left transition-all ${selectedExecutionId === execution.id ? 'border-accent/30 bg-accent/8 shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.12)]' : 'border-border bg-surface-0/40 hover:border-border-subtle hover:bg-surface-2/50'}`}>
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className={`rounded-full border px-2 py-0.5 font-medium ${statusStyles(execution.status)}`}>{t(`agents.pipelineStatus.${execution.status}`, execution.status)}</span>
                              <span className="text-text-muted">{new Date(execution.startedAt).toLocaleString()}</span>
                            </div>
                            <div className="mt-3 text-[11px] text-text-muted">{formatTriggerLabel(execution.trigger, t)} · {execution.steps.length} {t('agents.pipelineSteps', 'steps')} · {formatDuration(execution.completedAt - execution.startedAt, t)}</div>
                            {(engineLabel || fallbackLabel) && (<div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                                {engineLabel && (<span className="rounded-full border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-text-secondary">
                                    {t('agents.pipelineExecutionEngine', 'Execution engine')}: {engineLabel}
                                  </span>)}
                                {fallbackLabel && (<span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-warning">
                                    {fallbackLabel}
                                  </span>)}
                              </div>)}
                            {(execution.error || execution.finalOutput) && (<div className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-text-secondary">{execution.error || execution.finalOutput}</div>)}
                          </UiButton>);
            })}
                    </div>)}
                </section>

                <section className="rounded-[28px] border border-border-subtle bg-surface-1/75 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineExecutionDetails', 'Execution trace')}</h2>
                      <p className="mt-1 text-xs text-text-muted">{t('agents.pipelineExecutionDetailsHint', 'Inspect each node trace, including inputs, outputs, durations, warnings, and final output.')}</p>
                    </div>
                    {executionDetail && <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusStyles(executionDetail.status)}`}>{t(`agents.pipelineStatus.${executionDetail.status}`, executionDetail.status)}</span>}
                  </div>

                  {!executionDetail ? (<div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">{selectedSavedPipeline ? t('agents.pipelineSelectRunHint', 'Select a saved run to inspect the full handoff between steps.') : t('agents.pipelineRunDraftHint', 'Run the draft pipeline to review each step handoff here.')}</div>) : (<div className="mt-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineTrigger', 'Trigger')}</div>
                          <div className="mt-2 text-sm font-medium text-text-primary">{formatTriggerLabel(executionDetail.trigger, t)}</div>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineSucceeded', 'Succeeded')}</div>
                          <div className="mt-2 text-sm font-medium text-text-primary">{executionDetail.steps.filter((step) => step.status === 'success').length}/{executionDetail.steps.length}</div>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineErrors', 'Errors')}</div>
                          <div className="mt-2 text-sm font-medium text-text-primary">{executionDetail.steps.filter((step) => step.status === 'error').length}</div>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineExecutionEngine', 'Execution engine')}</div>
                          <div className="mt-2 text-sm font-medium text-text-primary">{executionDetailEngineLabel ?? '—'}</div>
                          {executionDetailFallbackLabel && (<div className="mt-1 text-xs text-warning">{executionDetailFallbackLabel}</div>)}
                        </div>
                      </div>

                      {(executionDetailFallbackLabel || executionDetailWarnings.length > 0) && (<div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                          <div className="font-medium">{t('agents.pipelineRoutingDiagnostics', 'Routing diagnostics')}</div>
                          <div className="mt-2 space-y-1">
                            {executionDetailFallbackLabel && <div>{executionDetailFallbackLabel}</div>}
                            {executionDetailWarnings.map((warning) => (<div key={warning}>{warning}</div>))}
                          </div>
                        </div>)}

                      {executionDetail.runtime?.visitedStepIndices && executionDetail.runtime.visitedStepIndices.length > 0 ? (<div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineTraversedPath', 'Traversed path')}</div>
                          <div className="mt-2 flex flex-wrap gap-2 text-sm text-text-secondary">
                            {executionDetail.runtime.visitedStepIndices.map((stepIndex) => <span key={`${executionDetail.id}-path-${stepIndex}`} className="rounded-full border border-border-subtle bg-surface-1/80 px-2.5 py-1 text-[11px]">#{stepIndex + 1}</span>)}
                          </div>
                        </div>) : null}

                      <div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineFinalOutput', 'Final output')}</div>
                            <div className="mt-2 text-sm text-text-secondary whitespace-pre-wrap">{executionDetail.finalOutput || executionDetail.error || t('agents.pipelineNoOutputYet', 'No output yet.')}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-text-muted">
                            <span>{formatDuration(executionDetail.completedAt - executionDetail.startedAt, t)}</span>
                            {executionDetail.usage && (<span className="rounded-full border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                                {formatUsageLabel(executionDetail.usage, t)}
                              </span>)}
                            {executionDetail.budgetExceeded && (<span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning" title={t('agents.pipelineBudgetExceededHint', 'Run aborted because a budget cap was exceeded.')}>
                                {t('agents.pipelineBudgetExceeded', 'Budget exceeded')}: {executionDetail.budgetExceeded.type} {executionDetail.budgetExceeded.observed}/{executionDetail.budgetExceeded.limit}
                              </span>)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {executionDetailSteps.map((step) => (<div key={`${executionDetail.id}-${step.stepIndex}`} className="rounded-[22px] border border-border bg-surface-0/40 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-text-primary">{step.name?.trim() || `${t('agents.pipelineStep', 'Step')} ${step.stepIndex + 1}`}</div>
                                <div className="mt-1 text-xs text-text-muted">{step.agentName || step.agentId}</div>
                                {step.usage && (<div className="mt-1 inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                                    {formatUsageLabel(step.usage, t)}
                                  </div>)}
                                {step.skipReason && step.status === 'skipped' && (<div className="mt-1 text-[11px] text-text-muted">{step.skipReason}</div>)}
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusStyles(step.status)}`}>{t(`agents.pipelineStatus.${step.status}`, step.status)}</span>
                            </div>
                            <div className="mt-3 grid gap-3">
                              <div className="rounded-2xl border border-border-subtle bg-surface-2/60 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineInput', 'Input')}</div>
                                <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm text-text-secondary">{step.input}</div>
                              </div>
                              <div className="rounded-2xl border border-border-subtle bg-surface-2/60 px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{step.status === 'skipped' ? t('agents.pipelineSkipped', 'Skipped') : (step.error ? t('agents.error', 'Error') : t('agents.output', 'Output'))}</div>
                                  <div className="text-[11px] text-text-muted">{formatDuration(step.durationMs, t)}{step.attempts && step.attempts > 1 ? ` · ${step.attempts} ${t('agents.pipelineAttempts', 'attempts')}` : ''}</div>
                                </div>
                                <div className={`mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm ${step.error && step.status !== 'skipped' ? 'text-red-300' : 'text-text-secondary'}`}>{step.error || step.output || t('agents.pipelineNoOutputYet', 'No output yet.')}</div>
                              </div>
                            </div>
                          </div>))}
                      </div>
                    </div>)}
                </section>
                </>) : null}
                </>) : null}
              </div>
            </div>
          </aside>) : null}
        </div>
      </div>
        {importDialogOpen && (<Dialog open={importDialogOpen} onClose={setImportDialogOpen} size="3xl" className="w-[min(92vw,960px)] max-w-none overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 p-0 text-text-primary shadow-2xl ring-0">
            <DialogBody className="mt-0 p-5">
              <DialogTitle className="text-base font-semibold text-text-primary">{t('agents.pipelineImport', 'Import JSON')}</DialogTitle>
              <div className="mt-2 text-xs text-text-muted">{t('agents.pipelineImportHint', 'Paste a workflow export or a bare pipeline JSON object to load it into the current draft.')}</div>
              <textarea value={importJsonText} onChange={(event) => { setImportJsonText(event.target.value); setImportJsonError(null); }} className="mt-4 min-h-72 w-full rounded-xl border border-border-subtle bg-surface-0/88 px-3 py-3 font-mono text-[12px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" placeholder='{"name":"Sample","steps":[...]}' spellCheck={false}/>
              {importJsonError ? <div className="mt-3 text-sm text-red-500">{importJsonError}</div> : null}
              <DialogActions className="mt-4">
                <UiButton unstyled type="button" onClick={() => setImportDialogOpen(false)} className="rounded-xl border border-border-subtle/70 bg-surface-0/82 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-text-primary">{t('common.cancel', 'Cancel')}</UiButton>
                <UiButton unstyled type="button" onClick={applyImportedPipeline} className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover">{t('agents.pipelineImportApply', 'Import')}</UiButton>
              </DialogActions>
            </DialogBody>
          </Dialog>)}
        {exportDialogOpen && (<Dialog open={exportDialogOpen} onClose={setExportDialogOpen} size="3xl" className="w-[min(92vw,960px)] max-w-none overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 p-0 text-text-primary shadow-2xl ring-0">
            <DialogBody className="mt-0 p-5">
              <DialogTitle className="text-base font-semibold text-text-primary">{t('agents.pipelineExport', 'Export JSON')}</DialogTitle>
              <div className="mt-2 text-xs text-text-muted">{t('agents.pipelineExportHint', 'Copy this portable workflow JSON to move the current draft across workspaces.')}</div>
              <textarea readOnly value={exportJson} className="mt-4 min-h-72 w-full rounded-xl border border-border-subtle bg-surface-0/88 px-3 py-3 font-mono text-[12px] text-text-primary outline-none" spellCheck={false}/>
              <DialogActions className="mt-4">
                <UiButton unstyled type="button" onClick={() => setExportDialogOpen(false)} className="rounded-xl border border-border-subtle/70 bg-surface-0/82 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-text-primary">{t('common.close', 'Close')}</UiButton>
                <UiButton unstyled type="button" onClick={() => { void copyExportJson(); }} className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover">{copiedExportJson ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}</UiButton>
              </DialogActions>
            </DialogBody>
          </Dialog>)}
        {assistantState && (<Suspense fallback={null}>
            <LazyPipelineAssistantDrawer mode={assistantState.mode} pipeline={assistantState.mode === 'edit' ? assistantPipeline : null} onClose={() => setAssistantState(null)} onPipelineMutated={() => { void handleAssistantPipelineMutated(); }}/>
          </Suspense>)}
    </>);
}


