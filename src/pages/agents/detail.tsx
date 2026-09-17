import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { EllipsisIcon, SlashIcon, Trash2Icon } from "lucide-react"

import { emitDataChanged } from "@/services/data-events"
import { useAgentDetailStore } from "@/stores/agent-detail-store"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import { AgentLogoBadge } from "@/pages/agents/components/agent-logo-badge"
import PageHeader from "@/pages/components/page-header"
import { ConfirmDeleteDialog } from "@/pages/components/confirm-delete-dialog"
import { ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import { AgentBindingsForm } from "@/pages/agents/components/agent-bindings-form"
import { AgentGeneralPanel } from "@/pages/agents/components/agent-general-panel"

const AgentsDetailPage = () => {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const {
    draft,
    providers,
    skills,
    integrations,
    documents,
    workflows,
    isLoading,
    isUpdatingAvailability,
    error,
    load,
    updateDraft,
    save,
    toggleBinding,
    toggleAvailability,
    remove,
    reload,
  } = useAgentDetailStore()
  const isReadOnly = Boolean(draft?.selectedVersion.isRelease)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (agentId) void load(agentId)
  }, [agentId, load])

  const handleSave = async () => {
    if (await save()) {
      emitDataChanged("/agents")
      toast.add({ title: "Agent saved", type: "success" })
    }
  }
  const handleToggleBinding = async (
    section: "workflows" | "integrations" | "skills" | "documents",
    itemId: string,
    checked: boolean,
  ) => {
    if (await toggleBinding(section, itemId, checked)) emitDataChanged("/agents")
  }
  const handleToggleAvailability = async () => {
    const wasDisabled = draft?.agent.isDisabled
    if (await toggleAvailability()) {
      emitDataChanged("/agents")
      toast.add({ title: wasDisabled ? "Agent enabled" : "Agent disabled", type: "success" })
    }
  }
  const handleDelete = async () => {
    await remove()
    if (!useAgentDetailStore.getState().draft) {
      setIsDeleteDialogOpen(false)
      emitDataChanged("/agents")
      navigate("/agents")
      toast.add({ title: "Agent deleted", type: "success" })
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.agent.title ?? "Agent"}
        description={draft?.agent.summary || "No description"}
        leading={draft ? <AgentLogoBadge agent={draft.agent} className="size-9" iconClassName="size-4.5" /> : null}
        actions={
          draft ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" aria-label="Agent actions" title="Agent actions" />}
              >
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
                    <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                      <Trash2Icon />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />
      <div className="flex min-h-0 flex-1 overflow-hidden p-4">
        <div className="grid min-h-0 w-full min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {isLoading ? <LoadingCard title="Loading agent..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <>
              <AgentGeneralPanel
                draft={draft}
                isReadOnly={isReadOnly}
                models={providers}
                onChange={updateDraft}
                onSave={() => void handleSave()}
              />
              <AgentBindingsForm
                documents={documents}
                draft={draft}
                integrations={integrations}
                isReadOnly={isReadOnly}
                onToggle={(section, itemId, checked) => {
                  void handleToggleBinding(section, itemId, checked)
                }}
                skills={skills}
                workflows={workflows}
              />
            </>
          ) : null}
        </div>
      </div>
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => void handleDelete()}
        title="Delete agent"
        description="This permanently deletes the custom agent and all of its versions. This action cannot be undone."
      />
    </div>
  )
}

export default AgentsDetailPage
