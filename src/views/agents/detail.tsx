import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { EllipsisIcon, SlashIcon, Trash2Icon } from "lucide-react"

import { useAsyncResource } from "@/hooks/use-async-resource"
import type { AgentDetail } from "@/data/domain/models"
import { deleteAgent, getAgentDetail, saveAgentDraft, setSystemAgentDisabled } from "@/data/repositories/agent-repository"
import { listDocuments } from "@/data/repositories/document-repository"
import { listIntegrationSummaries } from "@/data/repositories/integration-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { listSkills } from "@/data/repositories/skill-repository"
import { listWorkflows } from "@/data/repositories/workflow-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import { AgentLogoBadge } from "@/views/agents/components/agent-logo-badge"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { AgentBindingsForm } from "@/views/agents/components/agent-bindings-form"
import { AgentGeneralPanel } from "@/views/agents/components/agent-general-panel"

const AgentsDetailPage = () => {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getAgentDetail(agentId ?? "", selectedVersionId), [agentId, selectedVersionId])
  const { data: providersData } = useAsyncResource(() => listConfiguredModelProviders(), [])
  const { data: skillsData } = useAsyncResource(() => listSkills(), [])
  const { data: integrationsData } = useAsyncResource(() => listIntegrationSummaries(), [])
  const { data: documentsData } = useAsyncResource(() => listDocuments(), [])
  const { data: workflowsData } = useAsyncResource(() => listWorkflows(), [])
  const [draft, setDraft] = useState<AgentDetail | null>(null)
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const providers = providersData ?? []
  const skills = skillsData ?? []
  const integrations = integrationsData ?? []
  const documents = documentsData ?? []
  const workflows = workflowsData ?? []
  const isReadOnly = Boolean(draft?.selectedVersion.isRelease)

  useEffect(() => {
    if (!data) {
      return
    }

    setDraft({
      ...data,
      config: {
        ...data.config,
        workflowIds: data.config.workflowIds ?? [],
        documentIds: data.config.documentIds ?? [],
      },
    })
  }, [data])

  const syncDraft = (next: AgentDetail) => {
    setData(next)
    setDraft({
      ...next,
      config: {
        ...next.config,
        workflowIds: next.config.workflowIds ?? [],
        documentIds: next.config.documentIds ?? [],
      },
    })
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handleSave = async () => {
    if (!draft || isReadOnly) {
      return
    }

    try {
      const next = await saveAgentDraft(draft, false)
      syncDraft(next)
      emitDataChanged("/agents")
      toast.add({ title: "Agent saved", type: "success" })
    } catch (error) {
      toast.add({ title: "Save failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    }
  }

  const handleToggleBinding = async (section: "workflows" | "integrations" | "skills" | "documents", itemId: string, checked: boolean) => {
    if (!draft || isReadOnly) {
      return
    }

    const toggleIds = (items: string[]) => checked ? (items.includes(itemId) ? items : [...items, itemId]) : items.filter((item) => item !== itemId)
    const nextDraft: AgentDetail = {
      ...draft,
      config: {
        ...draft.config,
        workflowIds: section === "workflows" ? toggleIds(draft.config.workflowIds ?? []) : (draft.config.workflowIds ?? []),
        toolsetIds: section === "integrations" ? toggleIds(draft.config.toolsetIds) : draft.config.toolsetIds,
        skillIds: section === "skills" ? toggleIds(draft.config.skillIds) : draft.config.skillIds,
        documentIds: section === "documents" ? toggleIds(draft.config.documentIds ?? []) : (draft.config.documentIds ?? []),
      },
    }

    setDraft(nextDraft)
    try {
      const saved = await saveAgentDraft(nextDraft, false)
      syncDraft(saved)
      emitDataChanged("/agents")
    } catch (error) {
      toast.add({ title: "Save failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    }
  }

  const handleToggleAvailability = async () => {
    if (!draft || draft.agent.source !== "system") {
      return
    }

    setIsUpdatingAvailability(true)
    try {
      await setSystemAgentDisabled(draft.agent.id, !draft.agent.isDisabled)
      syncDraft({
        ...draft,
        agent: { ...draft.agent, isDisabled: !draft.agent.isDisabled },
      })
      emitDataChanged("/agents")
      toast.add({ title: draft.agent.isDisabled ? "Agent enabled" : "Agent disabled", type: "success" })
    } catch (error) {
      toast.add({ title: "Update failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    } finally {
      setIsUpdatingAvailability(false)
    }
  }

  const handleDelete = async () => {
    if (!draft || draft.agent.source !== "custom") {
      return
    }

    setIsDeleting(true)
    try {
      await deleteAgent(draft.agent.id)
      emitDataChanged("/agents")
      navigate("/agents")
      toast.add({ title: "Agent deleted", type: "success" })
    } catch (error) {
      toast.add({ title: "Delete failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.agent.title ?? "Agent"}
        description={draft?.agent.summary || "No description"}
        leading={draft ? <AgentLogoBadge agent={draft.agent} className="size-9" iconClassName="size-4.5" /> : null}
        actions={draft ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Agent actions" title="Agent actions" />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 min-w-44">
              {draft.agent.source === "system" ? (
                <DropdownMenuGroup>
                  <DropdownMenuItem disabled={isUpdatingAvailability} onClick={() => void handleToggleAvailability()}>
                    <SlashIcon />
                    {draft.agent.isDisabled ? "Enable" : "Disable"}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              ) : null}
              {draft.agent.source === "custom" ? (
                <>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger render={<DropdownMenuItem variant="destructive" />}>
                      <Trash2Icon />
                      Delete
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogMedia>
                          <Trash2Icon />
                        </AlertDialogMedia>
                        <AlertDialogTitle>Delete agent</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes the custom agent and all of its versions. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={() => void handleDelete()}>
                          {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden p-4">
        <div className="grid min-h-0 w-full min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {isLoading ? <LoadingCard title="Loading agent..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <>
              <AgentGeneralPanel draft={draft} isReadOnly={isReadOnly} models={providers} onChange={setDraft} onSave={() => void handleSave()} />
              <AgentBindingsForm documents={documents} draft={draft} integrations={integrations} isReadOnly={isReadOnly} onToggle={(section, itemId, checked) => { void handleToggleBinding(section, itemId, checked) }} skills={skills} workflows={workflows} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AgentsDetailPage
