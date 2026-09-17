import { NativeSelect } from "@/components/ui/native-select"
import { ResourceSelector } from "@/components/resource-selector"
import { WorkflowField } from "@/pages/workflows/components/workflow-field"
import type { ResourceSelectorOption } from "@/types/resource-selector"

type WorkflowNodeSelectProps = Omit<React.ComponentProps<typeof NativeSelect>, "children"> & {
  label: string
  hint?: string
  children: React.ReactNode
}

export function WorkflowNodeSelect({ label, hint, children, ...props }: WorkflowNodeSelectProps) {
  return (
    <WorkflowField label={label} hint={hint}>
      <NativeSelect size="sm" {...props}>
        {children}
      </NativeSelect>
    </WorkflowField>
  )
}

type WorkflowResourceSelectProps = Omit<React.ComponentProps<typeof ResourceSelector>, "options" | "emptyLabel"> & {
  emptyLabel: string
  label: string
  hint?: string
  options: ResourceSelectorOption[]
}

export function WorkflowResourceSelect({ label, hint, ...props }: WorkflowResourceSelectProps) {
  return (
    <WorkflowField label={label} hint={hint}>
      <ResourceSelector size="sm" {...props} />
    </WorkflowField>
  )
}
