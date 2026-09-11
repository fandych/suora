import { useEffect } from "react"
import { useNavigate, useParams } from "react-router"
import { EllipsisIcon, SlashIcon, Trash2Icon } from "lucide-react"

import { emitDataChanged } from "@/application/shared/data-events"
import { useAgentDetailStore } from "@/view-models/agents/agent-detail-store"
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
  const { draft, providers, skills, integrations, documents, workflows, isLoading, isUpdatingAvailability, isDeleting, error, load, updateDraft, save, toggleBinding, toggleAvailability, remove, reload } = useAgentDetailStore()
  const isReadOnly = Boolean(draft?.selectedVersion.isRelease)

  useEffect(() => {
    if (agentId) void load(agentId)
  }, [agentId, load])

  const handleSave = async () => { if (await save()) { emitDataChanged("/agents"); toast.add({ title: "Agent saved", type: "success" }) } }
  const handleToggleBinding = async (section: "workflows" | "integrations" | "skills" | "documents", itemId: string, checked: boolean) => { if (await toggleBinding(section, itemId, checked)) emitDataChanged("/agents") }
  const handleToggleAvailability = async () => { const wasDisabled = draft?.agent.isDisabled; if (await toggleAvailability()) { emitDataChanged("/agents"); toast.add({ title: wasDisabled ? "Agent enabled" : "Agent disabled", type: "success" }) } }
  const handleDelete = async () => { await remove(); if (!useAgentDetailStore.getState().draft) { emitDataChanged("/agents"); navigate("/agents"); toast.add({ title: "Agent deleted", type: "success" }) } }

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
              <AgentGeneralPanel draft={draft} isReadOnly={isReadOnly} models={providers} onChange={updateDraft} onSave={() => void handleSave()} />
              <AgentBindingsForm documents={documents} draft={draft} integrations={integrations} isReadOnly={isReadOnly} onToggle={(section, itemId, checked) => { void handleToggleBinding(section, itemId, checked) }} skills={skills} workflows={workflows} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AgentsDetailPage
