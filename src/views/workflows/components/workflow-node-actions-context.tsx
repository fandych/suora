import { createContext, useContext } from "react"

type WorkflowNodeActionsContextValue = {
  canEdit: boolean
  hasOutgoingConnection: (nodeId: string, sourceHandle: string | null) => boolean
  onAddNodeFromHandle: (sourceNodeId: string, sourceHandle: string | null, kind: string) => void
}

const WorkflowNodeActionsContext = createContext<WorkflowNodeActionsContextValue | null>(null)

export function WorkflowNodeActionsProvider({
  value,
  children,
}: {
  value: WorkflowNodeActionsContextValue
  children: React.ReactNode
}) {
  return <WorkflowNodeActionsContext.Provider value={value}>{children}</WorkflowNodeActionsContext.Provider>
}

export function useWorkflowNodeActions() {
  const value = useContext(WorkflowNodeActionsContext)
  if (!value) {
    return {
      canEdit: false,
      hasOutgoingConnection: () => false,
      onAddNodeFromHandle: () => undefined,
    }
  }

  return value
}