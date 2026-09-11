export type WorkflowExecutionContext = Record<string, unknown> & {
  input: unknown
  vars: Record<string, unknown>
  steps: Record<string, unknown>
  current?: unknown
  $input?: unknown
  $vars?: unknown
  $steps?: unknown
  $current?: unknown
}
