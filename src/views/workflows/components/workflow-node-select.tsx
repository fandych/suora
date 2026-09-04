import { NativeSelect } from "@/components/ui/native-select"
import { WorkflowField } from "@/views/workflows/components/workflow-field"

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